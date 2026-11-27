<script lang="ts">
	import { tick } from 'svelte';
	import { ChevronRight } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import { statusMeta, type StatusMeta } from '$lib/components/ui/status';
	import { formatStepDuration, type RailStep } from '$lib/components/ui/steprail';
	import { formatDuration, type BuildStep, type ParsedBuildLogs } from '$lib/utils/buildkitParser';
	import { isNoise, type BuildFailure, type BuildPhaseId } from '$lib/utils/build-failure';
	import {
		PHASE_ORDER,
		buildSections,
		sectionSteps,
		type BuildSection,
		type StageGroup,
		type StepItem
	} from '$lib/utils/build-sections';
	import { springCollapse, springRotate } from '$lib/utils/motion.svelte';

	let {
		parsed,
		running = false,
		failure = null,
		phases = [],
		settingsHref = null,
		crashHref = null,
		onnavigate = undefined
	}: {
		parsed: ParsedBuildLogs;
		running?: boolean;
		failure?: BuildFailure | null;
		phases?: RailStep[];
		settingsHref?: string | null;
		crashHref?: string | null;
		onnavigate?: () => void;
	} = $props();

	const LABEL: Record<BuildPhaseId, string> = {
		queue: 'Starting the builder',
		clone: 'Cloning the repo',
		build: 'Building the image',
		push: 'Pushing the image',
		deploy: 'Rolling out'
	};
	const DOT: Record<string, StatusMeta> = {
		running: statusMeta('progress', 'Running', true),
		done: statusMeta('success', 'Done'),
		cached: statusMeta('neutral', 'Cached'),
		error: statusMeta('error', 'Failed'),
		failed: statusMeta('error', 'Failed'),
		canceled: statusMeta('neutral', 'Canceled'),
		skipped: statusMeta('neutral', 'Skipped'),
		queued: statusMeta('info', 'Queued')
	};
	const STEP_TIME_RE = /^\d+\.\d{3}\s?/;
	const PREFIX_RE = /^\[(?:INFO|ERROR|WARNING)\]\s?/;
	const HEADING_RE = /^=+\s*.+?\s*=+$/;

	const sections = $derived.by(() => {
		const found = buildSections(parsed);
		const live = phases.filter((p) => p.status === 'running' || p.status === 'failed');
		const extra = live
			.map((p) => p.id as BuildPhaseId)
			.filter((id) => PHASE_ORDER.includes(id) && !found.some((s) => s.phase === id))
			.map((phase): BuildSection => ({ phase, items: [], steps: 0, cached: 0 }));
		return [...found, ...extra].sort(
			(a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase)
		);
	});
	const failedPhase = $derived(failure && !failure.canceled ? (failure.phase ?? null) : null);
	const failedStepKey = $derived(failure?.step && !failure.canceled ? `s:${failure.step.id}` : null);

	function phaseInfo(section: BuildSection) {
		const rail = phases.find((p) => p.id === section.phase);
		const hasError = sectionSteps(section).some((i) => i.step.status === 'error');
		const status =
			rail?.status ??
			(hasError || failedPhase === section.phase ? 'failed' : running ? 'running' : 'done');
		return {
			label: rail?.label ?? LABEL[section.phase],
			status,
			duration: rail?.durationMs ?? null
		};
	}

	let closed = $state<Record<string, boolean>>({});
	let open = $state<Record<string, boolean>>({});
	let scroller: HTMLDivElement | undefined = $state();
	let following = true;
	let revealed: string | null = null;

	$effect(() => {
		const key = failedStepKey ?? (failedPhase ? `p:${failedPhase}` : null);
		if (!key || key === revealed) return;
		revealed = key;
		if (failedStepKey) open[failedStepKey] = true;
		for (const section of sections) {
			for (const item of section.items) {
				if (item.kind === 'stage' && item.stage.items.some((s) => s.key === failedStepKey))
					closed[item.key] = false;
			}
		}
		const el = scroller;
		const content = el?.firstElementChild;
		if (!el || !content) return;
		const adjust = () => {
			const row =
				el.querySelector<HTMLElement>(`[data-key="${CSS.escape(failedStepKey ?? '')}"]`) ??
				el.querySelector<HTMLElement>('[data-failure]');
			if (!row) return;
			const box = el.getBoundingClientRect();
			const at = row.getBoundingClientRect();
			const top = at.top - box.top;
			const bottom = at.bottom - box.top;
			if (bottom > el.clientHeight) el.scrollTop += Math.min(top - 40, bottom - el.clientHeight);
		};
		const ro = new ResizeObserver(adjust);
		ro.observe(content);
		ro.observe(el);
		const stop = setTimeout(() => ro.disconnect(), 1500);
		return () => {
			clearTimeout(stop);
			ro.disconnect();
		};
	});

	$effect(() => {
		void sections.length;
		void parsed.steps.length;
		void parsed.messages.length;
		if (!running || !following || !scroller) return;
		const el = scroller;
		tick().then(() => (el.scrollTop = el.scrollHeight));
	});

	function onScroll() {
		if (!scroller) return;
		if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 4) following = true;
	}

	function userScroll(e: WheelEvent | KeyboardEvent | TouchEvent) {
		if (e instanceof WheelEvent && e.deltaY >= 0) return;
		if (e instanceof KeyboardEvent && !['ArrowUp', 'PageUp', 'Home'].includes(e.key)) return;
		following = false;
	}

	export async function focus(phase: string) {
		closed[phase] = false;
		await tick();
		const head = scroller?.querySelector<HTMLElement>(`[data-phase="${CSS.escape(phase)}"]`);
		if (head && scroller) {
			following = false;
			scroller.scrollTop += head.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
		}
	}

	function stepLabel(step: BuildStep): string {
		const where = step.stage ? `[${step.stage}${step.stagePos ? ` ${step.stagePos}` : ''}] ` : '';
		return `${where}${step.command || `step ${step.id}`}`;
	}

	function stageLabel(stage: StageGroup): string {
		if (stage.kind === 'setup') return 'Setup';
		if (stage.kind === 'export') return 'Export';
		return stage.name ?? 'Dockerfile';
	}

	function stageMeta(stage: StageGroup): string {
		const parts: string[] = [];
		if (stage.status === 'error') parts.push('Failed');
		else if (stage.status === 'canceled') parts.push('Canceled');
		parts.push(
			stage.cached
				? `${stage.cached} of ${stage.total} cached`
				: `${stage.total} ${stage.total === 1 ? 'step' : 'steps'}`
		);
		if (stage.durationSec !== null && stage.status !== 'running')
			parts.push(formatDuration(stage.durationSec));
		return parts.join(' · ');
	}

	function posWidth(stage: StageGroup): number {
		return Math.max(0, ...stage.items.map((i) => i.step.stagePos?.length ?? 0));
	}

	function stepLines(step: BuildStep): string[] {
		return step.output.map((l) => l.replace(STEP_TIME_RE, ''));
	}

	function isErrorLine(message: { level: string; text: string }): boolean {
		return message.level === 'ERROR' || /^\[ERROR\]/.test(message.text.trim());
	}

	function unseenEvidence(section: BuildSection): string[] {
		if (!failure) return [];
		const said = section.items
			.filter((i) => i.kind === 'line')
			.map((i) => (i.kind === 'line' ? i.message.text : ''))
			.join('\n');
		return failure.evidence.filter((line) => !said.includes(line));
	}

	function lineText(text: string): string {
		return text.trim().replace(PREFIX_RE, '');
	}

	const parts = (text: string) => text.split('`').map((t, i) => ({ text: t, code: i % 2 === 1 }));
</script>

{#snippet rich(text: string)}
	{#each parts(text) as part, i (i)}{#if part.code}<code>{part.text}</code>{:else}{part.text}{/if}{/each}
{/snippet}

{#snippet fix()}
	{#if failure && (failure.fix || failure.setting)}
		<div class="fix">
			<p class="fix-text">
				<strong>{@render rich(failure.title)}.</strong>
				{#if failure.fix}{@render rich(failure.fix)}{/if}
			</p>
			{#if failure.setting === 'source' && settingsHref}
				<Button size="sm" href={settingsHref} onclick={onnavigate}>Open Source & build</Button>
			{:else if failure.setting === 'crash' && crashHref}
				<Button size="sm" href={crashHref} onclick={onnavigate}>See the crash</Button>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet stepRow(item: StepItem, grouped: boolean)}
	{@const step = item.step}
	{@const hasOutput = step.output.length > 0 || !!step.error}
	{@const isOpen = !!open[item.key] && hasOutput}
	{@const label = grouped ? step.command || `step ${step.id}` : stepLabel(step)}
	<div class="step" data-key={item.key} data-status={step.status}>
		<button
			type="button"
			class="step-head"
			disabled={!hasOutput}
			aria-expanded={hasOutput ? isOpen : undefined}
			onclick={() => (open[item.key] = !open[item.key])}
		>
			<span class="arrow" aria-hidden="true">=&gt;</span>
			{#if grouped && step.stagePos}<span class="pos">{step.stagePos ?? ''}</span>{/if}
			<span class="step-label" title={label}>{label}</span>
			<span class="step-time">
				{#if step.status === 'error'}ERROR
				{:else if step.status === 'canceled'}CANCELED
				{:else if step.status === 'cached'}<span class="cached">CACHED</span>
				{:else if step.status === 'running'}<StatusDot meta={DOT.running} label="Running" />
				{:else if step.durationSec !== null}{formatDuration(step.durationSec)}{/if}
			</span>
		</button>
		{#if isOpen}
			<div class="output">
				{#each stepLines(step) as line, i (i)}<p class="line line--out">{line || ' '}</p>{/each}
				{#if step.error}<p class="line line--error">ERROR: {step.error}</p>{/if}
			</div>
			{#if item.key === failedStepKey}{@render fix()}{/if}
		{/if}
	</div>
{/snippet}

<div
	class="term"
	bind:this={scroller}
	onscroll={onScroll}
	onwheel={userScroll}
	ontouchmove={userScroll}
	onkeydown={userScroll}
	tabindex="-1"
	role="log"
>
	<div class="sections">
		{#each sections as section (section.phase)}
			{@const info = phaseInfo(section)}
			{@const isClosed = !!closed[section.phase]}
			<section class="section" data-status={info.status}>
				<button
					type="button"
					class="section-head"
					data-phase={section.phase}
					aria-expanded={!isClosed}
					onclick={() => (closed[section.phase] = !isClosed)}
				>
					<span
						class="chev"
						aria-hidden="true"
						{@attach springRotate(() => !isClosed, { rest: 0, on: 90 })}
						><ChevronRight size={14} /></span
					>
					<StatusDot meta={DOT[info.status] ?? DOT.done} label={(DOT[info.status] ?? DOT.done).label} />
					<span class="section-label">{info.label}</span>
					<span class="section-meta"
						>{#if section.steps}{section.steps}
							{section.steps === 1 ? 'step' : 'steps'}{#if section.cached}
								· {section.cached} cached{/if}{/if}</span
					>
					<span class="section-time"
						>{#if info.duration != null}{formatStepDuration(info.duration)}{/if}</span
					>
				</button>
				<div class="fold" inert={isClosed} {@attach springCollapse(() => isClosed)}>
					<div class="lines">
						{#each section.items as item (item.key)}
							{#if item.kind === 'line'}
								{@const text = lineText(item.message.text)}
								{#if text && !isNoise(text) && !HEADING_RE.test(text)}
									<p class="line" class:line--error={isErrorLine(item.message)}>{text}</p>
								{/if}
							{:else if item.kind === 'stage'}
								{@const stage = item.stage}
								{@const stageClosed = !!closed[item.key]}
								<div class="stage" data-kind={stage.kind} data-status={stage.status}>
									<button
										type="button"
										class="stage-head"
										aria-expanded={!stageClosed}
										onclick={() => (closed[item.key] = !stageClosed)}
									>
										<span
											class="stage-chev"
											aria-hidden="true"
											{@attach springRotate(() => !stageClosed, { rest: 0, on: 90 })}
											><ChevronRight size={12} /></span
										>
										<span class="stage-name" title={stageLabel(stage)}>{stageLabel(stage)}</span>
										<span class="stage-meta">{stageMeta(stage)}</span>
									</button>
									<div class="fold" inert={stageClosed} {@attach springCollapse(() => stageClosed)}>
										<div class="stage-steps" style:--pos-w="{posWidth(stage)}ch">
											{#each stage.items as child (child.key)}
												{@render stepRow(child, true)}
											{/each}
										</div>
									</div>
								</div>
							{:else}
								{@render stepRow(item, false)}
							{/if}
						{/each}
						{#if !section.items.length && info.status === 'running'}
							<p class="line line--out">Waiting for output</p>
						{/if}
						{#if failure && !failure.step && !failure.canceled && failedPhase === section.phase}
							<div class="failure" data-failure>
								{#each unseenEvidence(section) as line, i (i)}<p class="line line--error">{line}</p>{/each}
								{@render fix()}
							</div>
						{/if}
					</div>
				</div>
			</section>
		{:else}
			<p class="empty">Waiting for build output</p>
		{/each}
	</div>
</div>

<style>
	.term {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		line-height: 1.25rem;
		color: var(--console-text);
		font-variant-ligatures: none;
	}
	.sections {
		display: flex;
		flex-direction: column;
	}
	.section:not(:first-child) {
		border-top: 1px solid var(--console-edge);
	}
	.section-head {
		position: sticky;
		top: 0;
		z-index: 1;
		display: grid;
		grid-template-columns: 0.875rem 0.5rem minmax(0, 1fr) auto 3rem;
		column-gap: 0.625rem;
		align-items: center;
		width: 100%;
		min-height: 2.5rem;
		padding: 0 1rem 0 0.75rem;
		background: var(--console-bg);
		box-sizing: border-box;
		font-family: var(--font-sans);
		font-size: var(--text-callout);
		text-align: left;
		color: var(--text-default);
	}
	.section-head:hover {
		background: color-mix(in oklab, var(--console-bg) 92%, var(--ink));
	}
	.section-head:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.chev {
		display: grid;
		place-items: center;
		color: var(--text-faint);
	}
	.section-label {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-weight: var(--weight-medium);
	}
	.section[data-status='failed'] .section-label {
		color: var(--status-error);
	}
	.section[data-status='queued'] .section-label,
	.section[data-status='skipped'] .section-label {
		color: var(--text-faint);
	}
	.section-meta,
	.section-time {
		font-size: var(--text-footnote);
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
	}
	.section-time {
		text-align: right;
	}
	.fold {
		overflow: hidden;
	}
	.lines {
		display: flex;
		flex-direction: column;
		padding: 0 0.625rem 0.75rem 2.5rem;
	}
	.line {
		color: var(--console-text);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.line--out {
		color: var(--text-muted);
	}
	.line--error {
		color: var(--status-error);
	}
	.stage:not(:first-child),
	.stage + :not(.stage) {
		margin-top: 0.5rem;
	}
	.stage-head {
		display: grid;
		grid-template-columns: 0.75rem minmax(0, 1fr) auto;
		column-gap: 0.5rem;
		align-items: center;
		width: 100%;
		min-height: 1.75rem;
		padding: 0 0.375rem;
		border-radius: 0.375rem;
		text-align: left;
		color: var(--text-default);
	}
	.stage-head:hover {
		background: color-mix(in oklab, var(--console-bg) 90%, var(--ink));
	}
	.stage-head:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.stage-chev {
		display: grid;
		place-items: center;
		color: var(--text-faint);
	}
	.stage-name {
		min-width: 0;
		overflow-x: clip;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-weight: var(--weight-medium);
	}
	.stage[data-kind='setup'] .stage-name,
	.stage[data-kind='export'] .stage-name {
		font-family: var(--font-sans);
		color: var(--text-muted);
	}
	.stage[data-status='error'] .stage-name {
		color: var(--status-error);
	}
	.stage-meta {
		font-family: var(--font-sans);
		font-size: var(--text-footnote);
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
	}
	.stage-steps {
		padding-left: 1.25rem;
	}
	.pos {
		flex-shrink: 0;
		min-width: var(--pos-w);
		text-align: right;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.step-head {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		width: 100%;
		padding: 0 0.375rem;
		border-radius: 0.375rem;
		text-align: left;
		color: var(--console-text);
	}
	.step-head:not(:disabled):hover {
		background: color-mix(in oklab, var(--console-bg) 90%, var(--ink));
	}
	.step-head:disabled {
		cursor: default;
	}
	.step-head:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.arrow {
		color: var(--text-faint);
	}
	.step[data-status='done'] .arrow {
		color: var(--status-success);
	}
	.step[data-status='running'] .arrow {
		color: var(--status-progress);
	}
	.step[data-status='error'] .arrow,
	.step[data-status='error'] .step-label,
	.step[data-status='error'] .step-time {
		color: var(--status-error);
	}
	.cached {
		color: var(--text-faint);
	}
	.step[data-status='cached'] .step-label {
		color: var(--text-muted);
	}
	.step-label {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.arrow,
	.step-time {
		flex-shrink: 0;
	}
	.step-time {
		display: inline-flex;
		align-items: center;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.output {
		padding: 0.125rem 0 0.375rem 1.5rem;
	}
	.failure {
		padding-top: 0.125rem;
	}
	.fix {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0.5rem 0 0.25rem;
		padding: 0.625rem 0.75rem;
		border-radius: calc(0.625rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow: var(--shadow-raised);
		font-family: var(--font-sans);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
	}
	.fix-text {
		flex: 1 1 auto;
		min-width: 0;
		color: var(--text-default);
	}
	.fix-text strong {
		font-weight: var(--weight-semibold);
	}
	code {
		font-family: var(--font-mono);
		font-size: 0.92em;
	}
	.empty {
		padding: 2rem 1rem;
		text-align: center;
		font-family: var(--font-sans);
		color: var(--text-faint);
	}
</style>

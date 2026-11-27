<script lang="ts">
	import {
		Copy,
		FileText,
		RotateCcw,
		SquareArrowOutUpRight,
		SquareTerminal,
		Trash2,
		X
	} from 'lucide-svelte';
	import { Button, Stepper, StatusDot, statusMeta } from '$lib/components/ui';
	import Widget from '$lib/components/ui/Widget.svelte';
	import type { StatusMeta } from '$lib/components/ui';
	import { toasts } from '$lib/stores';
	import { formatCpu, formatMemory, humanizeWarning } from '$lib/utils/format';
	import type { Pod } from '$lib/types/deployment';
	import PodSimulator from './PodSimulator.svelte';
	import IslandPill from '$lib/components/patterns/IslandPill.svelte';
	import type { ClassifiedPod } from '$health';
	import IslandSheet from '$lib/components/patterns/IslandSheet.svelte';

	type PodWarning = { podName?: string; message: string };

	let {
		deploymentId,
		pods,
		warnings,
		replicas,
		scaleReplicas = $bindable(),
		scaling,
		drift,
		selectedPod,
		podLabel,
		podHref,
		onScale,
		onChange,
		onSelect,
		onCrashLogs,
		onShell,
		onDelete,
		onSimulated,
		versions = []
	}: {
		deploymentId: string;
		pods: Pod[];
		warnings: PodWarning[];
		replicas: number;
		scaleReplicas: number;
		scaling: boolean;
		drift: { stopped: boolean; observed: number; desired: number } | null;
		selectedPod: string;
		podLabel: (name: string) => string;
		podHref: (name: string) => string;
		onScale: () => void;
		onChange: (value: number) => void;
		onSelect: (pod: Pod) => void;
		onCrashLogs: (pod: Pod) => void;
		onShell: (podName: string, container: string) => void;
		onDelete: (name: string) => void;
		onSimulated: () => void;
		versions?: ClassifiedPod[];
	} = $props();

	type PodState = { label: string; hint: string | null; meta: StatusMeta };

	const meta = statusMeta;

	const SHORT: Record<string, string> = {
		"Can't pull container image": 'Image pull failed',
		'Not ready for traffic': 'Not ready',
		'No available nodes': 'Waiting for room',
		"Couldn't place the pod on a node": 'Waiting for room',
		'Pod evicted': 'Evicted',
		'Health check failing': 'Failing health check',
		'App taking too long to start': 'Slow to start'
	};

	const STATUS_LABEL: Record<string, string> = {
		ready: 'Running',
		starting: 'Starting',
		scheduled: 'Starting',
		pending: 'Waiting to start',
		crashing: 'Crashing',
		terminating: 'Shutting down',
		failed: 'Stopped',
		succeeded: 'Finished'
	};

	const STATUS_HINT: Record<string, string> = {
		ready: 'Serving traffic',
		starting: 'Booting up',
		scheduled: 'Booting up',
		pending: 'Waiting for a place to run',
		terminating: 'Replaced by a newer pod'
	};

	function kindOf(status: string): StatusMeta['kind'] {
		if (status === 'ready' || status === 'succeeded') return 'success';
		if (status === 'crashing' || status === 'failed') return 'error';
		if (status === 'terminating') return 'neutral';
		return 'progress';
	}

	function stateOf(pod: Pod): PodState {
		const status = (pod.status ?? '').toLowerCase();
		const kind = kindOf(status);
		const pulse = kind === 'progress';
		if (status === 'ready' || status === 'terminating') {
			return {
				label: STATUS_LABEL[status],
				hint: STATUS_HINT[status],
				meta: meta(kind, STATUS_LABEL[status], pulse)
			};
		}
		const termination = pod.containers?.find((c) => c.lastTermination)?.lastTermination;
		if (termination?.reason === 'OOMKilled') {
			return {
				label: 'Out of memory',
				hint: humanizeWarning('OOMKilled')?.hint ?? null,
				meta: meta('error', 'Out of memory')
			};
		}
		const lines = warnings.filter((w) => w.podName === pod.name).map((w) => w.message);
		for (const line of lines) {
			const what = line.match(/(secret|configmap) "([^"]+)" not found/i);
			if (what) {
				const thing = what[1].toLowerCase() === 'secret' ? 'secret' : 'config';
				return {
					label: `Missing ${thing}`,
					hint: `Needs ${what[1].toLowerCase()} "${what[2]}", which doesn't exist.`,
					meta: meta('error', `Missing ${thing}`)
				};
			}
		}
		for (const line of lines) {
			const h = humanizeWarning(line);
			if (!h || h.severity === 'info') continue;
			const base = h.title.split(' — ')[0];
			const label = SHORT[base] ?? base;
			const tone = h.severity === 'warning' || kind === 'progress' ? 'warning' : 'error';
			return { label, hint: h.hint, meta: meta(tone, label) };
		}
		if (termination && termination.reason !== 'Completed') {
			const label =
				termination.exitCode != null ? `Exited with ${termination.exitCode}` : termination.reason;
			return { label, hint: null, meta: meta('error', label) };
		}
		const label =
			STATUS_LABEL[status] ?? (status ? status[0].toUpperCase() + status.slice(1) : 'Unknown');
		return { label, hint: STATUS_HINT[status] ?? null, meta: meta(kind, label, pulse) };
	}

	function uptime(start?: string | null) {
		if (!start) return null;
		const s = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 1000));
		const d = Math.floor(s / 86400);
		const h = Math.floor((s % 86400) / 3600);
		const m = Math.floor((s % 3600) / 60);
		if (d) return h ? `${d}d ${h}h` : `${d}d`;
		if (h) return m ? `${h}h ${m}m` : `${h}h`;
		return m ? `${m}m` : 'just now';
	}

	const RANK: Record<string, number> = {
		error: 0,
		warning: 1,
		progress: 2,
		neutral: 3,
		info: 3,
		success: 4
	};

	const rows = $derived(
		pods
			.map((pod) => {
				const state = stateOf(pod);
				const restarts = pod.restartCount ?? 0;
				const up = uptime(pod.startTime);
				const healthy = state.meta.kind === 'success' || state.meta.kind === 'neutral';
				const detail = healthy
					? up && `up ${up}`
					: restarts
						? `restarted ${restarts} ${restarts === 1 ? 'time' : 'times'}`
						: null;
				const usage =
					pod.cpuUsage != null && pod.cpuUsage > 0
						? `${formatCpu(pod.cpuUsage)} CPU, ${formatMemory(pod.memoryUsage)}`
						: null;
				const tip = [state.label, state.hint, detail, usage].filter(Boolean).join(' · ');
				const term = pod.containers?.find((c) => c.lastTermination)?.lastTermination;
				const exit = term
					? `${term.reason === 'OOMKilled' ? 'Out of memory' : term.reason}${term.exitCode != null ? ` (${term.exitCode})` : ''}`
					: null;
				return { pod, name: podLabel(pod.name), state, restarts, detail, tip, exit };
			})
			.sort((a, b) => (RANK[a.state.meta.kind] ?? 5) - (RANK[b.state.meta.kind] ?? 5))
	);

	type Row = (typeof rows)[number];
	const versionMap = $derived(new Map(versions.map((v) => [v.name, v])));
	const versionOf = (name: string) => versionMap.get(name) ?? null;
	let scaleTimer: ReturnType<typeof setTimeout> | undefined;

	function queueScale(value: number) {
		onChange(value);
		clearTimeout(scaleTimer);
		scaleTimer = setTimeout(() => {
			if (value !== replicas) onScale();
		}, 700);
	}

	$effect(() => () => clearTimeout(scaleTimer));

	const problems = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const r of rows) {
			if (r.state.meta.kind === 'success' || r.state.meta.kind === 'neutral') continue;
			counts.set(r.state.label, (counts.get(r.state.label) ?? 0) + 1);
		}
		return [...counts].map(([label, n]) => `${n} ${label.toLowerCase()}`);
	});
	let openName = $state<string | null>(null);
	let sheet = $state<IslandSheet>();
	const pills: Record<string, HTMLButtonElement | undefined> = $state({});
	const openRow = $derived(rows.find((r) => r.pod.name === openName) ?? null);

	$effect(() => {
		if (openName && !openRow) openName = null;
	});

	function toneOf(kind: StatusMeta['kind']): 'ok' | 'warn' | 'bad' {
		if (kind === 'error') return 'bad';
		if (kind === 'warning' || kind === 'progress') return 'warn';
		return 'ok';
	}

	async function copyName(name: string) {
		await navigator.clipboard.writeText(name);
		toasts.add({ title: 'Pod name copied', color: 'success' });
	}
</script>

{#snippet podFace(r: Row, tone: 'ok' | 'warn' | 'bad')}
	{@const v = versionOf(r.pod.name)}
	<span class="glyph">
		<StatusDot
			meta={r.state.meta}
			size={8}
			tone={v?.version === 'new' && r.state.meta.kind === 'progress' ? 'deploy' : undefined}
		/>
	</span>
	<span class="pid">{r.name}</span>
	{#if v?.version && v.revision}
		<span class="ver ver--{v.version}"
			>v{v.revision}{v.version === 'new'
				? ' new'
				: v.version === 'replaced'
					? ' replaced'
					: ''}</span
		>
	{/if}
	{#if r.pod.name === selectedPod}<span class="logs-tag">Logs</span>{/if}
	<span class="face-end" class:face-end--tone={tone !== 'ok'}>
		{#if tone === 'ok'}
			{r.pod.cpuUsage
				? `${formatCpu(r.pod.cpuUsage)} · ${formatMemory(r.pod.memoryUsage)}`
				: r.state.label}
		{:else}
			{r.state.label}{#if r.restarts}&nbsp;· {r.restarts}×{/if}
		{/if}
	</span>
{/snippet}

{#snippet controls()}
	<Stepper
		bind:value={scaleReplicas}
		min={0}
		max={20}
		size="sm"
		shape="capsule"
		suffix={scaleReplicas === 1 ? 'replica' : 'replicas'}
		label="Replicas"
		disabled={scaling}
		onchange={queueScale}
	/>
	{#if __ORCHARD_MOCK__}
		<PodSimulator {deploymentId} {podLabel} onchange={onSimulated} />
	{/if}
{/snippet}

<Widget title="Pods" meta={controls} fill class="pods">
	{#if rows.length}
		<ul class="islands" aria-label="Pods">
			{#each rows as r (r.pod.name)}
				<li>
					<IslandPill
						bind:el={pills[r.pod.name]}
						tone={toneOf(r.state.meta.kind)}
						label="{r.name}, {r.state.label}"
						expanded={openName === r.pod.name}
						onclick={() => (openName = r.pod.name)}
					>
						{@render podFace(r, toneOf(r.state.meta.kind))}
					</IslandPill>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">Pods show up here once the first one is scheduled.</p>
	{/if}
	{#if openRow}
		{@const r = openRow}
		{@const tone = toneOf(r.state.meta.kind)}
		{@const container = r.pod.containers?.[0]?.name ?? ''}
		{#key r.pod.name}
			<IslandSheet
				bind:this={sheet}
				origin={pills[r.pod.name] ?? null}
				{tone}
				onclose={() => (openName = null)}
			>
				<div class="sheet-head">
					{@render podFace(r, tone)}
					<Button
						variant="ghost"
						size="sm"
						icon={X}
						label="Close {r.name}"
						onclick={() => sheet?.close()}
					/>
				</div>
				<dl class="kv">
					<div>
						<dt>Uptime</dt>
						<dd>{uptime(r.pod.startTime) ?? '-'}</dd>
					</div>
					<div>
						<dt>Restarts</dt>
						<dd>{r.restarts}</dd>
					</div>
					<div>
						<dt>CPU</dt>
						<dd>{r.pod.cpuUsage ? formatCpu(r.pod.cpuUsage) : '-'}</dd>
					</div>
					<div>
						<dt>Memory</dt>
						<dd>{r.pod.cpuUsage ? formatMemory(r.pod.memoryUsage) : '-'}</dd>
					</div>
					{#if r.exit}
						<div class="kv-wide">
							<dt>Last exit</dt>
							<dd class="kv-tone">{r.exit}</dd>
						</div>
					{/if}
				</dl>
				<div class="acts">
					<Button variant="secondary" size="sm" icon={FileText} onclick={() => onSelect(r.pod)}
						>Logs</Button
					>
					{#if r.pod.containers?.some((c) => c.lastTermination)}
						<Button variant="ghost" size="sm" icon={RotateCcw} onclick={() => onCrashLogs(r.pod)}
							>Before crash</Button
						>
					{/if}
					<Button
						variant="ghost"
						size="sm"
						icon={SquareTerminal}
						disabled={r.pod.status?.toLowerCase() !== 'ready' || !container}
						onclick={() => onShell(r.pod.name, container)}>Shell</Button
					>
					<span class="acts-end">
						<Button
							variant="ghost"
							size="sm"
							icon={Copy}
							label="Copy pod name"
							onclick={() => copyName(r.pod.name)}
						/>
						<Button
							variant="ghost"
							size="sm"
							icon={SquareArrowOutUpRight}
							label="Pod details"
							href={podHref(r.pod.name)}
						/>
						<Button
							variant="ghost"
							size="sm"
							icon={Trash2}
							label="Delete pod. Kubernetes starts a new one."
							onclick={() => onDelete(r.pod.name)}
						/>
					</span>
				</div>
			</IslandSheet>
		{/key}
	{/if}
</Widget>

<style>
	.islands {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.glyph {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 1rem;
		height: 1rem;
	}
	.pid {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
		font-weight: var(--weight-medium);
		text-box: trim-both cap alphabetic;
	}
	.ver {
		padding: 0.125rem 0.375rem;
		border-radius: calc(0.3125rem * var(--corner-scale));
		corner-shape: var(--corner);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-micro);
		font-weight: var(--weight-medium);
		white-space: nowrap;
	}
	.ver--new {
		background: var(--status-deploy-bg);
		color: var(--status-deploy);
	}
	.ver--old {
		background: var(--bg-active);
		color: var(--text-muted);
	}
	.ver--replaced {
		color: var(--text-faint);
		text-decoration: line-through;
	}
	.logs-tag {
		padding: 0.125rem 0.375rem;
		border-radius: calc(0.3125rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-active);
		color: var(--island-muted);
		font-size: var(--text-micro);
		font-weight: var(--weight-medium);
	}
	.face-end {
		margin-left: auto;
		overflow: hidden;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		color: var(--island-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.face-end--tone {
		font-family: inherit;
		font-size: var(--text-footnote);
		font-weight: var(--weight-medium);
		color: var(--island-tone);
	}
	.sheet-head {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-height: 1.75rem;
		margin: -0.25rem -0.375rem 0.75rem 0;
	}
	.sheet-head .pid {
		font-size: var(--text-callout);
	}
	.sheet-head .face-end {
		margin-right: 0.25rem;
	}
	.kv {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem 1.5rem;
		margin: 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--island-rule);
	}
	.kv > div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	.kv .kv-wide {
		grid-column: 1 / -1;
	}
	.kv dt {
		font-size: var(--text-footnote);
		color: var(--island-muted);
	}
	.kv dd {
		margin: 0;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
		color: var(--island-fg);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.kv .kv-tone {
		color: var(--island-tone);
	}
	.acts {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: auto;
		padding-top: 0.75rem;
	}
	.acts-end {
		display: flex;
		gap: 0.125rem;
		margin-left: auto;
	}
	.empty {
		font-size: var(--text-callout);
		color: var(--text-muted);
	}
</style>

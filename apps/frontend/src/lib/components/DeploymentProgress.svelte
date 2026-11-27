<script lang="ts">
	import { page } from '$app/state';
	import { Alert, StatusDot, StepRail, statusMeta } from '$lib/components/ui';
	import GoldenReticle from '$lib/components/ui/GoldenReticle.svelte';
	import type { DotStep } from '$lib/components/ui/StatusDot.svelte';
	import type { RailStep } from '$lib/components/ui/steprail';
	import { ansiBuildLines } from '$lib/utils/log-sources.svelte';
	import { createBuildkitParser } from '$lib/utils/buildkitParser';
	import { diagnoseBuild, type BuildPhaseId } from '$lib/utils/build-failure';
	import { formatPhase } from './deployment/build-phases';
	import BuildLog from './deployment/build/BuildLog.svelte';

	interface Props {
		status: string;
		buildStatus?: string;
		buildStep?: string | null;
		buildLogs?: string | null;
		buildError?: string | null;
		isGitHubDeploy: boolean;
		warnings?: Array<{ podName: string; message: string; timestamp: string }>;
		buildStepTimestamps?: Record<string, number> | null;
		settingsHref?: string | null;
		crashHref?: string | null;
		onsettings?: () => void;
	}

	let {
		buildStatus = 'none',
		buildStep,
		buildLogs,
		buildError,
		isGitHubDeploy,
		warnings,
		buildStepTimestamps,
		settingsHref = null,
		crashHref = null,
		onsettings = undefined
	}: Props = $props();

	function sanitizeLogs(logs: string | null | undefined): string {
		if (!logs) return '';

		let sanitized = logs;

		sanitized = sanitized.replace(
			/(x-access-token:|ghs_|ghp_|github_pat_)[a-zA-Z0-9_]+/gi,
			'***REDACTED***'
		);

		sanitized = sanitized.replace(
			/https?:\/\/[^:@\s]+:[^@\s]+@github\.com/gi,
			'https://***@github.com'
		);

		sanitized = sanitized.replace(/https?:\/\/[^@\s]+@github\.com/gi, 'https://***@github.com');

		sanitized = sanitized.replace(
			/(Bearer|Token|Authorization:)\s+[a-zA-Z0-9_\-.]+/gi,
			'$1 ***REDACTED***'
		);

		sanitized = sanitized.replace(
			/(password|passwd|pwd|secret|key|token)[\s]*[=:]['"]?([^\s'"]+)/gi,
			'$1=***REDACTED***'
		);

		return sanitized;
	}

	// Build logs are grow-only: sanitize only content appended since the last
	// call, re-running from the last committed newline so a secret can't
	// straddle the boundary.
	let sanRawPrefix = '';
	let sanOutPrefix = '';
	function sanitizeGrowing(raw: string | null | undefined): string {
		if (!raw) return '';
		if (!raw.startsWith(sanRawPrefix)) {
			sanRawPrefix = '';
			sanOutPrefix = '';
		}
		const suffix = raw.slice(sanRawPrefix.length);
		const nl = suffix.lastIndexOf('\n');
		if (nl >= 0) {
			sanOutPrefix += sanitizeLogs(suffix.slice(0, nl + 1));
			sanRawPrefix = raw.slice(0, sanRawPrefix.length + nl + 1);
			return sanOutPrefix + sanitizeLogs(suffix.slice(nl + 1));
		}
		return sanOutPrefix + sanitizeLogs(suffix);
	}

	const sanitizedBuildLogs = $derived(sanitizeGrowing(buildLogs));

	const buildLines = $derived(ansiBuildLines(sanitizedBuildLogs));
	const parseBuild = createBuildkitParser();
	const parsed = $derived(parseBuild(sanitizedBuildLogs));
	const running = $derived(buildStatus === 'building');
	const canceled = $derived(buildStatus === 'canceled' || buildStatus === 'cancelled');
	const failure = $derived(
		buildStatus === 'failed' || canceled
			? diagnoseBuild({
					parsed,
					error: canceled ? 'Build canceled by user' : buildError,
					buildStep,
					timestamps: buildStepTimestamps
				})
			: null
	);

	let now = $state(Date.now());
	$effect(() => {
		if (!running) return;
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	interface Phase {
		id: BuildPhaseId;
		label: string;
		from: string[];
	}

	const PHASES: Phase[] = isGitHubDeploy
		? [
				{ id: 'queue', label: 'Starting the builder', from: ['__start', 'queued', 'submitted'] },
				{ id: 'clone', label: 'Cloning the repo', from: ['cloning'] },
				{ id: 'build', label: 'Building the image', from: ['building'] },
				{ id: 'push', label: 'Pushing the image', from: ['pushing'] },
				{ id: 'deploy', label: 'Rolling out', from: ['deploying'] }
			]
		: [{ id: 'deploy', label: 'Rolling out', from: ['deploying', '__start', 'queued'] }];

	const STEP_PHASE: Record<string, BuildPhaseId> = {
		queued: 'queue',
		submitted: 'queue',
		scheduled: 'queue',
		cloning: 'clone',
		building: 'build',
		pushing: 'push',
		deploying: 'deploy',
		service: 'deploy'
	};

	function startOf(phase: Phase): number | null {
		for (const key of phase.from) {
			const t = buildStepTimestamps?.[key];
			if (typeof t === 'number') return t;
		}
		return null;
	}

	const currentIndex = $derived.by(() => {
		if (buildStatus === 'succeeded' || buildStep === 'complete') return PHASES.length;
		const phase = failure?.phase ?? (buildStep ? STEP_PHASE[buildStep] : undefined);
		if (phase) {
			const i = PHASES.findIndex((p) => p.id === phase);
			if (i >= 0) return i;
		}
		let last = -1;
		PHASES.forEach((p, i) => {
			if (startOf(p) !== null) last = i;
		});
		return Math.max(0, last);
	});

	const railSteps = $derived.by((): RailStep[] =>
		PHASES.map((phase, i) => {
			const start = startOf(phase);
			const nextStart = PHASES.slice(i + 1)
				.map(startOf)
				.find((t): t is number => t !== null);
			const end =
				nextStart ?? buildStepTimestamps?.complete ?? (i === currentIndex && running ? now : null);
			const durationMs =
				start !== null && typeof end === 'number' ? Math.max(0, end - start) : null;
			if (i < currentIndex) return { id: phase.id, label: phase.label, status: 'done', durationMs };
			if (i > currentIndex) {
				return { id: phase.id, label: phase.label, status: failure ? 'skipped' : 'queued' };
			}
			if (failure?.canceled) {
				return {
					id: phase.id,
					label: phase.label,
					status: 'skipped',
					detail: 'Canceled',
					durationMs
				};
			}
			if (failure) {
				return {
					id: phase.id,
					label: phase.label,
					status: 'failed',
					detail: failure.title.replaceAll('`', ''),
					durationMs
				};
			}
			return { id: phase.id, label: phase.label, status: 'running', durationMs };
		})
	);

	const total = $derived.by(() => {
		const starts = PHASES.map(startOf).filter((t): t is number => t !== null);
		if (!starts.length) return null;
		const end = buildStepTimestamps?.complete ?? (running ? now : null);
		if (end === null && failure) return null;
		const last = Object.entries(buildStepTimestamps ?? {})
			.filter(([k, v]) => !k.startsWith('__') && typeof v === 'number')
			.map(([, v]) => v as number);
		const stop = end ?? (last.length ? Math.max(...last) : null);
		return stop === null ? null : Math.max(0, stop - Math.min(...starts));
	});

	const DOT: Record<string, DotStep> = {
		done: 'done',
		running: 'active',
		failed: 'failed'
	};
	const dotSteps = $derived(railSteps.map((s) => DOT[s.status ?? ''] ?? 'pending'));

	const head = $derived.by(() => {
		if (failure?.canceled) return statusMeta('neutral', 'Canceled');
		if (failure)
			return statusMeta('error', failure.phase === 'deploy' ? 'Rollout failed' : 'Build failed');
		if (running) {
			const live = railSteps.find((s) => s.status === 'running');
			return statusMeta('progress', live?.label ?? 'Starting', true);
		}
		if (buildStatus === 'succeeded' || buildStep === 'complete')
			return statusMeta('success', 'Live');
		return statusMeta('neutral', 'Waiting');
	});

	const guides = $derived(page.url.searchParams.has('guides'));
	let buildLog: BuildLog | undefined = $state();

	const subline = $derived.by(() => {
		const at = railSteps.findIndex((s) => s.status === 'failed' || s.status === 'running');
		const parts: string[] = [];
		if (failure && at >= 0) parts.push(`Stopped at ${railSteps[at].label.toLowerCase()}`);
		else if (failure?.canceled) parts.push('Stopped before it finished');
		else if (running && at >= 0) parts.push(`Step ${at + 1} of ${railSteps.length}`);
		else if (head.kind === 'success') parts.push(`${railSteps.length} steps`);
		if (total !== null) parts.push(formatPhase(total));
		return parts.join(' · ');
	});
</script>

<div class="progress">
	{#if guides}<GoldenReticle contained />{/if}
	<div class="layout">
		<aside class="pipeline" aria-label="Deploy progress">
			<div class="hero">
				<span class="hero-dot">
					<StatusDot meta={head} steps={dotSteps} orbit={48} label={head.label} />
				</span>
				<div class="hero-text">
					<p class="hero-title">{head.label}</p>
					{#if subline}<p class="hero-sub">{subline}</p>{/if}
				</div>
			</div>
			<div class="phases">
				<StepRail steps={railSteps} label="Deploy steps" onselect={(id) => buildLog?.focus(id)} />
			</div>
			{#if warnings?.length && !running}
				<div class="warnings">
					<Alert tone="warning" title="Pod warnings">
						{#each warnings as warning, i (i)}
							<p class="warning"><span class="mono">{warning.podName}</span> {warning.message}</p>
						{/each}
					</Alert>
				</div>
			{/if}
		</aside>
		<div class="log">
			<BuildLog
				bind:this={buildLog}
				phases={railSteps}
				{parsed}
				lines={buildLines}
				{running}
				{failure}
				{settingsHref}
				{crashHref}
				onnavigate={onsettings}
			/>
		</div>
	</div>
</div>

<style>
	.progress {
		--build-bar-h: 2rem;
		--build-log-h: var(--progress-h, 32rem);
		--card-pad: 1rem;
		--hero-col: 3rem;
		--build-head-h: calc(var(--hero-col) + var(--card-pad) * 2);
		--hero-gap: 0.875rem;
		position: relative;
		container-type: inline-size;
	}
	.layout {
		display: grid;
		gap: 1rem;
		align-items: start;
	}
	@container (min-width: 44rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.618fr);
			align-items: stretch;
		}
	}
	.pipeline {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.hero {
		min-height: var(--build-head-h);
		box-sizing: border-box;
		display: grid;
		grid-template-columns: var(--hero-col) minmax(0, 1fr);
		column-gap: var(--hero-gap);
		align-items: center;
		padding: var(--card-pad) 0;
	}
	.hero-dot {
		display: grid;
		place-items: center;
		width: var(--hero-col);
		height: var(--hero-col);
		--ring-stroke: 2.6;
	}
	.hero-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}
	.hero-title {
		font-size: var(--text-headline);
		line-height: var(--lh-headline);
		font-weight: var(--weight-semibold);
		color: var(--text-default);
		text-box: trim-both cap alphabetic;
	}
	.hero-sub {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-box: trim-both cap alphabetic;
	}
	.phases {
		--rail-dot-col: var(--hero-col);
		--rail-gap: var(--hero-gap);
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.warnings {
		padding-top: var(--card-pad);
	}
	.warning {
		font-size: var(--text-footnote);
	}
	.mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-weight: var(--weight-medium);
	}
	.log {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		height: var(--build-log-h);
	}
</style>

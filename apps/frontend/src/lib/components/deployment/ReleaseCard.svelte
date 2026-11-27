<script lang="ts">
	import {
		GitBranch,
		GitCommitHorizontal,
		Package,
		RotateCcw,
		ScrollText,
		Timer
	} from 'lucide-svelte';
	import BuildTimer from '$lib/components/BuildTimer.svelte';
	import { stateEcho } from '$lib/utils/motion.svelte';
	import { formatBuildDurationBetween } from '$lib/utils/format';
	import {
		ActivityRow,
		Avatar,
		Button,
		StatusBadge,
		ToneTile,
		statusMeta
	} from '$lib/components/ui';
	import MetaList from '$lib/components/ui/MetaList.svelte';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import Widget from '$lib/components/ui/Widget.svelte';
	import type { Deployment } from '$lib/types/deployment';
	import { verdictBadge, verdictText, worthShowing } from './verdict';
	import {
		buildStartedAt,
		humanizeStep,
		originLabel,
		shortRef,
		type TimelineEntry
	} from './timeline-rows';

	let {
		live,
		previous,
		deployment,
		rollingBackId = null,
		onRollback,
		onOpenLogModal,
		onViewBuildLogs
	}: {
		live: TimelineEntry | null;
		previous: TimelineEntry | null;
		deployment: Deployment;
		rollingBackId?: string | null;
		onRollback: (historyId: string) => void;
		onOpenLogModal: (historyId: string) => void;
		onViewBuildLogs: () => void;
	} = $props();

	const building = $derived(
		deployment.buildStatus === 'building' ||
			deployment.buildStatus === 'queued' ||
			deployment.buildStatus === 'pending'
	);
	const failed = $derived(deployment.buildStatus === 'failed');
	const queued = $derived(
		(deployment.buildStatus === 'queued' || deployment.buildStatus === 'pending') &&
			!deployment.buildStep
	);
	const progress = $derived(
		queued
			? statusMeta('info', 'Queued', true)
			: statusMeta('progress', humanizeStep(deployment.buildStep), true)
	);
	const startedAt = $derived(buildStartedAt(deployment.buildStepTimestamps));
	const liveId = $derived(str(live?.meta.imageHistoryId));
	const previousId = $derived(str(previous?.meta.imageHistoryId));
	const previousRef = $derived(shortRef(previous));
	const buildError = $derived(deployment.buildError?.split('\n')[0]?.trim() || null);
	const titled = $derived(!!live && live.title !== shortRef(live));
	const verdict = $derived(
		deployment.latestVerdict &&
			liveId &&
			deployment.latestVerdict.imageHistoryId === liveId &&
			worthShowing(deployment.latestVerdict)
			? deployment.latestVerdict
			: null
	);
	const badge = $derived(verdict ? verdictBadge(verdict) : null);
	const liveFacts = $derived.by(() => {
		if (!live) return [];
		const sha = str(live.meta.commitSha);
		const ref = shortRef(live);
		const branch = str(live.meta.branch);
		const builtIn = formatBuildDurationBetween(
			str(live.meta.buildStartedAt) ?? undefined,
			str(live.meta.buildCompletedAt) ?? undefined
		);
		return [
			...(branch ? [{ label: branch, icon: GitBranch }] : []),
			...(titled && ref
				? [
						{
							label: ref,
							icon: GitCommitHorizontal,
							mono: true,
							href: sha && live.href ? live.href : undefined,
							external: true
						}
					]
				: []),
			...(builtIn ? [{ label: builtIn, icon: Timer }] : [])
		];
	});

	function str(v: unknown): string | null {
		return typeof v === 'string' && v ? v : null;
	}
</script>

{#if live || building || failed}
	<Widget class="release">
		<div class="rows" role="list" aria-label="Current release">
			{#if building || failed}
				<ActivityRow
					pinned
					tone={failed ? 'error' : progress.kind}
					{@attach stateEcho(() => deployment.buildStatus)}
				>
					{#snippet tile()}
						<ToneTile tone={failed ? 'error' : progress.kind} size={28}>
							<Package size={14} aria-hidden="true" />
						</ToneTile>
					{/snippet}
					{#snippet title()}
						<span class="name">New version</span>
						{#if failed}
							<StatusBadge meta={statusMeta('error', 'Failed')} />
						{:else}
							<StatusBadge meta={progress} />
						{/if}
					{/snippet}
					{#snippet meta()}
						{#if failed}
							<span class="error" title={deployment.buildError ?? undefined}
								>{buildError ?? 'The build stopped without output'}</span
							>
						{:else}
							<MetaList
								items={deployment.githubBranch
									? [{ label: deployment.githubBranch, icon: GitBranch }]
									: []}
							/>
							{#if startedAt}<span class="timer"><BuildTimer {startedAt} /></span>{/if}
						{/if}
					{/snippet}
					{#snippet actions()}
						<Button variant="secondary" size="sm" icon={ScrollText} onclick={onViewBuildLogs}
							>Build logs</Button
						>
					{/snippet}
				</ActivityRow>
			{/if}
			{#if live}
				<ActivityRow pinned tone="success" {@attach stateEcho(() => liveId)}>
					{#snippet tile()}
						{#if live.actor}
							<Avatar user={live.actor} size={28} />
						{:else}
							<ToneTile tone="success" size={28}>
								<Package size={14} aria-hidden="true" />
							</ToneTile>
						{/if}
					{/snippet}
					{#snippet title()}
						<span class="name" class:name--mono={!titled} title={live.title}>{live.title}</span>
						<StatusBadge meta={statusMeta('success', 'Live')} />
						{#if badge}<StatusBadge meta={badge} />{/if}
					{/snippet}
					{#snippet meta()}
						{#if verdict}
							<span
								class="verdict"
								class:verdict--worse={verdict.status === 'regressed'}
								title={verdictText(verdict)}>{verdictText(verdict)}</span
							>
						{:else}
							<MetaList items={liveFacts} />
						{/if}
						<span class="who" title={originLabel(live)}
							>{originLabel(live)} · <RelativeTime date={live.at} /></span
						>
					{/snippet}
					{#snippet actions()}
						{#if previousId}
							<Tooltip
								text={previousRef ? `Back to ${previousRef}` : 'Back to the previous release'}
							>
								<Button
									variant="secondary"
									size="sm"
									icon={RotateCcw}
									onclick={() => onRollback(previousId)}
									disabled={!!rollingBackId}
									loading={rollingBackId === previousId}>Roll back</Button
								>
							</Tooltip>
						{/if}
						{#if liveId}
							<Button
								variant="secondary"
								size="sm"
								icon={ScrollText}
								onclick={() => onOpenLogModal(liveId)}>Build logs</Button
							>
						{/if}
					{/snippet}
				</ActivityRow>
			{/if}
		</div>
	</Widget>
{/if}

<style>
	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-block: -0.5rem;
	}
	.rows :global(.button) {
		border-radius: 999px;
		corner-shape: round;
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.name--mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
	}
	.rows :global(.meta) {
		flex-wrap: nowrap;
		flex-shrink: 1;
		min-width: 0;
		gap: 1rem;
	}
	.who,
	.timer {
		flex-shrink: 0;
		margin-left: 0.625rem;
		color: var(--text-faint);
	}
	.who {
		flex-shrink: 1;
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.timer {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.timer :global(svg) {
		width: 14px;
		height: 14px;
	}
	.verdict {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-default);
	}
	.verdict--worse {
		color: var(--status-warning);
	}
	.error {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		color: var(--status-error);
	}
</style>

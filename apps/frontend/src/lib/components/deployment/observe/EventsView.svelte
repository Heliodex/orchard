<script lang="ts">
	import { untrack } from 'svelte';
	import { CircleCheck, Info, OctagonX, TriangleAlert } from 'lucide-svelte';
	import { Button, EmptyState, List, ListRow, LogViewer, ToneTile } from '$lib/components/ui';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { explainExitCode, humanizeWarning, podLabel } from '$lib/utils/format';
	import { ansiLogLines } from '$lib/utils/log-sources.svelte';
	import { springCollapse } from '$lib/utils/motion.svelte';
	import type { StatusKind } from '$lib/components/ui/status';
	import type { EventsState, TimelineItem } from './events.svelte';

	let {
		events,
		deployment,
		active,
		demo,
		focusKilled = $bindable(false)
	}: {
		events: EventsState;
		deployment: any;
		active: boolean;
		demo: boolean;
		focusKilled?: boolean;
	} = $props();

	let open = $state<string | null>(null);
	let mounted = $state<string[]>([]);

	const TONE: Record<string, StatusKind> = {
		critical: 'error',
		error: 'error',
		warning: 'warning',
		info: 'neutral'
	};

	function refresh() {
		if (!deployment?.id) return;
		events.fetch(deployment.id, { demo, pods: deployment?.pods ?? [] });
	}

	$effect(() => {
		const id = deployment?.id;
		if (!id || !active) return;
		untrack(refresh);
	});

	function toggle(row: TimelineItem) {
		if (!mounted.includes(row.key)) mounted = [...mounted, row.key];
		open = open === row.key ? null : row.key;
		if (open && row.kind === 'killed' && deployment?.id) {
			events.capture(deployment.id, row.item.entryId, demo);
		}
	}

	$effect(() => {
		if (!focusKilled || !events.loaded) return;
		const row = events.items.find((r) => r.kind === 'killed');
		untrack(() => {
			focusKilled = false;
			if (row && open !== row.key) toggle(row);
		});
	});

	function describe(row: TimelineItem) {
		if (row.kind === 'killed') {
			const k = row.item;
			const why = explainExitCode(k.exitCode, k.reason);
			return {
				title: why?.short ?? k.reason,
				tone: TONE[why?.severity ?? 'error'],
				icon: OctagonX,
				parts: [
					k.reason,
					k.exitCode != null ? `exit ${k.exitCode}` : null,
					`${podLabel(k.pod)} / ${k.container}`
				].filter(Boolean) as string[]
			};
		}
		const w = row.item;
		const human = humanizeWarning(w.message ?? '');
		const severity = human?.severity ?? 'warning';
		return {
			title: human?.title ?? w.reason ?? 'Warning',
			tone: TONE[severity],
			icon: severity === 'info' ? Info : TriangleAlert,
			parts: [
				w.reason ?? 'Warning',
				(w.count ?? 1) > 1 ? `${w.count} times` : null,
				podLabel(w.pod)
			].filter(Boolean) as string[]
		};
	}
</script>

{#if events.error && !events.loaded}
	<EmptyState title="Couldn't load events" description={events.error}>
		{#snippet icon()}<TriangleAlert size={18} />{/snippet}
		<Button variant="secondary" onclick={refresh}>Retry</Button>
	</EmptyState>
{:else if !events.loaded}
	<List label="Loading events">
		{#each [0, 1, 2] as i (i)}
			<div class="skeleton-row">
				<Skeleton width="2rem" height="2rem" rounded="0.625rem" />
				<div class="skeleton-text">
					<Skeleton width="36%" height="0.875rem" />
					<Skeleton width="22%" height="0.75rem" />
				</div>
			</div>
		{/each}
	</List>
{:else if events.items.length === 0}
	<EmptyState title="No crashes or Kubernetes warnings">
		{#snippet icon()}<CircleCheck size={18} />{/snippet}
		<Button variant="secondary" loading={events.loading} onclick={refresh}>Check again</Button>
	</EmptyState>
{:else}
	<List label="Events">
		{#each events.items as row (row.key)}
			{@const d = describe(row)}
			{@const expanded = open === row.key}
			<ListRow title={d.title} onclick={() => toggle(row)} selected={expanded}>
				{#snippet leading()}
					<ToneTile tone={d.tone} size={32}><d.icon size={16} /></ToneTile>
				{/snippet}
				{#snippet subtitle()}
					<span class="parts">{d.parts.join(' · ')}</span>
				{/snippet}
				{#snippet trailing()}
					<span class="when"
						>{#if row.at}<RelativeTime date={row.at} />{/if}</span
					>
				{/snippet}
			</ListRow>
			{#if mounted.includes(row.key)}
				<div class="fold" inert={!expanded} {@attach springCollapse(() => !expanded)}>
					<div class="detail">
						{#if row.kind === 'killed'}
							{@const logs = events.captured[row.item.entryId]}
							{#if events.capturing === row.item.entryId || logs === undefined}
								<Skeleton height="6rem" rounded="0.75rem" />
							{:else if logs}
								<div class="captured">
									<div class="captured-head">
										<span>Last output before it stopped</span>
										<CopyButton value={logs} label="Copy output" />
									</div>
									<div class="captured-body">
										<LogViewer lines={ansiLogLines(logs)} surface="dark" />
									</div>
								</div>
							{:else}
								<p class="quiet">Nothing was captured before it stopped</p>
							{/if}
						{:else}
							{@const human = humanizeWarning(row.item.message ?? '')}
							{#if human?.hint}<p class="hint">{human.hint}</p>{/if}
							<p class="raw">{row.item.message}</p>
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	</List>
{/if}

<style>
	.parts {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.when {
		font-size: var(--text-callout);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
	}
	.fold {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.detail {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem 1rem 1rem 3.75rem;
		background: var(--bg-sunken);
	}
	.captured {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.captured-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 1.75rem;
		font-size: var(--text-caption);
		color: var(--text-muted);
	}
	.captured-body {
		display: flex;
		max-height: 20rem;
	}
	.hint {
		margin: 0;
		font-size: var(--text-callout);
		color: var(--text-default);
	}
	.raw {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
		overflow-wrap: anywhere;
	}
	.quiet {
		margin: 0;
		font-size: var(--text-callout);
		color: var(--text-muted);
	}
	.skeleton-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1rem;
	}
	.skeleton-row + .skeleton-row {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.skeleton-text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>

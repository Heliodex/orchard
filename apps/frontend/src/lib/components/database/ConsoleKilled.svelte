<script lang="ts">
	import { untrack } from 'svelte';
	import { CircleCheck, OctagonX } from 'lucide-svelte';
	import { Button, EmptyState, List, ListRow, LogViewer, ToneTile } from '$lib/components/ui';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import type { StatusKind } from '$lib/components/ui/status';
	import { explainExitCode } from '$lib/utils/format';
	import { ansiLogLines } from '$lib/utils/log-sources.svelte';
	import { springCollapse } from '$lib/utils/motion.svelte';

	type Killed = {
		entryId: string;
		pod: string;
		container: string;
		reason: string;
		exitCode: number | null;
		finishedAt: string | null;
	};

	let {
		list,
		loading,
		logs,
		logsLoading,
		expanded,
		onToggle,
		onRefresh,
		podShortName
	}: {
		list: Killed[];
		loading: boolean;
		logs: Record<string, string>;
		logsLoading: string | null;
		expanded: string | null;
		onToggle?: (entryId: string) => void;
		onRefresh?: () => void;
		podShortName: (name: string) => string;
	} = $props();

	const TONE: Record<string, StatusKind> = {
		critical: 'error',
		error: 'error',
		warning: 'warning',
		info: 'neutral'
	};

	let mounted = $state<string[]>([]);

	$effect(() => {
		const id = expanded;
		if (!id) return;
		untrack(() => {
			if (!mounted.includes(id)) mounted = [...mounted, id];
		});
	});

	function describe(k: Killed) {
		const why = explainExitCode(k.exitCode, k.reason);
		return {
			title: why?.short ?? k.reason,
			tone: TONE[why?.severity ?? 'error'],
			parts: [
				k.reason,
				k.exitCode != null ? `exit ${k.exitCode}` : null,
				podShortName(k.pod)
			].filter(Boolean) as string[]
		};
	}
</script>

<div class="killed">
	{#if loading && list.length === 0}
		<List label="Loading killed containers">
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
	{:else if list.length === 0}
		<EmptyState title="Nothing was killed in the last 24 hours">
			{#snippet icon()}<CircleCheck size={18} />{/snippet}
			<Button variant="secondary" size="sm" {loading} onclick={() => onRefresh?.()}
				>Check again</Button
			>
		</EmptyState>
	{:else}
		<List label="Killed in the last 24 hours">
			{#each list as k (k.entryId)}
				{@const d = describe(k)}
				{@const open = expanded === k.entryId}
				<ListRow title={d.title} onclick={() => onToggle?.(k.entryId)} selected={open}>
					{#snippet leading()}
						<ToneTile tone={d.tone} size={32}><OctagonX size={16} /></ToneTile>
					{/snippet}
					{#snippet subtitle()}
						<span class="parts" title={d.parts.join(' · ')}>{d.parts.join(' · ')}</span>
					{/snippet}
					{#snippet trailing()}
						<span class="when"
							>{#if k.finishedAt}<RelativeTime date={k.finishedAt} />{/if}</span
						>
					{/snippet}
				</ListRow>
				{#if mounted.includes(k.entryId)}
					<div class="fold" inert={!open} {@attach springCollapse(() => !open)}>
						<div class="detail">
							{#if logsLoading === k.entryId || logs[k.entryId] === undefined}
								<Skeleton height="6rem" rounded="0.75rem" />
							{:else if logs[k.entryId]}
								<div class="output">
									<LogViewer
										toolbar
										filename="{podShortName(k.pod)}-killed"
										lines={ansiLogLines(logs[k.entryId])}
									/>
								</div>
							{:else}
								<p class="quiet">Nothing was captured before it stopped</p>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</List>
	{/if}
</div>

<style>
	.killed {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: thin;
	}
	.parts {
		min-width: 0;
		overflow-x: clip;
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
		padding: 0.75rem 1rem 1rem 3.75rem;
		background: var(--bg-sunken);
	}
	.output {
		display: flex;
		flex-direction: column;
		max-height: 18rem;
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

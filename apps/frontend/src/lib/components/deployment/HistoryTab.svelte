<script lang="ts">
	import {
		ArrowDown,
		Box,
		Bug,
		ChevronDown,
		CircleX,
		GitCommitHorizontal,
		History,
		RotateCcw,
		ScrollText,
		Settings2
	} from 'lucide-svelte';
	import { createInfiniteQuery, createQuery } from '@tanstack/svelte-query';
	import { SvelteSet } from 'svelte/reactivity';
	import { queryClient } from '$lib/query';
	import { apiFetch, selectedOrganization, subscribeOrgEvents } from '$lib/stores';
	import { stateEcho } from '$lib/utils/motion.svelte';
	import {
		ActivityGroup,
		ActivityRow,
		Avatar,
		Button,
		EmptyState,
		SegmentedControl,
		Skeleton,
		StatusBadge,
		Swap,
		ToneTile,
		statusMeta,
		type StatusKind
	} from '$lib/components/ui';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import Widget from '$lib/components/ui/Widget.svelte';
	import type { Deployment } from '$lib/types/deployment';
	import ReleaseCard from './ReleaseCard.svelte';
	import {
		verdictBadge,
		verdictMoment,
		verdictText,
		worthShowing,
		type ReleaseVerdict
	} from './verdict';
	import { page } from '$app/stores';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { momentLink } from './observe/permalink';
	import {
		DEFAULT_FILTER,
		TIMELINE_FILTERS,
		collapsePodRuns,
		actorLabel,
		entryBadge,
		filterKinds,
		flattenPages,
		foldBuildRuns,
		foldTitle,
		groupEntries,
		headline,
		granularityFor,
		newestAt,
		newlyArrived,
		releaseEnds,
		seedFromImageHistory,
		shortRef,
		type DisplayEntry,
		type TimelineFilter,
		type TimelinePage
	} from './timeline-rows';

	let {
		deployment,
		rollingBackId = null,
		onOpenLogModal,
		onRollback,
		onViewBuildLogs
	}: {
		deployment: Deployment;
		rollingBackId?: string | null;
		onOpenLogModal: (historyId: string) => void;
		onRollback: (historyId: string) => void;
		onViewBuildLogs: () => void;
	} = $props();

	const PAGE_SIZE = 40;

	let filter = $state<TimelineFilter>(DEFAULT_FILTER);

	const seed = $derived(seedFromImageHistory(deployment.imageHistory, deployment.githubRepo));
	const ends = $derived(releaseEnds(seed.entries));

	const timeline = createInfiniteQuery(() => ({
		queryKey: ['timeline', deployment.id, filter],
		queryFn: async ({ pageParam }: { pageParam: string | null }) => {
			const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
			const kinds = filterKinds(filter);
			if (kinds) params.set('kinds', kinds);
			if (pageParam) params.set('cursor', pageParam);
			const res = await apiFetch(`/apiv1/observe/deployments/${deployment.id}/timeline?${params}`);
			if (!res.ok) throw new Error(`timeline ${res.status}`);
			return (await res.json()) as TimelinePage;
		},
		initialPageParam: null as string | null,
		getNextPageParam: (last: TimelinePage) => last.nextCursor,
		enabled: !!deployment.id,
		placeholderData:
			filter === 'all' || filter === 'deploys' ? { pages: [seed], pageParams: [null] } : undefined,
		refetchInterval: 60_000,
		refetchIntervalInBackground: false
	}));

	const releaseVerdicts = createQuery(() => ({
		queryKey: ['release-verdicts', deployment.id],
		queryFn: async () => {
			const res = await apiFetch(`/apiv1/deployments/${deployment.id}/releases?limit=50`);
			if (!res.ok) return new Map<string, ReleaseVerdict>();
			const rows = (await res.json()) as {
				imageHistoryId: string | null;
				verdict: ReleaseVerdict | null;
			}[];
			const out = new Map<string, ReleaseVerdict>();
			for (const r of rows) {
				if (r.imageHistoryId && worthShowing(r.verdict)) out.set(r.imageHistoryId, r.verdict);
			}
			return out;
		},
		enabled: !!deployment.id,
		refetchInterval: 5 * 60_000,
		refetchIntervalInBackground: false
	}));
	const verdicts = $derived(releaseVerdicts.data ?? new Map<string, ReleaseVerdict>());

	const entries = $derived(flattenPages(timeline.data?.pages));
	const rows = $derived(collapsePodRuns(entries));
	const groups = $derived(groupEntries(foldBuildRuns(rows), granularityFor(filter)));
	const opened = new SvelteSet<string>();
	const focusRelease = $derived($page.url.searchParams.get('release'));
	let scrolledTo: string | null = null;

	$effect(() => {
		const id = focusRelease;
		if (!id || id === scrolledTo || !groups.length) return;
		const el = document.querySelector<HTMLElement>(`[data-release="${CSS.escape(id)}"]`);
		if (!el) return;
		scrolledTo = id;
		el.scrollIntoView({ block: 'center' });
	});
	const loading = $derived(timeline.isPending && !timeline.data);
	const live = $derived((ends.live && entries.find((e) => e.id === ends.live?.id)) || ends.live);

	const freshIds = new Set<string>();
	let seenIds: Set<string> | null = null;
	let seenNewestAt = 0;
	let seenFilter: TimelineFilter | null = null;

	$effect.pre(() => {
		if (filter !== seenFilter) {
			seenFilter = filter;
			seenIds = null;
			seenNewestAt = 0;
		}
		if (timeline.isPlaceholderData || !timeline.data) return;
		const current = entries;
		if (seenIds === null) {
			seenIds = new Set(current.map((e) => e.id));
			seenNewestAt = newestAt(current);
			return;
		}
		const arrived = newlyArrived(seenIds, current, seenNewestAt);
		for (const id of arrived) {
			seenIds.add(id);
			freshIds.add(id);
		}
		seenNewestAt = Math.max(seenNewestAt, newestAt(current));
	});

	let refreshTimer: ReturnType<typeof setTimeout> | null = null;
	function refreshSoon() {
		if (refreshTimer) clearTimeout(refreshTimer);
		refreshTimer = setTimeout(() => {
			refreshTimer = null;
			queryClient.invalidateQueries({ queryKey: ['timeline', deployment.id] });
		}, 400);
	}

	$effect(() => {
		const orgId = $selectedOrganization?.id ?? null;
		if (!orgId) return;
		return subscribeOrgEvents(orgId, (ev) => {
			if (ev.id !== deployment.id) return;
			if (
				ev.type === 'build.changed' ||
				ev.type === 'pod.changed' ||
				ev.type === 'deployment.changed'
			) {
				refreshSoon();
			}
		});
	});

	function str(v: unknown): string | null {
		return typeof v === 'string' && v ? v : null;
	}

	function tileTone(entry: DisplayEntry): StatusKind {
		if (entry.kind === 'release') return 'success';
		if (entry.kind === 'build') return entry.meta.buildStatus === 'failed' ? 'error' : 'neutral';
		if (entry.kind === 'pod') return entry.status === 'error' ? 'error' : 'neutral';
		if (entry.kind === 'error') return 'error';
		return 'neutral';
	}

	function podDetail(entry: DisplayEntry): string | null {
		const name = str(entry.meta.podName);
		if (!entry.detail || !name) return entry.detail;
		const rest = entry.detail.replace(name, '').replace(/^\s*·\s*/, '');
		return rest || null;
	}

	function emptyTitle(f: TimelineFilter): string {
		if (f === 'deploys' || f === 'all') return 'No deploys yet';
		if (f === 'changes') return 'No changes yet';
		if (f === 'pods') return 'No pod events yet';
		return 'No errors seen';
	}

	function emptyHint(f: TimelineFilter): string | undefined {
		if ((f === 'deploys' || f === 'all') && deployment.githubRepo)
			return `Push to ${deployment.githubBranch || 'main'} to deploy.`;
		return undefined;
	}
</script>

{#snippet row(entry: DisplayEntry)}
	{@const badge = entryBadge(entry)}
	{@const branch = str(entry.meta.branch)}
	{@const sha = str(entry.meta.commitSha)}
	{@const imageHistoryId = str(entry.meta.imageHistoryId)}
	{@const who = actorLabel(entry)}
	{@const verdict =
		entry.kind === 'release' && imageHistoryId ? verdicts.get(imageHistoryId) : undefined}
	{@const vBadge = verdict ? verdictBadge(verdict) : null}
	<ActivityRow
		tone={badge.kind}
		muted={entry.kind === 'pod' || entry.kind === 'build'}
		selected={entry.kind === 'release' && !!imageHistoryId && imageHistoryId === focusRelease}
		data-release={entry.kind === 'release' ? imageHistoryId : undefined}
		{@attach stateEcho(() => entry.id, { arrival: () => freshIds.has(entry.id) })}
	>
		{#snippet tile()}
			{#if entry.actor}
				<Avatar user={entry.actor} size={28} />
			{:else}
				<ToneTile tone={tileTone(entry)} size={28}>
					{#if entry.kind === 'pod'}
						<Box size={14} aria-hidden="true" />
					{:else if entry.kind === 'error'}
						<Bug size={14} aria-hidden="true" />
					{:else if entry.kind === 'build' && entry.meta.buildStatus === 'failed'}
						<CircleX size={14} aria-hidden="true" />
					{:else if entry.kind === 'audit'}
						<Settings2 size={14} aria-hidden="true" />
					{:else}
						<GitCommitHorizontal size={14} aria-hidden="true" />
					{/if}
				</ToneTile>
			{/if}
		{/snippet}
		{#snippet title()}
			<span
				class="tl-title"
				class:tl-title--mono={entry.kind === 'release' && headline(entry) === shortRef(entry)}
				title={str(entry.meta.commitMessage) ?? entry.title}>{headline(entry)}</span
			>
			{#if entry.kind === 'release' && entry.meta.isActive}
				<StatusBadge meta={statusMeta('success', 'Live')} />
			{/if}
			{#if vBadge}
				<StatusBadge meta={vBadge} />
			{:else if entry.kind === 'build'}
				<StatusBadge meta={statusMeta(badge.kind, badge.label, badge.pulse)} />
			{/if}
		{/snippet}
		{#snippet meta()}
			{#if verdict}
				<span
					class="tl-clip"
					class:tl-worse={verdict.status === 'regressed'}
					title={verdictText(verdict)}>{verdictText(verdict)}</span
				>
			{:else if entry.kind === 'release' || entry.kind === 'build'}
				{#if branch}<span>{branch}</span>{/if}
				{#if sha}
					{#if branch}<span aria-hidden="true">·</span>{/if}
					{#if entry.href}
						<a href={entry.href} target="_blank" rel="noopener noreferrer" class="tl-mono tl-link"
							>{sha.slice(0, 7)}</a
						>
					{:else}<span class="tl-mono">{sha.slice(0, 7)}</span>{/if}
				{/if}
				{#if entry.kind === 'build' && entry.detail && badge.kind === 'error' && entry.detail !== headline(entry)}
					<span aria-hidden="true">·</span>
					<span class="tl-err">{entry.detail}</span>
				{/if}
				{#if who}
					{#if branch || sha}<span aria-hidden="true">·</span>{/if}
					<span>{who}</span>
				{/if}
			{:else if entry.kind === 'pod'}
				<span class="tl-mono">{str(entry.meta.podName)}</span>
				{#if entry.steps}
					<span aria-hidden="true">·</span>
					<span>{entry.steps.join(' → ')}</span>
				{:else if podDetail(entry)}
					<span aria-hidden="true">·</span>
					<span>{podDetail(entry)}</span>
				{/if}
			{:else if entry.kind === 'audit'}
				{#if entry.detail}<span class="tl-clip" title={entry.detail}>{entry.detail}</span>{/if}
				{#if who}
					{#if entry.detail}<span aria-hidden="true">·</span>{/if}
					<span>{who}</span>
				{/if}
			{:else if entry.detail}
				<span class="tl-err" title={entry.detail}>{entry.detail}</span>
			{/if}
		{/snippet}
		{#snippet time()}<RelativeTime date={entry.at} />{/snippet}
		{#snippet actions()}
			{@const moment = verdict ? verdictMoment(verdict) : null}
			{#if moment}
				<CopyButton value={momentLink($page.url, moment)} label="Copy a link to this deploy" />
			{/if}
			{#if imageHistoryId}
				{#if !entry.meta.isActive}
					<Button
						variant="ghost"
						size="sm"
						icon={RotateCcw}
						onclick={() => onRollback(imageHistoryId)}
						disabled={!!rollingBackId}
						loading={rollingBackId === imageHistoryId}>Roll back</Button
					>
				{/if}
				<Button
					variant="ghost"
					size="sm"
					icon={ScrollText}
					onclick={() => onOpenLogModal(imageHistoryId)}>Logs</Button
				>
			{/if}
		{/snippet}
	</ActivityRow>
{/snippet}

<div class="tl">
	<ReleaseCard
		{live}
		previous={ends.previous}
		{deployment}
		{rollingBackId}
		{onRollback}
		{onOpenLogModal}
		{onViewBuildLogs}
	/>

	<Widget title="History">
		{#snippet meta()}
			<SegmentedControl
				options={TIMELINE_FILTERS}
				value={filter}
				label="Show"
				size="sm"
				shape="capsule"
				onchange={(v) => (filter = v as TimelineFilter)}
			/>
		{/snippet}

		<Swap key={filter}>
			{#if loading}
				<div class="tl-list" aria-busy="true">
					<ActivityGroup>
						{#each [0, 1, 2, 3, 4] as i (i)}
							<ActivityRow>
								{#snippet tile()}<Skeleton
										width="1.75rem"
										height="1.75rem"
										rounded="50%"
									/>{/snippet}
								{#snippet title()}<Skeleton width="14rem" height="0.75rem" />{/snippet}
								{#snippet meta()}<Skeleton width="8rem" height="0.625rem" />{/snippet}
							</ActivityRow>
						{/each}
					</ActivityGroup>
				</div>
			{:else if rows.length > 0}
				<div class="tl-list">
					{#each groups as group (group.key)}
						<ActivityGroup label={groups.length > 1 ? group.label : undefined}>
							{#each group.entries as entry (entry.id)}
								{#if entry.folded}
									{@const open = opened.has(entry.id)}
									{@const first = entry.folded[entry.folded.length - 1]}
									{@const last = entry.folded[0]}
									<ActivityRow tone={entryBadge(entry).kind} muted>
										{#snippet tile()}
											<ToneTile tone={tileTone(entry)} size={28}>
												{#if entry.meta.buildStatus === 'failed'}
													<CircleX size={14} aria-hidden="true" />
												{:else}
													<GitCommitHorizontal size={14} aria-hidden="true" />
												{/if}
											</ToneTile>
										{/snippet}
										{#snippet title()}
											<button
												type="button"
												class="tl-fold"
												aria-expanded={open}
												onclick={() => (open ? opened.delete(entry.id) : opened.add(entry.id))}
											>
												{foldTitle(entry)}
												<span class="tl-fold-chev" class:tl-fold-chev--open={open}
													><ChevronDown size={14} aria-hidden="true" /></span
												>
											</button>
										{/snippet}
										{#snippet meta()}
											{@const a = str(first.meta.commitSha)}
											{@const b = str(last.meta.commitSha)}
											{#if a && b}
												<span class="tl-mono">{a.slice(0, 7)}</span>
												<span aria-hidden="true">to</span>
												<span class="tl-mono">{b.slice(0, 7)}</span>
											{/if}
										{/snippet}
										{#snippet time()}<RelativeTime date={entry.at} />{/snippet}
									</ActivityRow>
									{#if open}
										<div class="tl-fold-body" role="list">
											{#each entry.folded as inner (inner.id)}{@render row(inner)}{/each}
										</div>
									{/if}
								{:else}
									{@render row(entry)}
								{/if}
							{/each}
						</ActivityGroup>
					{/each}
				</div>

				{#if timeline.hasNextPage}
					<div class="tl-more">
						<Button
							variant="ghost"
							size="sm"
							icon={timeline.isFetchingNextPage ? undefined : ArrowDown}
							onclick={() => timeline.fetchNextPage()}
							loading={timeline.isFetchingNextPage}
							disabled={timeline.isFetchingNextPage}>Older</Button
						>
					</div>
				{/if}
			{:else}
				<EmptyState title={emptyTitle(filter)} description={emptyHint(filter)}>
					{#snippet icon()}<History size={18} />{/snippet}
					{#if filter !== 'all'}
						<Button variant="secondary" size="sm" onclick={() => (filter = 'all')}
							>Show everything</Button
						>
					{/if}
				</EmptyState>
			{/if}
		</Swap>
	</Widget>
</div>

<style>
	.tl {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.tl-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.tl-title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tl-title--mono,
	.tl-mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.tl-link {
		color: inherit;
		text-decoration: none;
	}
	.tl-link:hover {
		color: var(--text-default);
		text-decoration: underline;
	}
	.tl-err {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--status-error);
	}
	.tl-clip {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tl-worse {
		color: var(--status-warning);
	}
	.tl-fold {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		cursor: pointer;
	}
	.tl-fold:hover {
		color: var(--text-default);
	}
	.tl-fold-chev {
		display: inline-flex;
		transition: transform var(--spring-glide-duration) var(--spring-glide);
	}
	.tl-fold-chev--open {
		transform: rotate(180deg);
	}
	.tl-fold-body {
		display: flex;
		flex-direction: column;
		padding-left: 2.5rem;
	}
	.tl-more {
		display: flex;
		justify-content: center;
		padding-top: 0.5rem;
	}
</style>

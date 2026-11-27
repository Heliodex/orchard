<script lang="ts">
	import { untrack } from 'svelte';
	import {
		ChevronRight,
		CircleCheck,
		Clock,
		Ellipsis,
		GitCommitHorizontal,
		Github,
		Rocket,
		TriangleAlert
	} from 'lucide-svelte';
	import {
		Avatar,
		Badge,
		Button,
		EmptyState,
		List,
		ListRow,
		Menu,
		MenuItem,
		MenuLabel,
		MenuSeparator,
		Table
	} from '$lib/components/ui';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import MetaList from '$lib/components/ui/MetaList.svelte';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import type { Mood } from '$lib/avatar';
	import { formatRelativeTime } from '$lib/utils/format';
	import { springCollapse, springRotate } from '$lib/utils/motion.svelte';
	import {
		ERROR_WINDOWS,
		deployLabel,
		type ErrorDeploy,
		type ErrorGroup,
		type ErrorStatus,
		type ErrorsState
	} from './errors.svelte';

	let {
		errors,
		deploymentId,
		active,
		demo,
		onOpenLogs
	}: {
		errors: ErrorsState;
		deploymentId: string;
		active: boolean;
		demo: boolean;
		onOpenLogs: () => void;
	} = $props();

	let open = $state<string[]>([]);
	let mounted = $state<string[]>([]);

	const windowLong = $derived(
		ERROR_WINDOWS.find((w) => w.value === errors.window)?.long ?? 'this window'
	);
	const STATUS_WORD: Record<ErrorStatus, string> = {
		unresolved: 'open',
		resolved: 'resolved',
		ignored: 'ignored'
	};

	$effect(() => {
		void errors.window;
		const id = deploymentId;
		if (!id || !active) return;
		untrack(() => errors.fetch(id, demo));
	});

	function toggle(fp: string) {
		if (!mounted.includes(fp)) mounted = [...mounted, fp];
		open = open.includes(fp) ? open.filter((f) => f !== fp) : [...open, fp];
	}

	function mood(status: ErrorStatus): Mood {
		if (status === 'resolved') return 'happy';
		if (status === 'ignored') return 'sleepy';
		return 'thinking';
	}

	function commitHref(sha: string | null) {
		return sha && errors.repoUrl ? `${errors.repoUrl}/commit/${sha}` : undefined;
	}

	function facts(g: ErrorGroup) {
		const out: {
			label: string;
			icon?: typeof Clock;
			href?: string;
			mono?: boolean;
			external?: boolean;
		}[] = [
			{ label: `First seen ${formatRelativeTime(new Date(g.firstSeen))}`, icon: Clock },
			{
				label: `${g.deployCount ?? 0} ${(g.deployCount ?? 0) === 1 ? 'deploy' : 'deploys'} affected`,
				icon: Rocket
			}
		];
		const d = g.firstDeploy;
		if (d?.commitSha) {
			out.push({
				label: `Started after ${d.commitSha.slice(0, 7)}${d.commitMessage ? ` ${d.commitMessage}` : ''}`,
				icon: GitCommitHorizontal,
				href: commitHref(d.commitSha),
				external: true
			});
		} else if (d) {
			out.push({ label: `Started after a deploy: ${deployLabel(d)}`, icon: GitCommitHorizontal });
		}
		if (g.githubIssueUrl) {
			out.push({ label: 'GitHub issue', icon: Github, href: g.githubIssueUrl, external: true });
		}
		return out;
	}
</script>

{#snippet deployCell(d: ErrorDeploy, col: { id: string })}
	{#if col.id === 'commit'}
		{@const href = commitHref(d.commitSha)}
		{#if href}
			<a class="sha" {href} target="_blank" rel="noopener noreferrer">{d.commitSha?.slice(0, 7)}</a>
		{:else}
			<span class="sha">{d.commitSha ? d.commitSha.slice(0, 7) : 'none'}</span>
		{/if}
	{:else if col.id === 'change'}
		<span class="change">{d.commitMessage ?? deployLabel(d)}</span>
	{:else if col.id === 'count'}
		{(d.count ?? 0).toLocaleString()}
	{:else}
		<RelativeTime date={d.at} />
	{/if}
{/snippet}

{#if errors.error && !errors.loaded}
	<EmptyState title="Couldn't load errors" description={errors.error}>
		{#snippet icon()}<TriangleAlert size={18} />{/snippet}
		<Button variant="secondary" onclick={() => errors.fetch(deploymentId, demo)}>Retry</Button>
	</EmptyState>
{:else if !errors.loaded}
	<List label="Loading errors">
		{#each [0, 1, 2] as i (i)}
			<div class="skeleton-row">
				<Skeleton width="40%" height="0.875rem" />
				<Skeleton width="24%" height="0.75rem" />
			</div>
		{/each}
	</List>
{:else if errors.visible.length === 0}
	<EmptyState
		title={errors.status === 'all'
			? `No errors in ${windowLong}`
			: `No ${STATUS_WORD[errors.status]} errors in ${windowLong}`}
	>
		{#snippet icon()}<CircleCheck size={18} />{/snippet}
		<Button variant="secondary" onclick={onOpenLogs}>Open logs</Button>
	</EmptyState>
{:else}
	<div class="errors">
		<p class="summary">
			{errors.events.toLocaleString()}
			{errors.events === 1 ? 'event' : 'events'} across {errors.visible.length}
			{errors.visible.length === 1 ? 'error' : 'errors'} in {windowLong}
		</p>
		<List label="Errors">
			{#each errors.visible as g (g.fingerprint)}
				{@const status = g.status ?? 'unresolved'}
				{@const expanded = open.includes(g.fingerprint)}
				{@const busy = errors.updating === g.fingerprint}
				<ListRow title={g.message} onclick={() => toggle(g.fingerprint)}>
					{#snippet leading()}
						<span class="chevron" {@attach springRotate(() => expanded, { rest: 0, on: 90 })}>
							<ChevronRight size={15} />
						</span>
					{/snippet}
					{#snippet titleSuffix()}
						{#if status !== 'unresolved'}<Badge>{STATUS_WORD[status]}</Badge>{/if}
					{/snippet}
					{#snippet subtitle()}
						<span class="type">{g.type}</span>
						<span class="dot" aria-hidden="true">·</span>
						<span>last seen <RelativeTime date={g.lastSeen} /></span>
						{#if g.assignee}
							<span class="dot" aria-hidden="true">·</span>
							<span class="who">
								<Avatar user={g.assignee} mood={mood(status)} size={16} />
								@{g.assignee.username}
							</span>
						{/if}
					{/snippet}
					{#snippet trailing()}
						<span class="count">
							<span class="count-n">{g.count.toLocaleString()}</span>
							<span class="count-unit">{g.count === 1 ? 'event' : 'events'}</span>
						</span>
					{/snippet}
					{#snippet actions()}
						{#if status === 'unresolved'}
							<Button
								size="sm"
								variant="secondary"
								disabled={busy}
								onclick={() => errors.setStatus(deploymentId, g, 'resolved')}>Resolve</Button
							>
						{:else}
							<Button
								size="sm"
								variant="secondary"
								disabled={busy}
								onclick={() => errors.setStatus(deploymentId, g, 'unresolved')}>Reopen</Button
							>
						{/if}
						<Menu placement="bottom-end">
							{#snippet trigger(attrs)}
								<Button
									{...attrs}
									size="sm"
									variant="ghost"
									icon={Ellipsis}
									label="More actions"
									disabled={busy}
								/>
							{/snippet}
							{#if status === 'unresolved'}
								<MenuItem onclick={() => errors.setStatus(deploymentId, g, 'ignored')}
									>Ignore</MenuItem
								>
							{:else if status === 'resolved'}
								<MenuItem onclick={() => errors.setStatus(deploymentId, g, 'ignored')}
									>Ignore</MenuItem
								>
							{:else}
								<MenuItem onclick={() => errors.setStatus(deploymentId, g, 'resolved')}
									>Resolve</MenuItem
								>
							{/if}
							<MenuSeparator />
							<MenuLabel>Assign to</MenuLabel>
							<MenuItem checked={!g.assignee} onclick={() => errors.assign(deploymentId, g, null)}
								>Nobody</MenuItem
							>
							{#each errors.members as m (m.id)}
								<MenuItem
									checked={g.assignee?.id === m.id}
									onclick={() => errors.assign(deploymentId, g, m.id)}
								>
									{#snippet leading()}<Avatar user={m} size={20} />{/snippet}
									@{m.username}
								</MenuItem>
							{/each}
							{#if g.githubIssueUrl}
								<MenuSeparator />
								<MenuItem icon={Github} href={g.githubIssueUrl} target="_blank"
									>Open GitHub issue</MenuItem
								>
							{/if}
						</Menu>
					{/snippet}
				</ListRow>
				{#if mounted.includes(g.fingerprint)}
					<div class="fold" inert={!expanded} {@attach springCollapse(() => !expanded)}>
						<div class="detail">
							<MetaList items={facts(g)} />
							{#if g.deploys?.length}
								<Table
									label="Deploys affected"
									dense
									inset={false}
									columns={[
										{ id: 'commit', label: 'Commit', width: '6rem' },
										{ id: 'change', label: 'Change' },
										{ id: 'count', label: 'Events', numeric: true, align: 'end' },
										{ id: 'at', label: 'Deployed', width: '7rem', align: 'end' }
									]}
									rows={g.deploys}
									rowKey={(d, i) => d.commitSha ?? i}
									cell={deployCell}
								/>
							{/if}
							{#if g.stackTrace}
								<CodeBlock code={g.stackTrace} title="Stack trace" maxHeight="20rem" />
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</List>
	</div>
{/if}

<style>
	.errors {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.summary {
		margin: 0;
		padding-inline: 0.25rem;
		font-size: var(--text-callout);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.chevron {
		display: grid;
		place-items: center;
		width: 1rem;
		color: var(--text-faint);
	}
	.type {
		overflow: hidden;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dot {
		color: var(--text-faint);
	}
	.who {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		white-space: nowrap;
	}
	.count {
		display: inline-flex;
		align-items: baseline;
		gap: 0.375rem;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.count-n {
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.count-unit {
		font-size: var(--text-caption);
		color: var(--text-muted);
	}
	.fold {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.detail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem 1rem 1rem 2.75rem;
		background: var(--bg-sunken);
	}
	.sha {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		color: var(--text-muted);
		text-decoration: none;
	}
	a.sha:hover {
		color: var(--text-default);
		text-decoration: underline;
	}
	.change {
		display: block;
		overflow: hidden;
		color: var(--text-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.skeleton-row {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.875rem 1rem;
	}
	.skeleton-row + .skeleton-row {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
</style>

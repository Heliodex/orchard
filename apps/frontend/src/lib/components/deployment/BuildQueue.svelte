<script lang="ts">
	import { GitCommit, Layers } from 'lucide-svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { queryClient } from '$lib/query';
	import { apiFetch, selectedOrganization, subscribeOrgEvents, sseStatusFor } from '$lib/stores';
	import { timeAgo } from '$lib/components/org-dashboard/helpers.svelte';
	import { motionStagger } from '$lib/utils/motion.svelte';
	import { slide } from '$lib/utils/transitions';

	interface BuildRun {
		id: string;
		status: string;
		triggerType: string;
		commitSha?: string | null;
		commitMessage?: string | null;
		branch?: string | null;
		createdAt: string;
	}

	let { deploymentId, githubRepo = '' }: { deploymentId: string; githubRepo?: string } = $props();

	function commitHref(sha?: string | null): string | null {
		if (!sha || !githubRepo) return null;
		return `${githubRepo.replace(/\.git$/, '')}/commit/${sha}`;
	}

	let sseStatusValue = $state<'connecting' | 'connected' | 'disconnected'>('connecting');

	const query = createQuery(() => ({
		queryKey: ['build-runs', deploymentId],
		queryFn: async () => {
			const res = await apiFetch(`/apiv1/deployments/${deploymentId}/build-runs?limit=20`);
			if (!res.ok) throw new Error(`build-runs ${res.status}`);
			return (await res.json()) as BuildRun[];
		},
		enabled: !!deploymentId,
		refetchInterval: (q) => {
			const rows = (q.state.data as BuildRun[] | undefined) ?? [];
			const hasActive = rows.some((r) => r.status === 'scheduled' || r.status === 'building');
			const sseUp = sseStatusValue === 'connected';
			if (hasActive) return sseUp ? 15_000 : 3_000;
			if (!sseUp) return 20_000;
			return 60_000;
		},
		refetchIntervalInBackground: false
	}));

	const runs = $derived<BuildRun[]>(query.data ?? []);
	const queued = $derived(runs.filter((r) => r.status === 'scheduled'));

	// Live updates ride the same Redis Streams SSE bus as everything else; the
	// queue emits `build.changed` for this deployment, which we invalidate on.
	$effect(() => {
		const orgId = $selectedOrganization?.id ?? null;
		if (!orgId) return;
		const statusStore = sseStatusFor(orgId);
		const unsubStatus = statusStore.subscribe((v) => (sseStatusValue = v));
		const unsub = subscribeOrgEvents(orgId, (ev) => {
			if (ev.type === 'build.changed' && ev.id === deploymentId) {
				queryClient.invalidateQueries({ queryKey: ['build-runs', deploymentId] });
			}
		});
		return () => {
			unsub();
			unsubStatus();
		};
	});
</script>

{#if queued.length > 0}
	<div class="bq-section" transition:slide={{ duration: 160 }}>
		<div class="bq-head">
			<Layers size={12} class="bq-head-icon" />
			<span class="bq-head-title">Up next</span>
			<span class="bq-head-count">{queued.length}</span>
		</div>
		<div class="bq-rows">
			{#each queued as run, i (run.id)}
				{@const href = commitHref(run.commitSha)}
				<svelte:element
					this={href ? 'a' : 'div'}
					class="bq-row"
					class:bq-row--link={!!href}
					href={href || undefined}
					target={href ? '_blank' : undefined}
					rel={href ? 'noopener noreferrer' : undefined}
					{@attach motionStagger({ index: i, from: { y: 5 } })}
				>
					{#if run.commitSha}
						<span class="bq-sha"><GitCommit size={11} />{run.commitSha.slice(0, 7)}</span>
					{/if}
					<span class="bq-msg">{run.commitMessage?.split('\n')[0] || 'Queued build'}</span>
					<span class="bq-when">{timeAgo(run.createdAt)}</span>
				</svelte:element>
			{/each}
		</div>
	</div>
{/if}

<style>
	.bq-section {
		border-top: 1px solid var(--border-default);
		padding: 0.5rem 1rem 0.75rem;
	}

	.bq-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.125rem 0 0.5rem;
	}

	.bq-section :global(.bq-head-icon) {
		color: var(--text-muted);
	}

	.bq-head-title {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.bq-head-count {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		color: var(--text-muted);
		background: var(--bg-sunken);
		border-radius: var(--radius-pill);
		padding: 0.0625rem 0.5rem;
		margin-left: auto;
	}

	.bq-rows {
		display: flex;
		flex-direction: column;
	}

	.bq-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3125rem 0.25rem;
		min-width: 0;
	}

	.bq-rows .bq-row:not(:last-child) {
		border-bottom: 1px solid var(--border-default);
	}

	.bq-row--link {
		margin: 0 -0.5rem;
		padding-left: 0.5rem;
		padding-right: 0.5rem;
		border-radius: var(--radius-xs);
		text-decoration: none;
		color: inherit;
		cursor: pointer;
		transition: background-color var(--dur-fast) ease;
	}

	.bq-row--link:hover {
		background-color: color-mix(in srgb, var(--text-default) 6%, transparent);
	}

	.bq-row--link:hover .bq-sha {
		color: var(--text-link);
	}

	.bq-sha {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.bq-msg {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-default);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		flex: 1;
	}

	.bq-when {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--text-faint);
		white-space: nowrap;
		flex-shrink: 0;
	}
</style>

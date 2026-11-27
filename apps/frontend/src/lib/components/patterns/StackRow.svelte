<script lang="ts" module>
	import type { StatusMeta } from '$lib/components/ui/status';

	export type StackService = { id: string; name: string; status: StatusMeta };
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import ResourceTile from './ResourceTile.svelte';
	import ListRow from '$lib/components/ui/ListRow.svelte';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';

	let {
		name,
		status,
		href,
		services,
		source = undefined,
		error = undefined,
		updatedAt = undefined,
		shown = 4,
		kind = 'stack',
		image = undefined,
		actions = undefined,
		presence = false
	}: {
		name: string;
		status: StatusMeta;
		href: string;
		services: StackService[];
		source?: string;
		error?: string | null;
		updatedAt?: string | null;
		shown?: number;
		kind?: 'stack' | 'template';
		image?: string | null;
		actions?: Snippet;
		presence?: boolean;
	} = $props();

	const RANK = { error: 0, warning: 1, progress: 2, info: 3, neutral: 4, success: 5 };
	const ordered = $derived(
		services
			.map((s, i) => ({ s, i }))
			.sort((a, b) => RANK[a.s.status.kind] - RANK[b.s.status.kind] || a.i - b.i)
			.map(({ s }) => s)
	);
	const visible = $derived(ordered.slice(0, shown));
	const hidden = $derived(ordered.length - visible.length);
	const quiet = $derived(status.kind === 'success' || status.kind === 'neutral');
</script>

<ListRow title={name} {href} {actions} {presence}>
	{#snippet leading()}
		<ResourceTile {kind} {image} />
	{/snippet}
	{#snippet titleSuffix()}
		{#if !quiet}<span class="state state--{status.kind}">{status.label}</span>{/if}
	{/snippet}
	{#snippet subtitle()}
		{#if error}
			<span class="error" title={error}>{error}</span>
		{:else}
			<span class="services">
				{#each visible as s, i (s.id)}
					{@const loud = s.status.kind !== 'success' && s.status.kind !== 'neutral'}
					<span class="service" title={s.name}
						>{s.name}{#if loud}&nbsp;<span class="state state--{s.status.kind}"
								>{s.status.label.toLowerCase()}</span
							>{/if}{#if i < visible.length - 1 || hidden > 0},{/if}</span
					>
				{:else}
					<span>No services</span>
				{/each}
				{#if hidden > 0}<span class="more">+{hidden}</span>{/if}
			</span>
			{#if source}
				<span aria-hidden="true">·</span>
				<span class="source" title={source}>{source}</span>
			{/if}
		{/if}
	{/snippet}
	{#snippet trailing()}
		{#if updatedAt}<RelativeTime date={updatedAt} />{/if}
	{/snippet}
</ListRow>

<style>
	.state {
		font-size: var(--text-caption);
		font-weight: var(--weight-medium);
	}
	.state--error {
		color: var(--status-error);
	}
	.state--warning {
		color: var(--status-warning);
	}
	.state--progress {
		color: var(--status-progress);
	}
	.state--info {
		color: var(--status-info);
	}
	.services {
		display: flex;
		align-items: baseline;
		gap: 0.3125rem;
		min-width: 0;
		overflow-x: clip;
	}
	.service {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
	}
	.more {
		flex-shrink: 0;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.source {
		flex-shrink: 10;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-faint);
	}
	.error {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		color: var(--status-error);
	}
</style>

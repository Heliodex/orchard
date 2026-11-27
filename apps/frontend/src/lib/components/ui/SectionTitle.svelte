<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		count = undefined,
		size = 'sm',
		actions = undefined
	}: {
		title: string;
		count?: number;
		size?: 'sm' | 'md';
		actions?: Snippet;
	} = $props();
</script>

<div class="row">
	<h2 class="title title--{size}">
		{title}
		{#if count !== undefined}<span class="count">{count}</span>{/if}
	</h2>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 1.75rem;
	}
	.title {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		text-box: trim-both cap alphabetic;
	}
	.title--sm {
		color: var(--text-muted);
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
	}
	.title--md {
		color: var(--text-default);
		font-size: var(--text-headline);
		font-weight: var(--weight-semibold);
	}
	.count {
		color: var(--text-faint);
		font-weight: var(--weight-regular);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>

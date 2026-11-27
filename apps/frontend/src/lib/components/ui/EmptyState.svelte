<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description = undefined,
		icon = undefined,
		children = undefined
	}: {
		title: string;
		description?: string;
		icon?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<div class="empty">
	{#if icon}<div class="icon">{@render icon()}</div>{/if}
	<h3 class="title">{title}</h3>
	{#if description}<p class="desc">{description}</p>{/if}
	{#if children}<div class="action">{@render children()}</div>{/if}
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 3rem 1.5rem;
		text-align: center;
	}
	.icon {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		margin-bottom: 0.5rem;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-active);
		color: var(--text-muted);
	}
	.title {
		--rond: var(--rond-hero);
		font-size: var(--text-headline);
		line-height: var(--lh-headline);
		font-weight: var(--weight-semibold);
		color: var(--text-default);
	}
	.desc {
		max-width: 44ch;
		font-size: var(--text-body);
		line-height: var(--lh-body);
		color: var(--text-muted);
	}
	.action {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}
</style>

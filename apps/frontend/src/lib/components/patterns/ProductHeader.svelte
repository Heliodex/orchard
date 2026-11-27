<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconTile from '$lib/components/ui/IconTile.svelte';

	let {
		title,
		eyebrow = undefined,
		description = undefined,
		icon = null,
		meta = undefined,
		actions = undefined
	}: {
		title: string;
		eyebrow?: string;
		description?: string;
		icon?: string | null;
		meta?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<header class="product">
	<span class="poster">
		<IconTile src={icon} class="poster-img" tint="var(--bg-raised)">
			{#snippet fallback()}<span class="letter">{title.charAt(0)}</span>{/snippet}
		</IconTile>
	</span>
	<div class="copy">
		{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
		<h1 class="title">{title}</h1>
		{#if description}<p class="description">{description}</p>{/if}
		{#if meta}<div class="meta">{@render meta()}</div>{/if}
		{#if actions}<div class="actions">{@render actions()}</div>{/if}
	</div>
</header>

<style>
	.product {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 1.75rem;
	}
	.poster {
		display: block;
		width: 8rem;
		height: 8rem;
	}
	.poster :global(.poster-img) {
		display: grid;
		width: 100%;
		height: 100%;
		border-radius: 22.37%;
		corner-shape: var(--corner);
		box-shadow:
			0 0 0 0.5px var(--rule),
			0 1px 2px color-mix(in oklab, var(--neutral-10) 6%, transparent),
			0 16px 32px -16px color-mix(in oklab, var(--neutral-10) 30%, transparent);
	}
	.letter {
		font-size: 3rem;
		font-weight: var(--weight-semibold);
		color: var(--text-muted);
	}
	.copy {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
	}
	.eyebrow {
		margin: 0;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		font-weight: var(--weight-medium);
		color: var(--text-muted);
	}
	.title {
		margin: 0;
		font-size: var(--text-title-1);
		line-height: var(--lh-title-1);
		font-weight: var(--weight-semibold);
		letter-spacing: -0.011em;
	}
	.description {
		max-width: 40rem;
		margin: 0;
		font-size: var(--text-headline);
		line-height: var(--lh-headline);
		color: var(--text-muted);
		text-wrap: pretty;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.875rem;
	}
	@media (max-width: 40rem) {
		.product {
			grid-template-columns: minmax(0, 1fr);
		}
		.poster {
			width: 5rem;
			height: 5rem;
		}
	}
</style>

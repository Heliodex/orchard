<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Icon } from './types';

	type Item = { label: string; icon?: Icon; href?: string; mono?: boolean; external?: boolean };

	let { items, leading = undefined }: { items: Item[]; leading?: Snippet } = $props();
</script>

<div class="meta">
	{#if leading}{@render leading()}{/if}
	{#each items as item, i (i)}
		{@const Glyph = item.icon}
		{#if item.href}
			<a
				class="item item--link"
				href={item.href}
				target={item.external ? '_blank' : undefined}
				rel={item.external ? 'noopener noreferrer' : undefined}
			>
				{#if Glyph}<Glyph size={14} aria-hidden="true" />{/if}
				<span class="label" class:label--mono={item.mono} title={item.label}>{item.label}</span>
			</a>
		{:else}
			<span class="item">
				{#if Glyph}<Glyph size={14} aria-hidden="true" />{/if}
				<span class="label" class:label--mono={item.mono} title={item.label}>{item.label}</span>
			</span>
		{/if}
	{/each}
</div>

<style>
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		min-width: 0;
		color: var(--text-muted);
		font-size: var(--text-callout);
	}
	.item {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		max-width: 100%;
		color: inherit;
		text-decoration: none;
	}
	.item--link:hover {
		color: var(--text-default);
	}
	.item :global(svg) {
		flex-shrink: 0;
		color: var(--text-faint);
	}
	.label {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.label--mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
	}
</style>

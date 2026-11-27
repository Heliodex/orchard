<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		href = undefined,
		mono = false,
		class: klass = '',
		icon = undefined,
		children
	}: {
		href?: string;
		mono?: boolean;
		class?: string;
		icon?: Snippet;
		children: Snippet;
	} = $props();
</script>

{#if href}
	<a {href} target="_blank" rel="noopener noreferrer" class="ui-chip ui-chip--link {klass}">
		{#if icon}<span class="ui-chip-icon">{@render icon()}</span>{/if}
		<span class="ui-chip-text" class:ui-chip-text--mono={mono}>{@render children()}</span>
	</a>
{:else}
	<span class="ui-chip {klass}">
		{#if icon}<span class="ui-chip-icon">{@render icon()}</span>{/if}
		<span class="ui-chip-text" class:ui-chip-text--mono={mono}>{@render children()}</span>
	</span>
{/if}

<style>
	.ui-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.0625rem 0.5rem;
		border-radius: var(--radius-pill);
		background-color: var(--fill-quiet);
		color: var(--text-muted);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		text-decoration: none;
		max-width: 100%;
		min-width: 0;
		white-space: nowrap;
	}
	.ui-chip--link:hover {
		background-color: var(--fill-soft);
		color: var(--text-default);
	}
	.ui-chip-icon {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
	}
	.ui-chip-text {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ui-chip-text--mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
</style>

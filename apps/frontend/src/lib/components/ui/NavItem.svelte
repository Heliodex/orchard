<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Icon } from './types';

	let {
		label,
		href = undefined,
		onclick = undefined,
		icon = undefined,
		active = false,
		tone = 'default',
		count = undefined,
		countTone = undefined,
		leading = undefined,
		trailing = undefined,
		liquid = false,
		...rest
	}: {
		label: string;
		href?: string;
		onclick?: (e: MouseEvent) => void;
		icon?: Icon;
		active?: boolean;
		tone?: 'default' | 'danger';
		count?: number;
		countTone?: 'default' | 'danger';
		leading?: Snippet;
		trailing?: Snippet;
		liquid?: boolean;
		[key: string]: unknown;
	} = $props();
</script>

{#snippet inner()}
	{#if leading}
		<span class="lead">{@render leading()}</span>
	{:else if icon}
		{@const Glyph = icon}
		<span class="tile tile--{tone}"><Glyph size={17} strokeWidth={1.75} aria-hidden="true" /></span>
	{/if}
	<span class="label">{label}</span>
	{#if count !== undefined}<span class="count count--{countTone ?? tone}">{count}</span>{/if}
	{#if trailing}{@render trailing()}{/if}
{/snippet}

{#if href}
	<a
		{href}
		class="item"
		class:item--active={active}
		class:item--liquid={liquid}
		aria-current={active ? 'page' : undefined}
		{...rest}>{@render inner()}</a
	>
{:else}
	<button
		type="button"
		class="item"
		class:item--active={active}
		class:item--liquid={liquid}
		{onclick}
		{...rest}>{@render inner()}</button
	>
{/if}

<style>
	.item {
		position: relative;
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		height: var(--nav-row-h, 2.25rem);
		padding: 0 0.5rem 0 0.375rem;
		border: none;
		border-radius: var(--nav-radius, calc(0.625rem * var(--corner-scale)));
		corner-shape: var(--corner);
		background: none;
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		letter-spacing: -0.006em;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease,
			transform var(--spring-press-duration) var(--spring-press),
			font-variation-settings var(--spring-smooth-duration) var(--spring-smooth);
	}
	.item:hover {
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
	}
	.item:focus-visible {
		outline-offset: -2px;
	}
	.item:active {
		transform: scale(0.98);
	}
	.item--active,
	.item--active:hover {
		background: var(--nav-active-bg);
		color: var(--nav-active-fg);
		box-shadow: var(--nav-active-shadow);
	}
	.item--liquid,
	.item--liquid:hover,
	.item--liquid.item--active,
	.item--liquid.item--active:hover {
		background: none;
		box-shadow: none;
	}
	.item--liquid.item--active:not([data-on-pill]) {
		color: var(--text-default);
	}
	.item--liquid[data-on-pill] {
		color: var(--nav-active-fg);
	}
	.tile {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		color: var(--text-muted);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}
	.tile--danger {
		color: var(--red-9);
	}
	.item--active .tile {
		color: var(--nav-active-icon);
	}
	.item--liquid.item--active:not([data-on-pill]) .tile {
		color: var(--text-muted);
	}
	.lead {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
	}
	.label {
		flex: 1;
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.count {
		display: grid;
		place-items: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		border-radius: calc(0.375rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--neutral-10) 8%, transparent);
		color: var(--text-muted);
		font-size: var(--text-caption);
		font-weight: var(--weight-semibold);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.count--danger {
		background: var(--red-solid);
		color: var(--on-solid);
	}
</style>

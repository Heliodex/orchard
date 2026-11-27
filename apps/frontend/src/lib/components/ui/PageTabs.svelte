<script lang="ts" generics="T extends string">
	import type { Icon } from './types';
	import { stretchIndicator } from './slide.svelte';

	type Tab = { id: T; label: string; icon?: Icon; count?: number; href?: string };

	let {
		tabs,
		value = $bindable(),
		label = 'Sections',
		onchange = undefined
	}: {
		tabs: readonly Tab[];
		value: T;
		label?: string;
		onchange?: (value: T) => void;
	} = $props();

	const els: Record<string, HTMLElement> = $state({});

	function pick(id: T) {
		value = id;
		onchange?.(id);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
		const i = tabs.findIndex((t) => t.id === value);
		const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
		pick(next.id);
		els[next.id]?.focus();
		e.preventDefault();
	}
</script>

{#snippet inner(tab: Tab)}
	{#if tab.icon}
		{@const TabIcon = tab.icon}
		<TabIcon size={15} strokeWidth={1.75} aria-hidden="true" />
	{/if}
	<span class="label">{tab.label}</span>
	{#if tab.count !== undefined}<span class="count">{tab.count}</span>{/if}
{/snippet}

<div class="capsule ui-glass-rim" role="tablist" aria-label={label} tabindex="-1" {onkeydown}>
	<span class="thumb" aria-hidden="true" {@attach stretchIndicator(() => els[value])}></span>
	{#each tabs as tab (tab.id)}
		{@const active = tab.id === value}
		{#if tab.href}
			<a
				bind:this={els[tab.id]}
				href={tab.href}
				role="tab"
				aria-selected={active}
				tabindex={active ? 0 : -1}
				class="item"
				class:item--active={active}
				onclick={() => pick(tab.id)}>{@render inner(tab)}</a
			>
		{:else}
			<button
				bind:this={els[tab.id]}
				type="button"
				role="tab"
				aria-selected={active}
				tabindex={active ? 0 : -1}
				class="item"
				class:item--active={active}
				onclick={() => pick(tab.id)}>{@render inner(tab)}</button
			>
		{/if}
	{/each}
</div>

<style>
	.capsule {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		max-width: 100%;
		padding: 0.25rem;
		overflow-x: auto;
		border-radius: var(--radius-pill);
		background: var(--material-glass-bg);
		backdrop-filter: var(--material-glass-filter);
		box-shadow: var(--shadow-glass);
		scrollbar-width: none;
	}
	.thumb {
		position: absolute;
		top: 0;
		left: 0;
		border-radius: var(--radius-pill);
		background: color-mix(in oklab, var(--bg-raised), white 8%);
		box-shadow:
			0 0 0 0.5px rgb(0 0 0 / 0.06),
			0 1px 2px rgb(0 0 0 / 0.1),
			0 3px 8px rgb(0 0 0 / 0.06);
		pointer-events: none;
		will-change: transform;
	}
	.item {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		gap: 0.4375rem;
		height: 2rem;
		padding: 0 0.875rem;
		border: none;
		border-radius: var(--radius-pill);
		background: none;
		color: var(--text-muted);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		white-space: nowrap;
		text-decoration: none;
		cursor: pointer;
		transition:
			color var(--fade-in) var(--curve-out),
			font-variation-settings var(--spring-smooth-duration) var(--spring-smooth);
	}
	.item:hover,
	.item--active {
		color: var(--text-default);
	}
	.item:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}
	.count {
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		color: var(--text-faint);
	}
	.item--active .count {
		color: var(--text-muted);
	}
</style>

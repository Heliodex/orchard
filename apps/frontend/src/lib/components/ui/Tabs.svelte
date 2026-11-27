<script lang="ts" generics="T extends string">
	import type { Icon } from './types';
	import { slidingIndicator } from './slide.svelte';

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

<div class="tabs" role="tablist" aria-label={label} tabindex="-1" {onkeydown}>
	{#each tabs as tab (tab.id)}
		{@const active = tab.id === value}
		{#if tab.href}
			<a
				bind:this={els[tab.id]}
				href={tab.href}
				role="tab"
				aria-selected={active}
				tabindex={active ? 0 : -1}
				class="tab"
				class:tab--active={active}
				onclick={() => pick(tab.id)}
			>
				{@render inner(tab)}
			</a>
		{:else}
			<button
				bind:this={els[tab.id]}
				type="button"
				role="tab"
				aria-selected={active}
				tabindex={active ? 0 : -1}
				class="tab"
				class:tab--active={active}
				onclick={() => pick(tab.id)}
			>
				{@render inner(tab)}
			</button>
		{/if}
	{/each}
	<span class="bar" aria-hidden="true" {@attach slidingIndicator(() => els[value])}></span>
</div>

{#snippet inner(tab: Tab)}
	{#if tab.icon}
		{@const TabIcon = tab.icon}
		<TabIcon size={14} aria-hidden="true" />
	{/if}
	{tab.label}
	{#if tab.count !== undefined}<span class="count">{tab.count}</span>{/if}
{/snippet}

<style>
	.tabs {
		position: relative;
		display: flex;
		align-items: stretch;
		gap: 0.25rem;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
		box-shadow: inset 0 -1px 0 var(--border-default);
	}
	.tab {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		height: 2.5rem;
		padding: 0 0.625rem;
		border: none;
		background: none;
		color: var(--text-muted);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		white-space: nowrap;
		text-decoration: none;
		cursor: pointer;
		isolation: isolate;
		transition: color var(--dur-fast) ease;
	}
	.tab:hover,
	.tab--active {
		color: var(--text-default);
	}
	.tab::before {
		content: '';
		position: absolute;
		inset: 0.375rem 0;
		border-radius: calc(0.375rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-hover);
		opacity: 0;
		transition: opacity var(--dur-fast) ease;
		z-index: -1;
	}
	.tab:hover::before {
		opacity: 1;
	}
	.count {
		padding: 0 0.3125rem;
		border-radius: var(--radius-pill);
		background: var(--bg-active);
		color: var(--text-muted);
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.bar {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		background: none;
	}
	.bar::after {
		content: '';
		position: absolute;
		right: 0.5rem;
		bottom: 0;
		left: 0.5rem;
		height: 2px;
		border-radius: 2px 2px 0 0;
		corner-shape: var(--corner);
		background: var(--text-default);
	}
	.bar:global([data-ready]) {
		transition:
			transform var(--spring-glide-duration) var(--spring-glide),
			width var(--spring-glide-duration) var(--spring-glide);
	}
</style>

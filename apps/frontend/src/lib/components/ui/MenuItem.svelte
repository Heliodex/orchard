<script lang="ts">
	import { getContext, type Snippet } from 'svelte';
	import { Check } from 'lucide-svelte';
	import type { Icon } from './types';

	let {
		onclick = undefined,
		href = undefined,
		danger = false,
		disabled = false,
		icon = undefined,
		shortcut = undefined,
		trailing = undefined,
		checked = undefined,
		leading = undefined,
		plain = false,
		keepOpen = false,
		description = undefined,
		children,
		...rest
	}: {
		onclick?: (e: MouseEvent) => void;
		href?: string;
		danger?: boolean;
		disabled?: boolean;
		icon?: Icon;
		shortcut?: string;
		trailing?: Snippet;
		checked?: boolean;
		leading?: Snippet;
		plain?: boolean;
		keepOpen?: boolean;
		description?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const menu = getContext<{ close: () => void } | undefined>('ui-menu');

	const structured = $derived(
		!!icon || !!leading || !!shortcut || !!trailing || !!description || checked !== undefined
	);
	const role = $derived(checked === undefined ? 'menuitem' : 'menuitemcheckbox');

	function handleClick(e: MouseEvent) {
		onclick?.(e);
		if (!keepOpen) menu?.close();
	}
</script>

{#snippet body()}
	{#if structured}
		{#if checked !== undefined}
			<span class="check" aria-hidden="true">
				{#if checked}<Check size={16} strokeWidth={2.25} />{/if}
			</span>
		{/if}
		{#if leading}
			<span class="leading" class:leading--plain={plain} aria-hidden="true"
				>{@render leading()}</span
			>
		{:else if icon}
			{@const Glyph = icon}
			<span class="icon" aria-hidden="true"><Glyph size={16} /></span>
		{/if}
		{#if description}
			<span class="label label--stack">
				<span class="label-main">{@render children?.()}</span>
				<span class="desc">{description}</span>
			</span>
		{:else}
			<span class="label">{@render children?.()}</span>
		{/if}
		{#if trailing}<span class="trailing">{@render trailing()}</span>{/if}
		{#if shortcut}<kbd class="shortcut">{shortcut}</kbd>{/if}
	{:else}
		{@render children?.()}
	{/if}
{/snippet}

{#if href && !disabled}
	<a
		{href}
		class="ui-menu-item"
		class:ui-menu-item--danger={danger}
		{role}
		aria-checked={checked}
		tabindex="-1"
		onclick={handleClick}
		{...rest}
	>
		{@render body()}
	</a>
{:else}
	<button
		type="button"
		class="ui-menu-item"
		class:ui-menu-item--danger={danger}
		{role}
		aria-checked={checked}
		tabindex="-1"
		{disabled}
		onclick={handleClick}
		{...rest}
	>
		{@render body()}
	</button>
{/if}

<style>
	.leading {
		display: inline-flex;
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		margin-left: -0.125rem;
		overflow: hidden;
		border-radius: calc((var(--radius-panel) - var(--float-pad) - 0.375rem) * var(--corner-scale));
		corner-shape: var(--corner);
		box-shadow: inset 0 0 0 0.5px var(--rule);
	}
	.leading--plain {
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		margin-left: 0;
		overflow: visible;
		border-radius: 0;
		box-shadow: none;
	}
	.leading--plain > :global(*) {
		width: auto;
		height: auto;
	}
	.leading:not(.leading--plain) > :global(*) {
		width: 100%;
		height: 100%;
	}
	.check,
	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
	}
	.check {
		color: currentColor;
	}
	.icon {
		color: var(--text-muted);
	}
	:global(.ui-menu-item--danger) .icon {
		color: currentColor;
	}
	.label {
		display: block;
		flex: 1;
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.label--stack {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		text-box: normal;
		padding-block: 0;
		margin-block: 0;
	}
	.label-main {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.desc {
		overflow: hidden;
		color: var(--text-muted);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		text-overflow: ellipsis;
	}
	.trailing {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		margin-left: auto;
		padding-left: 0.75rem;
	}
	.shortcut {
		flex-shrink: 0;
		margin-left: auto;
		padding-left: 1.5rem;
		color: var(--text-faint);
		font-family: inherit;
		font-size: var(--text-callout);
		font-weight: var(--weight-regular);
		letter-spacing: 0.04em;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-box: trim-both cap alphabetic;
	}
	:global(.ui-menu-item--danger) .shortcut {
		color: color-mix(in oklab, currentColor 60%, transparent);
	}
</style>

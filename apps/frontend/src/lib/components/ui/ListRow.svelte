<script lang="ts">
	import type { Snippet } from 'svelte';
	import { presence as enterExit } from '$lib/utils/transitions';

	let {
		title,
		subtitle = undefined,
		href = undefined,
		onclick = undefined,
		leading = undefined,
		trailing = undefined,
		actions = undefined,
		titleSuffix = undefined,
		presence = false,
		pinned = false,
		selected = false,
		flush = false
	}: {
		title: string;
		subtitle?: string | Snippet;
		href?: string;
		onclick?: (e: MouseEvent) => void;
		leading?: Snippet;
		trailing?: Snippet;
		actions?: Snippet;
		titleSuffix?: Snippet;
		presence?: boolean;
		pinned?: boolean;
		selected?: boolean;
		flush?: boolean;
	} = $props();

	const interactive = $derived(!!href || !!onclick);

	function rowClick(e: MouseEvent) {
		if (!onclick || (e.target as HTMLElement).closest('a, button, input, [role=menuitem]')) return;
		const selection = window.getSelection();
		if (selection && !selection.isCollapsed && selection.toString().trim()) return;
		onclick(e);
	}
</script>

<div
	class="row"
	class:row--interactive={interactive}
	class:row--pinned={pinned}
	class:row--selected={selected}
	class:row--flush={flush}
	class:row--clickable={!href && !!onclick}
	{@attach (el: HTMLElement) => {
		if (href || !onclick) return;
		el.addEventListener('click', rowClick);
		return () => el.removeEventListener('click', rowClick);
	}}
	aria-current={selected ? 'true' : undefined}
	role="listitem"
	in:enterExit={{ enabled: presence }}
	out:enterExit={{ enabled: presence }}
>
	{#if href}
		<a class="hit" {href} aria-label={title} {title}></a>
	{:else if onclick}
		<button type="button" class="hit" {onclick} aria-label={title} {title}></button>
	{/if}
	{#if leading}<div class="leading">{@render leading()}</div>{/if}
	<div class="text">
		<div class="title-line">
			<span class="title" {title}>{title}</span>
			{#if titleSuffix}{@render titleSuffix()}{/if}
		</div>
		{#if subtitle}
			<div class="subtitle">
				{#if typeof subtitle === 'string'}<span class="subtitle-text" title={subtitle}
						>{subtitle}</span
					>{:else}{@render subtitle()}{/if}
			</div>
		{/if}
	</div>
	{#if trailing || actions}
		<div class="end">
			{#if trailing}<div class="trailing">{@render trailing()}</div>{/if}
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</div>
	{/if}
</div>

<style>
	.row {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 3.25rem;
		padding: 0.625rem 1rem;
		content-visibility: auto;
		contain-intrinsic-size: auto 3.25rem;
		overflow-clip-margin: 0.75rem;
	}
	.row:not(:first-child) {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.row--flush {
		padding: 0.75rem 0;
	}
	.row--interactive {
		transition: background-color var(--dur-fast) ease;
	}
	.row--interactive:hover {
		background: var(--bg-hover);
	}
	.row--selected,
	.row--selected.row--interactive:hover {
		background: var(--bg-active);
	}
	.hit {
		position: absolute;
		inset: 0;
		z-index: 0;
		border: none;
		background: none;
		cursor: pointer;
	}
	.row--clickable {
		cursor: pointer;
	}
	.row--clickable .hit {
		pointer-events: none;
	}
	.row--clickable .text {
		pointer-events: auto;
	}
	.hit:focus-visible {
		outline-offset: -2px;
		border-radius: 0;
	}
	.leading,
	.trailing,
	.actions {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		pointer-events: none;
	}
	.leading :global(*),
	.trailing :global(*) {
		pointer-events: none;
	}
	.end {
		position: relative;
		display: grid;
		flex-shrink: 0;
		justify-items: end;
		align-items: center;
	}
	.end > * {
		grid-area: 1 / 1;
	}
	.trailing {
		transition: opacity var(--dur-fast) ease;
	}
	.actions {
		z-index: 1;
		pointer-events: none;
		opacity: 0;
		transition: opacity var(--dur-fast) ease;
	}
	.row--pinned .actions,
	.row:hover .actions,
	.row:focus-within .actions,
	.actions:has(:global([aria-expanded='true'])),
	.actions:has(:global(:popover-open)) {
		pointer-events: auto;
		opacity: 1;
	}
	.row:hover .end:has(.actions) .trailing,
	.row:focus-within .end:has(.actions) .trailing,
	.end:has(:global([aria-expanded='true'])) .trailing,
	.end:has(:global(:popover-open)) .trailing {
		opacity: 0;
	}
	.text {
		position: relative;
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
		pointer-events: none;
	}
	.title-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.title {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.subtitle {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		overflow-x: clip;
		white-space: nowrap;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.subtitle-text {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
	}
	.trailing {
		font-size: var(--text-callout);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	@media (hover: none) {
		.actions {
			pointer-events: auto;
			opacity: 1;
		}
		.end:has(.actions) .trailing {
			display: none;
		}
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { StatusKind } from './status';

	let {
		tone = 'neutral',
		muted = false,
		struck = false,
		pinned = false,
		selected = false,
		class: klass = '',
		time = undefined,
		tile,
		title,
		meta = undefined,
		actions = undefined,
		...rest
	}: {
		tone?: StatusKind;
		muted?: boolean;
		struck?: boolean;
		pinned?: boolean;
		selected?: boolean;
		class?: string;
		time?: Snippet;
		tile: Snippet;
		title: Snippet;
		meta?: Snippet;
		actions?: Snippet;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
	class="ui-arow motion-echo echo--{tone} {klass}"
	class:ui-arow--muted={muted}
	class:ui-arow--struck={struck}
	class:ui-arow--pinned={pinned}
	class:ui-arow--selected={selected}
	role="listitem"
	aria-current={selected ? 'true' : undefined}
	{...rest}
>
	<div class="ui-arow-tile">{@render tile()}</div>
	<div class="ui-arow-main">
		<span class="ui-arow-title">{@render title()}</span>
		{#if meta}<span class="ui-arow-meta">{@render meta()}</span>{/if}
	</div>
	{#if time || actions}
		<div class="ui-arow-end">
			{#if time}<span class="ui-arow-time">{@render time()}</span>{/if}
			{#if actions}<div class="ui-arow-actions">{@render actions()}</div>{/if}
		</div>
	{/if}
</div>

<style>
	.ui-arow {
		--arow-inset: 0.5rem;
		display: grid;
		grid-template-columns: 1.75rem minmax(0, 1fr) auto;
		align-items: center;
		column-gap: 0.75rem;
		margin-inline: calc(var(--arow-inset) * -1);
		padding: var(--arow-inset);
		border-radius: calc(
			max(var(--radius-floor), var(--widget-r, var(--radius-card)) - var(--arow-inset)) *
				var(--corner-scale)
		);
		corner-shape: var(--corner);
		transition: background-color var(--fade-in) var(--curve-out);
	}
	.ui-arow:not(.ui-arow--pinned):hover {
		background-color: var(--bg-hover);
	}
	.ui-arow--selected,
	.ui-arow--selected:not(.ui-arow--pinned):hover {
		background-color: var(--bg-active);
	}
	.ui-arow-tile {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
	}
	.ui-arow-main {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}
	.ui-arow-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		height: var(--lh-body);
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: var(--weight-medium);
		color: var(--text-default);
		white-space: nowrap;
		overflow-x: clip;
	}
	.ui-arow--muted .ui-arow-title {
		font-weight: var(--weight-regular);
		color: var(--text-muted);
	}
	.ui-arow--struck .ui-arow-title {
		text-decoration: line-through;
		text-decoration-color: var(--text-faint);
	}
	.ui-arow-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		height: var(--lh-callout);
		overflow-x: clip;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.ui-arow-end {
		display: grid;
		justify-items: end;
		align-items: center;
	}
	.ui-arow-end > * {
		grid-area: 1 / 1;
	}
	.ui-arow-time {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		color: var(--text-faint);
		white-space: nowrap;
		transition: opacity var(--fade-in) var(--curve-out);
	}
	.ui-arow-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--fade-in) var(--curve-out);
	}
	.ui-arow--pinned .ui-arow-actions,
	.ui-arow:hover .ui-arow-actions,
	.ui-arow:has(:focus-visible) .ui-arow-actions,
	.ui-arow-actions:has(:global([aria-expanded='true'])) {
		opacity: 1;
		pointer-events: auto;
	}
	.ui-arow--pinned .ui-arow-end:has(.ui-arow-actions) .ui-arow-time,
	.ui-arow:hover .ui-arow-end:has(.ui-arow-actions) .ui-arow-time,
	.ui-arow:has(:focus-visible) .ui-arow-end:has(.ui-arow-actions) .ui-arow-time,
	.ui-arow-end:has(:global([aria-expanded='true'])) .ui-arow-time {
		opacity: 0;
	}
	@media (hover: none) {
		.ui-arow-actions {
			opacity: 1;
			pointer-events: auto;
		}
		.ui-arow-end:has(.ui-arow-actions) .ui-arow-time {
			visibility: hidden;
		}
	}
</style>

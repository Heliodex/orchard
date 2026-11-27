<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronRight } from 'lucide-svelte';
	import { springCollapse, springRotate } from '$lib/utils/motion.svelte';

	let {
		title,
		note = undefined,
		size = 'md',
		open = $bindable(false),
		children
	}: {
		title: string;
		note?: string;
		size?: 'md' | 'lg';
		open?: boolean;
		children: Snippet;
	} = $props();

	const uid = $props.id();
</script>

<div class="disclosure" class:disclosure--lg={size === 'lg'}>
	<button
		type="button"
		class="summary"
		aria-expanded={open}
		aria-controls="{uid}-body"
		onclick={() => (open = !open)}
	>
		<span class="chevron" {@attach springRotate(() => open, { rest: 0, on: 90 })}>
			<ChevronRight size={15} />
		</span>
		<span class="title">{title}</span>
		{#if note}<span class="note">{note}</span>{/if}
	</button>
	<div id="{uid}-body" inert={!open} {@attach springCollapse(() => !open)}>
		<div class="body">{@render children()}</div>
	</div>
</div>

<style>
	.disclosure {
		display: flex;
		flex-direction: column;
	}
	.summary {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: calc(100% + 1rem);
		min-height: 2rem;
		margin: 0 -0.5rem;
		padding: 0 0.5rem;
		border: none;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: none;
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		text-align: left;
		cursor: pointer;
		transition: background-color var(--dur-fast) ease;
	}
	.summary:hover {
		background: color-mix(in oklab, var(--neutral-10) 5%, transparent);
	}
	.summary:active {
		background: color-mix(in oklab, var(--neutral-10) 9%, transparent);
	}
	.summary:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}
	.chevron {
		display: inline-flex;
		color: var(--text-muted);
	}
	.note {
		margin-left: auto;
		font-size: var(--text-caption);
		font-weight: var(--weight-regular);
		color: var(--text-muted);
	}
	.disclosure--lg .summary {
		gap: 0.5rem;
		min-height: 2.25rem;
		font-size: var(--text-headline);
		line-height: var(--lh-headline);
	}
	.disclosure--lg .chevron {
		color: var(--text-faint);
	}
	.disclosure--lg .note {
		margin-left: 0.25rem;
		color: var(--text-faint);
		font-size: var(--text-caption);
	}
	.disclosure--lg .body {
		padding-top: 0.5rem;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding-top: 0.75rem;
	}
</style>

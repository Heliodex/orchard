<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Tone } from './types';

	let {
		tone = 'neutral',
		children
	}: {
		tone?: Tone | 'accent';
		children: Snippet;
	} = $props();
</script>

<span class="pill pill--{tone}"><span class="pill-text">{@render children()}</span></span>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		max-width: 100%;
		min-width: 0;
		height: 1.25rem;
		padding: 0 0.375rem;
		border-radius: calc(0.375rem * var(--corner-scale));
		corner-shape: var(--corner);
		font-size: var(--text-caption);
		font-weight: var(--weight-medium);
		line-height: 1;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-box: trim-both cap alphabetic;
	}
	.pill-text {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
	}
	.pill-text > :global(svg) {
		display: inline-block;
		vertical-align: middle;
	}
	.pill--neutral {
		background: var(--bg-active);
		color: var(--text-muted);
	}
	.pill--accent {
		background: var(--accent-3);
		color: var(--accent-9);
	}
	.pill--success {
		background: var(--green-3);
		color: var(--green-9);
	}
	.pill--warning {
		background: var(--amber-3);
		color: var(--amber-9);
	}
	.pill--error {
		background: var(--red-3);
		color: var(--red-9);
	}
	.pill--info {
		background: var(--blue-3);
		color: var(--blue-9);
	}
</style>

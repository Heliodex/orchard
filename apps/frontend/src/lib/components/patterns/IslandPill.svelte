<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		tone = 'ok',
		label,
		expanded = false,
		el = $bindable(),
		onclick,
		children
	}: {
		tone?: 'ok' | 'warn' | 'bad';
		label: string;
		expanded?: boolean;
		el?: HTMLButtonElement;
		onclick: () => void;
		children: Snippet;
	} = $props();
</script>

<button
	bind:this={el}
	type="button"
	class="pill pill--{tone}"
	aria-label={label}
	aria-expanded={expanded}
	{onclick}
>
	{@render children()}
</button>

<style>
	.pill {
		--island-fg: var(--text-default);
		--island-muted: var(--text-muted);
		--island-faint: var(--text-faint);
		--island-rule: var(--border-default);
		--island-ok: var(--status-success);
		--island-tone: var(--text-default);
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		height: 2.25rem;
		padding: 0 0.875rem 0 0.75rem;
		border: none;
		border-radius: calc(1.125rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow:
			inset 0 0 0 0.5px var(--border-strong),
			0 1px 2px color-mix(in oklab, var(--neutral-10) 6%, transparent);
		color: var(--island-fg);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		text-align: left;
		cursor: pointer;
	}
	.pill:hover {
		background: color-mix(in oklab, var(--neutral-10) 3%, var(--bg-surface));
	}
	.pill:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.pill--warn {
		--island-tone: var(--status-warning);
	}
	.pill--bad {
		--island-tone: var(--status-error);
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronsUpDown } from 'lucide-svelte';

	let {
		value = $bindable(''),
		size = 'md',
		class: className = '',
		children,
		...rest
	}: {
		value?: string;
		size?: 'md' | 'sm';
		class?: string;
		children: Snippet;
		[key: string]: unknown;
	} = $props();
</script>

<span class="wrap {className}">
	<select class="select select--{size}" bind:value {...rest}>
		{@render children()}
	</select>
	<span class="chev" aria-hidden="true"><ChevronsUpDown size={14} /></span>
</span>

<style>
	.wrap {
		position: relative;
		display: block;
		min-width: 0;
	}
	.select {
		display: block;
		width: 100%;
		height: 2rem;
		padding: 0 2rem 0 0.625rem;
		border: none;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-raised);
		box-shadow: var(--shadow-raised);
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		appearance: none;
		cursor: pointer;
		transition: background-color var(--dur-fast) ease;
	}
	.select--sm {
		height: 1.75rem;
		font-size: var(--text-callout);
	}
	.select:hover:not(:disabled) {
		background: var(--bg-hover);
	}
	.select:focus-visible {
		outline: none;
		box-shadow:
			inset 0 0 0 1px var(--accent),
			0 0 0 3px var(--focus-ring);
	}
	.select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.chev {
		position: absolute;
		top: 50%;
		right: 0.5rem;
		display: flex;
		color: var(--text-faint);
		transform: translateY(-50%);
		pointer-events: none;
	}
</style>

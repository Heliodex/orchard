<script lang="ts">
	import { Search, X } from 'lucide-svelte';

	let {
		value = $bindable(''),
		placeholder = 'Search',
		shortcut = undefined,
		size = 'md',
		class: className = '',
		...rest
	}: {
		value?: string;
		placeholder?: string;
		shortcut?: string;
		size?: 'sm' | 'md';
		class?: string;
		[key: string]: unknown;
	} = $props();

	let input = $state<HTMLInputElement>();

	function editable(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return false;
		return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
	}

	function matches(e: KeyboardEvent) {
		if (!shortcut) return false;
		const mod = /^(⌘|Ctrl\+?)/.test(shortcut);
		const key = shortcut.replace(/^(⌘|Ctrl\+?)/, '').toLowerCase();
		if (mod) {
			return (e.metaKey || e.ctrlKey) && !e.altKey && e.code === `Key${key.toUpperCase()}`;
		}
		if (e.metaKey || e.ctrlKey || e.altKey || editable(e.target)) return false;
		return e.key.toLowerCase() === key;
	}

	function onkeydown(e: KeyboardEvent) {
		if (!input || !matches(e)) return;
		e.preventDefault();
		input.focus();
		input.select();
	}
</script>

<svelte:window {onkeydown} />

<label class="search search--{size} {className}">
	<span class="icon" aria-hidden="true"><Search size={size === 'sm' ? 14 : 15} /></span>
	<input
		bind:this={input}
		type="search"
		class="field"
		{placeholder}
		bind:value
		onkeydown={(e) => {
			if (e.key === 'Escape') input?.blur();
		}}
		aria-label={placeholder}
		{...rest}
	/>
	{#if value}
		<button type="button" class="clear" aria-label="Clear search" onclick={() => (value = '')}>
			<X size={12} strokeWidth={2.5} />
		</button>
	{:else if shortcut}
		<kbd class="kbd">{shortcut}</kbd>
	{/if}
</label>

<style>
	.search {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		height: 2rem;
		padding: 0 0.375rem 0 0.6875rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		box-shadow: inset 0 0 0 0.5px color-mix(in oklab, var(--neutral-10) 6%, transparent);
		color: var(--text-muted);
		cursor: text;
		transition:
			background-color var(--dur-fast) ease,
			box-shadow var(--dur-fast) ease;
	}
	.search--sm {
		height: 1.75rem;
		padding-left: 0.625rem;
	}
	.search:hover:not(:focus-within) {
		background: color-mix(in oklab, var(--neutral-10) 8%, transparent);
	}
	.search:focus-within {
		background: var(--bg-surface);
		box-shadow:
			inset 0 0 0 1px var(--accent-solid),
			0 0 0 3.5px color-mix(in oklab, var(--accent-solid) 22%, transparent);
	}
	.icon {
		display: flex;
		flex-shrink: 0;
	}
	.field {
		flex: 1;
		min-width: 0;
		height: 100%;
		padding: 0;
		border: none;
		background: none;
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		outline: none;
		appearance: none;
	}
	.search--sm .field {
		font-size: var(--text-callout);
	}
	.field::placeholder {
		color: var(--text-muted);
	}
	.field::-webkit-search-cancel-button {
		appearance: none;
	}
	.clear {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.125rem;
		height: 1.125rem;
		margin-right: 0.25rem;
		border: none;
		border-radius: calc(
			max(var(--radius-floor), var(--radius-control) - 0.4375rem) * var(--corner-scale)
		);
		corner-shape: var(--corner);
		background: var(--neutral-6);
		color: var(--bg-surface);
		cursor: pointer;
	}
	.kbd {
		flex-shrink: 0;
		padding: 0.1875rem 0.375rem;
		border-radius: calc(
			max(var(--radius-floor), var(--radius-control) - 0.375rem) * var(--corner-scale)
		);
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow: inset 0 0 0 0.5px var(--border-strong);
		color: var(--text-muted);
		font-family: inherit;
		font-size: var(--text-micro);
		font-weight: var(--weight-medium);
	}
</style>

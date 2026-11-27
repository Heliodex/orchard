<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Icon } from './types';
	import Spinner from './Spinner.svelte';

	let {
		variant = 'secondary',
		size = 'md',
		shape = 'rounded',
		href = undefined,
		type = 'button',
		loading = false,
		disabled = false,
		icon = undefined,
		iconRight = undefined,
		leading = undefined,
		label = undefined,
		class: className = '',
		children,
		...rest
	}: {
		variant?: 'primary' | 'secondary' | 'tinted' | 'ghost' | 'danger' | 'media';
		size?: 'sm' | 'md' | 'lg';
		shape?: 'rounded' | 'capsule';
		href?: string;
		type?: 'button' | 'submit';
		loading?: boolean;
		disabled?: boolean;
		icon?: Icon;
		iconRight?: Icon;
		leading?: Snippet;
		label?: string;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const iconOnly = $derived(!children && !!icon);
	const iconSize = $derived(size === 'sm' ? 14 : size === 'lg' ? 18 : 16);
</script>

{#snippet body()}
	{#if loading}
		<Spinner size={iconSize} />
	{:else if icon}
		{@const Leading = icon}
		<Leading size={iconSize} aria-hidden="true" />
	{:else if leading}
		<span class="leading" aria-hidden="true">{@render leading()}</span>
	{/if}
	{#if children}<span class="label">{@render children()}</span>{/if}
	{#if iconRight && !loading}
		{@const Trailing = iconRight}
		<Trailing size={iconSize} aria-hidden="true" />
	{/if}
{/snippet}

{#if href && !disabled}
	<a
		{href}
		class="button button--{variant} button--{size} {className}"
		class:button--capsule={shape === 'capsule'}
		class:button--icon={iconOnly}
		aria-label={label}
		{...rest}>{@render body()}</a
	>
{:else}
	<button
		{type}
		class="button button--{variant} button--{size} {className}"
		class:button--capsule={shape === 'capsule'}
		class:button--icon={iconOnly}
		class:button--loading={loading}
		disabled={disabled || loading}
		aria-busy={loading || undefined}
		aria-label={label}
		{...rest}>{@render body()}</button
	>
{/if}

<style>
	.button {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		flex-shrink: 0;
		max-width: 100%;
		height: 2rem;
		padding: 0 0.8125rem;
		border: none;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		letter-spacing: -0.005em;
		line-height: 1;
		white-space: nowrap;
		text-decoration: none;
		cursor: pointer;
		user-select: none;
		isolation: isolate;
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease,
			opacity var(--dur-fast) ease,
			transform var(--spring-press-duration) var(--spring-press);
	}
	.button:active:not(:disabled) {
		transform: scale(0.96);
		--rond: var(--rond-press);
	}
	.button:disabled {
		cursor: default;
		opacity: 0.4;
	}
	.button--loading:disabled {
		opacity: 0.75;
	}
	.button--sm {
		height: 1.75rem;
		padding: 0 0.625rem;
		border-radius: calc(0.5625rem * var(--corner-scale));
		corner-shape: var(--corner);
		font-size: var(--text-callout);
		gap: 0.3125rem;
	}
	.button--lg {
		height: 2.5rem;
		padding: 0 1.125rem;
		border-radius: calc(0.75rem * var(--corner-scale));
		corner-shape: var(--corner);
		font-size: var(--text-headline);
		gap: 0.5rem;
	}
	.button--icon {
		width: 2rem;
		padding: 0;
	}
	.button--sm.button--icon {
		width: 1.75rem;
	}
	.button--lg.button--icon {
		width: 2.5rem;
	}
	.button > :global(svg) {
		flex-shrink: 0;
	}
	.leading {
		display: flex;
		flex-shrink: 0;
	}
	.label {
		display: block;
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		text-box: trim-both cap alphabetic;
		transition: font-variation-settings var(--spring-press-duration) var(--spring-press);
	}
	.label :global(svg) {
		position: relative;
		top: calc(0.5ex - 0.5cap);
		display: inline-block;
		vertical-align: middle;
	}

	.button--primary {
		background-color: var(--accent-solid);
		color: var(--on-solid);
		box-shadow: 0 1px 2px color-mix(in oklab, var(--neutral-10) 14%, transparent);
	}
	.button--primary:hover:not(:disabled) {
		background-color: var(--accent-solid-hover);
	}

	.button--secondary {
		background: color-mix(in oklab, var(--neutral-10) 7%, transparent);
		color: var(--text-default);
	}
	.button--secondary:hover:not(:disabled) {
		background: color-mix(in oklab, var(--neutral-10) 11%, transparent);
	}

	.button--tinted {
		background: color-mix(in oklab, var(--accent-solid) 13%, transparent);
		color: var(--accent-9);
	}
	.button--tinted:hover:not(:disabled) {
		background: color-mix(in oklab, var(--accent-solid) 19%, transparent);
	}

	.button--ghost {
		background: transparent;
		color: var(--text-muted);
	}
	.button--ghost:hover:not(:disabled) {
		background: color-mix(in oklab, var(--neutral-10) 7%, transparent);
		color: var(--text-default);
	}

	.button--danger {
		background: color-mix(in oklab, var(--red-solid) 12%, transparent);
		color: var(--red-9);
	}
	.button--danger:hover:not(:disabled) {
		background: color-mix(in oklab, var(--red-solid) 18%, transparent);
	}

	.button--media {
		background: var(--on-media-fill);
		color: var(--on-media);
		box-shadow: inset 0 0 0 0.5px var(--on-media-edge);
	}
	.button--media:hover:not(:disabled) {
		background: var(--on-media-fill-hover);
	}
	.button--capsule {
		border-radius: 999px;
		corner-shape: round;
	}
</style>

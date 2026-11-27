<script lang="ts">
	import { stretchIndicator } from './slide.svelte';
	import Tooltip from './Tooltip.svelte';
	import type { Icon } from './types';

	interface Option {
		value: string;
		label: string;
		hint?: string;
		icon?: Icon;
		optionClass?: string;
		disabled?: boolean;
	}

	let {
		options,
		value = $bindable(''),
		label,
		onchange = undefined,
		grow = false,
		size = 'md',
		shape = 'rounded',
		iconOnly = false
	}: {
		options: readonly Option[];
		value: string;
		label: string;
		onchange?: (value: string) => void;
		grow?: boolean;
		size?: 'md' | 'sm';
		shape?: 'rounded' | 'capsule';
		iconOnly?: boolean;
	} = $props();

	const buttons: Record<string, HTMLButtonElement> = $state({});

	function select(next: string) {
		value = next;
		onchange?.(next);
	}
</script>

{#snippet option(opt: Option)}
	<button
		bind:this={buttons[opt.value]}
		type="button"
		role="radio"
		aria-checked={value === opt.value}
		aria-label={iconOnly ? opt.label : opt.hint}
		class="opt {opt.optionClass ?? ''}"
		class:opt--active={value === opt.value}
		disabled={opt.disabled}
		onclick={() => select(opt.value)}
	>
		{#if opt.icon}
			{@const Glyph = opt.icon}
			<Glyph size={size === 'sm' ? 14 : 16} strokeWidth={1.75} aria-hidden="true" />
		{/if}
		{#if !iconOnly}{opt.label}{/if}
	</button>
{/snippet}

<div
	class="seg seg--{size}"
	class:seg--capsule={shape === 'capsule'}
	class:seg--grow={grow}
	class:seg--icons={iconOnly}
	role="radiogroup"
	aria-label={label}
>
	<span class="thumb" aria-hidden="true" {@attach stretchIndicator(() => buttons[value])}></span>
	{#each options as opt (opt.value)}
		{#if iconOnly}
			<Tooltip text={opt.hint ?? opt.label} placement="bottom">{@render option(opt)}</Tooltip>
		{:else}
			{@render option(opt)}
		{/if}
	{/each}
</div>

<style>
	.seg {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		width: fit-content;
		padding: 0.125rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-active);
	}
	.seg--grow {
		display: flex;
		width: 100%;
	}
	.seg--grow .opt {
		flex: 1;
	}
	.thumb {
		position: absolute;
		top: 0;
		left: 0;
		border-radius: calc((var(--radius-control) - 0.125rem) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-raised);
		box-shadow:
			0 0 0 0.5px rgb(0 0 0 / 0.06),
			0 1px 2px rgb(0 0 0 / 0.1),
			0 2px 6px rgb(0 0 0 / 0.04);
		pointer-events: none;
		will-change: transform;
	}
	.opt {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		height: 1.75rem;
		min-width: 2rem;
		padding: 0 0.75rem;
		border: none;
		border-radius: calc((var(--radius-control) - 0.125rem) * var(--corner-scale));
		corner-shape: var(--corner);
		background: none;
		color: var(--text-muted);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
		white-space: nowrap;
		cursor: pointer;
		transition:
			color var(--dur-fast) ease,
			transform var(--spring-press-duration) var(--spring-press),
			font-variation-settings var(--spring-smooth-duration) var(--spring-smooth);
	}
	.opt:active:not(:disabled) {
		transform: scale(0.96);
	}
	.opt:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	:global(html.motion-reduce) .opt:active {
		transform: none;
	}
	.seg--sm .opt {
		height: 1.5rem;
		padding: 0 0.5rem;
		font-size: var(--text-caption);
	}
	.seg--icons .opt {
		width: 2rem;
		min-width: 0;
		padding: 0;
	}
	.seg--icons.seg--sm .opt {
		width: 1.75rem;
		padding: 0;
	}
	.seg--capsule,
	.seg--capsule .thumb,
	.seg--capsule .opt {
		border-radius: 999px;
		corner-shape: round;
	}
	.opt:hover,
	.opt--active {
		color: var(--text-default);
	}
</style>

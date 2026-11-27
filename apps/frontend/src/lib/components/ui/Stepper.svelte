<script lang="ts">
	import { Minus, Plus } from 'lucide-svelte';

	let {
		value = $bindable(1),
		min = 1,
		max = 99,
		step = 1,
		disabled = false,
		label = undefined,
		suffix = undefined,
		size = 'md',
		shape = 'rounded',
		id = undefined,
		onchange = undefined
	}: {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		label?: string;
		suffix?: string;
		size?: 'sm' | 'md';
		shape?: 'rounded' | 'capsule';
		id?: string;
		onchange?: (value: number) => void;
	} = $props();

	let hold: ReturnType<typeof setTimeout> | undefined;
	let repeat: ReturnType<typeof setInterval> | undefined;
	let repeated = false;

	function clamp(n: number): number {
		if (!Number.isFinite(n)) return min;
		const snapped = min + Math.round((n - min) / step) * step;
		return Number(Math.min(max, Math.max(min, snapped)).toFixed(6));
	}

	function set(next: number) {
		const v = clamp(next);
		if (v === value) return;
		value = v;
		onchange?.(v);
	}

	function nudge(dir: 1 | -1) {
		set(value + dir * step);
		if (value <= min || value >= max) stopHold();
	}

	function startHold(dir: 1 | -1, event: PointerEvent) {
		if (event.button !== 0) return;
		stopHold();
		repeated = false;
		hold = setTimeout(() => {
			repeat = setInterval(() => {
				repeated = true;
				nudge(dir);
			}, 70);
		}, 420);
	}

	function stopHold() {
		clearTimeout(hold);
		clearInterval(repeat);
	}

	function click(dir: 1 | -1) {
		if (repeated) {
			repeated = false;
			return;
		}
		nudge(dir);
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			nudge(1);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			nudge(-1);
		}
	}
</script>

<div
	class="stepper stepper--{size} stepper--{shape}"
	class:stepper--disabled={disabled}
	role="group"
	aria-label={label}
>
	<button
		type="button"
		class="step"
		aria-label="Decrease"
		disabled={disabled || value <= min}
		onclick={() => click(-1)}
		onpointerdown={(e) => startHold(-1, e)}
		onpointerup={stopHold}
		onpointerleave={stopHold}
		onpointercancel={stopHold}
	>
		<Minus size={14} strokeWidth={2.25} />
	</button>
	<span class="field">
		<input
			{id}
			type="number"
			class="num"
			inputmode="numeric"
			{min}
			{max}
			{step}
			{disabled}
			aria-label={label}
			bind:value
			onkeydown={onKey}
			onblur={() => set(value)}
			style:width="{Math.max(String(max).length, String(value ?? '').length, 1) + 0.5}ch"
		/>
		{#if suffix}<span class="suffix">{suffix}</span>{/if}
	</span>
	<button
		type="button"
		class="step"
		aria-label="Increase"
		disabled={disabled || value >= max}
		onclick={() => click(1)}
		onpointerdown={(e) => startHold(1, e)}
		onpointerup={stopHold}
		onpointerleave={stopHold}
		onpointercancel={stopHold}
	>
		<Plus size={14} strokeWidth={2.25} />
	</button>
</div>

<style>
	.stepper {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		height: 2rem;
		padding: 0.125rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-raised);
		box-shadow: var(--shadow-raised);
	}
	.stepper--sm {
		height: 1.75rem;
	}
	.stepper--sm .step {
		width: 1.5rem;
		height: 1.5rem;
	}
	.stepper--capsule {
		border-radius: 999px;
		corner-shape: round;
	}
	.stepper--capsule .step {
		border-radius: 50%;
	}
	.stepper--sm .num,
	.stepper--sm .suffix {
		font-size: var(--text-footnote);
	}
	.stepper--disabled {
		opacity: 0.45;
	}
	.step {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: none;
		border-radius: calc(var(--radius-control) - 0.125rem);
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}
	.step :global(svg) {
		transition: transform var(--spring-press-duration) var(--spring-press);
	}
	.step:hover:not(:disabled) {
		background: var(--bg-hover);
		color: var(--text-default);
	}
	.step:active:not(:disabled) {
		background: var(--bg-active);
	}
	.step:active:not(:disabled) :global(svg) {
		transform: scale(0.82);
	}
	.step:disabled {
		color: var(--text-faint);
		opacity: 0.6;
		cursor: default;
	}
	.step:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}
	.field {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.25rem;
		min-width: 2.25rem;
		padding: 0 0.375rem;
		cursor: text;
	}
	.num {
		min-width: 1.5ch;
		padding: 0;
		border: none;
		background: none;
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: var(--weight-medium);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-align: center;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	.num::-webkit-outer-spin-button,
	.num::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.num:focus {
		outline: none;
	}
	.stepper:has(.num:focus-visible) {
		box-shadow:
			inset 0 0 0 1px var(--accent),
			0 0 0 3px var(--focus-ring);
	}
	.suffix {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
		white-space: nowrap;
	}
</style>

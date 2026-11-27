<script lang="ts">
	let {
		value = $bindable(1),
		min = 0,
		max = 10,
		step = 1,
		label,
		disabled = false,
		ticks = false,
		showValue = false,
		onchange = undefined
	}: {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		label: string;
		disabled?: boolean;
		ticks?: boolean;
		showValue?: boolean;
		onchange?: (value: number) => void;
	} = $props();

	let trackEl = $state<HTMLDivElement | null>(null);
	let pressed = $state(false);
	let tracking = $state(false);
	let dragStartValue = $state(value);

	const span = $derived(Math.max(step, max - min));
	const ratio = $derived((clamp(value) - min) / span);
	const tickValues = $derived(
		ticks && span / step <= 20
			? Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => min + i * step)
			: []
	);

	function clamp(next: number) {
		return Math.min(max, Math.max(min, next));
	}

	function commit(next: number) {
		const snapped = clamp(min + Math.round((next - min) / step) * step);
		const rounded = Number(snapped.toFixed(6));
		if (rounded === value) return;
		value = rounded;
		onchange?.(rounded);
	}

	function valueAt(clientX: number) {
		if (!trackEl) return value;
		const rect = trackEl.getBoundingClientRect();
		const inset = rect.height / 2;
		const width = Math.max(1, rect.width - inset * 2);
		const r = Math.max(0, Math.min(1, (clientX - rect.left - inset) / width));
		return min + r * span;
	}

	function onPointerDown(event: PointerEvent) {
		if (disabled || !trackEl || event.button !== 0) return;
		pressed = true;
		tracking = false;
		dragStartValue = value;
		trackEl.setPointerCapture(event.pointerId);
		commit(valueAt(event.clientX));
	}

	function onPointerMove(event: PointerEvent) {
		if (!pressed) return;
		tracking = true;
		commit(valueAt(event.clientX));
	}

	function release(event: PointerEvent) {
		if (!pressed || !trackEl) return;
		pressed = false;
		tracking = false;
		if (trackEl.hasPointerCapture(event.pointerId)) trackEl.releasePointerCapture(event.pointerId);
	}

	function onPointerCancel(event: PointerEvent) {
		if (!pressed) return;
		release(event);
		commit(dragStartValue);
	}

	function onKeyDown(event: KeyboardEvent) {
		if (disabled) return;
		const keys: Record<string, number> = {
			ArrowRight: step,
			ArrowUp: step,
			ArrowLeft: -step,
			ArrowDown: -step,
			PageUp: step * 5,
			PageDown: -step * 5
		};
		if (event.key === 'Home') {
			event.preventDefault();
			commit(min);
			return;
		}
		if (event.key === 'End') {
			event.preventDefault();
			commit(max);
			return;
		}
		const delta = keys[event.key];
		if (delta === undefined) return;
		event.preventDefault();
		commit(value + delta);
	}
</script>

<div class="slider" class:slider--disabled={disabled} class:slider--value={showValue}>
	<div
		bind:this={trackEl}
		class="hit"
		class:hit--pressed={pressed}
		class:hit--tracking={tracking}
		style:--ratio={ratio}
		role="slider"
		tabindex={disabled ? -1 : 0}
		aria-label={label}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={value}
		aria-disabled={disabled}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={release}
		onpointercancel={onPointerCancel}
		onkeydown={onKeyDown}
	>
		<div class="groove">
			<div class="travel">
				<div class="mover">
					<div class="fill"></div>
				</div>
			</div>
		</div>
		{#if tickValues.length}
			<div class="travel" aria-hidden="true">
				{#each tickValues as tick (tick)}
					<span
						class="tick"
						class:tick--on={tick <= value}
						style:left="{((tick - min) / span) * 100}%"
					></span>
				{/each}
			</div>
		{/if}
		<div class="travel" aria-hidden="true">
			<div class="mover">
				<span class="knob"></span>
			</div>
		</div>
	</div>
	{#if showValue}<span class="readout" aria-hidden="true">{value}</span>{/if}
</div>

<style>
	.slider {
		width: 100%;
		min-width: 0;
	}
	.slider--value {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.slider--value .hit {
		flex: 1;
		min-width: 0;
	}
	.readout {
		flex-shrink: 0;
		min-width: 2ch;
		color: var(--text-default);
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: var(--weight-medium);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-align: right;
	}
	.hit {
		--knob: 1.25rem;
		position: relative;
		width: 100%;
		height: var(--knob);
		margin-block: 0.375rem;
		border-radius: var(--radius-pill);
		cursor: pointer;
		outline: none;
		touch-action: none;
		user-select: none;
	}
	.slider--disabled .hit {
		cursor: not-allowed;
		opacity: 0.45;
	}
	.groove {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 0.25rem;
		margin-top: -0.125rem;
		border-radius: var(--radius-pill);
		background: var(--bg-active);
		box-shadow: inset 0 0.5px 1px color-mix(in oklab, var(--neutral-10) 10%, transparent);
		overflow: hidden;
	}
	.travel {
		position: absolute;
		inset: 0 calc(var(--knob) / 2);
		pointer-events: none;
	}
	.mover {
		position: absolute;
		inset: 0;
		transform: translateX(calc(var(--ratio) * 100%));
		transition: transform var(--spring-glide-duration) var(--spring-glide);
	}
	.hit--tracking .mover {
		transition: none;
	}
	.fill {
		position: absolute;
		top: 0;
		bottom: 0;
		right: 100%;
		width: calc(100% + var(--knob));
		background: var(--accent);
	}
	.tick {
		position: absolute;
		top: 50%;
		width: 0.25rem;
		height: 0.25rem;
		margin: -0.125rem 0 0 -0.125rem;
		border-radius: 50%;
		background: var(--neutral-6);
		transition: background-color var(--dur-fast) ease;
	}
	.tick--on {
		background: color-mix(in oklab, var(--text-on-accent) 70%, transparent);
	}
	.knob {
		position: absolute;
		top: 50%;
		left: 0;
		width: var(--knob);
		height: var(--knob);
		margin: calc(var(--knob) / -2) 0 0 calc(var(--knob) / -2);
		border-radius: 50%;
		background: white;
		box-shadow:
			0 0 0 0.5px color-mix(in oklab, black 14%, transparent),
			0 1px 2px color-mix(in oklab, black 14%, transparent),
			0 3px 8px color-mix(in oklab, black 10%, transparent);
		transition: transform var(--spring-press-duration) var(--spring-press);
	}
	.hit:hover:not([aria-disabled='true']) .knob {
		transform: scale(1.06);
	}
	.hit--pressed .knob,
	.hit--pressed:hover .knob {
		transform: scale(1.18);
	}
	.knob::after {
		content: '';
		position: absolute;
		inset: -3px;
		border-radius: 50%;
		box-shadow: 0 0 0 3px var(--focus-ring);
		opacity: 0;
		transition: opacity var(--dur-fast) ease;
	}
	.hit:focus-visible .knob::after {
		opacity: 1;
	}
</style>

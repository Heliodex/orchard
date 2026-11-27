<script lang="ts">
	interface Slice {
		label: string;
		value: number;
		color?: string;
	}

	interface Props {
		slices: Slice[];
		size?: number;
		thickness?: number;
		/** Big label inside the donut. */
		centerLabel?: string;
		/** Small caption below the center label. */
		centerCaption?: string;
		/** Function to format a slice value for the legend. */
		formatValue?: (n: number) => string;
	}

	let {
		slices,
		size = 180,
		thickness = 22,
		centerLabel,
		centerCaption,
		formatValue = (n) => String(n)
	}: Props = $props();

	// Stable palette pulled from the platform's accent + chart-friendly hues.
	const DEFAULT_PALETTE = [
		'#ae2a3a', // primary (--button-bg)
		'#4a8aff',
		'#22c55e',
		'#f59e0b',
		'#a855f7',
		'#06b6d4',
		'#ec4899',
		'#84cc16',
		'#f97316',
		'#14b8a6'
	];

	const cx = $derived(size / 2);
	const cy = $derived(size / 2);
	const r = $derived((size - thickness) / 2);

	const visible = $derived(slices.filter((s) => s.value > 0));
	const total = $derived(visible.reduce((s, x) => s + x.value, 0));

	type Computed = { slice: Slice; pct: number; path: string; color: string };

	function arcPath(startAngle: number, endAngle: number): string {
		// Angles in radians, 0 = right, increasing counterclockwise per standard math;
		// we rotate the whole group -90° so 0 = top.
		const sx = cx + r * Math.cos(startAngle);
		const sy = cy + r * Math.sin(startAngle);
		const ex = cx + r * Math.cos(endAngle);
		const ey = cy + r * Math.sin(endAngle);
		const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
		return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
	}

	const computed = $derived.by<Computed[]>(() => {
		if (total <= 0) return [];
		const arr: Computed[] = [];
		let cursorAngle = 0;
		// If there's only one slice, draw it as a full circle path (two arcs).
		visible.forEach((s, i) => {
			const p = s.value / total;
			const startAngle = cursorAngle;
			let endAngle = cursorAngle + p * Math.PI * 2;
			// Nudge slightly to avoid full-360 collapsing to nothing.
			if (p >= 0.999) endAngle = startAngle + Math.PI * 2 - 0.0001;
			const path = arcPath(startAngle, endAngle);
			arr.push({
				slice: s,
				pct: p,
				path,
				color: s.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]
			});
			cursorAngle = endAngle;
		});
		return arr;
	});
</script>

<div class="donut-wrap">
	<div class="donut-svg-wrap" style="width: {size}px; height: {size}px;">
		<svg viewBox="0 0 {size} {size}" width={size} height={size} aria-hidden="true">
			<circle
				{cx}
				{cy}
				{r}
				fill="none"
				stroke="color-mix(in srgb, var(--surface-border) 60%, transparent)"
				stroke-width={thickness}
			/>
			{#if total <= 0}
				<text x={cx} y={cy + 4} text-anchor="middle" font-size="11" fill="var(--surface-muted)"
					>No data</text
				>
			{:else}
				<g transform="rotate(-90 {cx} {cy})">
					{#each computed as c, i (i)}
						<path
							d={c.path}
							fill="none"
							stroke={c.color}
							stroke-width={thickness}
							stroke-linecap="butt"
							class="donut-slice"
							style="--anim-delay: {i * 60}ms;"
						/>
					{/each}
				</g>
			{/if}
		</svg>
		{#if centerLabel || centerCaption}
			<div class="donut-center">
				{#if centerLabel}
					<div class="donut-center-label">{centerLabel}</div>
				{/if}
				{#if centerCaption}
					<div class="donut-center-caption">{centerCaption}</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if slices.length > 0 && total > 0}
		<ul class="donut-legend">
			{#each computed as c, i (i)}
				<li class="donut-legend-item">
					<span class="donut-legend-swatch" style="background-color: {c.color};"></span>
					<span class="donut-legend-label">{c.slice.label}</span>
					<span class="donut-legend-value">
						<span class="donut-legend-amount">{formatValue(c.slice.value)}</span>
						<span class="donut-legend-pct">{Math.round(c.pct * 100)}%</span>
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.donut-wrap {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	.donut-svg-wrap {
		position: relative;
		flex-shrink: 0;
	}
	.donut-svg-wrap svg {
		display: block;
	}
	.donut-slice {
		animation: donut-fade 350ms cubic-bezier(0.22, 1, 0.36, 1) var(--anim-delay, 0ms) both;
		transform-origin: center;
	}
	@keyframes donut-fade {
		from {
			opacity: 0;
			transform: scale(0.92);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	.donut-center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.donut-center-label {
		font-size: var(--text-headline);
		line-height: var(--lh-headline);
		font-weight: 700;
		color: var(--center-channel-color);
		letter-spacing: -0.01em;
	}
	.donut-center-caption {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--surface-muted);
		margin-top: 0.125rem;
	}

	.donut-legend {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 14rem;
		flex: 1;
	}
	.donut-legend-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--center-channel-color);
	}
	.donut-legend-swatch {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: var(--radius-xs);
		flex-shrink: 0;
	}
	.donut-legend-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	.donut-legend-value {
		display: inline-flex;
		gap: 0.5rem;
		align-items: baseline;
	}
	.donut-legend-amount {
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		font-weight: 600;
	}
	.donut-legend-pct {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--surface-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		min-width: 2.5rem;
		text-align: right;
	}
</style>

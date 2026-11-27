<script lang="ts">
	import { Infinity as InfinityIcon } from 'lucide-svelte';

	interface Props {
		value: number;
		max: number | null;
		label: string;
		formatValue: (n: number) => string;
		size?: 'sm' | 'md' | 'lg';
		/** Sub-line under the big number (e.g. "of 1000m"). Optional. */
		caption?: string | null;
	}

	let { value, max, label, formatValue, size = 'md', caption = null }: Props = $props();

	const dims = $derived(
		size === 'sm'
			? { w: 160, h: 110, r: 60, sw: 12, fs: 18, fsSub: 11 }
			: size === 'lg'
				? { w: 280, h: 180, r: 110, sw: 20, fs: 32, fsSub: 14 }
				: { w: 220, h: 140, r: 84, sw: 16, fs: 24, fsSub: 12 }
	);

	const cx = $derived(dims.w / 2);
	const cy = $derived(dims.h - 12);

	const isUnlimited = $derived(max === null);
	const pct = $derived(
		isUnlimited ? 0 : max && max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
	);
	const pctClamped = $derived(isUnlimited ? 0 : pct);

	const endX = $derived(cx - dims.r * Math.cos(Math.PI * pctClamped));
	const endY = $derived(cy - dims.r * Math.sin(Math.PI * pctClamped));

	const fillColor = $derived(
		isUnlimited
			? 'var(--surface-muted)'
			: pct >= 0.9
				? 'var(--error-text-color)'
				: pct >= 0.7
					? 'var(--warning-text)'
					: 'var(--success-text)'
	);

	const bgArc = $derived(`M ${cx - dims.r} ${cy} A ${dims.r} ${dims.r} 0 0 1 ${cx + dims.r} ${cy}`);
	const fillArc = $derived(
		pctClamped < 0.001 ? '' : `M ${cx - dims.r} ${cy} A ${dims.r} ${dims.r} 0 0 1 ${endX} ${endY}`
	);

	// Tick angles in % space.
	const ticks = [0, 0.25, 0.5, 0.75, 1] as const;

	function tickEnd(t: number, inner: number, outer: number) {
		const a = Math.PI * t;
		return {
			x1: cx - inner * Math.cos(a),
			y1: cy - inner * Math.sin(a),
			x2: cx - outer * Math.cos(a),
			y2: cy - outer * Math.sin(a)
		};
	}

	const remaining = $derived(isUnlimited || !max ? null : Math.max(0, max - value));
	const overLimit = $derived(!isUnlimited && max !== null && value > max);
</script>

<div class="speedo" style="--fill-color: {fillColor}; --max-w: {dims.w}px;">
	<svg viewBox="0 0 {dims.w} {dims.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
		<path
			d={bgArc}
			stroke="color-mix(in srgb, var(--surface-border) 60%, transparent)"
			stroke-width={dims.sw}
			stroke-linecap="round"
			fill="none"
		/>
		{#if fillArc}
			<path
				d={fillArc}
				stroke={fillColor}
				stroke-width={dims.sw}
				stroke-linecap="round"
				fill="none"
				class="speedo-fill"
			/>
		{/if}
		{#each ticks as t (t)}
			{@const e = tickEnd(t, dims.r - dims.sw / 2 - 4, dims.r - dims.sw / 2 - 10)}
			<line
				x1={e.x1}
				y1={e.y1}
				x2={e.x2}
				y2={e.y2}
				stroke="color-mix(in srgb, var(--surface-muted) 50%, transparent)"
				stroke-width="1.5"
				stroke-linecap="round"
			/>
		{/each}
		{#if !isUnlimited}
			<line
				x1={cx}
				y1={cy}
				x2={endX}
				y2={endY}
				stroke="var(--center-channel-color)"
				stroke-width="2.5"
				stroke-linecap="round"
				class="speedo-needle"
			/>
			<circle {cx} {cy} r="4" fill="var(--center-channel-color)" />
			<circle {cx} {cy} r="2" fill="var(--surface-bg)" />
		{/if}
	</svg>

	<div class="speedo-readout" style="font-size: {dims.fs}px;">
		{#if isUnlimited}
			<InfinityIcon class="speedo-infinity" />
		{:else}
			<span class="speedo-pct" class:over={overLimit}>{Math.round(pct * 100)}%</span>
		{/if}
	</div>

	<div class="speedo-meta">
		<p class="speedo-label">{label}</p>
		<p class="speedo-values" style="font-size: {dims.fsSub}px;">
			{#if isUnlimited}
				<span class="speedo-strong">{formatValue(value)} used</span>
				<span class="speedo-muted">· Unlimited</span>
			{:else}
				<span class="speedo-strong">{formatValue(value)}</span>
				<span class="speedo-muted">/ {formatValue(max!)}</span>
			{/if}
		</p>
		{#if caption}
			<p class="speedo-caption">{caption}</p>
		{:else if remaining !== null}
			<p class="speedo-caption">
				{#if overLimit}
					<span style="color: var(--error-text-color);">{formatValue(value - max!)} over limit</span
					>
				{:else}
					{formatValue(remaining)} remaining
				{/if}
			</p>
		{/if}
	</div>
</div>

<style>
	.speedo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		position: relative;
		width: 100%;
		max-width: var(--max-w, 220px);
	}
	.speedo svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.speedo-fill {
		animation: speedo-fill-in 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
		transition: stroke var(--dur-base) ease;
	}
	.speedo-needle {
		transform-origin: center;
		animation: speedo-fill-in 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
		transition:
			x2 var(--dur-base) cubic-bezier(0.22, 1, 0.36, 1),
			y2 var(--dur-base) cubic-bezier(0.22, 1, 0.36, 1);
	}
	@keyframes speedo-fill-in {
		from {
			stroke-dasharray: 0 1000;
		}
		to {
			stroke-dasharray: 1000 0;
		}
	}

	.speedo-readout {
		position: absolute;
		top: 40%;
		left: 0;
		right: 0;
		text-align: center;
		font-weight: 700;
		color: var(--center-channel-color);
		letter-spacing: -0.011em;
		pointer-events: none;
	}
	.speedo-pct {
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		color: var(--fill-color);
	}
	.speedo-pct.over {
		color: var(--error-text-color);
	}
	.speedo :global(.speedo-infinity) {
		width: 1.5em;
		height: 1.5em;
		display: inline-block;
		color: var(--surface-muted);
	}

	.speedo-meta {
		text-align: center;
		margin-top: -0.25rem;
	}
	.speedo-label {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
		letter-spacing: 0.05em;
		color: var(--surface-muted);
		margin: 0;
	}
	.speedo-values {
		margin: 0.125rem 0 0;
		font-weight: 600;
		color: var(--center-channel-color);
	}
	.speedo-strong {
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.speedo-muted {
		color: var(--surface-muted);
		font-weight: 600;
	}
	.speedo-caption {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--surface-muted);
		margin: 0.25rem 0 0;
	}
</style>

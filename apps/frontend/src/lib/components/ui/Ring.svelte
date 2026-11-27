<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SpringValue } from '$lib/utils/motion.svelte';

	let {
		value,
		max = 100,
		size = 48,
		thickness = undefined,
		tone = 'accent',
		label = undefined,
		detail = undefined,
		showValue = true,
		children = undefined
	}: {
		value: number;
		max?: number;
		size?: number;
		thickness?: number;
		tone?: 'accent' | 'neutral' | 'success' | 'warning' | 'error' | 'auto';
		label?: string;
		detail?: string;
		showValue?: boolean;
		children?: Snippet;
	} = $props();

	const uid = $props.id();
	const ratio = $derived(Math.min(1, Math.max(0, value / max)));
	const percent = $derived(Math.round(ratio * 100));
	const resolved = $derived(
		tone === 'auto' ? (ratio >= 0.9 ? 'error' : ratio >= 0.75 ? 'warning' : 'success') : tone
	);
	const t = $derived(thickness ?? Math.max(3, Math.round(size / 11)));
	const c = $derived(size / 2);
	const r = $derived((size - t) / 2);

	const spring = new SpringValue(0);
	let seeded = false;

	$effect(() => {
		const next = ratio;
		if (!seeded) {
			seeded = true;
			spring.to(next, 'glide', { instant: true });
			return;
		}
		spring.to(next, 'glide');
	});

	const p = $derived(Math.max(0, spring.current));
	const right = $derived(Math.min(p, 0.5) * 360);
	const left = $derived(Math.max(0, Math.min(p, 1) - 0.5) * 360);
	const end = $derived(Math.min(p, 1) * 360);
	const fontSize = $derived(Math.max(10, Math.round(size * 0.27)));
</script>

<div class="gauge gauge--{resolved}" style:--size="{size}px">
	<div
		class="dial"
		role="meter"
		aria-label={label ?? 'Usage'}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={percent}
		aria-valuetext={detail ?? `${percent}%`}
	>
		<svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
			<defs>
				<clipPath id="{uid}-r"><rect x={c} y="0" width={c} height={size} /></clipPath>
				<clipPath id="{uid}-l"><rect x="0" y="0" width={c + 0.5} height={size} /></clipPath>
			</defs>
			<circle class="track" cx={c} cy={c} {r} stroke-width={t} fill="none" />
			<g clip-path="url(#{uid}-r)" opacity={p > 0.001 ? 1 : 0}>
				<path
					class="arc"
					transform="rotate({right} {c} {c})"
					d="M {c} {c - r} A {r} {r} 0 0 0 {c} {c + r}"
					stroke-width={t}
					fill="none"
				/>
			</g>
			<g clip-path="url(#{uid}-l)" opacity={p > 0.5 ? 1 : 0}>
				<path
					class="arc"
					transform="rotate({left} {c} {c})"
					d="M {c} {c - r} A {r} {r} 0 0 1 {c} {c + r}"
					stroke-width={t}
					fill="none"
				/>
			</g>
			<g opacity={p > 0.001 ? 1 : 0}>
				<circle class="cap" cx={c} cy={c - r} r={t / 2} />
				<circle class="cap" cx={c} cy={c - r} r={t / 2} transform="rotate({end} {c} {c})" />
			</g>
		</svg>
		{#if children}
			<span class="center">{@render children()}</span>
		{:else if showValue && size >= 40}
			<span class="center" style:font-size="{fontSize}px">
				<span class="num">{percent}<span class="pct">%</span></span>
			</span>
		{/if}
	</div>
	{#if label || detail}
		<div class="caption">
			{#if label}<span class="label">{label}</span>{/if}
			{#if detail}<span class="detail">{detail}</span>{/if}
		</div>
	{/if}
</div>

<style>
	.gauge {
		--tone: var(--accent);
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}
	.gauge--neutral {
		--tone: var(--neutral-8);
	}
	.gauge--success {
		--tone: var(--status-success-solid);
	}
	.gauge--warning {
		--tone: var(--status-warning-solid);
	}
	.gauge--error {
		--tone: var(--status-error-solid);
	}
	.dial {
		position: relative;
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: var(--size);
		height: var(--size);
	}
	.dial svg {
		grid-area: 1 / 1;
		display: block;
	}
	.track {
		stroke: var(--bg-active);
	}
	.arc {
		stroke: var(--tone);
		stroke-linecap: butt;
	}
	.cap {
		fill: var(--tone);
	}
	.center {
		grid-area: 1 / 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-default);
		font-weight: var(--weight-semibold);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		letter-spacing: -0.011em;
	}
	.num {
		display: block;
		line-height: 1;
		text-box: trim-both cap alphabetic;
	}
	.pct {
		margin-left: 0.04em;
		font-size: 0.62em;
		font-weight: var(--weight-medium);
		color: var(--text-muted);
	}
	.caption {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
	}
	.label {
		display: block;
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: var(--weight-medium);
		color: var(--text-default);
		text-box: trim-both cap alphabetic;
	}
	.detail {
		display: block;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-box: trim-both cap alphabetic;
	}
</style>

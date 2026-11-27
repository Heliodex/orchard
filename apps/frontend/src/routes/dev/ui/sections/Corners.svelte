<script lang="ts">
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import Verdict from './Verdict.svelte';

	const FLOOR = 4;
	const Z = 2;
	let outerKey = $state('18');
	let gap = $state(8);
	let guides = $state(true);

	const outer = $derived(Number(outerKey));
	const raw = $derived(outer - gap);
	const inner = $derived(Math.max(FLOOR, raw));
	const floored = $derived(raw < FLOOR);

	const supported = typeof CSS !== 'undefined' && CSS.supports('corner-shape', 'superellipse(1.4)');
</script>

{#snippet arcs(r1: number, c1: number, r2: number, c2: number)}
	<svg class="guides" aria-hidden="true">
		<circle cx={c1} cy={c1} r={r1} class="arc" />
		<circle cx={c2} cy={c2} r={r2} class="arc arc--inner" />
		<circle cx={c1} cy={c1} r="2" class="pin" />
		{#if c2 !== c1}<circle cx={c2} cy={c2} r="2" class="pin pin--off" />{/if}
	</svg>
{/snippet}

<SectionCard
	title="Concentric corners"
	description="A surface nested near a corner takes the outer radius minus the gap, never its own number. Subtract first, then scale."
>
	{#snippet actions()}
		<div class="flex items-center gap-4">
			<SegmentedControl
				size="sm"
				label="Outer radius"
				bind:value={outerKey}
				options={[
					{ value: '10', label: 'Control 10' },
					{ value: '14', label: 'Card 14' },
					{ value: '18', label: 'Panel 18' },
					{ value: '22', label: 'Widget 22' }
				]}
			/>
			<div class="flex items-center gap-3">
				<span class="text-callout text-muted">Gap</span>
				<div class="w-32"><Slider label="Gap" bind:value={gap} min={0} max={24} step={2} /></div>
				<span class="w-8 text-callout text-fg tabular-nums rond-data">{gap}px</span>
			</div>
			<label class="flex items-center gap-2 text-callout text-muted">
				<Switch bind:checked={guides} label="Guides" />
				Guides
			</label>
		</div>
	{/snippet}
	<div class="flex flex-col gap-4">
		<div class="grid grid-cols-2 gap-4">
			<Verdict kind="do" note="Inner radius follows the gap. The arcs share one centre.">
				<div class="outer outer--zoom" style:--r="{outer * Z}px" style:--g="{gap * Z}px">
					<div class="inner" style:--ir="{inner * Z}px"></div>
					{#if guides}{@render arcs(
							outer * Z,
							outer * Z,
							inner * Z,
							(floored ? gap + inner : outer) * Z
						)}{/if}
				</div>
			</Verdict>
			<Verdict kind="dont" note="Equal radii. The inner corner bulges toward the edge.">
				<div class="outer outer--zoom" style:--r="{outer * Z}px" style:--g="{gap * Z}px">
					<div class="inner" style:--ir="{outer * Z}px"></div>
					{#if guides}{@render arcs(outer * Z, outer * Z, outer * Z, (gap + outer) * Z)}{/if}
				</div>
			</Verdict>
		</div>
		<div class="formula">
			<code class="font-mono">calc(({outer}px - {gap}px) * var(--corner-scale))</code>
			<span class="text-muted">
				inner {inner}px{#if floored}, floored at --radius-floor because the gap is larger than the
					radius{/if}
			</span>
		</div>
		<p class="text-caption text-faint">
			Drawn at 2x with round corners so the guides sit on the curve. In the app the superellipse and
			--corner-scale apply after the subtraction.
		</p>
	</div>
</SectionCard>

<div class="grid grid-cols-2 gap-6">
	<SectionCard
		title="Continuous, not circular"
		description="Every rounded rectangle uses the superellipse at 1.25x its nominal radius. There is no visible point where the straight edge turns."
	>
		<div class="grid grid-cols-3 gap-4">
			<figure class="corner-spec">
				<span class="tile tile--round"></span>
				<figcaption class="text-caption text-muted">Circular</figcaption>
			</figure>
			<figure class="corner-spec">
				<span class="tile tile--continuous"></span>
				<figcaption class="text-caption text-muted">Continuous</figcaption>
			</figure>
			<figure class="corner-spec">
				<span class="tile tile--continuous tile--overlay">
					<span class="tile-outline"></span>
				</span>
				<figcaption class="text-caption text-muted">Overlaid</figcaption>
			</figure>
		</div>
		<p class="mt-4 text-caption text-faint">
			{supported
				? 'This browser draws corner-shape, so --corner is superellipse(1.4) and --corner-scale is 1.25.'
				: 'This browser has no corner-shape, so corners fall back to round at scale 1.'}
		</p>
	</SectionCard>

	<div class="flex flex-col gap-6">
		<SectionCard
			title="The floor"
			description="When the gap beats the radius, the inner corner stops at --radius-floor (4px) instead of going sharp."
		>
			<div class="grid grid-cols-2 gap-4">
				<Verdict kind="do" note="Floored at 4px, drawn at 2x.">
					<div class="outer outer--small" style:--r="20px" style:--g="28px">
						<div class="inner" style:--ir="8px"></div>
					</div>
				</Verdict>
				<Verdict kind="dont" note="Clamped to 0. Reads as a hole.">
					<div class="outer outer--small" style:--r="20px" style:--g="28px">
						<div class="inner" style:--ir="0px"></div>
					</div>
				</Verdict>
			</div>
		</SectionCard>

		<SectionCard
			title="Circles in capsules"
			description="A circle inside a capsule sits at an inset of (height - circle) / 2 on every side it touches."
		>
			<div class="flex items-center justify-center gap-6">
				<span class="capsule">
					<span class="capsule-dot"></span>
					<span class="text-callout text-fg">40 high, 24 circle, 8 inset</span>
				</span>
			</div>
		</SectionCard>
	</div>
</div>

<style>
	.outer {
		position: relative;
		width: 100%;
		max-width: 18rem;
		height: 10rem;
		padding: var(--g);
		border-radius: var(--r);
		background: var(--bg-active);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.outer--zoom {
		max-width: 22rem;
		height: 13rem;
	}
	.outer--small {
		max-width: 11rem;
		height: 7.5rem;
	}
	.inner {
		width: 100%;
		height: 100%;
		border-radius: var(--ir);
		background: var(--bg-surface);
		box-shadow: var(--shadow-raised);
	}
	.guides {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.arc {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1;
		stroke-dasharray: 3 3;
		opacity: 0.7;
	}
	.arc--inner {
		stroke: var(--text-muted);
	}
	.pin {
		fill: var(--accent);
	}
	.pin--off {
		fill: var(--status-error-solid);
	}
	.formula {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.formula code {
		color: var(--text-default);
		font-size: var(--text-caption);
	}
	.corner-spec {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
	}
	.tile {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 1;
		max-width: 8rem;
		background: var(--bg-active);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.tile--round {
		border-radius: 2.25rem;
		corner-shape: round;
	}
	.tile--continuous {
		border-radius: calc(2.25rem * var(--corner-scale));
		corner-shape: var(--corner);
	}
	.tile--overlay {
		background: var(--accent-3);
		box-shadow: none;
	}
	.tile-outline {
		position: absolute;
		inset: 0;
		border-radius: 2.25rem;
		corner-shape: round;
		box-shadow: inset 0 0 0 1px var(--accent-7);
	}
	.capsule {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		height: 2.5rem;
		padding: 0 1rem 0 0.5rem;
		border-radius: var(--radius-pill);
		background: var(--bg-raised);
		box-shadow: var(--shadow-floating);
	}
	.capsule-dot {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: var(--status-success-bg);
		box-shadow: inset 0 0 0 1px var(--status-success-border);
	}
</style>

<script lang="ts">
	import { tick, untrack, type Snippet } from 'svelte';
	import AsciiVine from '$lib/components/ui/AsciiVine.svelte';
	import GoldenReticle from '$lib/components/ui/GoldenReticle.svelte';
	import {
		functionalMotion,
		morphHeightOn,
		motionStagger,
		springTiming
	} from '$lib/utils/motion.svelte';

	let {
		bloom = false,
		landed = false,
		seed = 23,
		brand = null,
		ground = null,
		headline = undefined,
		wordmark = undefined,
		tagline = null,
		guides = false,
		children,
		footer = undefined
	}: {
		bloom?: boolean;
		landed?: boolean;
		seed?: number;
		brand?: string | null;
		ground?: string | null;
		headline?: Snippet;
		wordmark?: Snippet;
		tagline?: string | null;
		guides?: boolean;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	let narrow = $state(false);
	let compact = $state(false);
	let sheet = $state<HTMLElement>();

	$effect(() => {
		const mq = window.matchMedia(headline ? '(max-width: 64rem)' : '(max-width: 40rem)');
		narrow = mq.matches;
		const on = () => (narrow = mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});

	const band = $derived<[number, number]>(
		headline ? (narrow ? [0.8, 0.97] : [0.68, 0.92]) : narrow ? [0.8, 0.96] : [0.36, 0.66]
	);

	$effect(() => {
		const on = landed;
		untrack(() => morph(on));
	});

	async function morph(on: boolean) {
		if (on === compact) return;
		const before = sheet?.getBoundingClientRect();
		compact = on;
		await tick();
		if (!sheet || !before || !functionalMotion()) return;
		const after = sheet.getBoundingClientRect();
		const dy = before.top - after.top;
		const dx = before.left + before.width / 2 - (after.left + after.width / 2);
		sheet.animate(
			[
				{ width: `${before.width}px`, translate: `${dx}px ${dy}px` },
				{ width: `${after.width}px`, translate: '0px 0px' }
			],
			springTiming('morph', { distance: Math.abs(dy) + Math.abs(before.width - after.width) })
		);
	}
</script>

<div
	class="auth"
	style:--brand={brand}
	style:--ground={ground}
	class:auth--hero={!!headline}
	class:auth--branded={!!brand}
	class:auth--grounded={!!ground}
>
	{#if headline}
		<section class="hero">
			<div class="hero-vine" aria-hidden="true">
				{#key narrow}<AsciiVine seed={seed + 2} {band} {bloom} />{/key}
			</div>
			{#if wordmark}
				<div class="wordmark" {@attach motionStagger({ index: 0, from: { y: -6 } })}>
					{@render wordmark()}
				</div>
			{/if}
			<div class="pitch" {@attach motionStagger({ index: 1, from: { y: 14 } })}>
				<h2 class="headline">{@render headline()}</h2>
				{#if tagline}<p class="tagline">{tagline}</p>{/if}
			</div>
		</section>
	{:else}
		<div class="field" aria-hidden="true">
			{#key narrow}<AsciiVine {seed} {band} {bloom} />{/key}
		</div>
	{/if}
	<div class="stage" class:stage--landed={compact}>
		<div
			class="sheet"
			class:sheet--landed={compact}
			bind:this={sheet}
			{@attach motionStagger({ index: headline ? 2 : 0, from: { y: 10 } })}
		>
			<div class="morph" {@attach morphHeightOn(() => (compact ? 'morph' : 'glide'))}>
				<div class="body">{@render children()}</div>
			</div>
		</div>
		{#if footer}
			<div class="foot" {@attach motionStagger({ index: 3, from: { y: 6 } })}>
				{@render footer()}
			</div>
		{/if}
	</div>
	{#if guides}<GoldenReticle />{/if}
</div>

<style>
	.auth {
		--sheet-pad: 1.75rem;
		--sheet-inner-r: 0.75rem;
		--sheet-r: calc((var(--sheet-inner-r) + var(--sheet-pad)) * var(--corner-scale));
		position: relative;
		min-height: 100dvh;
		isolation: isolate;
		background: var(--bg-app);
		color: var(--text-default);
	}
	.auth--grounded {
		background: var(--ground);
	}
	.auth--branded {
		--brand-field: var(--brand);
		--accent-solid: var(--brand);
		--accent-solid-hover: color-mix(in oklab, var(--brand) 86%, black);
		--accent-6: color-mix(in oklab, var(--brand) 45%, var(--bg-app));
		--accent-7: color-mix(in oklab, var(--brand) 65%, var(--bg-app));
		--accent-8: var(--brand);
		--accent-9: var(--brand);
		--accent-10: color-mix(in oklab, var(--brand) 70%, var(--text-default));
	}
	.auth--hero {
		--golden-minor: 38.2;
		display: grid;
		grid-template-columns: minmax(22rem, 38.2fr) minmax(28rem, 61.8fr);
	}
	.field {
		position: fixed;
		inset: 0;
		z-index: -1;
	}
	.hero {
		--vine-stem: color-mix(in oklab, var(--on-brand) 62%, transparent);
		--vine-leaf: color-mix(in oklab, var(--on-brand) 50%, transparent);
		--vine-petal-1: color-mix(in oklab, var(--on-brand) 45%, var(--brand-field));
		--vine-petal-2: color-mix(in oklab, var(--on-brand) 75%, var(--brand-field));
		--vine-petal-3: var(--on-brand);
		--vine-font: 'Space Mono', var(--font-mono);
		position: sticky;
		top: 0;
		height: 100dvh;
		padding: 2.25rem 3rem;
		overflow: hidden;
		isolation: isolate;
		background: var(--brand-field);
		color: var(--on-brand);
	}
	.hero-vine {
		position: absolute;
		inset: 0;
		z-index: -1;
	}
	.wordmark {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 0;
		height: 2rem;
	}
	.wordmark :global(img) {
		height: 1.75rem;
		width: auto;
	}
	.pitch {
		position: absolute;
		top: calc(var(--golden-minor) * 1%);
		left: 3rem;
		right: 3rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 26rem;
	}
	.headline {
		--rond: var(--rond-hero);
		margin: 0;
		font-size: clamp(1.75rem, 2.7vw, 2.625rem);
		line-height: 1.18;
		font-weight: var(--weight-medium);
		letter-spacing: -0.014em;
		text-wrap: balance;
		text-box: trim-both cap alphabetic;
	}
	.headline :global(em) {
		padding-right: 0.04em;
		font-style: italic;
		font-weight: var(--weight-display);
	}
	.headline :global(em.logotype) {
		font-family: 'Plus Jakarta Sans', var(--font-sans);
	}
	.tagline {
		margin: 0;
		font-size: var(--text-headline);
		line-height: var(--lh-headline);
		color: var(--on-brand-muted);
		text-wrap: pretty;
	}
	.stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 1.25rem;
		min-height: 100dvh;
		padding: max(3rem, calc(50dvh - 13rem)) 1rem 3rem;
	}
	.auth--hero .stage {
		padding-top: max(2rem, calc(var(--golden-minor) * 1dvh - var(--sheet-pad) - 0.3125rem));
	}
	.auth .stage--landed {
		justify-content: center;
		padding-top: 3rem;
	}
	.sheet {
		width: min(100%, 23.5rem);
		padding: var(--sheet-pad);
		border-radius: var(--sheet-r);
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow:
			0 0 0 0.5px var(--rule-strong),
			var(--shadow-floating);
	}
	.sheet--landed {
		--sheet-pad: 1.5rem;
		width: min(100%, 16rem);
	}
	.morph {
		position: relative;
	}
	.morph:global([data-morphing]) {
		overflow: clip;
		overflow-clip-margin: 0.375rem;
	}
	.body {
		display: flow-root;
	}
	.foot {
		max-width: 23.5rem;
		text-align: center;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
	}
	.foot :global(a) {
		color: var(--text-default);
		text-decoration: none;
	}
	.foot :global(a:hover) {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	@media (max-width: 64rem) {
		.auth--hero {
			grid-template-columns: 1fr;
		}
		.auth--hero .hero {
			position: relative;
			display: flex;
			flex-direction: column;
			gap: 2.5rem;
			height: auto;
			padding: 1.5rem 1.5rem 6rem;
		}
		.auth--hero .pitch {
			position: static;
		}
		.auth--hero .stage {
			min-height: 0;
			padding-top: 2rem;
		}
	}
	@media (max-width: 40rem) {
		.auth:not(.auth--hero) .stage {
			padding: 4.5rem 0.5rem 10rem;
		}
		.sheet:not(.sheet--landed) {
			--sheet-pad: 1.25rem;
		}
		.auth:not(.auth--hero) .sheet {
			background: transparent;
			box-shadow: none;
		}
	}
</style>

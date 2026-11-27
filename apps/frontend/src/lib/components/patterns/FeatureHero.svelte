<script lang="ts" module>
	export type FeatureItem = {
		id: string;
		title: string;
		eyebrow?: string;
		description?: string;
		icon?: string | null;
		href?: string;
	};
</script>

<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import IconTile from '$lib/components/ui/IconTile.svelte';
	import { decorativeMotion, fade, springTiming } from '$lib/utils/motion.svelte';

	let {
		items,
		cta = 'Deploy',
		columns = 4,
		onSelect = undefined,
		interval = 7000
	}: {
		items: FeatureItem[];
		cta?: string;
		columns?: number;
		onSelect?: (item: FeatureItem) => void;
		interval?: number;
	} = $props();

	let index = $state(0);
	let paused = $state(false);

	const current = $derived(items[Math.min(index, items.length - 1)]);

	$effect(() => {
		if (paused || items.length < 2 || !decorativeMotion()) return;
		const id = setTimeout(() => {
			if (!document.hidden) index = (index + 1) % items.length;
		}, interval);
		return () => clearTimeout(id);
	});

	function go(i: number) {
		index = (i + items.length) % items.length;
	}

	function enter(el: HTMLElement) {
		if (!decorativeMotion()) return;
		el.animate(
			[{ transform: 'translateY(0.375rem)' }, { transform: 'none' }],
			springTiming('glide')
		);
		el.animate([{ opacity: 0 }, { opacity: 1 }], { ...fade('in'), fill: 'backwards' });
	}

	function choose(e: MouseEvent) {
		if (!onSelect || e.metaKey || e.ctrlKey || e.shiftKey) return;
		e.preventDefault();
		onSelect(current);
	}
</script>

{#if current}
	<div class="frame" style:--cols={columns}>
		<section
			class="hero"
			aria-roledescription="carousel"
			aria-label="Featured"
			onpointerenter={() => (paused = true)}
			onpointerleave={() => (paused = false)}
			onfocusin={() => (paused = true)}
			onfocusout={() => (paused = false)}
			onkeydown={(e) => {
				if (e.key === 'ArrowRight') go(index + 1);
				if (e.key === 'ArrowLeft') go(index - 1);
			}}
		>
			{#key current.id}
				<div class="copy" {@attach enter}>
					{#if current.eyebrow}<p class="eyebrow">{current.eyebrow}</p>{/if}
					<h2 class="title">{current.title}</h2>
					{#if current.description}<p class="description">{current.description}</p>{/if}
					<div class="actions">
						<Button variant="primary" href={current.href} iconRight={ArrowRight} onclick={choose}
							>{cta}</Button
						>
					</div>
				</div>
				<div class="poster" aria-hidden="true">
					<span class="poster-tile" {@attach enter}>
						<IconTile src={current.icon} class="poster-img" tint="var(--bg-raised)">
							{#snippet fallback()}<span class="poster-letter">{current.title.charAt(0)}</span
								>{/snippet}
						</IconTile>
					</span>
				</div>
			{/key}
			{#if items.length > 1}
				<div class="dots" role="tablist" aria-label="Featured items">
					{#each items as item, i (item.id)}
						<button
							type="button"
							role="tab"
							class="dot"
							class:dot--on={i === index}
							aria-selected={i === index}
							aria-label={item.title}
							onclick={() => go(i)}
						></button>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}

<style>
	.frame {
		container-type: inline-size;
	}
	.hero {
		--gap: 1rem;
		--col: calc((100cqi - (var(--cols) - 1) * var(--gap)) / var(--cols));
		--inset: calc(var(--col) * 0.191);
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--col);
		min-height: max(15rem, var(--col));
		border-radius: calc(var(--radius-panel) * 1.25 * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow: var(--shadow-raised);
	}
	.copy {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.5rem;
		max-width: 34rem;
		padding: 1.5rem 0 1.5rem var(--inset);
	}
	.eyebrow {
		margin: 0;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		font-weight: var(--weight-medium);
		color: var(--text-muted);
	}
	.title {
		--rond: var(--rond-hero);
		margin: 0;
		font-size: var(--text-display);
		line-height: var(--lh-display);
		font-weight: var(--weight-semibold);
		letter-spacing: -0.014em;
		text-wrap: balance;
	}
	.description {
		display: -webkit-box;
		margin: 0;
		overflow: hidden;
		font-size: var(--text-headline);
		line-height: var(--lh-headline);
		color: var(--text-muted);
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		text-wrap: pretty;
	}
	.actions {
		margin-top: 1rem;
	}
	.poster {
		display: grid;
		place-items: center;
	}
	.poster-tile {
		display: block;
		width: calc(var(--col) * 0.618);
		aspect-ratio: 1;
	}
	.poster-tile :global(.poster-img) {
		display: grid;
		width: 100%;
		height: 100%;
		border-radius: calc(var(--col) * 0.618 * 0.225);
		corner-shape: var(--corner);
		box-shadow:
			0 0 0 0.5px var(--rule),
			0 1px 2px color-mix(in oklab, var(--neutral-10) 6%, transparent),
			0 18px 40px -18px color-mix(in oklab, var(--neutral-10) 28%, transparent);
	}
	.poster-letter {
		font-size: calc(var(--col) * 0.25);
		font-weight: var(--weight-semibold);
		color: var(--text-muted);
	}
	.dots {
		position: absolute;
		right: 0;
		bottom: calc(var(--inset) / 2 - 0.21875rem);
		display: flex;
		justify-content: center;
		gap: 0.375rem;
		width: var(--col);
	}
	.dot {
		width: 0.4375rem;
		height: 0.4375rem;
		padding: 0;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--neutral-5);
		cursor: pointer;
		transition: background-color var(--fade-in) var(--curve-out);
	}
	.dot--on {
		background: var(--text-default);
	}
	.dot:focus-visible {
		outline: 2px solid var(--accent-solid);
		outline-offset: 2px;
	}
	@container (max-width: 40rem) {
		.hero {
			grid-template-columns: minmax(0, 1fr);
		}
		.copy {
			padding: 1.5rem;
		}
		.poster {
			display: none;
		}
		.dots {
			right: 1.5rem;
			width: auto;
		}
	}
</style>

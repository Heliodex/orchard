<script lang="ts" module>
	import type { ShelfTone, ShelfItem } from './shelf';
	export type { ShelfTone, ShelfItem };
</script>

<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import AppIcon from '$lib/components/ui/AppIcon.svelte';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import SectionTitle from '$lib/components/ui/SectionTitle.svelte';
	import { bakeBlur } from '$lib/components/aura/aura';
	import { decorativeMotion } from '$lib/utils/motion.svelte';

	let {
		items,
		title,
		seeAllHref = undefined,
		columns = undefined,
		plain = false,
		autoScroll = false,
		compact = false,
		onSelect = undefined
	}: {
		items: ShelfItem[];
		title: string;
		seeAllHref?: string;
		columns?: number;
		plain?: boolean;
		autoScroll?: boolean;
		compact?: boolean;
		onSelect?: (item: ShelfItem) => void;
	} = $props();

	function choose(e: MouseEvent, item: ShelfItem) {
		if (!onSelect || e.metaKey || e.ctrlKey || e.shiftKey) return;
		e.preventDefault();
		onSelect(item);
	}

	const HUES = ['blue', 'green', 'amber', 'neutral'] as const;

	function hueOf(name: string) {
		return HUES[
			[...name].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) %
				HUES.length
		];
	}

	function tintOf(name: string) {
		const hue = hueOf(name);
		return hue === 'neutral'
			? 'var(--neutral-3)'
			: `color-mix(in oklab, var(--${hue}-3) 55%, var(--bg-surface))`;
	}

	let baked = $state<Record<string, string | null>>({});

	$effect(() => {
		if (plain) return;
		for (const item of items) {
			const src = item.background ?? item.icon;
			if (!src) continue;
			bakeBlur(src).then((url) => {
				if (url) baked[src] = url;
			});
		}
	});

	function artOf(item: ShelfItem) {
		const src = item.background ?? item.icon;
		return src ? (baked[src] ?? null) : null;
	}

	function percent(p: number) {
		return Math.round(Math.min(1, Math.max(0, p)) * 100);
	}

	let scroller = $state<HTMLElement>();
	let track = $state<HTMLElement>();
	let canPrev = $state(false);
	let canNext = $state(false);
	let hovered = false;
	let focused = false;

	function measure() {
		const el = scroller;
		if (!el) return;
		const max = el.scrollWidth - el.clientWidth;
		canPrev = el.scrollLeft > 2;
		canNext = el.scrollLeft < max - 2;
	}

	function watch(el: HTMLElement) {
		scroller = el;
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		if (el.firstElementChild) ro.observe(el.firstElementChild);
		el.addEventListener('scroll', measure, { passive: true });
		let frame = 0;
		let last = 0;
		let position = el.scrollLeft;
		function tick(time: number) {
			if (last && autoScroll && !hovered && !focused && decorativeMotion() && !document.hidden) {
				const max = el.scrollWidth - el.clientWidth;
				if (max > 0) {
					position = Math.abs(position - el.scrollLeft) > 2 ? el.scrollLeft : position;
					position = position >= max - 1 ? 0 : Math.min(max, position + (time - last) * 0.025);
					el.scrollLeft = position;
				}
			} else {
				position = el.scrollLeft;
			}
			last = time;
			frame = requestAnimationFrame(tick);
		}
		if (autoScroll) frame = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(frame);
			ro.disconnect();
			el.removeEventListener('scroll', measure);
		};
	}

	function page(dir: 1 | -1) {
		const el = scroller;
		if (!el || !track) return;
		const first = track.firstElementChild as HTMLElement | null;
		const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
		const step = first ? first.offsetWidth + gap : el.clientWidth;
		const per = Math.max(1, Math.floor((el.clientWidth + gap) / step));
		el.scrollBy({ left: dir * per * step, behavior: decorativeMotion() ? 'smooth' : 'auto' });
	}
</script>

<section
	class="shelf"
	class:shelf--plain={plain}
	class:shelf--grid={!!columns}
	class:shelf--auto={autoScroll}
	class:shelf--compact={compact}
	style:--cols={columns}
	aria-label={title}
	onmouseenter={() => (hovered = true)}
	onmouseleave={() => (hovered = false)}
	onfocusin={() => (focused = true)}
	onfocusout={(event) =>
		(focused = event.currentTarget.contains(event.relatedTarget as Node | null))}
>
	<SectionTitle {title} size="md">
		{#snippet actions()}
			{#if seeAllHref}<a class="see-all" href={seeAllHref}
					><span class="see-all-label">See all</span><ChevronRight size={14} /></a
				>{/if}
			{#if !autoScroll && (canPrev || canNext)}
				<span class="pager">
					<button
						type="button"
						class="page-btn"
						aria-label="Previous"
						disabled={!canPrev}
						onclick={() => page(-1)}><ChevronLeft size={16} /></button
					>
					<button
						type="button"
						class="page-btn"
						aria-label="Next"
						disabled={!canNext}
						onclick={() => page(1)}><ChevronRight size={16} /></button
					>
				</span>
			{/if}
		{/snippet}
	</SectionTitle>

	<div
		class="scroller"
		class:scroller--start={canPrev}
		class:scroller--end={canNext}
		{@attach watch}
	>
		<ul class="track" bind:this={track}>
			{#each items as item (item.id)}
				{@const art = artOf(item)}
				{@const tone = item.tone ?? 'neutral'}
				{@const live = tone === 'progress' && item.progress != null}
				<li class="slot">
					<a class="tile tile--{tone}" href={item.href} onclick={(e) => choose(e, item)}>
						<span class="art" class:art--media={!!art}>
							<span class="art-clip" style:--tint={tintOf(item.title)}>
								<span
									class="art-mesh"
									class:art-mesh--ready={!!art}
									style:--mesh={art ? `url("${art}")` : 'none'}
								></span>
								<span class="art-veil"></span>
								<span class="art-icon"
									><AppIcon name={item.title} kind={item.kind} icon={item.icon} size="lg" /></span
								>
								{#if live}
									<span class="bar" aria-hidden="true"
										><span class="bar-fill" style:--p={percent(item.progress ?? 0) / 100}
										></span></span
									>
								{/if}
							</span>
						</span>
						<span class="caption">
							<span class="caption-top">
								<span class="app">{item.title}</span>
								{#if item.at && !live}<span class="when"><RelativeTime date={item.at} /></span>{/if}
							</span>
							{#if item.subtitle || item.status}
								<span class="caption-meta">
									{#if item.subtitle}<span class="project">{item.subtitle}</span>{/if}
									{#if item.subtitle && item.status}<span class="sep" aria-hidden="true"
										></span>{/if}
									{#if item.status}<span class="state"
											>{item.status}{#if live}{` · ${percent(item.progress ?? 0)}%`}{/if}</span
										>{/if}
								</span>
							{/if}
							{#if item.description}<span class="description">{item.description}</span>{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.description {
		display: -webkit-box;
		overflow: hidden;
		color: var(--text-muted);
		font-size: var(--text-caption);
		line-height: 1.35;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.shelf {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.see-all {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		height: 1.75rem;
		padding: 0 0.375rem 0 0.625rem;
		border-radius: var(--radius-pill);
		color: var(--text-muted);
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
		text-decoration: none;
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}
	.see-all:hover {
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		color: var(--text-default);
	}
	.see-all:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}
	.see-all-label {
		text-box: trim-both cap alphabetic;
	}

	.pager {
		display: inline-flex;
		gap: 0.25rem;
		opacity: 0;
		transition: opacity var(--dur-fast) ease;
	}
	.shelf:hover .pager,
	.shelf:focus-within .pager {
		opacity: 1;
	}
	@media (hover: none) {
		.pager {
			opacity: 1;
		}
	}
	.page-btn {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		color: var(--text-default);
		cursor: pointer;
		transition:
			background-color var(--dur-fast) ease,
			opacity var(--dur-fast) ease,
			transform var(--spring-press-duration) var(--spring-press);
	}
	.page-btn:hover:not(:disabled) {
		background: color-mix(in oklab, var(--neutral-10) 11%, transparent);
	}
	.page-btn:active:not(:disabled) {
		transform: scale(0.94);
	}
	.page-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.page-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.scroller {
		--fade-start: 0rem;
		--fade-end: 0rem;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scroll-padding-inline: 0.75rem;
		scrollbar-width: none;
		margin: -1rem -0.75rem -0.5rem;
		padding: 1rem 0.75rem 0.5rem;
		mask-image: linear-gradient(
			to right,
			transparent,
			black var(--fade-start),
			black calc(100% - var(--fade-end)),
			transparent
		);
	}
	.scroller::-webkit-scrollbar {
		display: none;
	}
	.shelf--auto .scroller {
		scroll-snap-type: none;
	}
	.scroller--start {
		--fade-start: 3rem;
	}
	.scroller--end {
		--fade-end: 3rem;
	}
	.track {
		display: flex;
		gap: 1rem;
		width: max-content;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.shelf--grid .scroller {
		container-type: inline-size;
	}
	.shelf--grid .slot {
		flex-basis: max(10rem, (100cqi - (var(--cols) - 1) * 1rem) / var(--cols));
	}
	.shelf--compact.shelf--grid .slot {
		flex-basis: max(15rem, (100cqi - (var(--cols) - 1) * 1rem) / var(--cols));
	}
	.shelf--grid .art {
		aspect-ratio: 1.618;
	}
	.shelf--plain .art-clip {
		background: var(--bg-surface);
	}
	.slot {
		flex: 0 0 15rem;
		min-width: 0;
		scroll-snap-align: start;
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		color: inherit;
		text-decoration: none;
		-webkit-tap-highlight-color: transparent;
	}
	.tile:focus-visible {
		outline: none;
	}
	.shelf--compact .tile {
		flex-direction: row;
		align-items: flex-start;
		gap: 0.75rem;
	}
	.shelf--compact .art {
		flex: 0 0 3.5rem;
		aspect-ratio: 1;
	}
	.shelf--compact .art-icon {
		zoom: 0.7;
	}
	.shelf--compact .caption {
		flex: 1;
		gap: 0.25rem;
	}

	.art {
		position: relative;
		display: block;
		aspect-ratio: 16 / 9;
		isolation: isolate;
		transform-origin: 50% 60%;
		transition: transform var(--spring-glide-duration) var(--spring-glide);
	}
	.art::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		box-shadow:
			0 18px 32px -14px var(--on-media-pill),
			0 6px 12px -6px color-mix(in oklab, var(--on-media-pill) 53%, transparent);
		opacity: 0;
		transition: opacity var(--dur-base) ease;
	}
	.tile:hover .art,
	.tile:focus-visible .art {
		transform: scale(1.03);
	}
	.tile:hover .art::before,
	.tile:focus-visible .art::before {
		opacity: 1;
	}
	.tile:active .art {
		transform: scale(1.01);
		transition-duration: var(--spring-press-duration);
		transition-timing-function: var(--spring-press);
	}

	.art-clip {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--tint);
		box-shadow:
			inset 0 0 0 0.5px color-mix(in oklab, var(--neutral-10) 12%, transparent),
			0 1px 2px color-mix(in oklab, var(--on-media-pill) 19%, transparent);
	}
	.tile:focus-visible .art-clip {
		box-shadow:
			inset 0 0 0 0.5px color-mix(in oklab, var(--neutral-10) 12%, transparent),
			0 0 0 3px var(--focus-ring);
	}
	.art-mesh {
		position: absolute;
		inset: -30%;
		background-image: var(--mesh);
		background-size: cover;
		background-position: center;
		opacity: 0;
		transition: opacity var(--fade-long) var(--curve-out);
	}
	.art-mesh--ready {
		opacity: 1;
	}
	.art-veil {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 45%, var(--on-media-pill));
		opacity: 0;
	}
	.art--media .art-veil {
		opacity: 1;
	}
	.art-icon {
		position: relative;
		display: flex;
		zoom: 1.2727;
		border-radius: calc(0.6875rem * var(--corner-scale));
		corner-shape: var(--corner);
		box-shadow:
			0 6px 14px -4px color-mix(in oklab, var(--on-media-pill) 67%, transparent),
			0 1px 3px color-mix(in oklab, var(--on-media-pill) 34%, transparent);
	}

	.bar {
		--bar-track: color-mix(in oklab, var(--neutral-10) 14%, transparent);
		--bar-fill: var(--text-default);
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
		left: 0.75rem;
		height: 0.25rem;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: var(--bar-track);
	}
	.art--media .bar {
		--bar-track: var(--on-media-fill);
		--bar-fill: var(--on-media);
	}
	.bar-fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--bar-fill);
		transform: translateX(calc((var(--p) - 1) * 100%));
		transition: transform var(--spring-glide-duration) var(--spring-glide);
	}

	.caption {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		padding-inline: 0.125rem;
	}
	.caption-top,
	.caption-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.app,
	.project,
	.state,
	.when {
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.app {
		flex: 1;
		min-width: 0;
		color: var(--text-default);
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		letter-spacing: -0.006em;
	}
	.when {
		flex-shrink: 0;
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.caption-meta {
		font-size: var(--text-caption);
	}
	.project {
		min-width: 0;
		color: var(--text-faint);
	}
	.sep {
		width: 2px;
		height: 2px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--text-faint);
	}
	.state {
		flex-shrink: 0;
		max-width: 75%;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.tile--error .state {
		color: var(--status-error);
		font-weight: var(--weight-medium);
	}
</style>

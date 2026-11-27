<script lang="ts">
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import { statusMeta } from '$lib/components/ui/status';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { Plus, ArrowRight, ChevronRight } from 'lucide-svelte';
	import AppIcon from '$lib/components/ui/AppIcon.svelte';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import { bakeBlur, bakedBlur } from '$lib/components/aura/aura';
	import { folder } from '$lib/utils/motion.svelte';

	let {
		name,
		href,
		image = undefined,
		background = undefined,
		owner = undefined,
		counts = [],
		updatedAt = undefined,
		summary = undefined,
		expanded = $bindable(true),
		onNew = undefined,
		layout = 'cards',
		density = 'regular',
		children
	}: {
		name: string;
		href: string;
		image?: string | null;
		background?: string | null;
		owner?: string;
		counts?: string[];
		updatedAt?: string | null;
		summary?: { tone: 'success' | 'error' | 'progress' | 'neutral'; label: string };
		expanded?: boolean;
		onNew?: () => void;
		layout?: 'cards' | 'rows' | 'dense' | 'lines';
		density?: 'regular' | 'compact';
		children: Snippet;
	} = $props();

	function fadeOverflow(el: HTMLElement) {
		const check = () => el.toggleAttribute('data-overflow', el.scrollWidth > el.clientWidth + 1);
		const ro = new ResizeObserver(check);
		ro.observe(el);
		for (const child of el.children) ro.observe(child);
		check();
		return () => ro.disconnect();
	}

	let host = $state<HTMLElement>();
	let iconEl = $state<HTMLElement>();
	let mesh = $state<string | null>(background ? bakedBlur(background) : null);
	let awake = $state(false);

	onMount(() => {
		if (!host || !background || mesh) return;
		const src = background;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				io.disconnect();
				bakeBlur(src).then((url) => (mesh = url));
			},
			{ rootMargin: '100% 0px' }
		);
		io.observe(host);
		return () => io.disconnect();
	});
</script>

<section
	bind:this={host}
	class="project project--{density} project--{layout}"
	class:project--media={!!background}
	class:project--awake={awake}
	aria-label={name}
	onpointerenter={() => (awake = true)}
>
	{#if background}<div
			class="backdrop"
			class:backdrop--ready={!!mesh}
			style:--mesh={mesh ? `url("${mesh}")` : 'none'}
		>
			<div class="mesh mesh--1"></div>
			<div class="mesh mesh--2"></div>
			<div class="mesh mesh--3"></div>
			<div class="veil"></div>
		</div>{/if}

	<header class="head">
		<button
			type="button"
			class="toggle"
			aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
			aria-expanded={expanded}
			onclick={() => (expanded = !expanded)}
		>
			<span class="chev" class:chev--open={expanded} aria-hidden="true"
				><ChevronRight size={16} /></span
			>
			<span class="icon" bind:this={iconEl}
				><AppIcon
					{name}
					kind="project"
					icon={image}
					size={density === 'compact' ? 'sm' : 'lg'}
				/></span
			>
			<span class="text">
				<span class="name" title={name}>{name}</span>
				<span class="meta" {@attach fadeOverflow}>
					{#if owner}<span class="owner">{owner}</span>{/if}
					{#each counts as c, i (i)}
						{#if owner || i > 0}<span class="sep" aria-hidden="true"></span>{/if}<span>{c}</span>
					{/each}
					{#if updatedAt}<span class="sep" aria-hidden="true"></span><RelativeTime
							date={updatedAt}
						/>{/if}
				</span>
			</span>
		</button>
		{#if summary}
			<span class="summary summary--{summary.tone}"
				><StatusDot
					meta={statusMeta(summary.tone, summary.label, summary.tone === 'progress')}
					size={8}
				/><span class="summary-label">{summary.label}</span></span
			>
		{/if}
		<div class="actions">
			{#if onNew}
				<button type="button" class="round" onclick={onNew} aria-label="New in {name}"
					><Plus size={15} /></button
				>
			{/if}
			<a class="round" {href} aria-label="Open {name}"><ArrowRight size={15} /></a>
		</div>
	</header>

	<div class="body" {@attach folder(() => expanded, { origin: () => iconEl })}>
		<div class="cards cards--{layout}">{@render children()}</div>
	</div>
</section>

<style>
	.project {
		--head-h: 5rem;
		--h-fg: var(--text-default);
		--h-muted: var(--text-muted);
		--h-fill: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		--h-fill-hover: color-mix(in oklab, var(--neutral-10) 10%, transparent);
		--h-edge: color-mix(in oklab, var(--neutral-10) 10%, transparent);
		--h-pill: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		--card-r: 0.75rem;
		--tray-pad: 0.875rem;
		--project-r: calc(var(--card-r) + var(--tray-pad));
		position: relative;
		min-width: 0;
		border-radius: calc(var(--project-r) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-raised);
		box-shadow: var(--shadow-raised);
		overflow: clip;
		isolation: isolate;
	}
	.project--compact {
		--head-h: 2.75rem;
		--project-r: 0.75rem;
	}
	.project--compact .text {
		flex-direction: row;
		align-items: center;
		gap: 0.75rem;
	}
	.project--compact .name {
		min-width: 0;
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
		letter-spacing: 0;
	}
	.project--compact .meta {
		flex-shrink: 100;
		font-size: var(--text-caption);
	}
	.project--compact .head {
		gap: 0.5rem;
		padding: 0 0.875rem 0 0.375rem;
	}
	.project--compact .chev {
		width: 1.5rem;
		height: 1.5rem;
	}
	.project--compact .round {
		width: 1.75rem;
		height: 1.75rem;
	}
	.project--compact .owner {
		color: var(--h-muted);
	}
	.project--compact .summary {
		width: 5.75rem;
		font-size: var(--text-caption);
	}
	.project--media {
		--h-fg: var(--on-media);
		--h-muted: var(--on-media-muted);
		--h-fill: var(--on-media-fill);
		--h-fill-hover: var(--on-media-fill-hover);
		--h-edge: var(--on-media-edge);
		--h-pill: var(--on-media-pill);
	}
	.project:not(.project--media) .head {
		box-shadow: inset 0 -1px 0 var(--border-default);
	}
	.backdrop {
		position: absolute;
		inset: 0 0 auto;
		z-index: -1;
		height: var(--head-h);
		overflow: hidden;
		background: var(--bg-active);
		contain: paint;
	}
	.mesh {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 200%;
		aspect-ratio: 1;
		background-image: var(--mesh);
		background-size: cover;
		background-position: center;
		opacity: 0;
		transition: opacity var(--fade-long) var(--curve-out);
	}
	.mesh--1 {
		transform: translate(-50%, -50%) scale(1.1) rotate(0deg);
	}
	.mesh--2 {
		transform: translate(-50%, -50%) scale(1.45) rotate(70deg);
	}
	.mesh--3 {
		transform: translate(-50%, -50%) scale(1.8) rotate(140deg);
	}
	.backdrop--ready .mesh--1 {
		opacity: 0.9;
	}
	.backdrop--ready .mesh--2 {
		opacity: 0.55;
	}
	.backdrop--ready .mesh--3 {
		opacity: 0.4;
	}
	.project--awake .mesh--1 {
		animation: spin-a 28s linear infinite paused;
	}
	.project--awake .mesh--2 {
		animation: spin-b 44s linear infinite paused;
	}
	.project--awake .mesh--3 {
		animation: spin-c 60s linear infinite paused;
	}
	.project:hover .mesh {
		animation-play-state: running;
	}
	@keyframes spin-a {
		to {
			transform: translate(-50%, -50%) scale(1.1) rotate(360deg);
		}
	}
	@keyframes spin-b {
		to {
			transform: translate(-50%, -50%) scale(1.45) rotate(430deg);
		}
	}
	@keyframes spin-c {
		to {
			transform: translate(-50%, -50%) scale(1.8) rotate(-220deg);
		}
	}
	.veil {
		position: absolute;
		inset: 0;
		background: var(--media-veil);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: var(--head-h);
		padding: 0 1.25rem 0 0.75rem;
		color: var(--h-fg);
	}
	.chev {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		border: none;
		border-radius: 50%;
		background: none;
		color: var(--h-muted);
		cursor: pointer;
		transition:
			background-color var(--dur-fast) ease,
			transform var(--spring-snap-duration) var(--spring-snap);
	}
	.chev--open {
		transform: rotate(90deg);
	}
	.toggle:hover .chev {
		background: var(--h-fill);
		color: var(--h-fg);
	}
	.toggle {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 0.75rem;
		align-self: stretch;
		min-width: 0;
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		text-align: left;
		cursor: pointer;
	}
	.toggle:focus-visible {
		outline: none;
	}
	.toggle:focus-visible .chev {
		box-shadow: 0 0 0 2px var(--accent-solid);
	}
	.icon {
		display: flex;
		flex-shrink: 0;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-width: 0;
	}
	.name {
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--text-title-3);
		font-weight: var(--weight-semibold);
		letter-spacing: -0.012em;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		color: var(--h-muted);
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.meta:global([data-overflow]) {
		mask-image: linear-gradient(90deg, black calc(100% - 1.5rem), transparent);
	}
	.meta > :global(*) {
		text-box: trim-both cap alphabetic;
	}
	.owner {
		color: var(--h-fg);
	}
	.sep {
		width: 2px;
		height: 2px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--h-muted);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		opacity: 0;
		transition: opacity var(--dur-fast) ease;
	}
	.project:hover .actions,
	.head:has(:focus-visible) .actions {
		opacity: 1;
	}
	@media (hover: none) {
		.actions {
			opacity: 1;
		}
	}
	.summary {
		display: inline-flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.5rem;
		flex-shrink: 0;
		width: 6.5rem;
		color: var(--h-muted);
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.summary-label {
		text-box: trim-both cap alphabetic;
	}
	.summary--error {
		color: var(--h-fg);
		font-weight: var(--weight-semibold);
	}
	.round {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		height: 1.75rem;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--h-fill);
		color: var(--h-fg);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-callout);
		font-weight: var(--weight-semibold);
		text-decoration: none;
		cursor: pointer;
		transition: background-color var(--dur-fast) ease;
	}
	.round {
		width: 2rem;
		height: 2rem;
	}
	.round:hover {
		background: var(--h-fill-hover);
	}

	.body {
		overflow: clip;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		padding: var(--tray-pad);
		background: var(--bg-sunken);
	}
	@media (min-width: 100rem) {
		.cards {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.cards--dense {
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.5rem;
	}
	.project--dense {
		--tray-pad: 0.625rem;
	}
	.cards--lines :global(.line) {
		border-radius: calc((var(--project-r) - 0.375rem) * var(--corner-scale));
		corner-shape: var(--corner);
	}
	.cards--lines {
		grid-template-columns: minmax(0, 1fr);
		gap: 0;
		padding: 0.25rem 0.375rem;
		background: none;
	}
	.cards--rows {
		grid-template-columns: minmax(0, 1fr);
		gap: 0;
		padding: 0.375rem 0.5rem;
		background: none;
	}
	@media (max-width: 720px) {
		.cards {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>

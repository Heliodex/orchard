<script lang="ts" module>
	import type { SpotlightItem } from './project-spotlight';
	export type { SpotlightItem };
</script>

<script lang="ts">
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import { statusMeta } from '$lib/components/ui/status';
	import type { Snippet } from 'svelte';
	import type { Icon } from '$lib/components/ui/types';
	import { ArrowRight, ExternalLink } from 'lucide-svelte';
	import Aura from '$lib/components/ui/Aura.svelte';
	import RemoteImg from '$lib/components/ui/RemoteImg.svelte';
	import AppIcon from '$lib/components/ui/AppIcon.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		FADE,
		functionalMotion,
		holdAmbient,
		motion,
		springTiming
	} from '$lib/utils/motion.svelte';
	import { tempo } from '$lib/design/springs';
	import { fade } from '$lib/utils/transitions';
	import { effectiveAnimation } from '$lib/stores/preferences';

	let {
		items,
		variant = 'spotlight',
		primary = undefined,
		tools = undefined,
		size = 'lg'
	}: {
		items: SpotlightItem[];
		variant?: 'spotlight' | 'banner';
		primary?: { label: string; href?: string; icon?: Icon };
		tools?: Snippet;
		size?: 'lg' | 'md';
	} = $props();

	const PrimaryIcon = $derived(primary?.icon ?? ArrowRight);
	let index = $state(0);
	let prev = $state<number | null>(null);
	let dir = $state(1);
	let hovered = $state(false);
	let focused = $state(false);
	let hidden = $state(false);
	let settle: ReturnType<typeof setTimeout> | undefined;
	let mounted = false;
	const PITCH = 13;
	const STRETCH = 17;
	const COPY_LEAD = 0.08;
	const ART_HOLD = 1400;

	const current = $derived(items[Math.min(index, items.length - 1)]);
	const auto = $derived($effectiveAnimation === 'full' && items.length > 1);
	const paused = $derived(hovered || focused || hidden);
	const apps = $derived((current?.apps ?? []).slice(0, 4));
	const extra = $derived(Math.max(0, (current?.apps?.length ?? 0) - apps.length));

	$effect(() => {
		const sync = () => (hidden = document.hidden);
		sync();
		document.addEventListener('visibilitychange', sync);
		return () => document.removeEventListener('visibilitychange', sync);
	});

	$effect(() => {
		mounted = true;
		return () => clearTimeout(settle);
	});

	function go(next: number, direction?: number) {
		const target = (next + items.length) % items.length;
		if (target === index) return;
		dir = direction ?? (target > index ? 1 : -1);
		prev = index;
		index = target;
		clearTimeout(settle);
		settle = setTimeout(() => (prev = null), ART_HOLD * tempo());
	}

	function onKey(e: KeyboardEvent) {
		if (items.length < 2) return;
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			go(index + 1, 1);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			go(index - 1, -1);
		}
	}

	function art(active: () => boolean) {
		return (el: HTMLElement) => {
			$effect(() => {
				const on = active();
				if (!mounted) return;
				const d = dir;
				if (!on) {
					motion(el, { scale: 1.02, x: `${-3 * d}%` }, 'cinematic', { exit: true });
					return;
				}
				const run = motion(
					el,
					{ opacity: [0, 1], scale: [1.08, 1], x: [`${4 * d}%`, '0%'] },
					'cinematic'
				);
				if (!run) el.style.opacity = '1';
			});
		};
	}

	let shelfEl = $state<HTMLElement | null>(null);
	let shownVariant: string | null = null;
	let before: number | null = null;

	$effect.pre(() => {
		const next = variant;
		const el = shelfEl;
		if (!el || shownVariant === null || next === shownVariant || !functionalMotion()) return;
		if (document.documentElement.classList.contains('vt-hero')) return;
		before = el.getBoundingClientRect().height;
	});

	$effect(() => {
		const next = variant;
		const el = shelfEl;
		if (!el) return;
		if (shownVariant === null) {
			shownVariant = next;
			return;
		}
		if (next === shownVariant) return;
		shownVariant = next;
		const from = before;
		before = null;
		if (from === null || document.documentElement.classList.contains('vt-hero')) return;
		const height = el.getBoundingClientRect().height;
		const timing = springTiming('glide', { distance: Math.abs(height - from) });
		holdAmbient(Number(timing.duration ?? 0) + 400);
		el.animate([{ height: `${from}px` }, { height: `${height}px` }], timing);
	});

	function copyIn(el: HTMLElement) {
		if (!mounted) return;
		motion(el, { opacity: [0, 1], x: [24 * dir, 0] }, 'pop', { delay: COPY_LEAD * tempo() });
	}
</script>

{#if current}
	<section
		bind:this={shelfEl}
		class="shelf shelf--{variant} shelf--{size} ui-glass-rim"
		aria-roledescription="carousel"
		aria-label="Recent projects"
		onpointerenter={() => (hovered = true)}
		onpointerleave={() => (hovered = false)}
		onfocusin={() => (focused = true)}
		onfocusout={() => (focused = false)}
		onkeydown={onKey}
	>
		<div class="stage" aria-hidden="true">
			{#each items as item, i (item.id)}
				{#if i === index || i === prev}
					<div class="art" class:art--on={i === index} {@attach art(() => i === index)}>
						{#if item.background}
							<RemoteImg src={item.background} class="poster" eager />
							<RemoteImg src={item.background} class="poster poster--soft" eager />
						{:else}
							<Aura name={item.name} />
						{/if}
					</div>
				{/if}
			{/each}
			<div class="veil veil--spotlight"></div>
			<div class="veil veil--banner"></div>
		</div>

		<div class="copy-stack" aria-live="polite">
			{#key current.id}
				<div class="copy-layers" {@attach copyIn} out:fade={{ duration: FADE.out * tempo() }}>
					<div
						class="copy copy--spotlight"
						class:copy--on={variant === 'spotlight'}
						inert={variant !== 'spotlight'}
					>
						<div class="byline">
							<span class="byline-icon"
								><AppIcon name={current.name} kind="project" icon={current.image} size="sm" /></span
							>
							{#if current.owner}<span class="owner">{current.owner}</span>{/if}
						</div>
						<div class="text">
							<div class="heading">
								<h2 class="name">{current.name}</h2>
								{#if current.description}
									<p class="description" title={current.description}>{current.description}</p>
								{/if}
							</div>
							<p class="status status--{current.tone}">
								<StatusDot
									meta={statusMeta(current.tone, current.status, current.tone === 'progress')}
									size={8}
								/><span class="status-label">{current.status}</span>
							</p>
						</div>
						<div class="actions">
							<a class="open" href={primary?.href ?? current.href}
								><span class="open-label">{primary?.label ?? 'Open project'}</span><PrimaryIcon
									size={16}
									aria-hidden="true"
								/></a
							>
							{#if current.url}
								<Button
									variant="media"
									href={current.url}
									iconRight={ExternalLink}
									target="_blank"
									rel="noreferrer">Visit</Button
								>
							{/if}
							{#if apps.length}
								<span class="apps" aria-label="{current.apps?.length} apps">
									{#each apps as a (a.name)}
										<span class="app" title={a.name}
											><AppIcon name={a.name} kind={a.kind ?? 'deployment'} size="sm" /></span
										>
									{/each}
									{#if extra}<span class="more">+{extra}</span>{/if}
								</span>
							{/if}
						</div>
					</div>
					<div
						class="copy copy--banner"
						class:copy--on={variant === 'banner'}
						inert={variant !== 'banner'}
					>
						<span class="lead"
							><AppIcon name={current.name} kind="project" icon={current.image} size="lg" /></span
						>
						<div class="text">
							<p class="name" aria-hidden={variant !== 'banner'}>{current.name}</p>
							<p class="status status--{current.tone}">
								<StatusDot
									meta={statusMeta(current.tone, current.status, current.tone === 'progress')}
									size={8}
								/><span class="status-label">{current.status}</span>
							</p>
						</div>
					</div>
				</div>
			{/key}
		</div>

		{#if tools}
			<div class="tools" class:layer--on={variant === 'spotlight'} inert={variant !== 'spotlight'}>
				{@render tools()}
			</div>
		{/if}

		<div class="side" class:layer--on={variant === 'banner'} inert={variant !== 'banner'}>
			{#if tools}{@render tools()}{/if}
			<a class="open" href={primary?.href ?? current.href}
				><span class="open-label">{primary?.label ?? 'Open'}</span><PrimaryIcon
					size={15}
					aria-hidden="true"
				/></a
			>
			{#if current.url}
				<Button
					variant="media"
					size="sm"
					href={current.url}
					icon={ExternalLink}
					label="Visit {current.name}"
					target="_blank"
					rel="noreferrer"
				/>
			{/if}
		</div>

		<span class="rim-proxy" aria-hidden="true"></span>

		{#if items.length > 1}
			<div class="dots" role="group" aria-label="Choose project" style:--count={items.length}>
				{#each items as item, i (item.id)}
					<button
						type="button"
						class="pip"
						class:pip--on={i === index}
						class:pip--auto={auto}
						style:--x="{i * PITCH + (i > index ? STRETCH : 0)}px"
						aria-label="Show {item.name}"
						aria-current={i === index ? 'true' : undefined}
						onclick={() => go(i)}
					>
						<span class="shape"
							><span class="cap"></span><span class="bar"></span><span class="cap cap--end"
							></span></span
						>
						{#if i === index && auto}
							{#key index}
								<span class="track"
									><span
										class="fill"
										class:fill--paused={paused}
										onanimationend={() => go(index + 1, 1)}
									></span></span
								>
							{/key}
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style>
	.tools {
		position: absolute;
		top: 1.5rem;
		right: 1.5rem;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.shelf {
		--pad: 2rem;
		position: relative;
		display: flex;
		min-width: 0;
		overflow: clip;
		isolation: isolate;
		border-radius: calc(var(--radius-panel) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-active);
		box-shadow: var(--shadow-glass);
		color: var(--on-media);
	}
	.shelf--lg {
		--art-h: 22rem;
	}
	.shelf--md {
		--art-h: 15.5rem;
	}
	.shelf--spotlight {
		height: 22rem;
	}
	.shelf--spotlight.shelf--md {
		--pad: 1.75rem;
		height: 15.5rem;
	}
	.shelf--md .veil--spotlight {
		background: linear-gradient(
			90deg,
			oklch(0 0 0 / 0.5) 0%,
			oklch(0 0 0 / 0.26) 34%,
			transparent 62%
		);
	}
	.shelf--md .art :global(.poster) {
		filter: saturate(1.15) brightness(1.04);
	}
	.shelf--md .art :global(.poster--soft) {
		filter: blur(28px) saturate(1.4);
	}
	.shelf--md .copy--spotlight {
		gap: 1rem;
	}
	.shelf--md .copy--spotlight .name {
		font-size: calc(var(--text-display) * 1.15);
	}
	.shelf--banner {
		height: 9rem;
		--pad: 1.5rem;
	}

	.stage {
		position: absolute;
		top: 0;
		left: 50%;
		width: min(100vw, var(--page-wide));
		height: var(--art-h);
		translate: -50% 0;
		z-index: -1;
		overflow: hidden;
		contain: paint;
	}
	.art {
		position: absolute;
		inset: -4%;
		z-index: 0;
		will-change: transform, opacity;
	}
	.art--on {
		z-index: 1;
	}
	.art :global(.aura),
	.art :global(.poster) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.art :global(.poster) {
		object-fit: cover;
		object-position: center 40%;
	}
	.art :global(.poster--soft) {
		filter: blur(28px) saturate(1.3);
		transform: scale(1.15);
		mask-image: linear-gradient(90deg, var(--on-media) 32%, transparent 72%);
	}
	.veil {
		position: absolute;
		inset: 0 0 auto;
		height: var(--art-h);
		z-index: 2;
		transition: opacity var(--spring-morph-duration) var(--spring-morph);
	}
	.veil--spotlight {
		background: linear-gradient(20deg, var(--on-media-pill) 0%, transparent 58%), var(--media-veil);
	}
	.veil--banner {
		opacity: 0;
		background:
			linear-gradient(90deg, oklch(0 0 0 / 0.5) 0%, oklch(0 0 0 / 0.22) 40%, transparent 66%),
			linear-gradient(270deg, oklch(0 0 0 / 0.32) 0%, transparent 38%);
	}
	.shelf--banner .veil--spotlight {
		opacity: 0;
	}
	.shelf--banner .veil--banner {
		opacity: 1;
	}

	.copy-stack {
		display: grid;
		grid-template-rows: minmax(0, 1fr);
		flex: 1;
		min-width: 0;
		min-height: 0;
	}
	.copy-layers {
		grid-area: 1 / 1;
		display: grid;
		grid-template-rows: minmax(0, 1fr);
		min-width: 0;
		min-height: 0;
	}
	.copy,
	.tools,
	.side {
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--fade-out) var(--curve-in);
	}
	.copy--on,
	.layer--on {
		opacity: 1;
		pointer-events: auto;
		transition: opacity var(--fade-long) var(--curve-out) var(--fade-out);
	}
	.copy {
		grid-area: 1 / 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 1.5rem;
		min-width: 0;
		padding: var(--pad);
		padding-right: 8rem;
	}
	.copy--banner {
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		gap: 1rem;
		padding-right: 1rem;
	}

	.byline {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		margin-bottom: auto;
		color: var(--on-media-muted);
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
	}
	.byline :global(.icon) {
		box-shadow: 0 0 0 0.5px var(--on-media-edge);
	}
	.owner {
		text-box: trim-both cap alphabetic;
	}
	.lead {
		display: flex;
		flex-shrink: 0;
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
		min-width: 0;
	}
	.copy--banner .text {
		gap: 0.75rem;
	}
	.name {
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: calc(var(--text-display) * 1.5);
		font-weight: var(--weight-semibold);
		letter-spacing: -0.017em;
		line-height: 1;
		text-shadow: var(--on-media-shadow);
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.copy--banner .name {
		font-size: var(--text-title-1);
		letter-spacing: -0.018em;
	}
	.heading {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.text:has(.description) {
		gap: 1.5rem;
	}
	.description {
		max-width: min(100%, 40rem);
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--on-media);
		font-size: var(--text-body);
		text-shadow: var(--on-media-shadow);
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		color: var(--on-media-muted);
		font-size: var(--text-body);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.copy--banner .status {
		font-size: var(--text-callout);
	}
	.status-label {
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.status--error {
		color: var(--on-media);
		font-weight: var(--weight-medium);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}
	.open {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		height: 2.25rem;
		padding: 0 0.875rem 0 1rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--on-media);
		color: oklch(from var(--on-media-pill) l c h / 0.88);
		box-shadow: var(--on-media-shadow);
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		text-decoration: none;
		white-space: nowrap;
		transition:
			opacity var(--dur-fast) ease,
			transform var(--spring-press-duration) var(--spring-press);
	}
	.open:hover {
		opacity: 0.9;
	}
	.open:active {
		transform: scale(0.96);
	}
	.open:focus-visible,
	.pip:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--on-media-edge);
	}
	.open-label {
		text-box: trim-both cap alphabetic;
	}
	.actions :global(.button) {
		height: 2.25rem;
	}

	.apps {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-left: 0.75rem;
		padding-left: 1rem;
		box-shadow: inset 0.5px 0 0 var(--on-media-edge);
	}
	.app {
		display: flex;
	}
	.app :global(.icon) {
		box-shadow: 0 0 0 0.5px var(--on-media-edge);
	}
	.more {
		color: var(--on-media-muted);
		font-size: var(--text-caption);
		font-weight: var(--weight-medium);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-box: trim-both cap alphabetic;
		padding-left: 0.125rem;
	}

	.side {
		position: absolute;
		top: 50%;
		right: var(--pad);
		display: flex;
		align-items: center;
		gap: 0.375rem;
		translate: 0 -50%;
	}
	.side .open {
		height: 1.75rem;
		padding: 0 0.625rem 0 0.75rem;
		border-radius: calc(0.5625rem * var(--corner-scale));
		font-size: var(--text-callout);
		gap: 0.3125rem;
	}

	.dots {
		--dot: 7px;
		--stretch: 17px;
		position: absolute;
		right: var(--pad);
		bottom: calc(var(--pad) + 0.6875rem);
		width: calc(var(--count) * var(--dot) + (var(--count) - 1) * 6px + var(--stretch));
		height: var(--dot);
	}
	.shelf--banner .dots {
		bottom: 0.875rem;
	}
	.pip {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--dot);
		height: var(--dot);
		padding: 0;
		border: none;
		border-radius: 50%;
		background: none;
		cursor: pointer;
		transform: translateX(var(--x));
		transition: transform var(--spring-glide-duration) var(--spring-glide);
	}
	.pip::before {
		content: '';
		position: absolute;
		inset: -0.5rem -0.1875rem;
	}
	.shape {
		position: absolute;
		inset: 0;
		opacity: 0.42;
		transition: opacity var(--dur-fast) ease;
	}
	.pip:hover .shape {
		opacity: 0.7;
	}
	.pip--on .shape {
		opacity: 1;
	}
	.pip--on.pip--auto .shape {
		opacity: 0.42;
	}
	.cap,
	.bar {
		position: absolute;
		top: 0;
		left: 0;
		height: var(--dot);
		background: var(--on-media);
	}
	.cap {
		width: var(--dot);
		border-radius: 50%;
		transition: transform var(--spring-glide-duration) var(--spring-glide);
	}
	.bar {
		left: calc(var(--dot) / 2);
		width: var(--stretch);
		transform: scaleX(0);
		transform-origin: left center;
		transition: transform var(--spring-glide-duration) var(--spring-glide);
	}
	.pip--on .cap--end {
		transform: translateX(var(--stretch));
	}
	.pip--on .bar {
		transform: scaleX(1);
	}
	.track {
		position: absolute;
		top: 0;
		left: 0;
		width: calc(var(--dot) + var(--stretch));
		height: var(--dot);
		overflow: hidden;
		border-radius: var(--radius-pill);
	}
	.fill {
		position: absolute;
		inset: 0;
		background: var(--on-media);
		transform: translateX(-100%);
		animation: advance 8s linear both;
	}
	.fill--paused {
		animation-play-state: paused;
	}
	@keyframes advance {
		to {
			transform: translateX(0);
		}
	}

	@media (max-width: 720px) {
		.shelf--spotlight {
			--pad: 1.25rem;
			height: 20rem;
		}
		.copy {
			padding-right: var(--pad);
			padding-bottom: calc(var(--pad) + 1.5rem);
		}
		.name {
			font-size: var(--text-display);
		}
		.apps {
			display: none;
		}
		.dots {
			bottom: var(--pad);
		}
	}

	.byline-icon {
		display: flex;
	}
	.copy .name,
	.copy .status {
		width: fit-content;
		max-width: 100%;
	}

	:global(html.vt-hero) .shelf {
		view-transition-name: hero;
	}
	:global(html.vt-hero) .copy--on .name {
		view-transition-name: hero-name;
	}
	:global(html.vt-hero) .copy--on .status {
		view-transition-name: hero-status;
	}
	:global(html.vt-hero) .copy--on .byline-icon,
	:global(html.vt-hero) .copy--on .lead {
		view-transition-name: hero-icon;
	}
	:global(html.vt-hero) .copy,
	:global(html.vt-hero) .tools,
	:global(html.vt-hero) .side {
		transition: none;
	}
	:global(html.vt-hero) .shelf::after {
		display: none;
	}
	.rim-proxy {
		display: none;
	}
	:global(html.vt-hero) .rim-proxy {
		display: block;
		position: absolute;
		inset: 0;
		pointer-events: none;
		view-transition-name: hero-rim;
	}
	:global(html.vt-hero::view-transition-group(hero)) {
		overflow: clip;
		border-radius: calc(var(--radius-panel) * var(--corner-scale));
		corner-shape: var(--corner);
		box-shadow: var(--shadow-glass);
	}
	:global(html.vt-hero::view-transition-image-pair(hero-rim)) {
		box-sizing: border-box;
		padding: 1.25px;
		border-radius: calc(var(--radius-panel) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--rim-glass);
		mask:
			linear-gradient(#000 0 0) content-box exclude,
			linear-gradient(#000 0 0);
	}
	:global(html.vt-hero::view-transition-old(hero-rim)),
	:global(html.vt-hero::view-transition-new(hero-rim)) {
		display: none;
	}
	:global(html.vt-hero::view-transition-old(hero)),
	:global(html.vt-hero::view-transition-new(hero)) {
		mix-blend-mode: normal;
	}
	:global(html.vt-hero::view-transition-old(hero)) {
		z-index: 1;
		animation: vt-fade-out var(--fade-long) var(--curve-out) both;
	}
	:global(html.vt-hero::view-transition-new(hero)) {
		animation: none;
	}
	:global(html.vt-hero--shrink::view-transition-old(hero)) {
		z-index: auto;
		animation: none;
	}
	:global(html.vt-hero--shrink::view-transition-new(hero)) {
		z-index: 1;
		animation: vt-fade-in var(--fade-long) var(--curve-out) both;
	}
	@keyframes -global-vt-fade-out {
		to {
			opacity: 0;
		}
	}
	@keyframes -global-vt-fade-in {
		from {
			opacity: 0;
		}
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Box, Database, Timer } from 'lucide-svelte';
	import RemoteImg from '$lib/components/ui/RemoteImg.svelte';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import Sparkline from '$lib/components/ui/Sparkline.svelte';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import NumberRoll from '$lib/components/ui/NumberRoll.svelte';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import { stateEcho } from '$lib/utils/motion.svelte';
	import { crashShiver } from '$lib/components/ui/cardMotion.svelte';
	import { trafficReading, type Traffic } from '$lib/components/ui/traffic';
	import type { StatusMeta } from '$lib/components/ui/status';
	import type { Icon } from '$lib/components/ui/types';

	let {
		kind,
		name,
		status,
		href,
		detail = undefined,
		metrics = undefined,
		updatedAt = undefined,
		image = undefined,
		traffic = undefined,
		quick = undefined,
		actions = undefined
	}: {
		kind: 'deployment' | 'database' | 'job';
		name: string;
		status: StatusMeta;
		href: string;
		detail?: string;
		metrics?: string;
		updatedAt?: string | null;
		image?: string | null;
		traffic?: Traffic;
		quick?: { label: string; icon: Icon; onclick?: () => void; href?: string }[];
		actions?: Snippet;
	} = $props();

	const KIND_ICON = { deployment: Box, database: Database, job: Timer };
	const KindIcon = $derived(KIND_ICON[kind]);
	let failed = $state(false);
	let scrub = $state<number | null>(null);
	let hit = $state<HTMLAnchorElement>();

	const MENU_GRACE = 280;

	function closeMenuOnLeave(card: HTMLElement) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const leave = () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				const open = card.querySelector<HTMLElement>(':popover-open');
				if (open && !card.matches(':hover')) open.hidePopover();
			}, MENU_GRACE);
		};
		const enter = () => clearTimeout(timer);
		card.addEventListener('pointerleave', leave);
		card.addEventListener('pointerenter', enter);
		return () => {
			clearTimeout(timer);
			card.removeEventListener('pointerleave', leave);
			card.removeEventListener('pointerenter', enter);
		};
	}

	const ARC_RADIUS = 48;
	const ARC_CHORD = 2;

	const reading = $derived(traffic ? trafficReading(traffic, scrub) : null);
	const fan = $derived((quick ?? []).slice(0, 3));
	const lead = $derived(actions ? 1 : 0);
	const fanCount = $derived(fan.length + lead);

	function arc(p: number) {
		const a = (p * ARC_CHORD) / ARC_RADIUS;
		return {
			x: -ARC_RADIUS * Math.sin(a),
			y: -ARC_RADIUS * (1 - Math.cos(a))
		};
	}

	function forwardClick(el: HTMLElement) {
		const go = () => hit?.click();
		el.addEventListener('click', go);
		return () => el.removeEventListener('click', go);
	}
</script>

<div
	data-entity={name}
	class="entity entity--{status.kind} motion-echo echo--{status.kind}"
	class:entity--fan={fanCount > 0}
	{@attach stateEcho(() => status.kind)}
	{@attach closeMenuOnLeave}
	{@attach crashShiver(() => status.kind)}
>
	<a class="hit" {href} aria-label={name} bind:this={hit}></a>
	<div class="top">
		<span class="tile">
			{#if image && !failed}
				<RemoteImg src={image} class="tile-img" onerror={() => (failed = true)} />
			{:else}
				<KindIcon size={18} />
			{/if}
		</span>
		<span class="text">
			<span class="name">{name}</span>
			{#if detail}<span class="detail">{detail}</span>{/if}
		</span>
	</div>
	{#if fanCount > 0}
		<span class="fan">
			{#each fan as q, k (q.label)}
				{@const p = k + lead}
				{@const at = arc(p)}
				<span
					class="fan-item"
					style:--fx="{at.x.toFixed(3)}rem"
					style:--fy="{at.y.toFixed(3)}rem"
					style:--k={p}
					style:--back={fanCount - 1 - p}
				>
					<Tooltip text={q.label}>
						{#if q.href}
							<a class="fan-btn" href={q.href} aria-label={q.label}><q.icon size={14} /></a>
						{:else}
							<button type="button" class="fan-btn" aria-label={q.label} onclick={q.onclick}
								><q.icon size={14} /></button
							>
						{/if}
					</Tooltip>
				</span>
			{/each}
			{#if actions}
				<span
					class="fan-item fan-item--menu"
					style:--fx="0rem"
					style:--fy="0rem"
					style:--k={0}
					style:--back={fanCount - 1}
				>
					<span class="fan-shell">{@render actions()}</span>
				</span>
			{/if}
		</span>
	{/if}
	<div class="bottom">
		<span class="status">
			<StatusDot meta={status} size={8} />
			<span class="label">{status.label}</span>
		</span>
		{#if traffic}
			<span class="traffic">
				<span class="spark" {@attach forwardClick}
					><Sparkline
						values={traffic.values}
						height={14}
						tone="neutral"
						interactive
						onScrub={(i) => (scrub = i)}
					/></span
				>
				<span class="traffic-label" style:min-width="{reading?.width}ch">
					{#if reading?.scrubbing}{reading.text}{:else}<NumberRoll value={traffic.label} />{/if}
				</span>
			</span>
		{:else if metrics}<span class="metrics">{metrics}</span>{/if}
		{#if updatedAt}<span class="when"><RelativeTime date={updatedAt} /></span>{/if}
	</div>
</div>

<style>
	.entity {
		position: relative;
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		min-width: 0;
		padding: 1rem;
		border-radius: calc(var(--card-r, 0.75rem) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-raised);
		box-shadow: var(--shadow-raised);
		transition:
			background-color var(--dur-fast) ease,
			transform var(--spring-glide-duration) var(--spring-glide);
	}
	.entity::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: var(--shadow-floating);
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--dur-base) ease;
	}
	.entity:hover,
	.entity:has(:focus-visible) {
		background: var(--bg-raised);
		transform: translateY(-1px);
	}
	.entity:hover::after,
	.entity:has(:focus-visible)::after {
		opacity: 1;
	}
	.entity:active {
		transform: translateY(0) scale(0.99);
	}
	:global(html.motion-reduce) .entity:is(:hover, :active, :has(:focus-visible)) {
		transform: none;
	}
	.hit {
		position: absolute;
		inset: 0;
		z-index: 0;
		border-radius: inherit;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		pointer-events: none;
	}
	.tile {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: calc(0.625rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: linear-gradient(var(--bg-surface), var(--neutral-2));
		box-shadow:
			inset 0 0 0 0.5px var(--border-strong),
			0 1px 2px color-mix(in oklab, var(--neutral-10) 8%, transparent);
		color: var(--text-muted);
		overflow: hidden;
	}
	.tile :global(.tile-img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		padding-block: 0.3em;
		margin-block: -0.3em;
		mask-image: linear-gradient(90deg, black 100%, transparent 100%);
	}
	.entity:is(:hover, :has(:focus-visible), :has(:global(:popover-open))) .text {
		mask-image: linear-gradient(90deg, black calc(100% - 5rem), transparent calc(100% - 3.5rem));
	}
	.name,
	.detail {
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.name {
		color: var(--text-default);
		font-size: var(--text-headline);
		font-weight: var(--weight-medium);
		letter-spacing: -0.01em;
	}
	.detail {
		color: var(--text-faint);
		font-size: var(--text-callout);
	}
	.entity--fan .top {
		padding-right: 2.5rem;
	}
	.fan {
		position: absolute;
		top: 1.5rem;
		right: 1rem;
		z-index: 1;
		width: 1.75rem;
		height: 1.75rem;
		pointer-events: none;
	}
	.fan-item {
		position: absolute;
		inset: 0;
		z-index: calc(var(--back) + 1);
		display: grid;
		place-items: center;
		opacity: 0;
		transform: translate(0.5rem, -0.625rem) scale(0.82);
		transition:
			transform var(--spring-settle-duration) var(--spring-settle)
				calc(var(--back) * 50ms * var(--tempo)),
			opacity var(--fade-out) var(--curve-in) calc((var(--back) * 50ms + 50ms) * var(--tempo));
	}
	.entity:hover .fan-item,
	.entity:has(:focus-visible) .fan-item,
	.fan:has(:global([aria-expanded='true'])) .fan-item,
	.fan:has(:global(:popover-open)) .fan-item {
		opacity: 1;
		pointer-events: auto;
		transform: translate(var(--fx), var(--fy));
		transition:
			transform var(--spring-pop-duration) var(--spring-pop) calc(var(--k) * 50ms * var(--tempo)),
			opacity var(--fade-in) var(--curve-out) calc(var(--k) * 50ms * var(--tempo));
	}
	:global(html.motion-reduce) .entity .fan-item {
		transform: translate(var(--fx), var(--fy));
		transition: opacity var(--spring-snappy-duration) ease;
	}
	.fan-btn,
	.fan-shell {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: calc(0.875rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-hover);
		box-shadow: var(--shadow-raised);
		color: var(--text-muted);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}
	.fan-btn {
		padding: 0;
		border: none;
		cursor: pointer;
	}
	.fan-btn:hover {
		background: var(--bg-active);
		color: var(--text-default);
	}
	.fan-shell {
		overflow: clip;
	}
	.fan-shell:has(:global(:focus-visible)) {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.bottom {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.875rem;
		box-shadow: inset 0 1px 0 var(--border-default);
		pointer-events: none;
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-muted);
	}
	.entity--error .status {
		color: var(--red-9);
		font-weight: var(--weight-semibold);
	}
	.label,
	.metrics,
	.when {
		text-box: trim-both cap alphabetic;
		white-space: nowrap;
	}
	@container (max-width: 17rem) {
		.traffic + .when {
			display: none;
		}
	}
	.traffic {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
		color: var(--text-faint);
	}
	.spark {
		position: relative;
		z-index: 1;
		width: 3.5rem;
		pointer-events: auto;
	}
	.traffic-label {
		display: inline-flex;
		justify-content: flex-end;
		text-box: trim-both cap alphabetic;
		white-space: nowrap;
	}
	.metrics {
		margin-left: auto;
		color: var(--text-faint);
	}
	.when {
		color: var(--text-faint);
	}
	.metrics + .when {
		margin-left: 0;
	}
	.status + .when {
		margin-left: auto;
	}
	@media (hover: none) {
		.fan-item--menu {
			opacity: 1;
			pointer-events: auto;
			transform: none;
		}
		.fan-item:not(.fan-item--menu) {
			display: none;
		}
	}
</style>

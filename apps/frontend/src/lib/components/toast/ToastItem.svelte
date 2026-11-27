<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Check, CircleAlert, TriangleAlert, Info } from 'lucide-svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FADE, SpringValue } from '$lib/utils/motion.svelte';
	import { tempo } from '$lib/design/springs';
	import { toasts, toastLook, TOAST_DURATION, type Toast } from '$lib/stores/toast';

	let {
		toast,
		expand,
		align,
		stackHovered
	}: {
		toast: Toast;
		expand: 'top' | 'bottom';
		align: 'left' | 'center' | 'right';
		stackHovered: boolean;
	} = $props();

	const H = 40;
	const ROUND = 16;
	const BLUR = ROUND * 0.5;
	const INSET = 8;
	const TAIL = 14;
	const MIN_OPEN = H * 2.25;
	const TEXT_X = 44;
	const TEXT_END = 20;
	const PAD = 12;
	const DESC_TOP = 38;
	const OPEN_MAX = 300;
	const SWIPE_MAX = 20;
	const SWIPE_DISMISS = 30;

	const ICONS = { success: Check, error: CircleAlert, warning: TriangleAlert, info: Info };

	const uid = $props.id();
	let width = $state(350);
	let ready = $state(false);
	let hovered = $state(false);
	let auto = $state(false);
	let contentH = $state(0);
	let inner = $state<HTMLElement>();
	let content = $state<HTMLElement>();
	let drag = $state(0);
	let descNatural = $state(0);
	let dragging = $state(false);

	const progress = new SpringValue(0);
	const pill = new SpringValue(H);

	type Layer = { key: string; title: string; color: Toast['color'] };
	let current = $state<Layer>({ key: '', title: '', color: 'info' });
	let previous = $state<Layer | null>(null);

	const hasMore = $derived(!!(toast.description || toast.action));
	const loading = $derived(toast.color === 'loading');
	const open = $derived(
		hasMore && !loading && !toast.exiting && (hovered || (auto && !stackHovered))
	);

	const openH = $derived(
		$toastLook !== 'tab' ? DESC_TOP + contentH : Math.max(MIN_OPEN, H + contentH)
	);
	const p = $derived(progress.current);
	const height = $derived(H + p * (openH - H));
	const pillW = $derived(Math.max(H, pill.current));
	const pillX = $derived(
		align === 'right' ? width - pillW : align === 'center' ? (width - pillW) / 2 : 0
	);
	const svgH = $derived(hasMore ? openH : H);
	const pillH = $derived(H + p * BLUR * 3);
	const pillR = $derived(H / 2 - p * (H / 2 - ROUND));
	const bodyH = $derived(Math.max(0, p * (openH - H)));
	const single = $derived($toastLook !== 'tab');
	const targetW = $derived(
		Math.min(
			width,
			Math.min(OPEN_MAX, Math.max(pillW, Math.ceil(descNatural) + TEXT_X + TEXT_END + 2))
		)
	);
	const targetX = $derived(
		align === 'right' ? width - targetW : align === 'center' ? (width - targetW) / 2 : 0
	);
	const shapeW = $derived(single ? pillW + p * (targetW - pillW) : pillW);
	const shapeX = $derived(single ? pillX + p * (targetX - pillX) : pillX);
	const shapeR = $derived(single ? H / 2 - p * (H / 2 - (PAD + 12)) : pillR);
	const flushL = $derived(pillX < 0.5);
	const flushR = $derived(pillX + pillW > width - 0.5);
	const filler = $derived(Math.min(ROUND, bodyH));

	const seams = $derived.by(() => {
		const zones: { x: number; y: number; w: number; h: number }[] = [];
		const left = pillX;
		const right = pillX + pillW;
		if (left < 0.5) zones.push({ x: 0, y: H - ROUND / 2, w: ROUND, h: ROUND * 2 });
		else {
			const x = Math.max(ROUND, left - ROUND * 2);
			zones.push({ x, y: H - ROUND * 1.5, w: left + ROUND / 2 - x, h: ROUND * 2 });
		}
		if (right > width - 0.5)
			zones.push({ x: width - ROUND, y: H - ROUND / 2, w: ROUND, h: ROUND * 2 });
		else {
			const end = Math.min(width - ROUND, right + ROUND * 2);
			zones.push({
				x: right - ROUND / 2,
				y: H - ROUND * 1.5,
				w: end - right + ROUND / 2,
				h: ROUND * 2
			});
		}
		return zones;
	});
	const sign = $derived(expand === 'bottom' ? 1 : -1);

	$effect(() => {
		const next = { key: `${toast.color}:${toast.title}`, title: toast.title, color: toast.color };
		untrack(() => {
			if (current.key === next.key) return;
			if (current.key) {
				const outgoing = current;
				previous = outgoing;
				setTimeout(() => {
					if (previous === outgoing) previous = null;
				}, FADE.long * tempo());
			}
			current = next;
		});
	});

	$effect(() => {
		const target = open ? 1 : 0;
		untrack(() => progress.to(target, 'morph', { settle: target === 0, instant: !ready }));
	});

	$effect(() => {
		void toast.version;
		if (!hasMore || loading) return;
		const life = toast.duration ?? TOAST_DURATION;
		const expandAt = setTimeout(() => (auto = true), life * 0.025);
		const collapseAt = setTimeout(() => (auto = false), Math.max(life - 2000, life * 0.5));
		return () => {
			clearTimeout(expandAt);
			clearTimeout(collapseAt);
		};
	});

	function measurePill() {
		if (!inner) return;
		pill.to(inner.scrollWidth + INSET + TAIL, 'morph', { instant: !ready });
	}

	$effect(() => {
		if (!inner) return;
		const ro = new ResizeObserver(measurePill);
		ro.observe(inner);
		return () => ro.disconnect();
	});

	$effect(() => {
		if (!content) {
			contentH = 0;
			return;
		}
		const el = content;
		const ro = new ResizeObserver(() => (contentH = el.scrollHeight));
		ro.observe(el);
		return () => ro.disconnect();
	});

	onMount(() => {
		width = Math.min(350, window.innerWidth - 24);
		measurePill();
		const raf = requestAnimationFrame(() => (ready = true));
		return () => cancelAnimationFrame(raf);
	});

	let startY: number | null = null;

	function onpointerdown(e: PointerEvent) {
		if (toast.exiting || (e.target as HTMLElement).closest('button')) return;
		startY = e.clientY;
		dragging = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent) {
		if (startY === null) return;
		const dy = e.clientY - startY;
		drag = Math.sign(dy) * Math.min(Math.abs(dy), SWIPE_MAX);
	}

	function onpointerup(e: PointerEvent) {
		if (startY === null) return;
		const dy = e.clientY - startY;
		startY = null;
		dragging = false;
		drag = 0;
		if (Math.abs(dy) > SWIPE_DISMISS) toasts.remove(toast.id);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') toasts.remove(toast.id);
	}
</script>

<div
	class="toast"
	data-ready={ready || undefined}
	data-exiting={toast.exiting || undefined}
	data-edge={expand}
	data-look={$toastLook}
	role={toast.color === 'error' ? 'alert' : 'status'}
	tabindex="-1"
	style:--w="{width}px"
	style:--text-x="{TEXT_X}px"
	style:--text-end="{TEXT_END}px"
	style:--h="{height}px"
	onpointerenter={() => (hovered = true)}
	onpointerleave={() => (hovered = false)}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	onpointercancel={onpointerup}
	{onkeydown}
>
	<div class="drag" class:drag--live={dragging} style:transform="translateY({drag}px)">
		<div class="canvas" data-edge={expand}>
			<svg {width} height={svgH} viewBox="0 0 {width} {svgH}" aria-hidden="true">
				{#snippet shapes()}
					<rect class="shape" x={pillX} y="0" width={pillW} height={pillH} rx={pillR} />
					{#if hasMore && filler > 0}
						{#if flushL}
							<rect class="shape" x="0" y={H - ROUND} width={ROUND} height={ROUND + filler} />
						{/if}
						{#if flushR}
							<rect
								class="shape"
								x={width - ROUND}
								y={H - ROUND}
								width={ROUND}
								height={ROUND + filler}
							/>
						{/if}
					{/if}
					{#if hasMore}
						<rect
							class="shape"
							x="0"
							y={H}
							{width}
							height={bodyH}
							rx={Math.min(ROUND, bodyH / 2)}
							opacity={Math.min(1, p * 3)}
						/>
					{/if}
				{/snippet}
				<defs>
					<filter
						id="goo-{uid}"
						filterUnits="userSpaceOnUse"
						x={-BLUR * 2}
						y={-BLUR * 2}
						width={width + BLUR * 4}
						height={svgH + BLUR * 4}
						color-interpolation-filters="sRGB"
					>
						<feGaussianBlur in="SourceGraphic" stdDeviation={BLUR} result="blur" />
						<feColorMatrix
							in="blur"
							type="matrix"
							values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
							result="goo"
						/>
						<feComposite in="SourceGraphic" in2="goo" operator="atop" />
					</filter>
				</defs>
				{#if single}
					<rect class="shape" x={shapeX} y="0" width={shapeW} {height} rx={shapeR} />
				{:else if hasMore && p > 0.01}
					<clipPath id="seam-{uid}">
						{#each seams as z, i (i)}<rect x={z.x} y={z.y} width={z.w} height={z.h} />{/each}
					</clipPath>
					<g clip-path="url(#seam-{uid})">
						<g filter="url(#goo-{uid})">
							{@render shapes()}
						</g>
					</g>
				{/if}
				{#if !single}{@render shapes()}{/if}
			</svg>
		</div>

		<div
			class="header"
			class:header--single={single}
			data-edge={expand}
			style:left="{single ? shapeX : pillX}px"
			style:max-width="{pillW}px"
			style:transform={single
				? `translate(${p * (PAD - 8)}px, ${p * (PAD - 8)}px)`
				: `translateY(${p * 3 * sign}px) scale(${1 - p * 0.1})`}
		>
			<div class="stack">
				{#key current.key}
					<div class="layer layer--current" bind:this={inner}>
						{@render face(current)}
					</div>
				{/key}
				{#if previous}
					<div class="layer layer--previous" aria-hidden="true">{@render face(previous)}</div>
				{/if}
			</div>
		</div>

		{#if hasMore}
			<div
				class="content"
				class:content--single={single}
				data-edge={expand}
				data-visible={open || undefined}
				style:left={single ? `${targetX}px` : undefined}
				style:width={single ? `${targetW}px` : undefined}
			>
				{#if single && toast.description}
					<span class="measure" aria-hidden="true" bind:clientWidth={descNatural}
						>{toast.description}</span
					>
				{/if}
				<div class="description" bind:this={content}>
					{#if toast.description}<p>{toast.description}</p>{/if}
					{#if toast.action}
						<button
							type="button"
							class="action"
							data-tone={toast.color}
							onclick={() => {
								toast.action?.onClick();
								toasts.remove(toast.id);
							}}>{toast.action.label}</button
						>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

{#snippet face(layer: Layer)}
	<span class="glyph" data-tone={layer.color} data-icon={layer.color}>
		{#if layer.color === 'loading'}
			<Spinner size={14} />
		{:else}
			{@const Glyph = ICONS[layer.color]}
			<Glyph size={14} strokeWidth={2.5} />
		{/if}
	</span>
	<span class="label" data-tone={layer.color} title={layer.title}>{layer.title}</span>
{/snippet}

<style>
	.toast {
		--gap: 0.75rem;
		position: relative;
		width: var(--w);
		height: var(--h);
		flex-shrink: 0;
		pointer-events: auto;
		touch-action: none;
		outline: none;
		opacity: 0;
		transform: translateY(calc(6px * var(--enter-dir))) scale(0.95);
	}
	.toast[data-edge='top'] {
		--enter-dir: 1;
		margin-top: calc(-1 * (var(--h) + var(--gap)));
	}
	.toast[data-edge='bottom'] {
		--enter-dir: -1;
		margin-bottom: calc(-1 * (var(--h) + var(--gap)));
	}
	.toast[data-ready] {
		opacity: 1;
		transform: none;
		margin: 0;
		transition:
			transform var(--spring-morph-duration) var(--spring-morph),
			opacity var(--fade-long) var(--curve-out),
			margin var(--spring-morph-duration) var(--spring-morph);
	}
	.toast[data-ready][data-exiting] {
		opacity: 0;
		transform: translateY(calc(6px * var(--enter-dir))) scale(0.95);
		pointer-events: none;
		transition:
			transform var(--spring-settle-duration) var(--spring-settle),
			opacity var(--fade-out) var(--curve-in),
			margin var(--spring-settle-duration) var(--spring-settle);
	}
	.toast[data-ready][data-exiting][data-edge='top'] {
		margin-top: calc(-1 * (var(--h) + var(--gap)));
	}
	.toast[data-ready][data-exiting][data-edge='bottom'] {
		margin-bottom: calc(-1 * (var(--h) + var(--gap)));
	}

	.drag {
		position: absolute;
		inset: 0;
		transition: transform var(--spring-glide-duration) var(--spring-glide);
	}
	.drag--live {
		transition: none;
	}

	.canvas {
		position: absolute;
		right: 0;
		left: 0;
		pointer-events: none;
		filter: drop-shadow(0 0 0.5px color-mix(in oklab, var(--neutral-10) 30%, transparent))
			drop-shadow(0 8px 20px rgb(0 0 0 / 0.16));
	}
	.canvas[data-edge='bottom'] {
		top: 0;
	}
	.canvas[data-edge='top'] {
		bottom: 0;
		transform: scaleY(-1);
	}
	.canvas svg {
		display: block;
		overflow: visible;
	}
	.shape {
		fill: var(--toast-fill);
	}

	.header {
		position: absolute;
		z-index: 2;
		display: flex;
		align-items: center;
		height: 40px;
		padding: 0 14px 0 8px;
		overflow: hidden;
		transform-origin: center;
	}
	.header[data-edge='bottom'] {
		top: 0;
	}
	.header[data-edge='top'] {
		bottom: 0;
	}
	.stack {
		position: relative;
		display: inline-flex;
		align-items: center;
		height: 100%;
	}
	.layer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
	}
	.layer--current {
		animation: face-in var(--fade-long) var(--curve-out) both;
	}
	.layer--previous {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		animation: face-out var(--fade-out) var(--curve-in) forwards;
		pointer-events: none;
	}
	@keyframes face-in {
		from {
			opacity: 0;
			filter: blur(6px);
		}
	}
	@keyframes face-out {
		to {
			opacity: 0;
			filter: blur(6px);
		}
	}

	.glyph {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		color: var(--tone-on);
		background: var(--tone);
	}
	.label {
		max-width: calc(var(--w) - 1.5rem - 0.5rem - 22px);
		overflow-x: clip;
		text-overflow: ellipsis;
		text-box: trim-both cap alphabetic;
		font-size: 0.8125rem;
		line-height: 1rem;
		font-weight: var(--weight-medium);
		color: var(--toast-ink);
	}
	.glyph[data-icon='warning'] :global(svg) {
		transform: translateY(-0.5px);
	}
	[data-tone='success'] {
		--tone: var(--toast-success);
		--tone-on: var(--toast-success-on);
	}
	[data-tone='error'] {
		--tone: var(--toast-error);
		--tone-on: var(--toast-error-on);
	}
	[data-tone='warning'] {
		--tone: var(--toast-warning);
		--tone-on: var(--toast-warning-on);
	}
	[data-tone='info'] {
		--tone: var(--toast-info);
		--tone-on: var(--toast-info-on);
	}
	[data-tone='loading'] {
		--tone: var(--toast-loading);
		--tone-on: var(--toast-loading-on);
	}

	.content {
		position: absolute;
		left: 0;
		z-index: 1;
		width: 100%;
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--fade-out) var(--curve-in);
	}
	.content[data-edge='bottom'] {
		top: 40px;
	}
	.content[data-edge='top'] {
		top: 0;
	}
	.content[data-visible] {
		opacity: 1;
		pointer-events: auto;
		transition: opacity var(--fade-long) var(--curve-out) calc(180ms * var(--tempo));
	}
	.measure {
		position: absolute;
		display: inline-block;
		visibility: hidden;
		white-space: nowrap;
		font-size: var(--text-callout);
		pointer-events: none;
	}
	.header--single[data-edge] {
		top: 0;
		bottom: auto;
	}
	.content--single[data-edge] {
		top: 38px;
	}
	.content--single .description {
		gap: 0.5rem;
		padding: 0 var(--text-end) 0.75rem var(--text-x);
		font-size: var(--text-callout);
		line-height: 1.125rem;
	}
	.description {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		font-size: var(--text-body);
		line-height: var(--lh-body);
		color: var(--toast-muted);
		overflow-wrap: anywhere;
	}
	.action {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 1.75rem;
		padding: 0 0.625rem;
		border: none;
		border-radius: var(--radius-pill);
		background: color-mix(in oklab, var(--tone) 28%, transparent);
		color: var(--toast-ink);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-caption);
		font-weight: var(--weight-medium);
		cursor: pointer;
		transition: background-color var(--dur-fast) ease;
	}
	.action:hover {
		background: color-mix(in oklab, var(--tone) 40%, transparent);
	}
</style>

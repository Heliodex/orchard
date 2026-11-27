<script lang="ts" module>
	import { Box, Database, Timer, LayoutTemplate } from 'lucide-svelte';
	import type { Icon } from '$lib/components/ui/types';

	export type NewMenuItem = { id: string; label: string; description?: string; icon: Icon };

	const DEFAULT_ITEMS: NewMenuItem[] = [
		{ id: 'deployment', label: 'App', description: 'From a repo or image', icon: Box },
		{ id: 'database', label: 'Database', description: 'Postgres, Redis and more', icon: Database },
		{ id: 'job', label: 'Job', description: 'Runs on a schedule', icon: Timer },
		{
			id: 'template',
			label: 'From a template',
			description: 'Ready-made apps and stacks',
			icon: LayoutTemplate
		}
	];
</script>

<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { Plus } from 'lucide-svelte';
	import { SpringValue, motionLevel, springTiming } from '$lib/utils/motion.svelte';
	import { tempo } from '$lib/design/springs';

	let {
		items = DEFAULT_ITEMS,
		onSelect = undefined,
		onIntent = undefined,
		label = 'New'
	}: {
		items?: NewMenuItem[];
		onSelect?: (id: string) => void;
		onIntent?: () => void;
		label?: string;
	} = $props();

	const BLUR = 8;
	const NECK = 8;
	const GAP = 6;
	const DROP = 0.7;
	const SWALLOW_AT = 0.05;
	const BULGE = 'scale(1.03, 1.06)';
	const BURST_SCALE = 0.4;
	const BURST_TRAVEL = 0.6;
	const STRIDE = 0.02;
	const LEAD = 0.05;
	const RETRACT_LAG = 50;

	const uid = $props.id();
	let root = $state<HTMLElement>();
	let trigger = $state<HTMLButtonElement>();
	let matter = $state<HTMLElement>();
	let sheet = $state<HTMLElement>();
	let open = $state(false);
	let tier = $state<'full' | 'reduced' | 'off'>('full');
	let box = $state({ bw: 72, bh: 32, w: 256, h: 200, rt: 10, r: 18 });

	const p = new SpringValue(0);
	const fade = new SpringValue(0);

	const full = $derived(tier === 'full');
	const s = $derived(full ? Math.max(0, p.current) : 1);
	const drawn = $derived(open || (full ? p.current > 0.002 : fade.current > 0.002));
	const tint = $derived(full ? 1 - ramp(0.12, 0.55, s) : 1 - fade.current);
	const veil = $derived(full ? 1 : fade.current);
	const lift = $derived(ramp(0.05, 0.6, s));

	function ramp(a: number, b: number, x: number) {
		const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
		return t * t * (3 - 2 * t);
	}

	function mix(a: number, b: number, t: number) {
		return a + (b - a) * t;
	}

	const geo = $derived.by(() => {
		const { bw, bh, w, h, rt, r } = box;
		const over = Math.max(0, s - 1);
		const cx = w - bw / 2;
		const drop = bw * DROP;
		const spread = ramp(0.3, 0.95, s);
		const hang = NECK * Math.sin(Math.PI * Math.min(1, s / 0.85));
		const gap = GAP * ramp(0.2, 0.9, s);
		const left = mix(cx - drop / 2, 0, spread) - over * w * 0.2;
		const right = mix(cx + drop / 2, w, spread);
		const top = bh + gap + hang - bh * 0.6 * (1 - ramp(0.05, 0.35, s));
		const bottom = bh + gap + h * Math.pow(Math.min(s, 1), 1.25) + over * h * 0.3;
		const width = Math.max(0, right - left);
		const height = Math.max(0, bottom - top);
		return {
			tab: { x: w - bw, y: 0, w: bw, h: bh + (gap + r + rt) * ramp(0.7, 0.95, s), r: rt },
			body: { x: left, y: top, w: width, h: height, r: Math.min(r, width / 2, height / 2) },
			zone: { x: w - bw - r * 2, y: bh - r, w: bw + r * 2 + 2, h: NECK + r * 2.5 }
		};
	});

	const clip = $derived.by(() => {
		const { bh, w, h } = box;
		const b = geo.body;
		const t = Math.max(0, b.y - bh - GAP);
		const l = Math.max(0, b.x);
		const rr = Math.max(0, w - (b.x + b.w));
		const bb = Math.max(0, bh + GAP + h - (b.y + b.h));
		return `inset(${t}px ${rr}px ${bb}px ${l}px round ${b.r}px)`;
	});

	const svgH = $derived(box.bh + GAP + box.h * 1.4);

	function measure() {
		if (!trigger || !matter || !sheet || !root) return;
		const cs = getComputedStyle(root);
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		const scale = parseFloat(cs.getPropertyValue('--corner-scale')) || 1;
		box = {
			bw: trigger.offsetWidth,
			bh: trigger.offsetHeight,
			w: matter.offsetWidth,
			h: sheet.offsetHeight,
			rt: parseFloat(cs.getPropertyValue('--radius-control')) * rem || 10,
			r: parseFloat(getComputedStyle(sheet).borderTopLeftRadius) / scale || 18
		};
	}

	function options() {
		return sheet ? [...sheet.querySelectorAll<HTMLElement>('[role="menuitem"]')] : [];
	}

	let rows: (Animation | null)[] = [];

	function live(el: HTMLElement) {
		const cs = getComputedStyle(el);
		return { transform: cs.transform === 'none' ? 'none' : cs.transform, opacity: cs.opacity };
	}

	function burst(opening: boolean) {
		const els = options();
		const from = els.map((el, i) => (rows[i] ? live(el) : null));
		for (const a of rows) a?.cancel();
		rows = [];
		if (!full || !trigger) return;
		const t = trigger.getBoundingClientRect();
		const ox = t.left + t.width / 2;
		const oy = t.top + t.height / 2;
		const n = els.length;
		rows = els.map((el, i) => {
			const r = el.getBoundingClientRect();
			el.style.transformOrigin = `${ox - r.left}px 50%`;
			const away = `translateY(${(oy - (r.top + r.height / 2)) * BURST_TRAVEL}px) scale(${BURST_SCALE})`;
			const start = from[i];
			const frames: Keyframe[] = opening
				? [
						start ?? { transform: away, opacity: 0 },
						{ opacity: start?.opacity ?? 0, offset: 0.25 },
						{ opacity: 1, offset: 0.7 },
						{ transform: 'none', opacity: 1 }
					]
				: [
						start ?? { transform: 'none', opacity: 1 },
						{ opacity: start?.opacity ?? 1, offset: 0.15 },
						{ transform: away, opacity: 0 }
					];
			const delay = start ? 0 : (opening ? LEAD + i * STRIDE : (n - 1 - i) * STRIDE) * tempo();
			const anim = el.animate(frames, {
				...springTiming(opening ? 'pop' : 'settle', { delay }),
				fill: 'both'
			});
			anim.onfinish = () => {
				if (!opening || !open) return;
				anim.cancel();
				rows[i] = null;
			};
			return anim;
		});
	}

	let swallowed = true;
	let pop: Animation | null = null;

	function swallow() {
		if (!trigger) return;
		pop?.cancel();
		const el = trigger;
		const gulp = el.animate([{ transform: 'none' }, { transform: BULGE }], {
			...springTiming('press'),
			fill: 'forwards'
		});
		pop = gulp;
		gulp.onfinish = () => {
			if (pop !== gulp) return;
			const settle = el.animate(
				[{ transform: BULGE }, { transform: 'none' }],
				springTiming('bouncy')
			);
			gulp.cancel();
			pop = settle;
			settle.onfinish = () => {
				if (pop === settle) pop = null;
			};
		};
	}

	$effect(() => {
		const v = p.current;
		untrack(() => {
			if (open || swallowed || !full || v > SWALLOW_AT) return;
			swallowed = true;
			swallow();
		});
	});

	let retract: ReturnType<typeof setTimeout> | undefined;

	function drive(target: 0 | 1) {
		clearTimeout(retract);
		if (tier === 'full') {
			fade.to(target, 'glide', { instant: true });
			if (target) p.to(1, 'morph');
			else retract = setTimeout(() => p.to(0, 'settle'), RETRACT_LAG * tempo());
		} else if (tier === 'reduced') {
			p.to(target, 'glide', { instant: true });
			fade.to(target, 'glide');
		} else {
			p.to(target, 'glide', { instant: true });
			fade.to(target, 'glide', { instant: true });
		}
	}

	function show(focus: 'first' | 'last' | 'menu') {
		if (open) return;
		onIntent?.();
		tier = motionLevel();
		measure();
		pop?.cancel();
		pop = null;
		open = true;
		swallowed = false;
		drive(1);
		burst(true);
		tick().then(() => {
			const list = options();
			const target = focus === 'menu' ? sheet : focus === 'first' ? list[0] : list[list.length - 1];
			target?.focus({ preventScroll: true });
		});
	}

	function hide(refocus: boolean) {
		if (!open) return;
		tier = motionLevel();
		open = false;
		drive(0);
		burst(false);
		if (refocus) trigger?.focus({ preventScroll: true });
	}

	function select(id: string) {
		onSelect?.(id);
		hide(true);
	}

	function onTriggerClick(e: MouseEvent) {
		if (open) hide(e.detail === 0);
		else show(e.detail === 0 ? 'first' : 'menu');
	}

	function onTriggerKey(e: KeyboardEvent) {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		const edge = e.key === 'ArrowDown' ? 'first' : 'last';
		if (!open) return show(edge);
		const list = options();
		(edge === 'first' ? list[0] : list[list.length - 1])?.focus({ preventScroll: true });
	}

	function onSheetKey(e: KeyboardEvent) {
		const list = options();
		if (list.length === 0) return;
		if (e.key === 'Tab') {
			hide(false);
			trigger?.focus({ preventScroll: true });
			return;
		}
		const at = list.indexOf(document.activeElement as HTMLElement);
		let next = -1;
		if (e.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % list.length;
		else if (e.key === 'ArrowUp')
			next = at < 0 ? list.length - 1 : (at - 1 + list.length) % list.length;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = list.length - 1;
		else if (e.key.length === 1 && /\S/.test(e.key)) {
			const key = e.key.toLowerCase();
			const order = [...list.slice(at + 1), ...list.slice(0, at + 1)];
			const hit = order.find((el) => el.textContent?.trim().toLowerCase().startsWith(key));
			if (hit) next = list.indexOf(hit);
		}
		if (next < 0) return;
		e.preventDefault();
		list[next].focus({ preventScroll: true });
	}

	function onRootKey(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !open) return;
		e.preventDefault();
		e.stopPropagation();
		hide(true);
	}

	function onFocusOut(e: FocusEvent) {
		const next = e.relatedTarget as Node | null;
		if (open && next && !root?.contains(next)) hide(false);
	}

	function onSheetPointerMove(e: PointerEvent) {
		const item = (e.target as Element).closest<HTMLElement>('[role="menuitem"]');
		if (item && document.activeElement !== item) item.focus({ preventScroll: true });
	}

	function onSheetPointerLeave() {
		if (sheet?.contains(document.activeElement) && document.activeElement !== sheet) {
			sheet.focus({ preventScroll: true });
		}
	}

	function guard(node: HTMLElement) {
		node.addEventListener('keydown', onRootKey);
		node.addEventListener('focusout', onFocusOut);
		return () => {
			node.removeEventListener('keydown', onRootKey);
			node.removeEventListener('focusout', onFocusOut);
		};
	}

	$effect(() => {
		if (!open) return;
		const down = (e: PointerEvent) => {
			if (!root?.contains(e.target as Node)) hide(false);
		};
		document.addEventListener('pointerdown', down, true);
		return () => document.removeEventListener('pointerdown', down, true);
	});

	$effect(() => () => {
		clearTimeout(retract);
		for (const a of rows) a?.cancel();
		pop?.cancel();
	});
</script>

{#snippet face()}
	<Plus size={16} aria-hidden="true" />
	<span class="label">{label}</span>
{/snippet}

{#snippet shapes()}
	<rect
		class="shape"
		x={geo.tab.x}
		y={geo.tab.y}
		width={geo.tab.w}
		height={geo.tab.h}
		rx={geo.tab.r}
	/>
	{#if geo.body.h > 0.5}
		<rect
			class="shape"
			x={geo.body.x}
			y={geo.body.y}
			width={geo.body.w}
			height={geo.body.h}
			rx={geo.body.r}
		/>
	{/if}
{/snippet}

<div class="new-menu" bind:this={root} data-drawn={drawn || undefined} {@attach guard}>
	<button
		bind:this={trigger}
		type="button"
		class="trigger"
		id="{uid}-trigger"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls="{uid}-menu"
		data-spin={(open && full) || undefined}
		onclick={onTriggerClick}
		onkeydown={onTriggerKey}
		onpointerenter={() => onIntent?.()}
		onfocus={() => onIntent?.()}
	>
		<span class="skin skin--surface" aria-hidden="true" style:opacity={drawn ? 1 : 0}></span>
		<span class="skin skin--accent" aria-hidden="true" style:opacity={tint}></span>
		<span class="face" style:opacity={tint}>{@render face()}</span>
		<span class="face face--open" aria-hidden="true" style:opacity={1 - tint}>{@render face()}</span
		>
	</button>

	<div
		class="matter"
		bind:this={matter}
		style:opacity={veil}
		style:--tint={tint}
		style:--lift={lift}
	>
		<svg class="canvas" width={box.w} height={svgH} viewBox="0 0 {box.w} {svgH}" aria-hidden="true">
			<defs>
				<filter
					id="goo-{uid}"
					filterUnits="userSpaceOnUse"
					x={geo.zone.x - BLUR * 2}
					y={geo.zone.y - BLUR * 2}
					width={geo.zone.w + BLUR * 4}
					height={geo.zone.h + BLUR * 4}
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
				<clipPath id="seam-{uid}">
					<rect x={geo.zone.x} y={geo.zone.y} width={geo.zone.w} height={geo.zone.h} />
				</clipPath>
			</defs>
			{#if drawn}
				<g clip-path="url(#seam-{uid})">
					<g filter="url(#goo-{uid})">{@render shapes()}</g>
				</g>
				{@render shapes()}
			{/if}
		</svg>

		<div
			class="sheet"
			bind:this={sheet}
			id="{uid}-menu"
			role="menu"
			tabindex="-1"
			aria-labelledby="{uid}-trigger"
			inert={!open}
			style:top="{box.bh + GAP}px"
			style:clip-path={drawn ? clip : undefined}
			onkeydown={onSheetKey}
			onpointermove={onSheetPointerMove}
			onpointerleave={onSheetPointerLeave}
		>
			{#each items as item (item.id)}
				{@const Glyph = item.icon}
				<button
					type="button"
					class="option"
					role="menuitem"
					tabindex="-1"
					onclick={() => select(item.id)}
				>
					<span class="tile" aria-hidden="true"><Glyph size={16} /></span>
					<span class="text">
						<span class="title">{item.label}</span>
						{#if item.description}<span class="hint">{item.description}</span>{/if}
					</span>
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.new-menu {
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
	}
	.new-menu[data-drawn] {
		z-index: var(--z-dropdown);
	}

	.trigger {
		position: relative;
		z-index: 2;
		display: inline-grid;
		place-items: center;
		height: 2rem;
		padding: 0 0.8125rem;
		border: none;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: none;
		color: var(--on-solid);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		letter-spacing: -0.005em;
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
		transition: transform var(--spring-press-duration) var(--spring-press);
	}
	.trigger:active {
		transform: scale(0.96);
	}

	.skin {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		corner-shape: inherit;
		pointer-events: none;
	}
	.skin--surface {
		background: var(--bg-raised);
	}
	.skin--accent {
		background: var(--accent-solid);
		box-shadow: 0 1px 2px color-mix(in oklab, var(--neutral-10) 14%, transparent);
		transition: background-color var(--dur-fast) ease;
	}
	.new-menu[data-drawn] .skin--accent {
		box-shadow: none;
	}
	.trigger[aria-expanded='false']:hover .skin--accent {
		background: var(--accent-solid-hover);
	}

	.face {
		position: relative;
		grid-area: 1 / 1;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
	.face--open {
		color: var(--text-default);
	}
	.face--open :global(svg) {
		color: var(--text-muted);
	}
	.face :global(svg) {
		flex-shrink: 0;
		transition: transform var(--spring-snap-duration) var(--spring-snap);
	}
	.trigger[data-spin] .face :global(svg) {
		transform: rotate(45deg);
	}
	.label {
		display: block;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}

	.matter {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 1;
		width: 16rem;
		pointer-events: none;
		visibility: hidden;
	}
	.new-menu[data-drawn] .matter {
		visibility: visible;
	}

	.canvas {
		position: absolute;
		top: 0;
		left: 0;
		display: block;
		overflow: visible;
		filter: drop-shadow(
				0 0 0.5px
					color-mix(in oklab, var(--material-glass-edge) calc(var(--lift) * 100%), transparent)
			)
			drop-shadow(
				0 4px 12px color-mix(in oklab, var(--on-media-pill) calc(var(--lift) * 26%), transparent)
			)
			drop-shadow(
				0 12px 32px color-mix(in oklab, var(--on-media-pill) calc(var(--lift) * 34%), transparent)
			);
	}
	.shape {
		fill: color-mix(in srgb, var(--accent-solid) calc(var(--tint) * 100%), var(--bg-raised));
	}

	.sheet {
		position: absolute;
		left: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		width: 100%;
		padding: var(--float-pad);
		border-radius: var(--float-r);
		corner-shape: var(--corner);
		outline: none;
	}
	.new-menu[data-drawn] .sheet:not([inert]) {
		pointer-events: auto;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.375rem;
		border: none;
		border-radius: var(--float-item-r);
		corner-shape: var(--corner);
		background: transparent;
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		text-align: left;
		cursor: pointer;
		outline: none;
		transition: background-color var(--dur-fast) ease;
	}
	.option:hover,
	.option:focus {
		background: var(--float-hover);
	}
	.option:active {
		background: var(--float-press);
	}

	.tile {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		border-radius: calc((var(--radius-panel) - var(--float-pad) - 0.375rem) * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		color: var(--text-default);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 0.4375rem;
		min-width: 0;
	}
	.title,
	.hint {
		display: block;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.title {
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
	}
	.hint {
		color: var(--text-muted);
		font-size: var(--text-caption);
	}
</style>

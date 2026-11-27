<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { ChevronsUpDown, PanelLeft } from 'lucide-svelte';
	import NavItem from '$lib/components/ui/NavItem.svelte';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import RemoteImg from '$lib/components/ui/RemoteImg.svelte';
	import type { SidebarSection } from './sidebar';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import AppIcon from '$lib/components/ui/AppIcon.svelte';
	import Menu from '$lib/components/ui/Menu.svelte';
	import { effectiveAnimation } from '$lib/stores/preferences';
	import { SPRINGS, physics, type SpringName } from '$lib/design/springs';

	let {
		org,
		user,
		sections = [],
		onSearch = undefined,
		liquid = false,
		collapsed = $bindable(false),
		onToggle = undefined,
		orgMenu = undefined,
		userMenu = undefined,
		userAvatar = undefined,
		userBadge = 0,
		children = undefined
	}: {
		org: { name: string; plan?: string; avatar?: string | null };
		user: { handle: string; avatar?: string | null };
		sections?: SidebarSection[];
		onSearch?: () => void;
		liquid?: boolean;
		collapsed?: boolean;
		onToggle?: () => void;
		orgMenu?: Snippet;
		userMenu?: Snippet;
		userAvatar?: Snippet;
		userBadge?: number;
		children?: Snippet;
	} = $props();

	let panelW = $state(0);
	const menuW = $derived(collapsed || !panelW ? undefined : panelW - 16);

	function toggle() {
		if (onToggle) onToggle();
		else collapsed = !collapsed;
	}

	const liquidOn = $derived(liquid && !children && $effectiveAnimation === 'full');

	const HOVER_LEAD: SpringName = 'press';
	const HOVER_TRAIL: SpringName = 'glide';
	const PILL_LEAD: SpringName = 'snap';
	const PILL_TRAIL: SpringName = 'morph';
	const PRESENCE: SpringName = 'snap';
	const THIN = 0.08;
	const SHRINK = 0.3;
	const FADE_SPAN = 0.45;
	const SUBSTEPS = 4;
	const MAX_DT = 1 / 30;

	type Edge = { x: number; v: number; to: number; k: number; c: number };
	type Blob = {
		root: HTMLElement;
		top: HTMLElement;
		mid: HTMLElement;
		bot: HTMLElement;
		ink: number;
	};

	const makeEdge = (): Edge => ({ x: 0, v: 0, to: 0, k: 0, c: 0 });

	function tune(e: Edge, name: SpringName) {
		const p = physics(SPRINGS[name]);
		e.k = p.stiffness;
		e.c = p.damping;
	}

	function jump(e: Edge, to: number) {
		e.x = to;
		e.to = to;
		e.v = 0;
	}

	function advance(e: Edge, dt: number) {
		e.v += (-e.k * (e.x - e.to) - e.c * e.v) * dt;
		e.x += e.v * dt;
	}

	const resting = (e: Edge, eps: number) => Math.abs(e.x - e.to) < eps && Math.abs(e.v) < eps * 10;

	function aim(top: Edge, bot: Edge, t: number, b: number, lead: SpringName, trail: SpringName) {
		const down = t + b > top.to + bot.to;
		tune(down ? bot : top, lead);
		tune(down ? top : bot, trail);
		top.to = t;
		bot.to = b;
	}

	function blobOf(root: Element): Blob {
		const [top, mid, bot] = Array.from(root.children) as HTMLElement[];
		const ink = parseFloat(getComputedStyle(root).getPropertyValue('--blob-ink')) || 1;
		return { root: root as HTMLElement, top, mid, bot, ink };
	}

	const thinning = (stretch: number) => THIN * Math.min(1, Math.max(0, stretch - 1));

	function paint(blob: Blob, t: number, b: number, h: number, alpha: number, thin: number) {
		const s = b - t;
		if (s <= 0.5 || alpha <= 0.002 || h <= 0) {
			blob.root.style.opacity = '0';
			return;
		}
		const k = Math.min(1, s / h);
		const cap = (h / 2) * k;
		blob.root.style.opacity = `${Math.min(1, alpha) * blob.ink}`;
		blob.root.style.transform = `scaleX(${1 - thin})`;
		blob.top.style.transform = `translate3d(0, ${t}px, 0) scaleY(${k})`;
		blob.mid.style.transform = `translate3d(0, ${t + cap / 2}px, 0) scaleY(${(s - cap) / h})`;
		blob.bot.style.transform = `translate3d(0, ${b - cap}px, 0) scaleY(${k})`;
	}

	function liquidEngine(layer: HTMLElement) {
		const scroll = layer.parentElement as HTMLElement;
		const [hoverA, hoverB, pill] = Array.from(layer.children).map(blobOf);
		const hTop = makeEdge();
		const hBot = makeEdge();
		const aTop = makeEdge();
		const aBot = makeEdge();
		const presence = makeEdge();
		const edges = [hTop, hBot, aTop, aBot];
		tune(presence, PRESENCE);
		let hovered: HTMLElement | null = null;
		let active: HTMLElement | null = null;
		let items: { el: HTMLElement; mid: number; on: boolean }[] = [];
		let rowH = 0;
		let gap = 0;
		let raf = 0;
		let last = 0;

		const span = (el: HTMLElement) => [el.offsetTop, el.offsetTop + el.offsetHeight] as const;

		function measure() {
			rowH = scroll.querySelector<HTMLElement>('[data-liquid-item]')?.offsetHeight ?? 0;
			gap = parseFloat(getComputedStyle(scroll).rowGap) || 0;
			layer.style.setProperty('--blob-h', `${rowH}px`);
		}

		function collect() {
			items = Array.from(scroll.querySelectorAll<HTMLElement>('[data-liquid-item]')).map((el) => ({
				el,
				mid: el.offsetTop + el.offsetHeight / 2,
				on: el.hasAttribute('data-on-pill')
			}));
		}

		function render() {
			const pt = aTop.x;
			const pb = aBot.x;
			for (const it of items) {
				const on = active !== null && it.mid > pt && it.mid < pb;
				if (on === it.on) continue;
				it.on = on;
				it.el.toggleAttribute('data-on-pill', on);
			}
			if (active)
				paint(pill, pt, pb, rowH, 1, thinning((pb - pt) / Math.max(1, aBot.to - aTop.to)));
			else pill.root.style.opacity = '0';
			const p = Math.min(1, Math.max(0, presence.x));
			const size = hBot.x - hTop.x;
			const c = hTop.x + size / 2;
			const half = (size / 2) * (1 - SHRINK * (1 - p));
			const t = c - half;
			const b = c + half;
			const thin = thinning(size / Math.max(1, hBot.to - hTop.to)) + (SHRINK / 4) * (1 - p);
			const aEnd = Math.min(b, active ? pt - gap : Infinity);
			const bStart = Math.max(t, active ? pb + gap : Infinity);
			const fade = (s: number) => p * Math.min(1, s / (rowH * FADE_SPAN));
			paint(hoverA, t, aEnd, rowH, fade(aEnd - t), thin);
			paint(hoverB, bStart, b, rowH, fade(b - bStart), thin);
		}

		function frame(now: number) {
			const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000)) / SUBSTEPS;
			last = now;
			for (let i = 0; i < SUBSTEPS; i++) {
				for (const e of edges) advance(e, dt);
				advance(presence, dt);
			}
			if (edges.every((e) => resting(e, 0.05)) && resting(presence, 0.002)) {
				for (const e of edges) jump(e, e.to);
				jump(presence, presence.to);
				raf = 0;
			} else {
				raf = requestAnimationFrame(frame);
			}
			render();
		}

		function kick() {
			if (raf) return;
			last = performance.now();
			raf = requestAnimationFrame(frame);
		}

		function place(instant: boolean) {
			collect();
			const next = scroll.querySelector<HTMLElement>('[data-liquid-active]');
			if (!next) {
				active = null;
				render();
				return;
			}
			const [t, b] = span(next);
			if (instant || !active) {
				jump(aTop, t);
				jump(aBot, b);
			} else if (t !== aTop.to || b !== aBot.to) {
				aim(aTop, aBot, t, b, PILL_LEAD, PILL_TRAIL);
			}
			active = next;
			render();
			kick();
		}

		function onMove(e: PointerEvent) {
			if (e.pointerType === 'touch') return;
			const item = (e.target as Element).closest<HTMLElement>('[data-liquid-item]');
			if (!item || item === hovered) return;
			hovered = item;
			const [t, b] = span(item);
			if (presence.x < 0.05) {
				jump(hTop, t);
				jump(hBot, b);
			} else {
				aim(hTop, hBot, t, b, HOVER_LEAD, HOVER_TRAIL);
			}
			presence.to = 1;
			kick();
		}

		function onLeave() {
			hovered = null;
			presence.to = 0;
			kick();
		}

		function resync() {
			measure();
			place(true);
			if (hovered) {
				const [t, b] = span(hovered);
				jump(hTop, t);
				jump(hBot, b);
			}
			render();
		}

		measure();
		place(true);
		scroll.addEventListener('pointermove', onMove);
		scroll.addEventListener('pointerleave', onLeave);
		const observer = new ResizeObserver(resync);
		observer.observe(scroll);

		$effect(() => {
			void sections;
			untrack(() => place(false));
		});

		return () => {
			scroll.removeEventListener('pointermove', onMove);
			scroll.removeEventListener('pointerleave', onLeave);
			observer.disconnect();
			cancelAnimationFrame(raf);
			for (const it of items) it.el.removeAttribute('data-on-pill');
		};
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.code === 'Backslash') {
			e.preventDefault();
			toggle();
		}
	}}
/>

<nav class="panel" class:panel--collapsed={collapsed} aria-label="Main" bind:clientWidth={panelW}>
	{#snippet orgFace()}
		<span class="org-avatar">
			{#if org.avatar}<RemoteImg src={org.avatar} class="cover" />{:else}{org.name.charAt(0)}{/if}
		</span>
		<span class="org-text">
			<span class="org-name">{org.name}</span>
			{#if org.plan}<span class="org-plan">{org.plan}</span>{/if}
		</span>
		<ChevronsUpDown size={14} class="org-chev" />
	{/snippet}
	{#if orgMenu}
		<Menu placement="bottom-start" size="lg" width={menuW}>
			{#snippet trigger(attrs)}
				<button type="button" class="org" title={collapsed ? org.name : undefined} {...attrs}
					>{@render orgFace()}</button
				>
			{/snippet}
			{@render orgMenu()}
		</Menu>
	{:else}
		<button type="button" class="org">{@render orgFace()}</button>
	{/if}

	<SearchField placeholder="Search" shortcut="⌘K" size="sm" onfocus={onSearch} />

	<div class="scroll" class:scroll--liquid={liquidOn}>
		{#if liquidOn}
			<div class="liquid-layer" aria-hidden="true" {@attach liquidEngine}>
				{#each ['hover', 'hover', 'pill'] as kind, i (i)}
					<div class="blob blob--{kind}">
						<span class="blob-cap blob-cap--top"></span>
						<span class="blob-mid"></span>
						<span class="blob-cap blob-cap--bot"></span>
					</div>
				{/each}
			</div>
		{/if}
		{#if children}
			{@render children()}
		{:else}
			{#each sections as section, si (si)}
				{#if section.label}<p class="section">{section.label}</p>{/if}
				{#each section.items as item (item.label)}
					{#if section.tiles}
						<NavItem
							href={item.href}
							label={item.label}
							active={item.active}
							liquid={liquidOn}
							data-liquid-item={liquidOn ? '' : undefined}
							data-liquid-active={liquidOn && item.active ? '' : undefined}
						>
							{#snippet leading()}
								<span class="app">
									<AppIcon name={item.label} size="sm" />
									{#if item.status}<span class="app-dot"
											><StatusDot meta={item.status} size={7} /></span
										>{/if}
								</span>
							{/snippet}
						</NavItem>
					{:else}
						<NavItem
							href={item.href}
							label={item.label}
							icon={item.icon}
							active={item.active}
							count={item.count}
							liquid={liquidOn}
							data-liquid-item={liquidOn ? '' : undefined}
							data-liquid-active={liquidOn && item.active ? '' : undefined}
						/>
					{/if}
				{/each}
			{/each}
		{/if}
	</div>

	<div class="foot">
		{#snippet meFace()}
			<span class="me-pic">
				<span class="me-avatar">
					{#if userAvatar}{@render userAvatar()}{:else if user.avatar}<RemoteImg
							src={user.avatar}
							class="cover"
						/>{:else}{user.handle.charAt(0).toUpperCase()}{/if}
				</span>
				{#if userBadge > 0}<span class="me-badge">{userBadge}</span>{/if}
			</span>
			<span class="me-name" title="@{user.handle}">@{user.handle}</span>
		{/snippet}
		{#if userMenu}
			<Menu placement="top-start" size="lg" width={menuW}>
				{#snippet trigger(attrs)}
					<button
						type="button"
						class="me"
						title={collapsed ? `@${user.handle}` : undefined}
						{...attrs}>{@render meFace()}</button
					>
				{/snippet}
				{@render userMenu()}
			</Menu>
		{:else}
			<button type="button" class="me">{@render meFace()}</button>
		{/if}
		<button
			type="button"
			class="fold"
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			aria-expanded={!collapsed}
			onclick={toggle}
		>
			<PanelLeft size={16} />
		</button>
	</div>
</nav>

<style>
	.me-pic {
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
	}
	.me-badge {
		position: absolute;
		top: -0.25rem;
		right: -0.375rem;
		display: grid;
		place-items: center;
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.25rem;
		border-radius: var(--radius-pill);
		background: var(--accent-solid);
		color: var(--on-solid);
		font-size: 0.625rem;
		font-weight: var(--weight-medium);
		line-height: 1;
		box-shadow: 0 0 0 1.5px var(--material-chrome-bg);
	}
	.panel :global(:focus-visible) {
		outline-offset: -2px;
	}
	.panel--collapsed .section {
		color: transparent;
		transition: color var(--fade-out) var(--curve-in);
	}
	.panel--collapsed .foot {
		flex-direction: column-reverse;
		align-items: flex-start;
	}
	.panel--collapsed :global(.item),
	.panel--collapsed .me,
	.panel--collapsed :global(.search) {
		width: var(--nav-row-h, 2.25rem);
		height: var(--nav-row-h, 2.25rem);
		padding-left: 0.375rem;
		padding-right: 0;
	}
	.panel--collapsed :global(.search) {
		padding-left: 0.6875rem;
	}
	.panel--collapsed .org {
		padding-left: 0.125rem;
	}
	.panel--collapsed :global(.count),
	.panel--collapsed :global(.kbd),
	.panel--collapsed :global(.label),
	.panel--collapsed .me-name,
	.panel--collapsed .org-text,
	.panel--collapsed :global(.org-chev) {
		opacity: 0;
		transition: opacity var(--fade-out) var(--curve-in);
	}
	.panel :global(.label),
	.me-name,
	.org-text,
	.panel :global(.org-chev) {
		transition: opacity var(--fade-in) var(--curve-out);
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		height: 100%;
		padding: 0.5rem;
		--nav-radius: calc((var(--radius-panel) - 0.5rem) * var(--corner-scale));
		border-radius: calc(var(--radius-panel) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--material-chrome-bg);
		box-shadow:
			inset 0 0 0 0.5px var(--material-chrome-edge),
			0 1px 2px color-mix(in oklab, var(--neutral-10) 5%, transparent),
			0 16px 40px -16px color-mix(in oklab, var(--neutral-10) 20%, transparent);
		overflow: hidden;
	}
	.org {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 2.75rem;
		padding: 0 0.5rem 0 0.375rem;
		border: none;
		border-radius: var(--nav-radius);
		corner-shape: var(--corner);
		background: none;
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		text-align: left;
		cursor: pointer;
		transition: background-color var(--dur-fast) ease;
	}
	.org:hover {
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
	}
	.org-avatar,
	.me-avatar {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		overflow: hidden;
		border-radius: calc(0.5rem * var(--corner-scale));
		corner-shape: var(--corner);
		font-weight: var(--weight-semibold);
	}
	.org-avatar {
		width: 2rem;
		height: 2rem;
		background: var(--accent-solid);
		color: var(--on-solid);
		font-size: var(--text-headline);
	}
	.org-avatar :global(.cover),
	.me-avatar :global(.cover) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.org-text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}
	.org-name,
	.org-plan {
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.org-name {
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
	}
	.org-plan {
		color: var(--text-faint);
		font-size: var(--text-caption);
	}
	.org :global(.org-chev) {
		flex-shrink: 0;
		color: var(--text-faint);
	}
	.scroll {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.25rem;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: none;
	}
	.scroll > :global(*) {
		flex-shrink: 0;
	}
	.scroll--liquid {
		position: relative;
	}
	.scroll--liquid .section {
		position: relative;
	}
	.liquid-layer {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 0;
		pointer-events: none;
	}
	.blob {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 0;
		opacity: 0;
		transform-origin: 50% 0;
	}
	.blob--pill {
		filter: drop-shadow(var(--nav-active-shadow));
	}
	.blob-cap,
	.blob-mid {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		transform-origin: 0 0;
		will-change: transform;
	}
	.blob-cap {
		height: calc(var(--blob-h) / 2);
		corner-shape: var(--corner);
	}
	.blob-mid {
		height: var(--blob-h);
	}
	.blob-cap--top {
		border-radius: var(--nav-radius) var(--nav-radius) 0 0;
	}
	.blob-cap--bot {
		border-radius: 0 0 var(--nav-radius) var(--nav-radius);
	}
	.blob--hover {
		--blob-ink: 0.06;
	}
	.blob--hover .blob-cap,
	.blob--hover .blob-mid {
		background: var(--neutral-10);
	}
	.blob--pill .blob-cap,
	.blob--pill .blob-mid {
		background: var(--nav-active-bg);
	}
	.section {
		padding: 0.875rem 0.5rem 0.25rem;
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-weight: var(--weight-semibold);
	}
	.app {
		position: relative;
		display: block;
		width: 1.5rem;
		height: 1.5rem;
	}
	.app-dot {
		position: absolute;
		right: -0.125rem;
		bottom: -0.125rem;
		display: flex;
		padding: 2px;
		border-radius: 50%;
		background: var(--bg-surface);
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.me {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		height: 2.5rem;
		padding: 0 0.375rem;
		border: none;
		border-radius: var(--nav-radius);
		corner-shape: var(--corner);
		background: none;
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		cursor: pointer;
	}
	.me:hover,
	.fold:hover {
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
	}
	.me-avatar {
		width: 1.5rem;
		height: 1.5rem;
		background: var(--neutral-7);
		color: var(--on-solid);
		font-size: var(--text-caption);
	}
	.me-name {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-callout);
		text-box: trim-both cap alphabetic;
	}
	.fold {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: none;
		border-radius: var(--nav-radius);
		corner-shape: var(--corner);
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}
</style>

<script lang="ts" module>
	import type { StatusMeta } from '$lib/components/ui/status';

	export type SpotlightItem = {
		id: string;
		label: string;
		sublabel?: string;
		kind: 'project' | 'deployment' | 'database' | 'job';
		icon?: string | null;
		status?: StatusMeta;
		href: string;
	};
</script>

<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { Search } from 'lucide-svelte';
	import AppIcon from '$lib/components/ui/AppIcon.svelte';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import {
		decorativeMotion,
		fade,
		motionEnabled,
		springTiming,
		staggerDelay
	} from '$lib/utils/motion.svelte';
	import { tempo } from '$lib/design/springs';

	let {
		items,
		placeholder = 'Search apps',
		shortcut = '/',
		onSelect = undefined,
		width = '16rem'
	}: {
		items: SpotlightItem[];
		placeholder?: string;
		shortcut?: string;
		onSelect?: (item: SpotlightItem) => void;
		width?: string;
	} = $props();

	type Seg = { text: string; hit: boolean };
	type Hit = { item: SpotlightItem; label: Seg[]; sub: Seg[] | null; score: number };
	type View = { apps: Hit[]; projects: Hit[]; flat: Hit[]; empty: string | null };
	type Range = [number, number];

	const uid = $props.id();
	const listId = `${uid}-list`;
	const optId = (item: SpotlightItem) => `${uid}-opt-${item.id}`;
	const APP_LIMIT = 6;
	const PROJECT_LIMIT = 4;
	const BUD = 28;
	const FLIGHT_OVERLAP = 0.12;
	const DRIP_LEAD = 0.13;
	const SPREAD_LEAD = 0.1;
	const SPREAD_TRAIL = 0.04;
	const FALL_TRAIL = 0.08;

	let slot = $state<HTMLElement>();
	let layer = $state<HTMLElement>();
	let stage = $state<HTMLElement>();
	let flight = $state<HTMLElement>();
	let bar = $state<HTMLElement>();
	let input = $state<HTMLInputElement>();
	let list = $state<HTMLElement>();
	let hl = $state<HTMLElement>();
	let ghost = $state<HTMLElement>();
	let slash = $state<HTMLElement>();

	let phase = $state<'closed' | 'open' | 'closing'>('closed');
	let where = $state<'slot' | 'flight'>('slot');
	let query = $state('');
	let active = $state(0);
	let view = $state<View | null>(null);

	let returnTo: HTMLElement | null = null;
	let moving = false;
	let dropOpen = false;
	let dripGen = 0;
	let flightGen = 0;
	let dripLead = 0;
	let hlPlaced = false;
	let oozing = $state(false);
	let box = $state({ w: 576, h: 52 });
	let oozeGen = 0;
	let exits: Animation[] = [];
	const entered = new WeakSet<Element>();
	const running = new WeakMap<Element, Map<string, Animation>>();

	function locate(text: string, q: string): { score: number; ranges: Range[] } | null {
		const t = text.toLowerCase();
		const i = t.indexOf(q);
		if (i === 0) return { score: 0, ranges: [[0, q.length]] };
		if (i > 0) return { score: /[\s\-_./]/.test(t[i - 1]) ? 1 : 2, ranges: [[i, i + q.length]] };
		const needle = q.replace(/\s+/g, '');
		if (needle.length < 2) return null;
		const ranges: Range[] = [];
		let k = 0;
		for (let j = 0; j < t.length && k < needle.length; j++) {
			if (t[j] !== needle[k]) continue;
			const last = ranges[ranges.length - 1];
			if (last && last[1] === j) last[1] = j + 1;
			else ranges.push([j, j + 1]);
			k++;
		}
		if (k < needle.length || ranges.length > Math.max(2, Math.ceil(needle.length / 2))) return null;
		return { score: 3 + ranges.length, ranges };
	}

	function segments(text: string, ranges: Range[]): Seg[] {
		const out: Seg[] = [];
		let at = 0;
		for (const [a, b] of ranges) {
			if (a > at) out.push({ text: text.slice(at, a), hit: false });
			out.push({ text: text.slice(a, b), hit: true });
			at = b;
		}
		if (at < text.length) out.push({ text: text.slice(at), hit: false });
		return out;
	}

	function rank(item: SpotlightItem, q: string): Hit | null {
		const own = locate(item.label, q);
		if (own) {
			return {
				item,
				score: own.score,
				label: segments(item.label, own.ranges),
				sub: item.sublabel ? [{ text: item.sublabel, hit: false }] : null
			};
		}
		const i = item.sublabel?.toLowerCase().indexOf(q) ?? -1;
		if (!item.sublabel || i < 0) return null;
		return {
			item,
			score: 8,
			label: [{ text: item.label, hit: false }],
			sub: segments(item.sublabel, [[i, i + q.length]])
		};
	}

	const results = $derived.by((): View | null => {
		if (phase !== 'open') return null;
		const raw = query.trim();
		const q = raw.toLowerCase();
		if (!q) return null;
		const hits = items.map((item) => rank(item, q)).filter((h): h is Hit => !!h);
		hits.sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label));
		const apps = hits.filter((h) => h.item.kind !== 'project').slice(0, APP_LIMIT);
		const projects = hits.filter((h) => h.item.kind === 'project').slice(0, PROJECT_LIMIT);
		const flat = [...apps, ...projects];
		return { apps, projects, flat, empty: flat.length ? null : raw };
	});

	function set(el: HTMLElement | undefined, prop: string, value: string) {
		if (!el) return;
		running.get(el)?.get(prop)?.cancel();
		running.get(el)?.delete(prop);
		el.style.setProperty(prop, value);
	}

	function tween(
		el: HTMLElement | undefined,
		prop: string,
		to: string,
		timing: KeyframeAnimationOptions,
		from?: string
	): Animation | null {
		if (!el) return null;
		let map = running.get(el);
		if (!map) running.set(el, (map = new Map()));
		const start = from ?? getComputedStyle(el).getPropertyValue(prop).trim();
		map.get(prop)?.cancel();
		map.delete(prop);
		el.style.setProperty(prop, to);
		if (!timing.duration || start === to) return null;
		const anim = el.animate([{ [prop]: start }, { [prop]: to }], { ...timing, fill: 'backwards' });
		map.set(prop, anim);
		anim.addEventListener('finish', () => {
			if (map.get(prop) === anim) map.delete(prop);
		});
		return anim;
	}

	const settled = (anim: Animation | null) =>
		anim
			? anim.finished.then(
					() => true,
					() => false
				)
			: Promise.resolve(true);

	function ooze(anim: Animation | null) {
		const gen = ++oozeGen;
		oozing = !!anim;
		settled(anim).then(() => {
			if (gen === oozeGen) oozing = false;
		});
	}

	const physical = () => decorativeMotion() || !motionEnabled();

	function measure() {
		if (!slot || !stage || !layer || !flight) return 0;
		const from = slot.getBoundingClientRect();
		const to = stage.getBoundingClientRect();
		const dx = from.left - to.left;
		const dy = from.top - to.top;
		const scale =
			parseFloat(getComputedStyle(slot).fontSize) / parseFloat(getComputedStyle(flight).fontSize);
		layer.style.setProperty('--dx', `${dx}px`);
		layer.style.setProperty('--dy', `${dy}px`);
		layer.style.setProperty('--w0', `${from.width}px`);
		layer.style.setProperty('--h0', `${from.height}px`);
		layer.style.setProperty('--s0', `${scale}`);
		layer.style.setProperty('--sw0', `${from.width / to.width}`);
		layer.style.setProperty('--sh0', `${from.height / to.height}`);
		layer.style.setProperty('--bW', `${BUD / to.width}`);
		box = { w: to.width, h: to.height };
		return Math.hypot(dx, dy);
	}

	function dock(to: 'slot' | 'flight') {
		const parent = to === 'slot' ? slot : flight;
		if (!parent || !bar) return;
		if (bar.parentElement !== parent) {
			const focused = document.activeElement === input;
			moving = true;
			const host = parent as HTMLElement & { moveBefore?: (n: Node, r: Node | null) => void };
			try {
				if (host.moveBefore) host.moveBefore(bar, null);
				else parent.appendChild(bar);
			} catch {
				parent.appendChild(bar);
			}
			if (focused && document.activeElement !== input) input?.focus({ preventScroll: true });
			moving = false;
		}
		where = to;
	}

	function open(from: EventTarget | null) {
		if (phase === 'open' || !layer) return;
		const fresh = phase === 'closed';
		if (
			from instanceof HTMLElement &&
			from !== document.body &&
			!layer.contains(from) &&
			!slot?.contains(from)
		) {
			returnTo = from;
		} else if (fresh) returnTo = null;
		phase = 'open';
		flightGen++;
		const distance = measure();
		if (fresh) dock('flight');
		const timing = springTiming('snap', { distance });
		if (physical()) {
			tween(layer, '--spot-t', '1', timing);
			tween(slash, 'opacity', '0', fade('out'));
		} else {
			set(layer, '--spot-t', '1');
			set(slash, 'opacity', '0');
			tween(layer, 'opacity', '1', timing, fresh ? '0' : undefined);
			tween(ghost, 'opacity', '0', timing, fresh ? '1' : undefined);
		}
	}

	function close(restore: boolean) {
		if (phase !== 'open' || !layer) return;
		phase = 'closing';
		const gen = ++flightGen;
		const delay = dropOpen ? FLIGHT_OVERLAP * tempo() : 0;
		query = '';
		if (restore && returnTo?.isConnected) returnTo.focus({ preventScroll: true });
		if (document.activeElement === input) input?.blur();
		const distance = measure();
		let anim: Animation | null;
		if (physical()) {
			anim = tween(layer, '--spot-t', '0', springTiming('settle', { delay, distance }));
		} else {
			const timing = springTiming('settle', { delay });
			anim = tween(layer, 'opacity', '0', timing);
			tween(ghost, 'opacity', '1', timing);
		}
		settled(anim).then(() => {
			if (gen === flightGen && phase === 'closing') land();
		});
	}

	function land() {
		phase = 'closed';
		dripGen++;
		dropOpen = false;
		for (const a of exits) a.cancel();
		exits = [];
		view = null;
		dock('slot');
		set(layer, '--spot-t', '0');
		set(layer, 'opacity', '1');
		set(layer, '--spot-fall', '0');
		set(layer, '--spot-spread', '0');
		set(layer, '--spot-h', `${BUD}`);
		set(layer, '--spot-o', '1');
		set(ghost, 'opacity', '0');
		if (decorativeMotion()) tween(slash, 'opacity', '1', fade('in'));
		else set(slash, 'opacity', '1');
	}

	function dripIn(height: number) {
		if (physical()) {
			set(layer, '--spot-o', '1');
			ooze(tween(layer, '--spot-fall', '1', springTiming('morph')));
			tween(layer, '--spot-spread', '1', springTiming('morph', { delay: SPREAD_LEAD * tempo() }));
			tween(
				layer,
				'--spot-h',
				`${height}`,
				springTiming('snap', { delay: DRIP_LEAD * tempo(), distance: height })
			);
			return;
		}
		set(layer, '--spot-fall', '1');
		set(layer, '--spot-spread', '1');
		set(layer, '--spot-h', `${height}`);
		tween(layer, '--spot-o', '1', springTiming('snap'), '0');
	}

	function resize(height: number) {
		if (!layer) return;
		if (!decorativeMotion()) return set(layer, '--spot-h', `${height}`);
		const now = parseFloat(getComputedStyle(layer).getPropertyValue('--spot-h')) || BUD;
		tween(
			layer,
			'--spot-h',
			`${height}`,
			springTiming('glide', { distance: Math.abs(height - now) })
		);
	}

	function dripOut() {
		if (!layer) return Promise.resolve(true);
		if (!physical()) return settled(tween(layer, '--spot-o', '0', springTiming('settle')));
		const rows = list ? [...list.querySelectorAll<HTMLElement>('[data-row]')] : [];
		exits = rows.map((el, i) => {
			const cs = getComputedStyle(el);
			return el.animate(
				[
					{ opacity: cs.opacity, transform: cs.transform },
					{ opacity: 0, transform: 'translateY(-0.5rem) scale(0.96)' }
				],
				{
					...springTiming('settle', { delay: staggerDelay(rows.length - 1 - i) / 2 }),
					fill: 'forwards'
				}
			);
		});
		const now = parseFloat(getComputedStyle(layer).getPropertyValue('--spot-h')) || BUD;
		tween(layer, '--spot-h', `${BUD}`, springTiming('settle', { distance: now - BUD }));
		tween(layer, '--spot-spread', '0', springTiming('settle', { delay: SPREAD_TRAIL * tempo() }));
		const fall = tween(
			layer,
			'--spot-fall',
			'0',
			springTiming('settle', { delay: FALL_TRAIL * tempo() })
		);
		ooze(fall);
		return settled(fall);
	}

	async function present(next: View | null) {
		const gen = ++dripGen;
		if (next) {
			for (const a of exits) a.cancel();
			exits = [];
			const fresh = !dropOpen;
			dropOpen = true;
			dripLead = fresh ? DRIP_LEAD * tempo() : 0;
			if (fresh) hlPlaced = false;
			view = next;
			active = 0;
			await tick();
			if (gen !== dripGen || !list) return;
			if (fresh) dripIn(list.offsetHeight);
			else resize(list.offsetHeight);
			return;
		}
		if (!dropOpen) return;
		dropOpen = false;
		await dripOut();
		if (gen !== dripGen) return;
		view = null;
		if (!physical()) {
			set(layer, '--spot-fall', '0');
			set(layer, '--spot-spread', '0');
			set(layer, '--spot-h', `${BUD}`);
		}
	}

	$effect(() => {
		const next = results;
		untrack(() => {
			present(next);
		});
	});

	function placeHighlight(v: View | null, index: number) {
		if (!hl) return;
		const hit = v?.flat[index];
		const row = hit ? document.getElementById(optId(hit.item)) : null;
		if (!row) {
			hl.style.opacity = '0';
			hlPlaced = false;
			return;
		}
		const to = `translateY(${row.offsetTop}px)`;
		if (hlPlaced && decorativeMotion()) {
			tween(hl, 'transform', to, springTiming('glide'));
			return;
		}
		set(hl, 'transform', to);
		const first = !hlPlaced;
		hlPlaced = true;
		if (first && motionEnabled()) {
			tween(hl, 'opacity', '1', springTiming('pop', { delay: dripLead }), '0');
		} else set(hl, 'opacity', '1');
	}

	$effect(() => {
		const index = active;
		const v = view;
		untrack(() => placeHighlight(v, index));
	});

	function rowIn(index: number) {
		return (el: Element) => {
			if (entered.has(el)) return;
			entered.add(el);
			if (!motionEnabled()) return;
			const frames = decorativeMotion()
				? [
						{ opacity: 0, transform: 'translateY(-0.375rem) scale(0.97)' },
						{ opacity: 1, transform: 'none' }
					]
				: [{ opacity: 0 }, { opacity: 1 }];
			(el as HTMLElement).animate(frames, {
				...springTiming('pop', { delay: dripLead + staggerDelay(index) }),
				fill: 'backwards'
			});
		};
	}

	function choose(item: SpotlightItem) {
		close(true);
		if (onSelect) onSelect(item);
		else goto(item.href);
	}

	function editable(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return false;
		return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
	}

	function matches(e: KeyboardEvent) {
		if (!shortcut) return false;
		const mod = /^(⌘|Ctrl\+?)/.test(shortcut);
		const key = shortcut.replace(/^(⌘|Ctrl\+?)/, '').toLowerCase();
		if (mod) {
			return (e.metaKey || e.ctrlKey) && !e.altKey && e.code === `Key${key.toUpperCase()}`;
		}
		if (e.metaKey || e.ctrlKey || e.altKey || editable(e.target)) return false;
		return e.key.toLowerCase() === key;
	}

	function onwindowkeydown(e: KeyboardEvent) {
		if (phase === 'open' || !input || !matches(e)) return;
		e.preventDefault();
		const from = document.activeElement;
		input.focus({ preventScroll: true });
		if (phase !== 'open') open(from);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close(true);
			return;
		}
		const flat = results?.flat ?? [];
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			if (!flat.length) return;
			e.preventDefault();
			const step = e.key === 'ArrowDown' ? 1 : -1;
			active = (active + step + flat.length) % flat.length;
		} else if (e.key === 'Enter' && flat[active]) {
			e.preventDefault();
			choose(flat[active].item);
		}
	}

	function onfocusout(e: FocusEvent) {
		if (moving || phase !== 'open' || !document.hasFocus()) return;
		const to = e.relatedTarget;
		if (to instanceof Node && flight?.contains(to)) return;
		close(false);
	}

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return () => node.remove();
	}
</script>

<svelte:window onkeydown={onwindowkeydown} />

<div class="slot" style:width data-away={phase !== 'closed' || undefined} bind:this={slot}>
	<span class="plate" aria-hidden="true"></span>
	<span class="ghost" aria-hidden="true" bind:this={ghost}>
		<span class="glyph"><Search size={15} /></span>
		<span class="ghost-text">{placeholder}</span>
	</span>
	{#if shortcut}<kbd class="slash" bind:this={slash}>{shortcut}</kbd>{/if}

	<div
		class="layer"
		data-floating={phase !== 'closed' || undefined}
		bind:this={layer}
		{@attach portal}
	>
		<div
			class="scrim carry"
			aria-hidden="true"
			onpointerdown={() => close(true)}
			onmousedown={(e) => e.preventDefault()}
		></div>
		<div class="stage carry" bind:this={stage}>
			<div
				class="flight carry"
				bind:this={flight}
				role="presentation"
				{onfocusout}
				onmousedown={(e) => {
					if (e.target !== input) e.preventDefault();
				}}
			>
				<span class="halo halo--cap carry" aria-hidden="true"></span>
				<span class="halo halo--drop carry" aria-hidden="true"></span>
				<svg class="body carry" aria-hidden="true">
					<defs class="carry">
						<filter
							id="{uid}-goo"
							filterUnits="userSpaceOnUse"
							x="-24"
							y={box.h - 34}
							width={box.w + 48}
							height="80"
							color-interpolation-filters="sRGB"
						>
							<feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
							<feColorMatrix
								in="blur"
								type="matrix"
								values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
								result="goo"
							/>
							<feComposite in="SourceGraphic" in2="goo" operator="atop" />
						</filter>
						<clipPath id="{uid}-seam" class="carry"><rect class="seam carry" /></clipPath>
					</defs>
					{@render shapes(true)}
					{#if oozing}
						<g class="carry" clip-path="url(#{uid}-seam)">
							<g class="carry" filter="url(#{uid}-goo)">{@render shapes(false)}</g>
						</g>
					{/if}
					{@render shapes(false)}
				</svg>
				<kbd class="esc carry" aria-hidden="true">Esc</kbd>
				<div class="results carry">
					<div class="list" id={listId} role="listbox" aria-label="Search results" bind:this={list}>
						<span class="hl" aria-hidden="true" bind:this={hl}></span>
						{#if view?.empty}
							<p class="empty" data-row {@attach rowIn(0)}>
								<span class="empty-text">No apps or projects match “{view.empty}”</span>
							</p>
						{/if}
						{#if view?.apps.length}
							{@render group('Apps', 'apps', view.apps, 0)}
						{/if}
						{#if view?.projects.length}
							{@render group('Projects', 'projects', view.projects, view.apps.length)}
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="bar carry" data-where={where} bind:this={bar}>
		<span class="glyph" aria-hidden="true"><Search size={15} /></span>
		<input
			bind:this={input}
			bind:value={query}
			type="text"
			class="field"
			role="combobox"
			aria-label={placeholder}
			aria-expanded={!!view && phase === 'open'}
			aria-controls={listId}
			aria-autocomplete="list"
			aria-activedescendant={view?.flat[active] ? optId(view.flat[active].item) : undefined}
			autocomplete="off"
			spellcheck="false"
			{placeholder}
			onfocus={(e) => open(e.relatedTarget)}
			{onkeydown}
		/>
	</div>
</div>

{#snippet shapes(edge: boolean)}
	<rect class="drop carry" class:edge />
	<rect class="cap carry" class:edge />
{/snippet}

{#snippet group(title: string, key: string, hits: Hit[], offset: number)}
	<div class="set" role="group" aria-labelledby="{uid}-{key}">
		<div class="heading" id="{uid}-{key}" data-row {@attach rowIn(offset)}>{title}</div>
		{#each hits as hit, i (hit.item.id)}
			{@const index = offset + i}
			<div
				id={optId(hit.item)}
				class="option"
				role="option"
				tabindex="-1"
				aria-selected={index === active}
				data-row
				onpointermove={() => (active = index)}
				onclick={() => choose(hit.item)}
				onkeydown={(e) => {
					if (e.key === 'Enter') choose(hit.item);
				}}
				{@attach rowIn(index + 1)}
			>
				<AppIcon name={hit.item.label} kind={hit.item.kind} icon={hit.item.icon} size="sm" />
				<span class="name"
					>{#each hit.label as s, j (j)}{#if s.hit}<mark class="hit">{s.text}</mark
							>{:else}{s.text}{/if}{/each}</span
				>
				{#if hit.sub}
					<span class="sub"
						>{#each hit.sub as s, j (j)}{#if s.hit}<mark class="hit">{s.text}</mark
								>{:else}{s.text}{/if}{/each}</span
					>
				{/if}
				{#if hit.item.status}
					<span class="state">
						<StatusDot meta={hit.item.status} size={8} />
						<span class="state-label">{hit.item.status.label}</span>
					</span>
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

<style>
	@property --spot-t {
		syntax: '<number>';
		inherits: false;
		initial-value: 0;
	}
	@property --spot-fall {
		syntax: '<number>';
		inherits: false;
		initial-value: 0;
	}
	@property --spot-spread {
		syntax: '<number>';
		inherits: false;
		initial-value: 0;
	}
	@property --spot-h {
		syntax: '<number>';
		inherits: false;
		initial-value: 28;
	}
	@property --spot-o {
		syntax: '<number>';
		inherits: false;
		initial-value: 1;
	}
	@property --t {
		syntax: '<number>';
		inherits: false;
		initial-value: 0;
	}
	@property --sx {
		syntax: '<number>';
		inherits: false;
		initial-value: 1;
	}
	@property --sy {
		syntax: '<number>';
		inherits: false;
		initial-value: 1;
	}
	@property --cw {
		syntax: '<length>';
		inherits: false;
		initial-value: 0px;
	}
	@property --ch {
		syntax: '<length>';
		inherits: false;
		initial-value: 0px;
	}
	@property --bw {
		syntax: '<length>';
		inherits: false;
		initial-value: 0px;
	}
	@property --drop-y {
		syntax: '<length>';
		inherits: false;
		initial-value: 0px;
	}

	.slot {
		position: relative;
		display: block;
		flex-shrink: 0;
		height: 2rem;
		font-size: var(--text-body);
	}
	.plate {
		position: absolute;
		inset: 0;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		box-shadow: inset 0 0 0 0.5px color-mix(in oklab, var(--neutral-10) 6%, transparent);
		transition: background-color var(--dur-fast) ease;
	}
	.slot:not([data-away]):hover .plate {
		background: color-mix(in oklab, var(--neutral-10) 8%, transparent);
	}
	.slot[data-away] .plate {
		background: color-mix(in oklab, var(--neutral-10) 4%, transparent);
		box-shadow: inset 0 1px 2px color-mix(in oklab, var(--neutral-10) 7%, transparent);
	}
	.ghost,
	.bar {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		gap: 0.5714em;
		padding: 0 2.25rem 0 0.7857em;
		color: var(--text-muted);
	}
	.ghost {
		opacity: 0;
		pointer-events: none;
	}
	.ghost-text {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.glyph {
		display: flex;
		flex-shrink: 0;
	}
	.glyph :global(svg) {
		width: 1.0714em;
		height: 1.0714em;
	}
	.slash,
	.esc {
		position: absolute;
		padding: 0.1875rem 0.375rem;
		border-radius: calc(0.375rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow: inset 0 0 0 0.5px var(--border-strong);
		color: var(--text-muted);
		font-family: inherit;
		font-size: var(--text-micro);
		font-weight: var(--weight-medium);
		line-height: var(--lh-micro);
		pointer-events: none;
	}
	.slash {
		top: 50%;
		right: 0.375rem;
		translate: 0 -50%;
	}
	.bar {
		cursor: text;
	}
	.bar[data-where='flight'] {
		inset: 0 auto auto 0;
		width: calc(var(--W) - 4rem);
		height: var(--H);
		padding-right: 0;
		transform-origin: 0 50%;
		transform: translate(
				calc(var(--spot-t) * 0.3rem),
				calc((1 - var(--spot-t)) * (var(--h0) - var(--H)) / 2)
			)
			scale(calc(var(--s0) + (1 - var(--s0)) * var(--spot-t)));
	}
	.field {
		flex: 1;
		min-width: 0;
		height: 100%;
		padding: 0;
		border: none;
		background: none;
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: 1em;
		outline: none;
		appearance: none;
	}
	.field::placeholder {
		color: var(--text-muted);
	}

	.layer {
		--W: min(36rem, calc(100vw - 2rem));
		--H: 3.25rem;
		--B: 28px;
		--gap: 0.75rem;
		--R: calc(var(--radius-panel) * var(--corner-scale));
		--r0: calc(var(--radius-control) * var(--corner-scale));
		--w0: 16rem;
		--h0: 2rem;
		--dx: 0px;
		--dy: 0px;
		--s0: 1;
		--sw0: 0.45;
		--sh0: 0.6;
		--bW: 0.05;
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		visibility: hidden;
		pointer-events: none;
	}
	.carry {
		--spot-t: inherit;
		--spot-fall: inherit;
		--spot-spread: inherit;
		--spot-h: inherit;
		--spot-o: inherit;
		--t: clamp(0, var(--spot-t), 1);
		--sx: calc(var(--sw0) + (1 - var(--sw0)) * var(--spot-t));
		--sy: calc(var(--sh0) + (1 - var(--sh0)) * var(--spot-t));
		--cw: max(var(--B), calc(var(--w0) + (var(--W) - var(--w0)) * var(--spot-t)));
		--ch: max(1rem, calc(var(--h0) + (var(--H) - var(--h0)) * var(--spot-t)));
		--bw: max(calc(var(--B) / 2), calc(var(--B) + (var(--cw) - var(--B)) * var(--spot-spread)));
		--drop-y: calc(var(--ch) - var(--B) - 2px + (var(--gap) + var(--B) + 2px) * var(--spot-fall));
	}
	.layer[data-floating] {
		visibility: visible;
	}
	.scrim {
		position: absolute;
		inset: 0;
		background: rgb(0 0 0 / 0.14);
		opacity: var(--t);
	}
	.layer[data-floating] .scrim {
		pointer-events: auto;
	}
	:global(:root.dark) .scrim {
		background: rgb(0 0 0 / 0.36);
	}
	.stage {
		position: absolute;
		top: clamp(4rem, 16vh, 9rem);
		left: 50%;
		width: var(--W);
		height: var(--H);
		margin-left: calc(var(--W) / -2);
	}
	.flight {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--W);
		height: var(--H);
		font-size: var(--text-title-3);
		transform: translate(
			calc((1 - var(--spot-t)) * var(--dx)),
			calc((1 - var(--spot-t)) * var(--dy))
		);
		will-change: transform;
	}
	.layer[data-floating] .flight {
		pointer-events: auto;
	}
	.body {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--W);
		height: 40rem;
		overflow: visible;
		pointer-events: none;
	}
	.halo {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--W);
		transform-origin: 0 0;
		box-shadow:
			0 8px 16px rgb(0 0 0 / 0.06),
			0 20px 40px rgb(0 0 0 / 0.1);
		pointer-events: none;
	}
	.halo--cap {
		height: var(--H);
		border-radius: calc(var(--H) / 2);
		opacity: var(--t);
		transform: scale(var(--sx), var(--sy));
	}
	.halo--drop {
		height: 100px;
		border-radius: var(--R);
		opacity: calc(clamp(0, var(--spot-fall), 1) * var(--spot-o) * var(--t));
		transform: translate(calc((var(--cw) - var(--bw)) / 2), var(--drop-y))
			scale(
				max(0.01, calc(var(--bW) + (var(--sx) - var(--bW)) * var(--spot-spread))),
				calc(max(14, var(--spot-h)) / 100)
			);
	}
	.cap {
		x: 0;
		y: 0;
		width: var(--cw);
		height: var(--ch);
		rx: max(0px, calc(var(--r0) + (var(--H) / 2 - var(--r0)) * var(--spot-t)));
		fill: var(--bg-overlay);
	}
	.drop {
		x: calc((var(--cw) - var(--bw)) / 2);
		y: var(--drop-y);
		width: var(--bw);
		height: calc(max(14, var(--spot-h)) * 1px);
		rx: calc(var(--B) / 2 + (var(--R) - var(--B) / 2) * clamp(0, var(--spot-spread), 1));
		fill: var(--bg-overlay);
		opacity: var(--spot-o);
	}
	.edge {
		stroke: var(--material-glass-edge);
		stroke-width: 1px;
	}
	.seam {
		x: -2rem;
		y: calc(var(--ch) - 0.75rem);
		width: calc(var(--W) + 4rem);
		height: calc(var(--gap) + 1.5rem);
	}
	.esc {
		top: calc(var(--H) / 2);
		right: 0.875rem;
		translate: 0 -50%;
		opacity: var(--t);
		transform: translate(
			calc((1 - var(--spot-t)) * (var(--w0) - var(--W) + 0.5rem)),
			calc((1 - var(--spot-t)) * (var(--h0) - var(--H)) / 2)
		);
	}

	.results {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--W);
		opacity: var(--spot-o);
		transform: translate(
			calc((var(--cw) - var(--W)) / 2),
			calc(var(--ch) + var(--gap) - (1 - var(--spot-fall)) * (var(--gap) + var(--B) + 2px))
		);
		clip-path: inset(
			0 calc((var(--W) - var(--bw)) / 2) calc(100% - max(0, var(--spot-h)) * 1px)
				calc((var(--W) - var(--bw)) / 2) round var(--R)
		);
		font-size: var(--text-body);
	}
	.list {
		position: relative;
		padding: 0.375rem;
		will-change: transform;
	}
	.hl {
		position: absolute;
		top: 0;
		right: 0.375rem;
		left: 0.375rem;
		height: 2.5rem;
		border-radius: calc((var(--radius-panel) - 0.375rem) * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--neutral-10) 7%, transparent);
		opacity: 0;
		pointer-events: none;
	}
	.set + .set {
		margin-top: 0.25rem;
	}
	.heading {
		padding: 0.625rem 0.625rem 0.5rem;
		color: var(--text-faint);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: var(--weight-medium);
		text-box: trim-both cap alphabetic;
	}
	.option {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		height: 2.5rem;
		padding: 0 0.625rem 0 0.5rem;
		cursor: pointer;
		user-select: none;
	}
	.name,
	.sub,
	.state-label,
	.empty-text {
		overflow-x: clip;
		white-space: nowrap;
		text-overflow: ellipsis;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.name {
		flex-shrink: 0;
		max-width: 50%;
		color: var(--text-default);
	}
	.sub {
		flex: 1;
		min-width: 0;
		color: var(--text-faint);
		font-size: var(--text-callout);
	}
	.hit {
		background: none;
		color: inherit;
		font-weight: var(--weight-medium);
	}
	.sub .hit {
		color: var(--text-muted);
	}
	.state {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		gap: 0.375rem;
		margin-left: auto;
	}
	.state-label {
		color: var(--text-muted);
		font-size: var(--text-caption);
	}
	.empty {
		display: flex;
		margin: 0;
		padding: 1rem 0.75rem;
		color: var(--text-muted);
	}
	.empty-text {
		min-width: 0;
	}
</style>

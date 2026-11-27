<script lang="ts" module>
	import type { PaletteAction, PaletteItem } from './command-palette';
	export type { PaletteAction, PaletteItem };

	type Range = [number, number];
	type Seg = { text: string; hit: boolean };

	const warmed = new Set<string>();

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

	const plain = (text: string): Seg[] => [{ text, hit: false }];

	const KEY_CODES: Record<string, string> = {
		',': 'Comma',
		'.': 'Period',
		'/': 'Slash',
		';': 'Semicolon',
		'[': 'BracketLeft',
		']': 'BracketRight',
		'↵': 'Enter',
		'⌫': 'Backspace'
	};

	function keysOf(shortcut: string): string[] {
		return shortcut.match(/[⌘⇧⌥⌃]|[^⌘⇧⌥⌃]+/g) ?? [];
	}

	function codeOf(key: string): string {
		if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
		if (/^\d$/.test(key)) return `Digit${key}`;
		return KEY_CODES[key] ?? key;
	}

	function pressed(shortcut: string, e: KeyboardEvent): boolean {
		const keys = keysOf(shortcut);
		const main = keys.filter((k) => !'⌘⇧⌥⌃'.includes(k));
		if (main.length !== 1) return false;
		const meta = keys.includes('⌘');
		return (
			(meta ? e.metaKey || e.ctrlKey : !e.metaKey) &&
			e.shiftKey === keys.includes('⇧') &&
			e.altKey === keys.includes('⌥') &&
			(meta || e.ctrlKey === keys.includes('⌃')) &&
			e.code === codeOf(main[0])
		);
	}
</script>

<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { ArrowLeftRight, Box, Calculator, Check, Database, Search, Timer } from 'lucide-svelte';
	import AppIcon from '$lib/components/ui/AppIcon.svelte';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import Kbd from '$lib/components/ui/Kbd.svelte';
	import { calculate, type Calculation } from './palette/calc';
	import { convert, type Conversion } from './palette/units';
	import {
		decorativeMotion,
		fade,
		motionEnabled,
		springTiming,
		staggerDelay,
		holdBackground
	} from '$lib/utils/motion.svelte';

	let {
		open = $bindable(false),
		origin = undefined,
		items,
		actions = [],
		onSelect = undefined,
		placeholder = 'Search apps and actions'
	}: {
		open?: boolean;
		origin?: () => Element | null | undefined;
		items: PaletteItem[];
		actions?: PaletteAction[];
		onSelect?: (item: PaletteItem) => void;
		placeholder?: string;
	} = $props();

	type Row =
		| { type: 'item'; key: string; item: PaletteItem; label: Seg[]; sub: Seg[] | null }
		| { type: 'action'; key: string; action: PaletteAction; label: Seg[] }
		| { type: 'calc'; key: string; calc: Calculation }
		| { type: 'unit'; key: string; conv: Conversion };
	type Scope = 'all' | 'actions' | 'projects';
	type Section = { key: string; title: string; rows: Row[]; offset: number };
	type View = {
		query: string;
		scope: Scope;
		sections: Section[];
		flat: Row[];
		empty: string | null;
	};
	type Group = { key: string; title: string; rows: Row[]; best: number };
	type FadeKind = 'in' | 'out' | 'long';

	const uid = $props.id();
	const listId = `${uid}-list`;
	const optId = (row: Row) => `${uid}-opt-${row.key}`;
	const RECENT_KEY = 'orchard-palette-recent';
	const RECENT_COUNT = 3;
	const LIMIT = { apps: 6, projects: 3, actions: 4 };
	const ROW_STRIDE = 0.012;
	const ENTER_FROM = 'translateY(-0.25rem) scale(0.97)';
	const EXIT_TO = 'scale(0.98)';
	const COPIED_MS = 1600;
	const SCOPE_LABEL: Record<Scope, string> = { all: '', actions: 'Actions', projects: 'Projects' };
	const KIND_GLYPH = { deployment: Box, database: Database, job: Timer };

	let layer = $state<HTMLElement>();
	let scrim = $state<HTMLElement>();
	let panel = $state<HTMLElement>();
	let input = $state<HTMLInputElement>();
	let scroller = $state<HTMLElement>();
	let hl = $state<HTMLElement>();

	let phase = $state<'closed' | 'open' | 'closing'>('closed');
	let query = $state('');
	let active = $state(0);
	let view = $state<View | null>(null);
	let copied = $state<string | null>(null);
	let recent = $state<string[]>([]);
	let edges = $state({ top: false, bottom: false });
	let mod = $state('⌘');

	let returnTo: HTMLElement | null = null;
	let batch = false;
	let opening = false;
	let wave = 0;
	let presentGen = 0;
	let flightGen = 0;
	let hlPlaced = false;
	let heightAnim: Animation | null = null;
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	const entered = new WeakSet<Element>();
	const running = new WeakMap<Element, Map<string, Animation>>();

	function rankItem(item: PaletteItem, q: string): (Row & { type: 'item' }) | null {
		const own = locate(item.label, q);
		if (own) {
			return {
				type: 'item',
				key: `i-${item.id}`,
				item,
				label: segments(item.label, own.ranges),
				sub: item.sublabel ? plain(item.sublabel) : null,
				score: own.score
			} as Row & { type: 'item'; score: number };
		}
		const i = item.sublabel?.toLowerCase().indexOf(q) ?? -1;
		if (!item.sublabel || i < 0) return null;
		return {
			type: 'item',
			key: `i-${item.id}`,
			item,
			label: plain(item.label),
			sub: segments(item.sublabel, [[i, i + q.length]]),
			score: 8
		} as Row & { type: 'item'; score: number };
	}

	function rankAction(action: PaletteAction, q: string): (Row & { type: 'action' }) | null {
		const own = locate(action.label, q);
		if (own) {
			return {
				type: 'action',
				key: `a-${action.id}`,
				action,
				label: segments(action.label, own.ranges),
				score: own.score
			} as Row & { type: 'action'; score: number };
		}
		const hit = action.keywords?.some((k) => k.toLowerCase().startsWith(q));
		if (!hit) return null;
		return {
			type: 'action',
			key: `a-${action.id}`,
			action,
			label: plain(action.label),
			score: 6
		} as Row & { type: 'action'; score: number };
	}

	const scoreOf = (row: Row) => (row as { score?: number }).score ?? 0;

	function byScore<T extends Row>(rows: T[], label: (row: T) => string) {
		return rows.sort((a, b) => scoreOf(a) - scoreOf(b) || label(a).localeCompare(label(b)));
	}

	const itemRow = (item: PaletteItem): Row => ({
		type: 'item',
		key: `i-${item.id}`,
		item,
		label: plain(item.label),
		sub: item.sublabel ? plain(item.sublabel) : null
	});

	const actionRow = (action: PaletteAction): Row => ({
		type: 'action',
		key: `a-${action.id}`,
		action,
		label: plain(action.label)
	});

	function recentItems(): PaletteItem[] {
		const byId = new Map(items.map((i) => [i.id, i]));
		const picked = recent.map((id) => byId.get(id)).filter((i): i is PaletteItem => !!i);
		for (const item of items) {
			if (picked.length >= RECENT_COUNT) break;
			if (item.kind !== 'project' && !picked.includes(item)) picked.push(item);
		}
		return picked.slice(0, RECENT_COUNT);
	}

	function build(raw: string): View {
		let scope: Scope = 'all';
		let text = raw;
		if (raw.startsWith('>')) {
			scope = 'actions';
			text = raw.slice(1);
		} else if (raw.startsWith('#')) {
			scope = 'projects';
			text = raw.slice(1);
		}
		const q = text.trim().toLowerCase();
		const groups: Group[] = [];

		if (scope === 'all' && q) {
			const calc = calculate(text);
			const conv = calc ? null : convert(text);
			if (calc) {
				groups.push({
					key: 'calc',
					title: 'Calculator',
					rows: [{ type: 'calc', key: 'calc', calc }],
					best: -1
				});
			} else if (conv) {
				groups.push({
					key: 'unit',
					title: conv.dimension,
					rows: [{ type: 'unit', key: 'unit', conv }],
					best: -1
				});
			}
		}

		if (!q) {
			if (scope === 'all') {
				const rec = recentItems();
				if (rec.length)
					groups.push({ key: 'recent', title: 'Recent', rows: rec.map(itemRow), best: 0 });
			}
			if (scope !== 'projects' && actions.length) {
				groups.push({ key: 'actions', title: 'Actions', rows: actions.map(actionRow), best: 1 });
			}
			if (scope === 'projects') {
				const projects = items.filter((i) => i.kind === 'project').map(itemRow);
				if (projects.length)
					groups.push({ key: 'projects', title: 'Projects', rows: projects, best: 0 });
			}
		} else {
			const ranked: Group[] = [];
			if (scope !== 'actions') {
				const hits = items
					.filter((i) => scope === 'all' || i.kind === 'project')
					.map((i) => rankItem(i, q))
					.filter((h): h is Row & { type: 'item' } => !!h);
				byScore(hits, (h) => h.item.label);
				const apps = hits.filter((h) => h.item.kind !== 'project').slice(0, LIMIT.apps);
				const projects = hits
					.filter((h) => h.item.kind === 'project')
					.slice(0, scope === 'projects' ? Infinity : LIMIT.projects);
				if (apps.length)
					ranked.push({ key: 'apps', title: 'Apps', rows: apps, best: scoreOf(apps[0]) });
				if (projects.length) {
					ranked.push({
						key: 'projects',
						title: 'Projects',
						rows: projects,
						best: scoreOf(projects[0])
					});
				}
			}
			if (scope !== 'projects') {
				const hits = actions
					.map((a) => rankAction(a, q))
					.filter((h): h is Row & { type: 'action' } => !!h);
				byScore(hits, (h) => h.action.label);
				const top = hits.slice(0, scope === 'actions' ? Infinity : LIMIT.actions);
				if (top.length)
					ranked.push({ key: 'actions', title: 'Actions', rows: top, best: scoreOf(top[0]) });
			}
			ranked.sort((a, b) => a.best - b.best);
			groups.push(...ranked);
		}

		let offset = 0;
		const sections = groups.map((g) => {
			const s = { key: g.key, title: g.title, rows: g.rows, offset };
			offset += g.rows.length;
			return s;
		});
		const flat = sections.flatMap((s) => s.rows);
		return { query: raw, scope, sections, flat, empty: flat.length ? null : text.trim() || raw };
	}

	const results = $derived(phase === 'open' ? build(query) : null);

	const scope = $derived<Scope>(
		query.startsWith('>') ? 'actions' : query.startsWith('#') ? 'projects' : 'all'
	);

	const current = $derived(view?.flat[active] ?? null);

	const hasBody = $derived(!!view && (view.flat.length > 0 || !!view.empty));

	const countLabel = $derived.by(() => {
		if (!view) return '';
		const n = view.flat.length;
		if (!n) return 'No results';
		const noun =
			view.scope === 'actions' ? 'action' : view.scope === 'projects' ? 'project' : 'result';
		return `${n} ${noun}${n === 1 ? '' : 's'}`;
	});

	const hints = $derived.by(() => {
		const out: { keys: string[]; label: string; done?: boolean }[] = [];
		const row = current;
		if (row?.type === 'item') {
			out.push({ keys: ['↵'], label: 'Open' });
			if (row.item.url) out.push({ keys: [mod, '↵'], label: 'Visit' });
		} else if (row?.type === 'action') {
			out.push({ keys: ['↵'], label: 'Run' });
		} else if (row) {
			out.push(
				copied === row.key
					? { keys: [], label: 'Copied', done: true }
					: { keys: [mod, 'C'], label: 'Copy' }
			);
		}
		out.push({ keys: ['esc'], label: query ? 'Clear' : 'Close' });
		return out;
	});

	function fadeTiming(kind: FadeKind, delay = 0): KeyframeAnimationOptions {
		if (decorativeMotion() || !motionEnabled()) return fade(kind, delay);
		return { ...springTiming('glide'), delay: delay * 1000 };
	}

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

	function show() {
		if (phase === 'open' || !layer || !panel) return;
		const fresh = phase === 'closed';
		const from = document.activeElement;
		if (from instanceof HTMLElement && from !== document.body && !layer.contains(from)) {
			returnTo = from;
		} else if (fresh) returnTo = null;
		if (fresh) {
			opening = true;
			batch = true;
			if (!view) view = build(query);
		}
		if (phase === 'closed') holdBackground(true);
		phase = 'open';
		open = true;
		flightGen++;
		layer.setAttribute('data-floating', '');
		layer.inert = false;
		if (decorativeMotion()) {
			tween(panel, 'transform', 'none', springTiming('snap'), fresh ? ENTER_FROM : undefined);
		} else set(panel, 'transform', 'none');
		tween(panel, 'opacity', '1', fadeTiming('in'), fresh ? '0' : undefined);
		tween(scrim, 'opacity', '1', fadeTiming('long'), fresh ? '0' : undefined);
		input?.focus({ preventScroll: true });
	}

	function hide(restore: boolean) {
		if (phase !== 'open' || !layer || !panel) return;
		phase = 'closing';
		open = false;
		copied = null;
		const gen = ++flightGen;
		const home = origin?.();
		if (document.activeElement === input) input?.blur();
		if (restore && returnTo?.isConnected && !home?.contains(returnTo)) {
			returnTo.focus({ preventScroll: true });
		}
		const moves = decorativeMotion()
			? tween(panel, 'transform', EXIT_TO, springTiming('settle', { exit: true }))
			: null;
		const fades = tween(panel, 'opacity', '0', fadeTiming('out'));
		tween(scrim, 'opacity', '0', fadeTiming('out'));
		Promise.all([settled(moves), settled(fades)]).then(() => {
			if (gen === flightGen && phase === 'closing') land();
		});
	}

	function land() {
		if (phase !== 'closed') holdBackground(false);
		phase = 'closed';
		presentGen++;
		heightAnim?.cancel();
		heightAnim = null;
		if (panel) panel.style.height = '';
		query = '';
		active = 0;
		hlPlaced = false;
		set(hl, 'opacity', '0');
		if (scroller) scroller.scrollTop = 0;
		batch = true;
		view = build('');
		tick().then(() => {
			if (phase === 'closed') batch = false;
		});
	}

	$effect(() => () => {
		if (untrack(() => phase) !== 'closed') holdBackground(false);
	});

	function rowIn(el: Element) {
		if (entered.has(el)) return;
		entered.add(el);
		if (batch || opening || !motionEnabled()) return;
		const delay = decorativeMotion() ? staggerDelay(wave, ROW_STRIDE) : 0;
		wave++;
		(el as HTMLElement).animate([{ opacity: 0 }, { opacity: 1 }], {
			...fadeTiming('in', delay),
			fill: 'backwards'
		});
	}

	function syncEdges() {
		if (!scroller) return;
		const { scrollTop, clientHeight, scrollHeight } = scroller;
		const top = scrollTop > 1;
		const bottom = scrollTop + clientHeight < scrollHeight - 1;
		if (top !== edges.top || bottom !== edges.bottom) edges = { top, bottom };
	}

	async function present(next: View | null) {
		if (!next) return;
		const gen = ++presentGen;
		const prev = view;
		const sameQuery = !!prev && prev.query === next.query;
		const prevKey = sameQuery ? prev.flat[active]?.key : undefined;
		const keep = prevKey ? next.flat.findIndex((r) => r.key === prevKey) : -1;
		if (!sameQuery) {
			copied = null;
			if (scroller) scroller.scrollTop = 0;
		}
		const glide = !opening && !!panel && motionEnabled();
		let from = 0;
		if (glide && panel) {
			from = panel.offsetHeight;
			heightAnim?.cancel();
			heightAnim = null;
			panel.style.height = `${from}px`;
		}
		wave = 0;
		view = next;
		active = keep >= 0 ? keep : 0;
		await tick();
		if (gen !== presentGen) return;
		if (panel) panel.style.height = '';
		syncEdges();
		if (opening) {
			opening = false;
			batch = false;
			return;
		}
		if (!glide || !panel) return;
		const to = panel.offsetHeight;
		const distance = Math.abs(to - from);
		if (distance < 1) return;
		heightAnim = panel.animate(
			[{ height: `${from}px` }, { height: `${to}px` }],
			springTiming('glide', { distance })
		);
	}

	$effect(() => {
		const next = results;
		untrack(() => {
			present(next);
		});
	});

	$effect(() => {
		const want = open;
		untrack(() => {
			if (want && phase !== 'open') show();
			else if (!want && phase === 'open') hide(true);
		});
	});

	function placeHighlight(v: View | null, index: number) {
		if (!hl) return;
		const row = v?.flat[index];
		const el = row ? document.getElementById(optId(row)) : null;
		if (!el) {
			set(hl, 'opacity', '0');
			hlPlaced = false;
			return;
		}
		const y = el.offsetTop;
		const to = `translateY(${y}px)`;
		const height = `${el.offsetHeight}px`;
		const quiet = batch || opening;
		if (hlPlaced && !quiet && decorativeMotion()) {
			const now = new DOMMatrixReadOnly(getComputedStyle(hl).transform).m42;
			const distance = Math.abs(y - now);
			const timing = springTiming('glide', { distance });
			if (distance >= 0.5) tween(hl, 'transform', to, timing);
			if (hl.style.height !== height) tween(hl, 'height', height, timing);
			return;
		}
		set(hl, 'transform', to);
		set(hl, 'height', height);
		const first = !hlPlaced;
		hlPlaced = true;
		if (first && !quiet && motionEnabled()) {
			tween(hl, 'opacity', '1', fadeTiming('in'), '0');
		} else set(hl, 'opacity', '1');
	}

	$effect(() => {
		const index = active;
		const v = view;
		untrack(() => placeHighlight(v, index));
	});

	function reveal(index: number) {
		const row = view?.flat[index];
		const el = row ? document.getElementById(optId(row)) : null;
		if (!el || !scroller) return;
		if (index === 0) {
			scroller.scrollTop = 0;
			return;
		}
		const pad = 6;
		const group = el.closest<HTMLElement>('[role="group"]');
		const leads = group?.querySelector('[role="option"]') === el;
		const top = leads && group ? group.offsetTop : el.offsetTop - pad;
		const bottom = el.offsetTop + el.offsetHeight + pad;
		if (top < scroller.scrollTop) scroller.scrollTop = top;
		else if (bottom > scroller.scrollTop + scroller.clientHeight) {
			scroller.scrollTop = bottom - scroller.clientHeight;
		}
	}

	function remember(id: string) {
		recent = [id, ...recent.filter((r) => r !== id)].slice(0, 8);
		try {
			localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
		} catch {
			return;
		}
	}

	function writeFallback(text: string) {
		if (!panel) return false;
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.cssText = 'position:absolute;opacity:0;pointer-events:none';
		panel.appendChild(area);
		area.select();
		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {
			ok = false;
		}
		area.remove();
		input?.focus({ preventScroll: true });
		return ok;
	}

	function flash(key: string) {
		copied = key;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			if (copied === key) copied = null;
		}, COPIED_MS);
	}

	function copy(row: Row & { type: 'calc' | 'unit' }) {
		const text = row.type === 'calc' ? row.calc.copy : row.conv.copy;
		const done = () => flash(row.key);
		const fail = () => {
			if (writeFallback(text)) done();
		};
		if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fail);
		else fail();
	}

	function choose(row: Row, visit = false) {
		if (row.type === 'calc' || row.type === 'unit') return copy(row);
		if (row.type === 'action') {
			hide(true);
			row.action.run();
			return;
		}
		const item = row.item;
		remember(item.id);
		hide(true);
		if (visit && item.url) {
			window.open(item.url, '_blank', 'noopener');
			return;
		}
		if (onSelect) onSelect(item);
		else goto(item.href);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.isComposing) return;
		const flat = view?.flat ?? [];
		const cmd = e.metaKey || e.ctrlKey;
		if (e.key === 'Escape') {
			e.preventDefault();
			if (query) query = '';
			else hide(true);
			return;
		}
		if (e.key === 'Tab') {
			e.preventDefault();
			return;
		}
		const down = e.key === 'ArrowDown' || (e.ctrlKey && !e.metaKey && e.code === 'KeyN');
		const up = e.key === 'ArrowUp' || (e.ctrlKey && !e.metaKey && e.code === 'KeyP');
		if (down || up) {
			if (!flat.length) return;
			e.preventDefault();
			active = (active + (down ? 1 : -1) + flat.length) % flat.length;
			reveal(active);
			return;
		}
		if (e.key === 'Enter') {
			const row = flat[active];
			if (!row) return;
			e.preventDefault();
			choose(row, cmd);
			return;
		}
		if (cmd && e.code === 'KeyC') {
			const row = flat[active];
			const collapsed = input?.selectionStart === input?.selectionEnd;
			if (row && (row.type === 'calc' || row.type === 'unit') && collapsed) {
				e.preventDefault();
				copy(row);
			}
		}
	}

	function onfocusout(e: FocusEvent) {
		if (phase !== 'open' || !document.hasFocus()) return;
		const to = e.relatedTarget;
		if (to instanceof Node && panel?.contains(to)) return;
		hide(false);
	}

	$effect(() => {
		const onkey = (e: KeyboardEvent) => {
			const toggle =
				e.code === 'KeyK' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && !e.repeat;
			if (toggle) {
				e.preventDefault();
				e.stopImmediatePropagation();
				if (phase === 'open') hide(true);
				else show();
				return;
			}
			if (phase !== 'open' || !(e.metaKey || e.ctrlKey || e.altKey)) return;
			const hit = actions.find((a) => a.shortcut && pressed(a.shortcut, e));
			if (!hit) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			hide(true);
			hit.run();
		};
		window.addEventListener('keydown', onkey, true);
		return () => window.removeEventListener('keydown', onkey, true);
	});

	$effect(() => {
		mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
		try {
			const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
			if (Array.isArray(saved)) recent = saved.filter((s) => typeof s === 'string');
		} catch {
			recent = [];
		}
	});

	$effect(() => {
		const urls = items.map((i) => i.icon).filter((s): s is string => !!s && !warmed.has(s));
		if (!urls.length) return;
		const run = () => {
			for (const src of urls) {
				warmed.add(src);
				const img = new Image();
				img.decoding = 'async';
				img.src = src;
				img.decode().catch(() => undefined);
			}
		};
		if ('requestIdleCallback' in window) {
			const handle = requestIdleCallback(run, { timeout: 1500 });
			return () => cancelIdleCallback(handle);
		}
		const handle = setTimeout(run, 300);
		return () => clearTimeout(handle);
	});

	$effect(() => {
		const warm = async () => {
			if (phase !== 'closed' || view) return;
			batch = true;
			view = untrack(() => build(''));
			await tick();
			if (phase === 'closed') batch = false;
		};
		if ('requestIdleCallback' in window) {
			const handle = requestIdleCallback(warm, { timeout: 1200 });
			return () => cancelIdleCallback(handle);
		}
		const handle = setTimeout(warm, 400);
		return () => clearTimeout(handle);
	});

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return () => node.remove();
	}

	function holdWheel(node: HTMLElement) {
		const onwheel = (e: WheelEvent) => {
			if (phase !== 'open') return;
			if (scroller && e.target instanceof Node && scroller.contains(e.target)) return;
			e.preventDefault();
		};
		node.addEventListener('wheel', onwheel, { passive: false });
		return () => node.removeEventListener('wheel', onwheel);
	}
</script>

<div
	class="layer"
	data-floating={phase !== 'closed' || undefined}
	data-open={phase === 'open' || undefined}
	inert={phase === 'closed'}
	bind:this={layer}
	{@attach portal}
	{@attach holdWheel}
>
	<div
		class="scrim"
		aria-hidden="true"
		bind:this={scrim}
		onpointerdown={() => hide(true)}
		onmousedown={(e) => e.preventDefault()}
	></div>
	<div class="stage">
		<div
			class="panel"
			bind:this={panel}
			role="dialog"
			aria-modal="true"
			aria-label="Command palette"
			tabindex="-1"
			{onfocusout}
			onmousedown={(e) => {
				if (e.target !== input) e.preventDefault();
			}}
		>
			<div class="bar">
				<span class="glyph" aria-hidden="true"><Search size={16} strokeWidth={2} /></span>
				<input
					bind:this={input}
					bind:value={query}
					type="text"
					class="field"
					role="combobox"
					aria-label={placeholder}
					aria-expanded={hasBody && phase === 'open'}
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={current ? optId(current) : undefined}
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					{placeholder}
					{onkeydown}
				/>
				{#if scope !== 'all'}
					<span class="scope"><span class="scope-text">{SCOPE_LABEL[scope]}</span></span>
				{/if}
			</div>

			<div class="body" data-none={!hasBody || undefined}>
				<div
					class="well"
					data-fade-top={edges.top || undefined}
					data-fade-bottom={edges.bottom || undefined}
				>
					<div
						class="scroller"
						id={listId}
						role="listbox"
						aria-label="Results"
						bind:this={scroller}
						onscroll={syncEdges}
					>
						<span class="hl" aria-hidden="true" bind:this={hl}></span>
						{#if view?.empty}
							<p class="none" {@attach rowIn}>
								<span class="none-text">No matches for “{view.empty}”</span>
							</p>
						{/if}
						{#each view?.sections ?? [] as section (section.key)}
							<div class="set" role="group" aria-labelledby="{uid}-{section.key}">
								<div class="heading" id="{uid}-{section.key}" {@attach rowIn}>
									{section.title}
								</div>
								<div class="rows">
									{#each section.rows as row, i (row.key)}
										{@render option(row, section.offset + i)}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
				<div class="foot">
					<span class="count" aria-live="polite">{countLabel}</span>
					<span class="hints">
						{#each hints as hint (hint.label)}
							<span class="hint" class:hint--done={hint.done}>
								{#if hint.done}
									<span class="done-glyph" aria-hidden="true"
										><Check size={12} strokeWidth={2.5} /></span
									>
								{:else}
									<Kbd keys={hint.keys} />
								{/if}
								<span class="hint-text">{hint.label}</span>
							</span>
						{/each}
					</span>
				</div>
			</div>
		</div>
	</div>
</div>

{#snippet marks(segs: Seg[])}{#each segs as s, j (j)}{#if s.hit}<mark class="hit">{s.text}</mark
			>{:else}{s.text}{/if}{/each}{/snippet}

{#snippet option(row: Row, index: number)}
	<div
		id={optId(row)}
		class="option option--{row.type}"
		role="option"
		tabindex="-1"
		aria-selected={index === active}
		onpointermove={() => {
			if (active !== index) active = index;
		}}
		onclick={(e) => choose(row, e.metaKey || e.ctrlKey)}
		onkeydown={(e) => {
			if (e.key === 'Enter') choose(row);
		}}
		{@attach rowIn}
	>
		{#if row.type === 'item'}
			{#if row.item.icon || row.item.kind === 'project'}
				<span class="lead">
					<AppIcon name={row.item.label} kind={row.item.kind} icon={row.item.icon} size="sm" />
				</span>
			{:else}
				{@const Glyph = KIND_GLYPH[row.item.kind as keyof typeof KIND_GLYPH]}
				<span class="lead lead--glyph"><Glyph size={15} strokeWidth={1.75} /></span>
			{/if}
			<span class="name">{@render marks(row.label)}</span>
			{#if row.sub && row.item.project}
				<span class="owner">
					<AppIcon name={row.item.project} kind="project" icon={row.item.projectIcon} size="xs" />
					<span class="sub">{@render marks(row.sub)}</span>
				</span>
			{:else if row.sub}<span class="sub">{@render marks(row.sub)}</span>{/if}
			{#if row.item.status}
				<span class="trail">
					{#if row.item.status.kind !== 'success'}
						<span class="state">{row.item.status.label}</span>
					{/if}
					<StatusDot meta={row.item.status} size={8} />
				</span>
			{/if}
		{:else if row.type === 'action'}
			{@const Glyph = row.action.icon}
			<span class="lead lead--glyph"><Glyph size={15} strokeWidth={1.75} /></span>
			<span class="name">{@render marks(row.label)}</span>
			{#if row.action.hint}<span class="sub">{row.action.hint}</span>{/if}
			{#if row.action.shortcut}
				<span class="trail keys" aria-hidden="true">{row.action.shortcut}</span>
			{/if}
		{:else}
			{@const ask = row.type === 'calc' ? row.calc.expression : row.conv.from.text}
			{@const answer = row.type === 'calc' ? row.calc.formatted : row.conv.to.text}
			<span class="lead lead--glyph">
				{#if row.type === 'calc'}<Calculator size={15} strokeWidth={1.75} />{:else}<ArrowLeftRight
						size={15}
						strokeWidth={1.75}
					/>{/if}
			</span>
			<span class="ask">{ask}</span>
			{#if row.type === 'unit'}
				<span class="sub">{row.conv.from.name} to {row.conv.to.name.toLowerCase()}</span>
			{/if}
			<span class="trail">
				{#if copied === row.key}
					<span class="copied" aria-hidden="true"><Check size={14} strokeWidth={2.25} /></span>
				{/if}
				<span class="answer">{answer}</span>
			</span>
		{/if}
	</div>
{/snippet}

<style>
	.layer {
		--W: min(38rem, calc(100vw - 2rem));
		--R: calc(var(--radius-panel) * var(--corner-scale));
		--inset: 0.375rem;
		--inner: calc((var(--radius-panel) - var(--inset)) * var(--corner-scale));
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		visibility: hidden;
		pointer-events: none;
	}
	.layer[data-floating] {
		visibility: visible;
	}
	.layer[data-open] .scrim,
	.layer[data-open] .panel {
		pointer-events: auto;
	}

	.scrim {
		position: absolute;
		inset: 0;
		will-change: opacity;
		background: color-mix(in oklab, var(--neutral-10) 12%, transparent);
	}
	:global(:root.dark) .scrim {
		background: color-mix(in oklab, var(--neutral-1) 45%, transparent);
	}
	.stage {
		position: absolute;
		top: clamp(4rem, 16vh, 9rem);
		left: 50%;
		width: var(--W);
		margin-left: calc(var(--W) / -2);
	}
	.panel {
		will-change: transform;
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - clamp(4rem, 16vh, 9rem) - 2rem);
		overflow: hidden;
		border-radius: var(--R);
		corner-shape: var(--corner);
		--palette-bg: var(--neutral-raised);
		background: var(--palette-bg);
		box-shadow:
			inset 0 0.5px 0 color-mix(in oklab, var(--on-solid) 14%, transparent),
			var(--shadow-floating);
		color: var(--text-default);
		outline: none;
		transform-origin: 50% 1.625rem;
		will-change: transform, opacity;
	}

	.bar {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.625rem;
		height: 3.25rem;
		padding: 0 1rem 0 1.0625rem;
		color: var(--text-muted);
		font-size: var(--text-headline);
		cursor: text;
	}
	.glyph {
		display: flex;
		flex-shrink: 0;
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
		color: var(--text-faint);
	}
	.scope {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		height: 1.375rem;
		padding: 0 0.5rem;
		border-radius: calc(0.375rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		color: var(--text-muted);
		font-size: var(--text-caption);
	}
	.scope-text {
		text-box: trim-both cap alphabetic;
	}

	.body {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-height: 0;
		border-top: 0.5px solid var(--material-glass-edge);
	}
	.body[data-none] {
		display: none;
	}
	.well {
		--edge: 1.25rem;
		position: relative;
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-height: 0;
	}
	.well::before,
	.well::after {
		content: '';
		position: absolute;
		right: 0;
		left: 0;
		z-index: 3;
		height: var(--edge);
		pointer-events: none;
		opacity: 0;
		will-change: opacity;
		transition: opacity var(--fade-in) var(--curve-out);
	}
	.well::before {
		top: 0;
		background: linear-gradient(var(--palette-bg), transparent);
	}
	.well::after {
		bottom: 0;
		background: linear-gradient(transparent, var(--palette-bg));
	}
	.well[data-fade-top]::before,
	.well[data-fade-bottom]::after {
		opacity: 1;
	}
	.scroller {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		max-height: min(24rem, 56vh);
		padding: var(--inset);
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
		will-change: scroll-position;
		background: var(--palette-bg);
	}
	.scroller::-webkit-scrollbar {
		display: none;
	}
	.hl {
		position: absolute;
		top: 0;
		right: var(--inset);
		left: var(--inset);
		height: 2.375rem;
		border-radius: var(--inner);
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		opacity: 0;
		pointer-events: none;
	}
	.heading {
		padding: 0.75rem 0.5rem 0.375rem;
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-weight: var(--weight-semibold);
		line-height: var(--lh-caption);
		user-select: none;
	}
	.set:first-of-type .heading {
		padding-top: 0.5rem;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.option {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		height: 2.375rem;
		padding: 0 0.625rem 0 0.4375rem;
		border-radius: var(--inner);
		corner-shape: var(--corner);
		font-size: var(--text-body);
		cursor: default;
		user-select: none;
	}
	.lead {
		display: flex;
		flex-shrink: 0;
	}
	.lead--glyph {
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		color: var(--text-muted);
	}
	.name,
	.sub,
	.state,
	.ask,
	.answer,
	.none-text,
	.hint-text,
	.count {
		overflow-x: clip;
		white-space: nowrap;
		text-overflow: ellipsis;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.name {
		flex-shrink: 0;
		max-width: 60%;
		color: var(--text-default);
	}
	.sub {
		flex: 1;
		min-width: 0;
		color: var(--text-muted);
		font-size: var(--text-callout);
	}
	.owner {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 0.4375rem;
		min-width: 0;
	}
	.owner :global(.icon--xs) {
		width: 1rem;
		height: 1rem;
		border-radius: calc(0.25rem * var(--corner-scale));
	}
	.hit {
		background: none;
		color: inherit;
		font-weight: var(--weight-medium);
	}
	.trail {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}
	.state {
		color: var(--text-muted);
		font-size: var(--text-caption);
	}
	.keys {
		color: var(--text-faint);
		font-size: var(--text-callout);
		letter-spacing: 0.08em;
	}

	.option--calc,
	.option--unit {
		height: 2.75rem;
	}
	.ask {
		flex-shrink: 1;
		min-width: 0;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.option--unit .ask {
		flex-shrink: 0;
	}
	.answer {
		color: var(--text-default);
		font-size: var(--text-title-3);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		letter-spacing: var(--track-title);
	}
	.copied {
		display: flex;
		color: var(--accent);
	}

	.none {
		display: flex;
		margin: 0;
		padding: 0.875rem 0.5rem;
		color: var(--text-muted);
		font-size: var(--text-body);
	}
	.none-text {
		min-width: 0;
	}

	.foot {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		height: 2.375rem;
		padding: 0 0.875rem 0 1.0625rem;
		border-top: 0.5px solid var(--material-glass-edge);
		color: var(--text-faint);
		font-size: var(--text-caption);
	}
	.count {
		min-width: 0;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.hints {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.875rem;
	}
	.hint {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.hint--done {
		color: var(--text-muted);
	}
	.done-glyph {
		display: flex;
		color: var(--accent);
	}
</style>

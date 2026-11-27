<script lang="ts" module>
	export type NotifierRect = { x: number; y: number; w: number; h: number; r: number };
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { ArrowUpRight, Check, CircleAlert, Info, TriangleAlert, X } from 'lucide-svelte';
	import AppIcon from '$lib/components/ui/AppIcon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { activity, type ActivityPhase } from '$lib/stores/activity';
	import { toasts, type Toast, type ToastColor } from '$lib/stores/toast';
	import { SPRINGS, sampleSpring, tempo, type SpringSpec } from '$lib/design/springs';
	import {
		springTiming,
		motionLevel,
		decorativeMotion,
		type SpringName
	} from '$lib/utils/motion.svelte';

	let {
		takeOverToasts = false,
		offsetLeft = 0,
		shiftLeft = 0,
		onOpen,
		class: className = ''
	}: {
		takeOverToasts?: boolean;
		offsetLeft?: number;
		shiftLeft?: number;
		onOpen?: (id: string) => void;
		class?: string;
	} = $props();

	type Rect = NotifierRect;
	type Axis = 'x' | 'y';
	type Live = {
		id: string;
		source: 'activity' | 'toast';
		app: string;
		project?: string;
		projectIcon?: string | null;
		phase?: string;
		phaseId?: string;
		progress?: number;
		status: 'running' | 'success' | 'error';
		title?: string;
		message?: string;
		detail?: string;
		phases: ActivityPhase[];
		startedAt: number;
		finishedAt?: number;
	};
	type ShownToast = { id: string; toast: Toast; leaving: boolean; from?: Rect };
	type ShownBud = { id: string; live: Live; leaving: boolean };
	type Note = { key: string; title: string; tone: ToastColor; at: number };
	type Target = {
		rect: Rect;
		face: boolean;
		attached: boolean;
		axis: Axis;
		anchor?: Rect;
		anchorId?: string;
		birth?: Rect;
		leaving?: boolean;
		tone?: ToastColor;
	};
	type Blob = {
		group?: HTMLElement;
		pieces: HTMLElement[];
		neck?: HTMLElement;
		face?: HTMLElement;
		faceIn?: HTMLElement;
		from: Rect;
		to: Rect;
		anim?: Animation;
		spec?: SpringSpec;
		delay: number;
		applied: boolean;
		faceApplied: boolean;
		faceOn: boolean;
		leaving: boolean;
	};

	const PILL = 36;
	const GAP = 8;
	const BUD = 36;
	const DOT = 10;
	const OV = 6;
	const MIN_HEAD = 196;
	const MAX_HEAD = 320;
	const CARD_W = 368;
	const TOAST_MIN = 96;
	const TOAST_MAX = 360;
	const TOAST_OPEN = 320;
	const MAX_TOASTS = 3;
	const MAX_BUDS = 2;
	const SWIPE_MAX = 20;
	const SWIPE_DISMISS = 30;
	const SHAKE = 5;
	const STEP = 1000 / 120;
	const LEAVE_DELAY = 0.05;
	const FACE_LEAD = 0.06;
	const FACE_LEAD_ALONE = 0.09;
	const SWAP_LEAD = 0.04;
	const SHAKE_LEAD = 260;

	const ICONS = { success: Check, error: CircleAlert, warning: TriangleAlert, info: Info };
	const uid = $props.id();

	let rmax = 22.5;
	let ready = false;
	let expanded = $state(false);
	let hoveredToast = $state<string | null>(null);
	let headRowW = $state(MIN_HEAD);
	let sheetH = $state(160);
	let sizes = $state<Record<string, { w: number; more: number }>>({});
	let toastShown = $state.raw<ShownToast[]>([]);
	let budShown = $state.raw<ShownBud[]>([]);
	let recent = $state<Note[]>([]);
	let polite = $state('');
	let urgent = $state('');
	let now = $state(Date.now());
	let root = $state<HTMLElement>();
	let headButton = $state<HTMLButtonElement>();
	let sheetEl = $state<HTMLElement>();

	const firstSeen = new Map<string, number>();
	const blobs = new Map<string, Blob>();
	const lastRects = new Map<string, Rect>();
	let lastHeadId: string | undefined;

	const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
		x: lerp(a.x, b.x, t),
		y: lerp(a.y, b.y, t),
		w: lerp(a.w, b.w, t),
		h: lerp(a.h, b.h, t),
		r: lerp(a.r, b.r, t)
	});
	const sameRect = (a: Rect, b: Rect) =>
		Math.abs(a.x - b.x) < 0.25 &&
		Math.abs(a.y - b.y) < 0.25 &&
		Math.abs(a.w - b.w) < 0.25 &&
		Math.abs(a.h - b.h) < 0.25 &&
		Math.abs(a.r - b.r) < 0.25;
	const isDot = (r: Rect) => r.w <= DOT + 0.5 && r.h <= DOT + 0.5;
	const dotAt = (cx: number, cy: number): Rect => ({
		x: cx - DOT / 2,
		y: cy - DOT / 2,
		w: DOT,
		h: DOT,
		r: DOT / 2
	});
	const overlaps = (r: Rect, a: Rect, axis: Axis) =>
		axis === 'y' ? r.y < a.y + a.h - 0.5 : r.x < a.x + a.w - 0.5;

	function under(a: Rect, w: number): Rect {
		const h = Math.max(4, Math.min(PILL, a.h) - 6);
		const uw = Math.max(h, Math.min(w, a.w) * 0.6);
		return { x: a.x + a.w / 2 - uw / 2, y: a.y + a.h - h - 3, w: uw, h, r: h / 2 };
	}

	function underX(a: Rect): Rect {
		const s = Math.max(4, Math.min(BUD, a.h) - 6);
		return { x: a.x + a.w - s - 3, y: a.y + 3, w: s, h: s, r: s / 2 };
	}

	const toastLives = $derived.by((): Live[] => {
		if (!takeOverToasts) return [];
		return $toasts
			.filter((t) => t.color === 'loading' && !t.exiting)
			.map((t) => {
				if (!firstSeen.has(t.id)) firstSeen.set(t.id, Date.now());
				return {
					id: t.id,
					source: 'toast',
					app: t.title,
					status: 'running',
					phases: [],
					startedAt: firstSeen.get(t.id) ?? Date.now()
				};
			});
	});

	const lives = $derived<Live[]>([
		...$activity.map((a) => ({ ...a, source: 'activity' as const })),
		...toastLives
	]);
	const primary = $derived(lives.find((l) => l.status !== 'running') ?? lives[0]);
	const toastById = $derived(new Map(toastShown.map((s) => [s.id, s])));
	const budById = $derived(new Map(budShown.map((s) => [s.id, s])));
	const toastIds = $derived(toastShown.map((s) => s.id));
	const budIds = $derived(budShown.map((s) => s.id));

	$effect(() => {
		const want = lives.filter((l) => l.id !== primary?.id).slice(0, MAX_BUDS);
		untrack(() => {
			const map = new Map(want.map((l) => [l.id, l]));
			const next = budShown.map((s) => {
				const l = map.get(s.id);
				if (l) return { ...s, live: l, leaving: false };
				return s.leaving ? s : { ...s, leaving: true };
			});
			for (const l of want) {
				if (!next.some((s) => s.id === l.id)) next.push({ id: l.id, live: l, leaving: false });
			}
			budShown = next;
		});
	});

	function handoff(id: string): Rect | undefined {
		const b = lastHeadId === id ? blobs.get('head') : blobs.get(`bud:${id}`);
		return b?.applied ? currentRect(b) : undefined;
	}

	$effect(() => {
		const list = takeOverToasts ? $toasts : [];
		untrack(() => {
			const live = new Map(
				list.filter((t) => t.color !== 'loading' && !t.exiting).map((t) => [t.id, t])
			);
			let next = toastShown.map((s) => {
				const t = live.get(s.id);
				if (t) return s.toast === t ? s : { ...s, toast: t };
				return s.leaving ? s : { ...s, leaving: true };
			});
			for (const t of list) {
				if (!live.has(t.id) || next.some((s) => s.id === t.id)) continue;
				next = [{ id: t.id, toast: t, leaving: false, from: handoff(t.id) }, ...next];
				note(`t:${t.id}`, t.title, t.color);
			}
			toastShown = next;
		});
	});

	const seenStatus = new Map<string, Live['status']>();

	$effect(() => {
		const list = lives.map((l) => ({
			id: l.id,
			status: l.status,
			title: headline(l),
			phase: l.phase,
			message: l.message
		}));
		untrack(() => {
			for (const l of list) {
				const before = seenStatus.get(l.id);
				if (before === l.status) continue;
				seenStatus.set(l.id, l.status);
				if (l.status === 'running') {
					say(l.phase ? `${l.title}, ${l.phase}` : l.title);
					continue;
				}
				note(`a:${l.id}:${l.status}`, l.title, l.status);
				if (l.status === 'error') {
					say(l.message ? `${l.title}. ${l.message}` : l.title, true);
					if (before) queueMicrotask(() => shake(lastHeadId === l.id ? 'head' : `bud:${l.id}`));
				} else say(l.title);
			}
			for (const id of [...seenStatus.keys()]) {
				if (!list.some((l) => l.id === id)) seenStatus.delete(id);
			}
		});
	});

	$effect(() => {
		if (!lives.some((l) => l.status === 'running')) return;
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	$effect(() => {
		if (lives.length) return;
		untrack(() => {
			if (expanded) close();
		});
	});

	$effect(() => {
		if (!expanded) return;
		untrack(() => toasts.pause());
		return () => {
			if (!hoveredToast) toasts.resume();
		};
	});

	$effect(() => {
		if (!takeOverToasts) return;
		const el = document.documentElement;
		el.setAttribute('data-notifier-toasts', '');
		return () => el.removeAttribute('data-notifier-toasts');
	});

	$effect(() => {
		if (!expanded) return;
		const down = (e: PointerEvent) => {
			if (root && !root.contains(e.target as Node)) close();
		};
		const key = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			close(true);
		};
		window.addEventListener('pointerdown', down, true);
		window.addEventListener('keydown', key);
		return () => {
			window.removeEventListener('pointerdown', down, true);
			window.removeEventListener('keydown', key);
		};
	});

	function note(key: string, title: string, tone: ToastColor) {
		recent = [{ key, title, tone, at: Date.now() }, ...recent.filter((n) => n.key !== key)].slice(
			0,
			6
		);
	}

	function say(text: string, loud = false) {
		if (loud) urgent = text;
		else polite = text;
	}

	function headline(l: Live) {
		if (l.status === 'success') return l.title ?? `${l.app} deployed`;
		if (l.status === 'error') return l.title ?? `${l.app} failed`;
		return l.app;
	}

	function stateLabel(l: Live) {
		if (l.status === 'success') return 'Deployed';
		if (l.status === 'error') return 'Failed';
		return l.phase ?? 'Working';
	}

	function phaseMs(p: ActivityPhase) {
		return p.live && p.since ? p.ms + Math.max(0, now - p.since) : p.ms;
	}

	function elapsed(l: Live) {
		return Math.max(0, (l.finishedAt ?? now) - l.startedAt);
	}

	function clock(ms: number) {
		const s = Math.floor(ms / 1000);
		if (s < 60) return `${s}s`;
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	function ago(at: number) {
		const s = Math.floor((now - at) / 1000);
		if (s < 60) return 'Just now';
		const m = Math.floor(s / 60);
		if (m < 60) return `${m}m ago`;
		return `${Math.floor(m / 60)}h ago`;
	}

	function openSheet() {
		if (!lives.length) return;
		now = Date.now();
		hoveredToast = null;
		expanded = true;
		requestAnimationFrame(() => sheetEl?.focus({ preventScroll: true }));
	}

	function close(refocus = false) {
		expanded = false;
		if (refocus) requestAnimationFrame(() => headButton?.focus({ preventScroll: true }));
	}

	function dismissLive(l: Live) {
		if (l.source === 'toast') toasts.remove(l.id);
		else activity.dismiss(l.id);
	}

	const plan = $derived.by(() => {
		const out = new Map<string, Target>();
		const on = lives.length > 0;
		const freeBuds = on && !expanded ? budShown.filter((b) => !b.leaving) : [];
		const headW = Math.min(MAX_HEAD, Math.max(MIN_HEAD, headRowW));
		const cx = -(freeBuds.length * (BUD + GAP)) / 2;
		const head: Rect = !on
			? dotAt(0, PILL / 2)
			: expanded
				? { x: -CARD_W / 2, y: 0, w: CARD_W, h: sheetH, r: rmax }
				: { x: cx - headW / 2, y: 0, w: headW, h: PILL, r: PILL / 2 };
		out.set('head', { rect: head, face: on && !expanded, attached: false, axis: 'y' });
		out.set('sheet', { rect: head, face: on && expanded, attached: false, axis: 'y' });

		let bi = 0;
		for (const b of budShown) {
			const tucked = b.leaving || !on || expanded;
			const free: Rect = {
				x: head.x + head.w + GAP + bi * (BUD + GAP),
				y: 0,
				w: BUD,
				h: BUD,
				r: BUD / 2
			};
			if (!tucked) bi++;
			const tuck = underX(head);
			out.set(`bud:${b.id}`, {
				rect: tucked ? tuck : free,
				face: !tucked,
				attached: tucked,
				axis: 'x',
				anchor: head,
				anchorId: 'head',
				birth: tuck,
				leaving: b.leaving
			});
		}

		const tcx = on && !expanded ? cx : 0;
		let y = on ? PILL + GAP : 0;
		const placed: { id: string; rect: Rect }[] = [];
		for (const s of toastShown) {
			const key = `toast:${s.id}`;
			const size = sizes[s.id] ?? { w: 200, more: 0 };
			const more = !!(s.toast.description || s.toast.action);
			const open = !s.leaving && !expanded && hoveredToast === s.id && more;
			const w = open
				? Math.max(Math.min(TOAST_MAX, size.w), TOAST_OPEN)
				: clamp(size.w, TOAST_MIN, TOAST_MAX);
			const h = open ? PILL + size.more : PILL;
			const above = placed.at(-1) ?? (on ? { id: 'head', rect: head } : undefined);
			if (s.leaving) {
				const last = lastRects.get(key) ?? { x: tcx - w / 2, y, w, h: PILL, r: PILL / 2 };
				out.set(key, {
					rect: above
						? under(above.rect, w)
						: dotAt(last.x + last.w / 2, last.y + Math.min(last.h, PILL) / 2),
					face: false,
					attached: !!above,
					axis: 'y',
					anchor: above?.rect,
					anchorId: above?.id,
					leaving: true,
					tone: s.toast.color
				});
				continue;
			}
			if ((on && expanded) || placed.length >= MAX_TOASTS) {
				const a = on && expanded ? { id: 'head', rect: head } : placed.at(-1)!;
				const tuck = under(a.rect, w);
				out.set(key, {
					rect: tuck,
					face: false,
					attached: true,
					axis: 'y',
					anchor: a.rect,
					anchorId: a.id,
					birth: s.from ?? tuck,
					tone: s.toast.color
				});
				continue;
			}
			const rect: Rect = { x: tcx - w / 2, y, w, h, r: open ? rmax : PILL / 2 };
			out.set(key, {
				rect,
				face: true,
				attached: false,
				axis: 'y',
				anchor: above?.rect,
				anchorId: above?.id,
				birth: s.from ?? (above ? under(above.rect, w) : dotAt(tcx, y + PILL / 2)),
				tone: s.toast.color
			});
			placed.push({ id: key, rect });
			y += h + GAP;
		}
		return out;
	});

	$effect(() => {
		void plan;
		schedule();
	});

	let queued = false;
	function schedule() {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			apply();
		});
	}

	function blank(): Blob {
		const r = dotAt(0, PILL / 2);
		return {
			pieces: [],
			from: r,
			to: r,
			delay: 0,
			applied: false,
			faceApplied: false,
			faceOn: false,
			leaving: false
		};
	}

	function part(id: string, kind: 'group' | 'face') {
		return (el: HTMLElement) => {
			let b = blobs.get(id);
			if (!b) {
				b = blank();
				blobs.set(id, b);
			}
			if (kind === 'group') {
				b.group = el;
				b.pieces = [...el.querySelectorAll<HTMLElement>('.goo-piece')];
				b.neck = el.querySelector<HTMLElement>('.goo-neck') ?? undefined;
			} else {
				b.face = el;
				b.faceIn = el.querySelector<HTMLElement>('.face-in') ?? el;
			}
			schedule();
			return () => {
				queueMicrotask(() => {
					if (el.isConnected) return;
					const cur = blobs.get(id);
					if (!cur) return;
					if (kind === 'group' && cur.group === el) {
						cur.group = undefined;
						cur.applied = false;
					}
					if (kind === 'face' && cur.face === el) {
						cur.face = undefined;
						cur.faceApplied = false;
					}
					if (!cur.group && !cur.face) {
						blobs.delete(id);
						lastRects.delete(id);
					}
				});
			};
		};
	}

	const curves = new Map<string, number[]>();
	function pointsOf(spec: SpringSpec) {
		const scale = Math.round(tempo() * 20) / 20;
		const key = `${spec.response}:${spec.damping}:${scale}`;
		let pts = curves.get(key);
		if (!pts) {
			pts = sampleSpring(spec, STEP, scale).points;
			curves.set(key, pts);
		}
		return pts;
	}

	function currentRect(b: Blob): Rect {
		const an = b.anim;
		if (!an || !b.spec || an.playState === 'finished' || an.playState === 'idle') return b.to;
		const t = (Number(an.currentTime) || 0) - b.delay;
		if (t <= 0) return b.from;
		const pts = pointsOf(b.spec);
		const x = t / STEP;
		const i = Math.floor(x);
		if (i >= pts.length - 1) return b.to;
		return lerpRect(b.from, b.to, pts[i] + (pts[i + 1] - pts[i]) * (x - i));
	}

	function moving(id?: string) {
		const b = id ? blobs.get(id) : undefined;
		return !!b?.anim && b.anim.playState === 'running' && !sameRect(currentRect(b), b.to);
	}

	const px = (v: number) => `${Math.round(v * 100) / 100}px`;
	const sc = (v: number) => Math.max(v, 0.001).toFixed(4);

	function shapeOf(rc: Rect): string[] {
		const r = Math.max(0, Math.min(rc.r, rc.w / 2, rc.h / 2));
		const k = sc(r / rmax);
		const inner = (v: number) => sc(Math.max(0, v) / 100);
		const right = rc.x + rc.w - 2 * r;
		const bottom = rc.y + rc.h - 2 * r;
		return [
			`translate(${px(rc.x)}, ${px(rc.y + r)}) scale(${inner(rc.w)}, ${inner(rc.h - 2 * r)})`,
			`translate(${px(rc.x + r)}, ${px(rc.y)}) scale(${inner(rc.w - 2 * r)}, ${inner(rc.h)})`,
			`translate(${px(rc.x)}, ${px(rc.y)}) scale(${k})`,
			`translate(${px(right)}, ${px(rc.y)}) scale(${k})`,
			`translate(${px(rc.x)}, ${px(bottom)}) scale(${k})`,
			`translate(${px(right)}, ${px(bottom)}) scale(${k})`
		];
	}

	const placeOf = (rc: Rect) => `translate(${px(rc.x)}, ${px(rc.y)})`;

	function stop(el: Element, id: string) {
		for (const a of el.getAnimations()) if (a.id === id) a.cancel();
	}

	function snap(b: Blob, rc: Rect) {
		b.from = rc;
		b.to = rc;
		b.anim = undefined;
		const tf = shapeOf(rc);
		b.pieces.forEach((el, i) => {
			stop(el, 'shape');
			el.style.transform = tf[i];
		});
		if (b.face) {
			stop(b.face, 'shape');
			b.face.style.transform = placeOf(rc);
			b.face.style.width = px(rc.w);
			b.face.style.height = px(rc.h);
		}
	}

	function fadeGroup(b: Blob, on: boolean, name: SpringName = 'pop') {
		const el = b.group;
		if (!el) return undefined;
		const cur = getComputedStyle(el).opacity;
		stop(el, 'fade');
		el.style.opacity = on ? '1' : '0';
		if (!ready || motionLevel() === 'off') return undefined;
		const an = el.animate({ opacity: [cur, on ? '1' : '0'] }, springTiming(on ? name : 'settle'));
		an.id = 'fade';
		return an;
	}

	function fadeFace(b: Blob, on: boolean, delay = 0) {
		b.faceOn = on;
		const el = b.faceIn;
		if (b.face) b.face.inert = !on;
		if (!el) return;
		const cur = Number(getComputedStyle(el).opacity);
		stop(el, 'fade');
		el.style.opacity = on ? '1' : '0';
		if (!ready || motionLevel() === 'off') return;
		const blur = decorativeMotion();
		const kf: PropertyIndexedKeyframes = on
			? blur
				? { opacity: [cur, 1], filter: ['blur(4px)', 'blur(0px)'] }
				: { opacity: [cur, 1] }
			: blur
				? { opacity: [cur, 0], filter: ['blur(0px)', 'blur(4px)'] }
				: { opacity: [cur, 0] };
		const an = el.animate(kf, {
			...(on ? springTiming('glide', { delay }) : springTiming('settle')),
			fill: 'backwards'
		});
		an.id = 'fade';
	}

	function neckFrames(
		a: Rect,
		from: Rect,
		to: Rect,
		axis: Axis,
		detach: boolean,
		pts: number[]
	): Keyframe[] {
		const last = pts.length - 1;
		const stride = Math.max(1, Math.ceil(last / 48));
		const idx: number[] = [];
		for (let i = 0; i < last; i += stride) idx.push(i);
		idx.push(last);
		let broken = false;
		return idx.map((i) => {
			const b = lerpRect(from, to, pts[i]);
			const gap = axis === 'y' ? b.y - (a.y + a.h) : b.x - (a.x + a.w);
			const span = axis === 'y' ? Math.min(a.w, b.w) : Math.min(a.h, b.h);
			let k = gap <= 0 ? 1 : 1 - gap / (GAP * (detach ? 0.9 : 1));
			if (detach && k <= 0) broken = true;
			k = broken ? 0 : clamp(k);
			const width = Math.max(1, span * (0.16 + 0.5 * k));
			const len = Math.max(1, gap + OV * 2);
			const mid =
				axis === 'y' ? (a.x + a.w / 2 + b.x + b.w / 2) / 2 : (a.y + a.h / 2 + b.y + b.h / 2) / 2;
			const transform =
				axis === 'y'
					? `translate(${px(mid - width / 2)}, ${px(a.y + a.h - OV)}) scale(${sc(width / 100)}, ${sc(len / 100)})`
					: `translate(${px(a.x + a.w - OV)}, ${px(mid - width / 2)}) scale(${sc(len / 100)}, ${sc(width / 100)})`;
			return { offset: i / last, transform, opacity: k > 0 ? 1 : 0 };
		});
	}

	function neck(b: Blob, t: Target, from: Rect, to: Rect, spec: SpringSpec, delay: number) {
		if (!b.neck || !t.anchor || moving(t.anchorId)) return;
		const a = t.anchor;
		const detach = !t.attached && overlaps(from, a, t.axis) && !overlaps(to, a, t.axis);
		const attach = t.attached && !overlaps(from, a, t.axis);
		if (!detach && !attach) return;
		const pts = pointsOf(spec);
		stop(b.neck, 'neck');
		const an = b.neck.animate(neckFrames(a, from, to, t.axis, detach, pts), {
			duration: (pts.length - 1) * STEP,
			delay,
			easing: 'linear'
		});
		an.id = 'neck';
	}

	function springFor(from: Rect, to: Rect, t: Target): SpringName {
		if (t.leaving) return 'settle';
		if (isDot(from) || isDot(to)) return 'morph';
		if (to.h > from.h + 4) return 'morph';
		if (to.h < from.h - 4) return 'glide';
		if (t.anchor && overlaps(from, t.anchor, t.axis) && !t.attached) return 'morph';
		return 'glide';
	}

	function gone(id: string) {
		if (id.startsWith('toast:')) {
			const key = id.slice(6);
			toastShown = toastShown.filter((s) => s.id !== key || !s.leaving);
			if (!toastShown.some((s) => s.id === key)) delete sizes[key];
		} else if (id.startsWith('bud:')) {
			const key = id.slice(4);
			budShown = budShown.filter((s) => s.id !== key || !s.leaving);
		}
	}

	function settleLeave(id: string, b: Blob, an?: Animation) {
		const done = () => {
			if (blobs.get(id) === b && b.leaving) gone(id);
		};
		if (an) an.finished.then(done, () => {});
		else queueMicrotask(done);
	}

	function move(id: string, b: Blob, t: Target, start?: Rect) {
		const from = start ?? currentRect(b);
		const to = t.rect;
		const level = motionLevel();
		const appearing = isDot(from) && !isDot(to);
		const vanishing = isDot(to) && !isDot(from);
		if (!ready || level !== 'full') {
			if (ready && level === 'reduced' && (t.leaving || vanishing)) {
				const an = fadeGroup(b, false);
				const finish = () => {
					if (b.to === to || b.leaving) snap(b, to);
				};
				b.to = to;
				if (an) an.finished.then(finish, () => {});
				else finish();
				if (t.leaving) settleLeave(id, b, an);
				return;
			}
			snap(b, to);
			if (ready && level === 'reduced' && (appearing || start) && !isDot(to))
				fadeGroup(b, true, 'glide');
			else if (b.group) b.group.style.opacity = isDot(to) ? '0' : '1';
			if (t.leaving) settleLeave(id, b);
			return;
		}
		const name = springFor(from, to, t);
		const delay = t.leaving ? LEAVE_DELAY * tempo() : 0;
		const timing = springTiming(name, { delay });
		const spec = SPRINGS[name];
		b.from = from;
		b.to = to;
		b.spec = spec;
		b.delay = Number(timing.delay ?? 0);
		const a = shapeOf(from);
		const z = shapeOf(to);
		b.pieces.forEach((el, i) => {
			stop(el, 'shape');
			el.style.transform = z[i];
			const an = el.animate([{ transform: a[i] }, { transform: z[i] }], {
				...timing,
				fill: 'backwards'
			});
			an.id = 'shape';
			if (i === 0) b.anim = an;
		});
		if (b.face) {
			stop(b.face, 'shape');
			b.face.style.width = px(to.w);
			b.face.style.height = px(to.h);
			b.face.style.transform = placeOf(to);
			const an = b.face.animate([{ transform: placeOf(from) }, { transform: placeOf(to) }], {
				...timing,
				fill: 'backwards'
			});
			an.id = 'shape';
		}
		if (appearing) fadeGroup(b, true);
		if (vanishing) fadeGroup(b, false);
		neck(b, t, from, to, spec, b.delay);
		if (t.leaving) settleLeave(id, b, b.anim);
	}

	function applyShape(id: string, b: Blob, t: Target) {
		lastRects.set(id, t.rect);
		if (!b.applied) {
			b.applied = true;
			const birth = t.birth ?? t.rect;
			snap(b, birth);
			const faded = isDot(birth) || (ready && motionLevel() === 'reduced');
			if (b.group) b.group.style.opacity = faded ? '0' : '1';
			if (!sameRect(birth, t.rect) || faded) move(id, b, t, birth);
			if (t.tone === 'error' && ready) setTimeout(() => shake(id), SHAKE_LEAD * tempo());
			return;
		}
		if (t.leaving && !b.leaving) {
			b.leaving = true;
			move(id, b, t);
			return;
		}
		if (!t.leaving) b.leaving = false;
		if (sameRect(b.to, t.rect)) return;
		move(id, b, t);
	}

	function applyFace(b: Blob, t: Target) {
		if (!b.faceApplied) {
			b.faceApplied = true;
			b.faceOn = false;
			if (b.faceIn) b.faceIn.style.opacity = '0';
			if (b.face) b.face.inert = true;
		}
		if (t.face !== b.faceOn) fadeFace(b, t.face, (b.group ? FACE_LEAD : FACE_LEAD_ALONE) * tempo());
	}

	function apply() {
		const targets = plan;
		for (const [id, t] of targets) {
			const b = blobs.get(id);
			if (!b) continue;
			if (b.group) applyShape(id, b, t);
			if (b.face) applyFace(b, t);
		}
		lastHeadId = primary?.id ?? lastHeadId;
	}

	function shake(id: string) {
		if (!decorativeMotion()) return;
		const b = blobs.get(id);
		if (!b) return;
		const frames = Array.from({ length: 25 }, (_, i) => {
			const t = i / 24;
			const x = SHAKE * Math.exp(-4.2 * t) * Math.sin(2 * Math.PI * 3 * t);
			return { translate: `${x.toFixed(2)}px 0px` };
		});
		const timing = { ...springTiming('glide'), easing: 'linear' };
		for (const el of [b.group, b.face]) {
			if (!el) continue;
			stop(el, 'shake');
			el.animate(frames, timing).id = 'shake';
		}
	}

	function measure(set: (el: HTMLElement) => void) {
		return (el: HTMLElement) => {
			set(el);
			const ro = new ResizeObserver(() => set(el));
			ro.observe(el);
			return () => ro.disconnect();
		};
	}

	const measureHead = measure((el) => (headRowW = Math.ceil(el.offsetWidth)));
	const measureSheet = measure((el) => (sheetH = Math.ceil(el.offsetHeight)));
	function measureToast(id: string, field: 'w' | 'more') {
		return measure((el) => {
			const v = Math.ceil(field === 'w' ? el.offsetWidth : el.offsetHeight);
			const cur = sizes[id] ?? { w: 200, more: 0 };
			if (cur[field] !== v) sizes[id] = { ...cur, [field]: v };
		});
	}

	type HeadFace = { key: string; live: Live };
	let headFaces = $state<HeadFace[]>([]);

	$effect(() => {
		const l = primary;
		if (!l) return;
		const key = `${l.id}:${l.status}`;
		untrack(() => {
			const top = headFaces.at(-1);
			if (top?.key === key) {
				top.live = l;
				return;
			}
			headFaces = [...headFaces.filter((f) => f.key !== key).slice(-2), { key, live: l }];
		});
	});

	function blurIn(el: HTMLElement, delay = 0) {
		if (!ready || motionLevel() === 'off') return;
		const kf: PropertyIndexedKeyframes = decorativeMotion()
			? { opacity: [0, 1], filter: ['blur(4px)', 'blur(0px)'] }
			: { opacity: [0, 1] };
		el.animate(kf, { ...springTiming('glide', { delay }), fill: 'backwards' });
	}

	function swapIn(el: HTMLElement) {
		blurIn(el);
	}

	function headSwap(key: string) {
		return (el: HTMLElement) => {
			let entered = false;
			$effect(() => {
				const current = headFaces.at(-1)?.key === key;
				const many = headFaces.length > 1;
				untrack(() => {
					if (current && !entered) {
						entered = true;
						if (many) blurIn(el, SWAP_LEAD * tempo());
						return;
					}
					if (current) return;
					const drop = () => (headFaces = headFaces.filter((f) => f.key !== key));
					if (!ready || motionLevel() === 'off') return drop();
					const an = el.animate(
						decorativeMotion()
							? { opacity: [1, 0], filter: ['blur(0px)', 'blur(4px)'] }
							: { opacity: [1, 0] },
						{ ...springTiming('settle'), fill: 'forwards' }
					);
					an.onfinish = drop;
				});
			});
		};
	}

	let drag: { id: string; y: number; pointer: number; dy: number } | null = null;

	function dragSet(id: string, dy: number) {
		const b = blobs.get(`toast:${id}`);
		for (const el of [b?.group, b?.face]) if (el) el.style.translate = dy ? `0px ${px(dy)}` : '';
	}

	function onToastDown(e: PointerEvent, id: string) {
		if ((e.target as HTMLElement).closest('button')) return;
		drag = { id, y: e.clientY, pointer: e.pointerId, dy: 0 };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onToastMove(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.pointer) return;
		const raw = e.clientY - drag.y;
		drag.dy = raw;
		dragSet(drag.id, Math.sign(raw) * Math.min(Math.abs(raw), SWIPE_MAX));
	}

	function onToastUp(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.pointer) return;
		const { id, dy } = drag;
		drag = null;
		const shown = Math.sign(dy) * Math.min(Math.abs(dy), SWIPE_MAX);
		dragSet(id, 0);
		const b = blobs.get(`toast:${id}`);
		if (shown && ready && motionLevel() === 'full') {
			for (const el of [b?.group, b?.face]) {
				el?.animate({ translate: [`0px ${px(shown)}`, '0px 0px'] }, springTiming('snap'));
			}
		}
		if (Math.abs(dy) > SWIPE_DISMISS) toasts.remove(id);
	}

	function toastEnter(id: string) {
		hoveredToast = id;
		toasts.pause();
	}

	function toastLeave(id: string) {
		if (hoveredToast === id) hoveredToast = null;
		if (!expanded) toasts.resume();
	}

	onMount(() => {
		const v = parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--corner-scale')
		);
		rmax = 18 * (Number.isFinite(v) && v > 0 ? v : 1);
		const raf = requestAnimationFrame(() => {
			ready = true;
			schedule();
		});
		return () => cancelAnimationFrame(raf);
	});
</script>

{#snippet body(axis: Axis)}
	<span class="goo-piece goo-slab"></span>
	<span class="goo-piece goo-slab"></span>
	<span class="goo-piece goo-corner"></span>
	<span class="goo-piece goo-corner"></span>
	<span class="goo-piece goo-corner"></span>
	<span class="goo-piece goo-corner"></span>
	<span class="goo-neck">
		<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
			{#if axis === 'y'}
				<path d="M0 0H100C62 34 62 66 100 100H0C38 66 38 34 0 0Z" />
			{:else}
				<path d="M0 0C34 38 66 38 100 0V100C66 62 34 62 0 100Z" />
			{/if}
		</svg>
	</span>
{/snippet}

{#snippet glyph(l: Live)}
	{#if l.status === 'success'}
		<span class="glyph" data-tone="success"><Check size={14} strokeWidth={2.75} /></span>
	{:else if l.status === 'error'}
		<span class="glyph" data-tone="error"><CircleAlert size={14} strokeWidth={2.5} /></span>
	{:else if l.source === 'toast' || l.progress == null}
		<span class="glyph phase--{l.phaseId ?? 'idle'}" data-tone="phase"><Spinner size={14} /></span>
	{:else}
		<span class="glyph phase--{l.phaseId ?? 'build'}" data-tone="phase">
			<svg class="meter" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<circle class="meter-track" cx="8" cy="8" r="6" />
				<circle
					class="meter-fill"
					cx="8"
					cy="8"
					r="6"
					pathLength="100"
					stroke-dasharray="100"
					stroke-dashoffset={100 - clamp(l.progress) * 100}
				/>
			</svg>
		</span>
	{/if}
{/snippet}

{#snippet toneGlyph(tone: ToastColor, small = false)}
	<span class="glyph" class:glyph--small={small} data-tone={tone}>
		{#if tone === 'loading'}
			<Spinner size={small ? 12 : 14} />
		{:else}
			{@const Icon = ICONS[tone]}
			<Icon size={small ? 12 : 14} strokeWidth={2.5} />
		{/if}
	</span>
{/snippet}

{#snippet headRow(l: Live)}
	{@render glyph(l)}
	<span class="head-text">
		<span class="head-title line" data-tone={l.status} title={headline(l)}>{headline(l)}</span>
		{#if l.status === 'running' && l.phase && l.source === 'activity'}
			{#key l.phase}
				<span class="head-sub line" {@attach swapIn}>{l.phase}</span>
			{/key}
		{:else if l.status === 'error' && l.message}
			<span class="head-sub line" title={l.message}>{l.message}</span>
		{/if}
	</span>
	{#if l.source === 'activity'}
		<span class="head-clock line">{clock(elapsed(l))}</span>
		<AppIcon name={l.project ?? l.app} kind="project" icon={l.projectIcon} size="sm" />
	{/if}
{/snippet}

<div
	class="notifier {className}"
	bind:this={root}
	style:left="calc(50% + {offsetLeft / 2}px - {shiftLeft}px)"
	style:--card-w="{CARD_W}px"
	style:--open-w="{TOAST_OPEN}px"
>
	<span class="nf-sr" role="status" aria-live="polite">{polite}</span>
	<span class="nf-sr" role="alert">{urgent}</span>

	<div class="matter" aria-hidden="true">
		{#each toastIds as id (id)}
			<div class="blob" {@attach part(`toast:${id}`, 'group')}>{@render body('y')}</div>
		{/each}
		{#each budIds as id (id)}
			<div class="blob" {@attach part(`bud:${id}`, 'group')}>{@render body('x')}</div>
		{/each}
		<div class="blob" {@attach part('head', 'group')}>{@render body('y')}</div>
	</div>

	<div class="faces">
		{#each toastIds as id (id)}
			{@const s = toastById.get(id)}
			{#if s}
				{@const t = s.toast}
				<div
					class="face toast-face"
					role={t.color === 'error' ? 'alert' : 'status'}
					aria-live={t.color === 'error' ? 'assertive' : 'polite'}
					tabindex="-1"
					data-open={(hoveredToast === id && !expanded) || undefined}
					{@attach part(`toast:${id}`, 'face')}
					onpointerenter={() => toastEnter(id)}
					onpointerleave={() => toastLeave(id)}
					onpointerdown={(e) => onToastDown(e, id)}
					onpointermove={onToastMove}
					onpointerup={onToastUp}
					onpointercancel={onToastUp}
					onkeydown={(e) => {
						if (e.key === 'Escape') toasts.remove(id);
					}}
				>
					<div class="face-in">
						<div class="toast-row" {@attach measureToast(id, 'w')}>
							{@render toneGlyph(t.color)}
							{#key t.title}
								<span class="toast-title line" data-tone={t.color} title={t.title} {@attach swapIn}
									>{t.title}</span
								>
							{/key}
						</div>
						{#if t.description || t.action}
							<div class="toast-more" {@attach measureToast(id, 'more')}>
								{#if t.description}<p class="toast-desc">{t.description}</p>{/if}
								{#if t.action}
									<button
										type="button"
										class="toast-action"
										data-tone={t.color}
										onclick={() => {
											t.action?.onClick();
											toasts.remove(id);
										}}>{t.action.label}</button
									>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{/each}

		{#each budIds as id (id)}
			{@const s = budById.get(id)}
			{#if s}
				<button
					type="button"
					class="face bud-face"
					aria-label="{headline(s.live)}, show activity"
					{@attach part(`bud:${id}`, 'face')}
					onclick={openSheet}
				>
					<span class="face-in">
						{#if s.live.source === 'activity' && s.live.status === 'running'}
							<AppIcon
								name={s.live.project ?? s.live.app}
								kind="project"
								icon={s.live.projectIcon}
								size="sm"
							/>
						{:else}
							{@render glyph(s.live)}
						{/if}
					</span>
				</button>
			{/if}
		{/each}

		<button
			type="button"
			class="face head-face"
			bind:this={headButton}
			aria-expanded={expanded}
			aria-controls="{uid}-sheet"
			aria-label={primary ? `${headline(primary)}, show activity` : 'Activity'}
			{@attach part('head', 'face')}
			onclick={openSheet}
		>
			<span class="face-in head-stack">
				{#each headFaces as f, i (f.key)}
					<span
						class="head-row"
						class:head-row--past={i !== headFaces.length - 1}
						{@attach headSwap(f.key)}
						{@attach i === headFaces.length - 1 && measureHead}
					>
						{@render headRow(f.live)}
					</span>
				{/each}
			</span>
		</button>

		<div
			class="face sheet"
			id="{uid}-sheet"
			role="dialog"
			aria-label="Activity and notifications"
			tabindex="-1"
			bind:this={sheetEl}
			{@attach part('sheet', 'face')}
			{@attach measureSheet}
		>
			<div class="face-in sheet-in">
				{#if lives.length}
					<ul class="nf-lives">
						{#each lives as l (l.id)}
							{@const total = l.phases.reduce((sum, p) => sum + phaseMs(p), 0)}
							<li class="nf-live" data-status={l.status}>
								<div class="nf-live-top">
									{@render glyph(l)}
									<span class="nf-who">
										<span class="nf-app line">{l.app}</span>
										{#if l.project}<span class="nf-project line">{l.project}</span>{/if}
									</span>
									<span class="nf-state line" data-tone={l.status}>{stateLabel(l)}</span>
									{#if l.source === 'activity'}
										<span class="nf-clock line">{clock(elapsed(l))}</span>
									{/if}
									<span class="nf-acts">
										{#if onOpen && l.source === 'activity'}
											<button
												type="button"
												class="nf-act"
												aria-label="Open {l.app}"
												onclick={() => onOpen?.(l.id)}><ArrowUpRight size={14} /></button
											>
										{/if}
										<button
											type="button"
											class="nf-act"
											aria-label="Dismiss {l.app}"
											onclick={() => dismissLive(l)}><X size={14} /></button
										>
									</span>
								</div>
								{#if l.phases.length > 0 && total > 0}
									<span class="nf-bar" role="img" aria-label="Where the time went">
										{#each l.phases as p (p.id)}
											<span
												class="nf-seg phase--{p.id}"
												class:nf-seg--live={p.live && l.status === 'running'}
												style:flex-grow={Math.max(phaseMs(p), total * 0.04)}
												title="{p.label} {clock(phaseMs(p))}"
											></span>
										{/each}
									</span>
								{/if}
								{#if l.message || l.detail}
									<p class="nf-msg line">
										{l.message ?? ''}{#if l.detail}<span class="nf-detail"
												>{l.message ? ' · ' : ''}{l.detail}</span
											>{/if}
									</p>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{#if recent.length}
					<div class="nf-recent">
						<span class="nf-caption line">Recent</span>
						<ul class="nf-notes">
							{#each recent.slice(0, 4) as n (n.key)}
								<li class="nf-note">
									{@render toneGlyph(n.tone, true)}
									<span class="nf-note-title line">{n.title}</span>
									<span class="nf-ago line">{ago(n.at)}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	:global(html[data-notifier-toasts] section[aria-label='Notifications'][data-position]) {
		display: none;
	}

	.notifier {
		--nf-fill: var(--bg-raised);
		--nf-edge: color-mix(in oklab, var(--neutral-10) 17%, transparent);
		--nf-shade: color-mix(in oklab, var(--neutral-10) 9%, transparent);
		--nf-shade-far: color-mix(in oklab, var(--neutral-10) 10%, transparent);
		--nf-wash: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		--nf-wash-strong: color-mix(in oklab, var(--neutral-10) 11%, transparent);
		position: fixed;
		top: 1rem;
		z-index: var(--z-toast);
		width: 0;
		height: 0;
		pointer-events: none;
		color: var(--text-default);
		font-size: var(--text-callout);
	}
	:global(:root.dark) .notifier {
		--nf-fill: color-mix(in oklab, var(--neutral-1) 72%, black);
		--nf-edge: color-mix(in oklab, var(--neutral-10) 16%, transparent);
		--nf-shade: color-mix(in oklab, black 34%, transparent);
		--nf-shade-far: color-mix(in oklab, black 42%, transparent);
		--nf-wash: color-mix(in oklab, var(--neutral-10) 8%, transparent);
		--nf-wash-strong: color-mix(in oklab, var(--neutral-10) 14%, transparent);
	}
	.nf-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.matter {
		position: absolute;
		top: 0;
		left: 0;
		filter: drop-shadow(0 0 0.5px var(--nf-edge)) drop-shadow(0 2px 3px var(--nf-shade))
			drop-shadow(0 10px 20px var(--nf-shade-far));
	}
	.blob {
		position: absolute;
		top: 0;
		left: 0;
		opacity: 0;
	}
	.goo-piece,
	.goo-neck {
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: 0 0;
	}
	.goo-piece {
		background: var(--nf-fill);
	}
	.goo-slab {
		width: 100px;
		height: 100px;
	}
	.goo-corner {
		width: calc(2.25rem * var(--corner-scale));
		height: calc(2.25rem * var(--corner-scale));
		border-radius: calc(1.125rem * var(--corner-scale));
		corner-shape: var(--corner);
	}
	.goo-neck {
		width: 100px;
		height: 100px;
		opacity: 0;
	}
	.goo-neck svg {
		display: block;
		width: 100%;
		height: 100%;
		fill: var(--nf-fill);
	}

	.faces {
		position: absolute;
		top: 0;
		left: 0;
	}
	.face {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: auto;
		outline: none;
	}
	.face-in {
		opacity: 0;
	}
	button.face {
		padding: 0;
		border: none;
		background: transparent;
		color: inherit;
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		cursor: pointer;
		border-radius: calc(1.125rem * var(--corner-scale));
		corner-shape: var(--corner);
	}
	button.face:focus-visible,
	.toast-face:focus-visible {
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.line {
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}

	.glyph {
		--tone: var(--status-neutral-solid);
		--tone-ink: var(--status-neutral);
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		color: var(--tone-ink);
		background: color-mix(in oklab, var(--tone) 17%, transparent);
	}
	.glyph--small {
		width: 1.25rem;
		height: 1.25rem;
	}
	[data-tone='success'] {
		--tone: var(--status-success-solid);
		--tone-ink: var(--status-success);
	}
	[data-tone='error'] {
		--tone: var(--status-error-solid);
		--tone-ink: var(--status-error);
	}
	[data-tone='warning'] {
		--tone: var(--status-warning-solid);
		--tone-ink: var(--status-warning);
	}
	[data-tone='info'] {
		--tone: var(--status-info-solid);
		--tone-ink: var(--status-info);
	}
	[data-tone='loading'] {
		--tone: var(--status-neutral-solid);
		--tone-ink: var(--text-muted);
	}
	.glyph[data-tone='phase'] {
		--tone: var(--phase);
		--tone-ink: color-mix(in oklab, var(--phase) 72%, var(--text-default));
	}
	.meter {
		transform: rotate(-90deg);
	}
	.meter-track,
	.meter-fill {
		fill: none;
		stroke-width: 2.25;
	}
	.meter-track {
		stroke: color-mix(in oklab, var(--phase) 26%, transparent);
	}
	.meter-fill {
		stroke: var(--tone-ink);
		stroke-linecap: round;
	}

	.head-face {
		display: grid;
		place-items: center;
	}
	.head-stack {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
	}
	.head-row {
		grid-area: 1 / 1;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: max-content;
		max-width: 20rem;
		height: 2.25rem;
		padding-inline: 0.375rem;
	}
	.head-row--past {
		pointer-events: none;
	}
	.head-text {
		display: flex;
		flex: 1;
		align-items: baseline;
		gap: 0.375rem;
		min-width: 0;
		padding-inline-end: 0.125rem;
	}
	.head-title {
		flex-shrink: 0;
		max-width: 11rem;
		font-weight: var(--weight-medium);
	}
	.head-title[data-tone='error'] {
		font-weight: var(--weight-semibold);
	}
	.head-title[data-tone='success'] {
		font-weight: var(--weight-regular);
	}
	.head-sub {
		min-width: 0;
		color: var(--text-muted);
	}
	.head-clock {
		flex-shrink: 0;
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}

	.bud-face {
		display: grid;
		place-items: center;
		border-radius: 50%;
	}
	.bud-face .face-in {
		display: grid;
		place-items: center;
	}

	.toast-face {
		touch-action: none;
		cursor: default;
	}
	.toast-face:not([data-open]) .face-in {
		display: flex;
		justify-content: center;
	}
	.toast-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: max-content;
		max-width: 22.5rem;
		height: 2.25rem;
		padding-inline: 0.375rem 0.875rem;
	}
	.toast-title {
		min-width: 0;
		font-weight: var(--weight-medium);
	}
	.toast-title[data-tone='error'] {
		font-weight: var(--weight-semibold);
	}
	.toast-more {
		position: absolute;
		top: 2.25rem;
		left: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
		width: var(--open-w);
		padding: 0.25rem 0.875rem 0.875rem 2.375rem;
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--fade-out) var(--curve-in);
	}
	.toast-face[data-open] .toast-more {
		opacity: 1;
		pointer-events: auto;
		transition: opacity var(--fade-long) var(--curve-out) calc(140ms * var(--tempo));
	}
	.toast-desc {
		margin: 0;
		overflow-wrap: anywhere;
		color: var(--text-muted);
		font-size: var(--text-callout);
		line-height: var(--lh-footnote);
	}
	.toast-action {
		display: flex;
		align-items: center;
		height: 1.75rem;
		padding: 0 0.625rem;
		border: none;
		border-radius: calc(0.5rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--tone) 14%, transparent);
		color: var(--tone-ink);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-caption);
		font-weight: var(--weight-medium);
		cursor: pointer;
		transition: background-color var(--dur-fast) ease;
	}
	.toast-action:hover {
		background: color-mix(in oklab, var(--tone) 24%, transparent);
	}
	.toast-action:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.sheet {
		width: var(--card-w);
		transform: translateX(calc(var(--card-w) / -2));
		border-radius: calc(1.125rem * var(--corner-scale));
		corner-shape: var(--corner);
	}
	.sheet:focus-visible {
		box-shadow: 0 0 0 3px var(--focus-ring);
	}
	.sheet-in {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.75rem;
	}
	.nf-lives,
	.nf-notes {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.nf-lives {
		gap: 0.25rem;
	}
	.nf-live {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.5rem;
		border-radius: calc(0.625rem * var(--corner-scale));
		corner-shape: var(--corner);
		transition: background-color var(--dur-fast) ease;
	}
	.nf-live:hover,
	.nf-live:focus-within {
		background: var(--nf-wash);
	}
	.nf-live-top {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-height: 1.5rem;
	}
	.nf-who {
		display: flex;
		flex: 1;
		align-items: baseline;
		gap: 0.375rem;
		min-width: 0;
	}
	.nf-app {
		flex-shrink: 0;
		max-width: 9rem;
		font-weight: var(--weight-medium);
	}
	.nf-project {
		min-width: 0;
		color: var(--text-faint);
		font-size: var(--text-caption);
	}
	.nf-state {
		flex-shrink: 0;
		color: var(--text-muted);
	}
	.nf-state[data-tone='success'] {
		color: var(--status-success);
	}
	.nf-state[data-tone='error'] {
		color: var(--status-error);
		font-weight: var(--weight-semibold);
	}
	.nf-clock {
		flex-shrink: 0;
		min-width: 2rem;
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-align: end;
	}
	.nf-acts {
		position: absolute;
		top: 50%;
		right: -0.25rem;
		display: flex;
		gap: 0.125rem;
		translate: 0 -50%;
		opacity: 0;
		transition: opacity var(--dur-fast) ease;
	}
	.nf-live:hover .nf-acts,
	.nf-live:focus-within .nf-acts {
		opacity: 1;
	}
	.nf-state,
	.nf-clock {
		transition: opacity var(--dur-fast) ease;
	}
	.nf-live:hover :is(.nf-state, .nf-clock),
	.nf-live:focus-within :is(.nf-state, .nf-clock) {
		opacity: 0;
	}
	.nf-act {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: none;
		border-radius: calc(0.375rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}
	.nf-act:hover {
		background: var(--nf-wash-strong);
		color: var(--text-default);
	}
	.nf-act:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}
	.nf-bar {
		display: flex;
		gap: 2px;
		height: 0.375rem;
		margin-inline-start: 2.125rem;
	}
	.nf-seg {
		flex-basis: 0;
		min-width: 3px;
		border-radius: var(--radius-pill);
		background: var(--phase);
	}
	.nf-seg--live {
		animation: nf-pulse 1.6s ease-in-out infinite;
	}
	@keyframes nf-pulse {
		50% {
			opacity: 0.45;
		}
	}
	.nf-msg {
		margin: 0 0 0 2.125rem;
		color: var(--text-default);
	}
	.nf-detail {
		color: var(--text-muted);
	}
	.nf-recent {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-inline: 0.5rem;
		padding-block-end: 0.25rem;
	}
	.nf-caption {
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-weight: var(--weight-medium);
	}
	.nf-notes {
		gap: 0.625rem;
	}
	.nf-note {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 0;
	}
	.nf-note-title {
		flex: 1;
		min-width: 0;
		color: var(--text-muted);
	}
	.nf-ago {
		flex-shrink: 0;
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}

	.phase--idle {
		--phase: var(--neutral-7);
	}
	.phase--queue {
		--phase: var(--neutral-5);
	}
	.phase--schedule {
		--phase: var(--amber-5);
	}
	.phase--start {
		--phase: var(--amber-7);
	}
	.phase--clone {
		--phase: var(--hue-violet);
	}
	.phase--build {
		--phase: var(--blue-7);
	}
	.phase--push {
		--phase: var(--green-7);
	}
	.phase--rollout {
		--phase: var(--green-5);
	}
	:global(:root.dark) .phase--queue {
		--phase: var(--neutral-8);
	}
	:global(:root.dark) .phase--schedule {
		--phase: var(--amber-8);
	}
	:global(:root.dark) .phase--rollout {
		--phase: var(--green-9);
	}
</style>

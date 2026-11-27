<script lang="ts" module>
	export type IslandPhase = { id: string; label: string; ms: number; live?: boolean };

	export type IslandActivity = {
		id: string;
		app: string;
		project: string;
		projectIcon?: string | null;
		phase: string;
		phaseId?: string;
		progress?: number;
		status: 'running' | 'success' | 'error';
		message?: string;
		detail?: string;
		phases?: IslandPhase[];
	};
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Check, CircleAlert } from 'lucide-svelte';
	import AppIcon from '$lib/components/ui/AppIcon.svelte';
	import {
		SpringValue,
		springTiming,
		decorativeMotion,
		motionEnabled,
		motionLevel,
		type SpringName
	} from '$lib/utils/motion.svelte';
	import { tempo } from '$lib/design/springs';

	let {
		activities,
		onDismiss,
		onOpen,
		offsetLeft = 0,
		class: className = ''
	}: {
		activities: IslandActivity[];
		onDismiss?: (id: string) => void;
		onOpen?: (id: string) => void;
		offsetLeft?: number;
		class?: string;
	} = $props();

	const CW = 440;
	const CH = 280;
	const CX = CW / 2;
	const PILL_H = 36;
	const DOT = 10;
	const BUD_R = 18;
	const BUD_GAP = 8;
	const CARD_W = 352;
	const CARD_R = 22;
	const MIN_PILL = 208;
	const MAX_PILL = 288;
	const BLUR = 5;
	const RISE = 28;
	const SUCCESS_HOLD = 2500;
	const SHAKE = 7;
	const SWAP_LEAD = 0.04;
	const SHEET_LEAD = 0.07;

	const uid = $props.id();

	let ready = $state(false);
	let expanded = $state(false);
	let focusId = $state<string | null>(null);
	let hovered = $state(false);
	let faceW = $state(MIN_PILL);
	let sheetH = $state(132);
	let cornerScale = $state(1);
	let tone = $state<'success' | 'error'>('success');

	let root = $state<HTMLElement>();
	let stage = $state<HTMLElement>();
	let shaker = $state<HTMLElement>();
	let popper = $state<HTMLElement>();
	let tint = $state<SVGPathElement>();
	let hitMain = $state<HTMLButtonElement>();

	const presence = new SpringValue(0);
	const grow = new SpringValue(0);
	const split = new SpringValue(0);
	const pillW = new SpringValue(MIN_PILL);
	const cardH = new SpringValue(132);

	const primary = $derived(activities.find((a) => a.status !== 'running') ?? activities[0]);
	const secondary = $derived(activities.find((a) => a.id !== primary?.id));
	const focused = $derived(activities.find((a) => a.id === focusId) ?? primary);

	let heldPrimary: IslandActivity | undefined;
	let heldSecondary: IslandActivity | undefined;
	let heldFocused: IslandActivity | undefined;
	const shownPrimary = $derived.by(() => (heldPrimary = primary ?? heldPrimary));
	const shownSecondary = $derived.by(() => (heldSecondary = secondary ?? heldSecondary));
	const shownFocused = $derived.by(() => (heldFocused = focused ?? heldFocused));

	const pillTarget = $derived(Math.min(MAX_PILL, Math.max(MIN_PILL, faceW)));
	const budOut = $derived(!!secondary && !expanded);
	const targetMx = $derived(CX - (budOut ? BUD_GAP + 2 * BUD_R : 0) / 2);

	const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	const smooth = (a: number, b: number, v: number) => {
		const t = clamp((v - a) / (b - a));
		return t * t * (3 - 2 * t);
	};

	function squircle(x: number, y: number, w: number, h: number, r: number) {
		const m = Math.max(0, Math.min(w, h) / 2);
		const rr = clamp(r, 0, m);
		const p = Math.min(rr * 1.5, m);
		const a = p > 0 ? (4 * p - 2.343 * rr) / (3 * p) : 0;
		const c = p * a;
		const n = (v: number) => Math.round(v * 100) / 100;
		return [
			`M${n(x + p)} ${n(y)}`,
			`H${n(x + w - p)}`,
			`C${n(x + w - p + c)} ${n(y)} ${n(x + w)} ${n(y + p - c)} ${n(x + w)} ${n(y + p)}`,
			`V${n(y + h - p)}`,
			`C${n(x + w)} ${n(y + h - p + c)} ${n(x + w - p + c)} ${n(y + h)} ${n(x + w - p)} ${n(y + h)}`,
			`H${n(x + p)}`,
			`C${n(x + p - c)} ${n(y + h)} ${n(x)} ${n(y + h - p + c)} ${n(x)} ${n(y + h - p)}`,
			`V${n(y + p)}`,
			`C${n(x)} ${n(y + p - c)} ${n(x + p - c)} ${n(y)} ${n(x + p)} ${n(y)}Z`
		].join('');
	}

	const geo = $derived.by(() => {
		const full = decorativeMotion();
		const p = presence.current;
		const t1 = full ? Math.max(0, (p - 0.35) / 0.65) : 1;
		const t2 = full ? clamp(p / 0.35) : 1;
		const e = grow.current;
		const s = split.current;
		const baseH = lerp(DOT, PILL_H, t1);
		const baseW = lerp(DOT, pillW.current, t1);
		const w = lerp(baseW, CARD_W, e);
		const h = lerp(baseH, cardH.current, e);
		const r = lerp(baseH / 2, CARD_R * cornerScale, clamp(e));
		const mx = CX - (s * (BUD_GAP + 2 * BUD_R)) / 2;
		const right = mx + w / 2;
		const br = BUD_R * Math.min(1, t1) * lerp(0.55, 1, clamp(s));
		const bx = right - br + s * (BUD_GAP + 2 * br);
		const stretch = full ? Math.sin(Math.PI * clamp(s, 0, 1.3)) * 0.16 : 0;
		return {
			d: squircle(mx - w / 2, 0, w, h, r),
			mx,
			right,
			cy: baseH / 2,
			br,
			bx,
			rx: br * (1 + stretch),
			ry: br * (1 - stretch * 0.5),
			neck: br * 1.4 * (1 - smooth(0.3, 0.78, s)),
			bud: s > 0.01 && br > 0.5,
			goo: full && s > 0.02 && s < 0.98,
			budAlpha: clamp((s - 0.45) / 0.4) * clamp(t1),
			faceAlpha: clamp((t1 - 0.6) / 0.4) * clamp(1 - e * 3),
			rise: full ? -(1 - t2) * RISE : 0,
			alpha: full ? t2 : clamp(p),
			gone: p < 0.002 && activities.length === 0
		};
	});

	function drive(
		v: SpringValue,
		target: number,
		name: SpringName,
		opts: { settle?: boolean } = {}
	) {
		v.to(target, name, { ...opts, instant: !ready || !decorativeMotion() });
	}

	$effect(() => {
		const t = activities.length ? 1 : 0;
		untrack(() => presence.to(t, 'morph', { settle: t === 0, instant: !motionEnabled() }));
	});

	$effect(() => {
		const t = pillTarget;
		untrack(() => drive(pillW, t, 'morph'));
	});

	$effect(() => {
		const t = expanded ? 1 : 0;
		untrack(() => drive(grow, t, 'morph', { settle: t === 0 }));
	});

	$effect(() => {
		const t = budOut ? 1 : 0;
		const name: SpringName = t ? 'pop' : expanded ? 'settle' : 'morph';
		untrack(() => drive(split, t, name));
	});

	$effect(() => {
		const t = sheetH;
		untrack(() => cardH.to(t, 'glide', { instant: grow.current < 0.01 || !decorativeMotion() }));
	});

	$effect(() => {
		void expanded;
		void budOut;
		untrack(() => {
			if (!ready || !stage || motionLevel() !== 'reduced') return;
			stage.animate({ opacity: [0, 1] }, springTiming('glide'));
		});
	});

	$effect(() => {
		if (!activities.length) untrack(() => (expanded = false));
	});

	type Face = { key: string; a: IslandActivity };
	let faces = $state<Face[]>([]);

	$effect(() => {
		const a = shownPrimary;
		if (!a) return;
		const key = `${a.id}:${a.status}`;
		const snap = $state.snapshot(a) as IslandActivity;
		untrack(() => {
			const top = faces.at(-1);
			if (top?.key === key) {
				top.a = snap;
				return;
			}
			faces = [...faces.filter((f) => f.key !== key).slice(-2), { key, a: snap }];
		});
	});

	const seen = new Map<string, IslandActivity['status']>();
	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	$effect(() => {
		const list = activities.map((a) => ({ id: a.id, status: a.status }));
		untrack(() => {
			for (const { id, status } of list) {
				const before = seen.get(id);
				seen.set(id, status);
				if (before === status) continue;
				if (status === 'success') {
					if (before) celebrate();
					clearTimeout(timers.get(id));
					timers.set(
						id,
						setTimeout(() => {
							timers.delete(id);
							onDismiss?.(id);
						}, SUCCESS_HOLD)
					);
				}
				if (status === 'error' && before) refuse();
			}
			for (const id of [...seen.keys()]) {
				if (list.some((a) => a.id === id)) continue;
				seen.delete(id);
				clearTimeout(timers.get(id));
				timers.delete(id);
			}
		});
	});

	function flash(kind: 'success' | 'error') {
		tone = kind;
		tint?.animate({ opacity: [0.55, 0] }, springTiming('cinematic'));
	}

	function celebrate() {
		flash('success');
		if (!decorativeMotion() || !popper) return;
		popper.animate({ transform: ['scale(1.07)', 'scale(1)'] }, springTiming('bouncy'));
	}

	function refuse() {
		flash('error');
		if (!decorativeMotion() || !shaker) return;
		const steps = 24;
		const frames = Array.from({ length: steps + 1 }, (_, i) => {
			const t = i / steps;
			const x = SHAKE * Math.exp(-4.2 * t) * Math.sin(2 * Math.PI * 3 * t);
			return { transform: `translateX(${x.toFixed(2)}px)` };
		});
		shaker.animate(frames, { ...springTiming('glide'), easing: 'linear' });
	}

	function open(id: string | undefined) {
		if (!id) return;
		focusId = id;
		expanded = true;
		hovered = false;
	}

	function close(refocus = false) {
		expanded = false;
		if (refocus) requestAnimationFrame(() => hitMain?.focus());
	}

	$effect(() => {
		if (!expanded) return;
		const down = (e: PointerEvent) => {
			if (root && !root.contains(e.target as Node)) close();
		};
		const key = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close(true);
		};
		window.addEventListener('pointerdown', down, true);
		window.addEventListener('keydown', key);
		return () => {
			window.removeEventListener('pointerdown', down, true);
			window.removeEventListener('keydown', key);
		};
	});

	function measure(set: (w: number, h: number) => void) {
		return (el: HTMLElement) => {
			const ro = new ResizeObserver(() => set(el.offsetWidth, el.offsetHeight));
			ro.observe(el);
			return () => ro.disconnect();
		};
	}

	function blurIn(el: HTMLElement, delay = 0) {
		const kf: PropertyIndexedKeyframes = decorativeMotion()
			? {
					opacity: [0, 1],
					filter: ['blur(6px)', 'blur(0px)'],
					transform: ['scale(0.96)', 'scale(1)']
				}
			: { opacity: [0, 1] };
		return el.animate(kf, { ...springTiming('pop', { delay }), fill: 'backwards' });
	}

	function faceMotion(key: string) {
		return (el: HTMLElement) => {
			let entered = false;
			$effect(() => {
				const current = faces.at(-1)?.key === key;
				const many = faces.length > 1;
				untrack(() => {
					if (current && !entered) {
						entered = true;
						if (many && ready) blurIn(el, SWAP_LEAD * tempo());
						return;
					}
					if (current) return;
					const anim = el.animate(
						{ opacity: [1, 0], filter: ['blur(0px)', 'blur(6px)'] },
						{ ...springTiming('settle'), fill: 'forwards' }
					);
					anim.onfinish = () => (faces = faces.filter((f) => f.key !== key));
				});
			});
		};
	}

	function swapIn(el: HTMLElement) {
		if (ready) blurIn(el);
	}

	function sheetMotion(el: HTMLElement) {
		let anim: Animation | null = null;
		$effect(() => {
			const shown = expanded;
			untrack(() => {
				anim?.cancel();
				if (shown) {
					anim = blurIn(el, SHEET_LEAD * tempo());
					return;
				}
				anim = el.animate(
					decorativeMotion()
						? { opacity: [1, 0], filter: ['blur(0px)', 'blur(6px)'] }
						: { opacity: [1, 0] },
					{ ...springTiming('settle'), fill: 'forwards' }
				);
			});
		});
	}

	function clock(ms: number) {
		const s = Math.floor(ms / 1000);
		if (s < 60) return `${s}s`;
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	function headline(a: IslandActivity) {
		if (a.status === 'success') return `${a.app} deployed`;
		if (a.status === 'error') return `${a.app} failed`;
		return a.app;
	}

	onMount(() => {
		const v = parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--corner-scale')
		);
		if (Number.isFinite(v) && v > 0) cornerScale = v;
		const raf = requestAnimationFrame(() => (ready = true));
		return () => {
			cancelAnimationFrame(raf);
			for (const t of timers.values()) clearTimeout(t);
		};
	});
</script>

<div
	class="island {className}"
	data-gone={geo.gone || undefined}
	bind:this={root}
	style:left="calc(50% + {offsetLeft / 2 - CW / 2}px)"
	style:width="{CW}px"
	style:height="{CH}px"
>
	<span class="announce" role="status" aria-live="polite">
		{#if primary}{headline(primary)}{primary.status === 'running' ? `, ${primary.phase}` : ''}{/if}
	</span>
	<div
		class="lift"
		bind:this={stage}
		style:transform="translateY({geo.rise}px)"
		style:opacity={geo.alpha}
	>
		<div class="shake" bind:this={shaker}>
			<div class="swell" data-hover={(hovered && !expanded && decorativeMotion()) || undefined}>
				<div class="pop" bind:this={popper}>
					<svg class="canvas" width={CW} height={CH} viewBox="0 0 {CW} {CH}" aria-hidden="true">
						<defs>
							<filter
								id="goo-{uid}"
								filterUnits="userSpaceOnUse"
								x={geo.right - 60}
								y={-BLUR * 3}
								width={geo.bx - geo.right + geo.br * 2 + 90}
								height={PILL_H + BLUR * 6}
								color-interpolation-filters="sRGB"
							>
								<feGaussianBlur in="SourceGraphic" stdDeviation={BLUR} result="blur" />
								<feColorMatrix
									in="blur"
									type="matrix"
									values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
								/>
							</filter>
						</defs>
						{#if geo.goo}
							<g class="shape" filter="url(#goo-{uid})">
								<path d={geo.d} />
								<ellipse cx={geo.bx} cy={geo.cy} rx={geo.rx} ry={geo.ry} />
								{#if geo.neck > 0.5}
									<rect
										x={geo.right - geo.br}
										y={geo.cy - geo.neck / 2}
										width={Math.max(0, geo.bx - geo.right + geo.br)}
										height={geo.neck}
										rx={geo.neck / 2}
									/>
								{/if}
							</g>
						{/if}
						<path class="shape" d={geo.d} />
						{#if geo.bud}
							<ellipse class="shape" cx={geo.bx} cy={geo.cy} rx={geo.rx} ry={geo.ry} />
						{/if}
						<path class="tint tint--{tone}" d={geo.d} bind:this={tint} />
					</svg>

					<div class="main-layer" style:clip-path="path('{geo.d}')">
						<div
							class="face"
							style:height="{PILL_H}px"
							style:transform="translateX({geo.mx - CX}px)"
							style:opacity={geo.faceAlpha}
						>
							{#each faces as f, i (f.key)}
								{@const current = i === faces.length - 1}
								{@const a = f.a}
								<div
									class="face-row"
									class:face-row--past={!current}
									data-status={a.status}
									{@attach faceMotion(f.key)}
									{@attach current && measure((w) => (faceW = w))}
								>
									{#if a.status === 'running'}
										<AppIcon name={a.project} kind="project" icon={a.projectIcon} size="sm" />
										<span class="face-text">
											<span class="face-app" title={a.app}>{a.app}</span>
											{#key a.phase}
												<span class="face-phase" {@attach swapIn}>{a.phase}</span>
											{/key}
										</span>
										{#if a.progress != null}
											<svg
												class="meter phase--{a.phaseId ?? 'build'}"
												viewBox="0 0 16 16"
												width="16"
												height="16"
												aria-hidden="true"
											>
												<circle class="meter-track" cx="8" cy="8" r="6" />
												<circle
													class="meter-fill"
													cx="8"
													cy="8"
													r="6"
													pathLength="100"
													stroke-dasharray="100"
													stroke-dashoffset={100 - clamp(a.progress) * 100}
												/>
											</svg>
										{:else}
											<span class="pulse phase--{a.phaseId ?? 'build'}"></span>
										{/if}
									{:else}
										<span class="glyph glyph--{a.status}">
											{#if a.status === 'success'}
												<Check size={14} strokeWidth={2.75} />
											{:else}
												<CircleAlert size={14} strokeWidth={2.5} />
											{/if}
										</span>
										<span class="face-text">
											<span class="face-app face-app--{a.status}" title={headline(a)}
												>{headline(a)}</span
											>
										</span>
										<AppIcon name={a.project} kind="project" icon={a.projectIcon} size="sm" />
									{/if}
								</div>
							{/each}
						</div>

						{#if shownFocused && (expanded || grow.current > 0.02)}
							{@const f = shownFocused}
							{@const total = (f.phases ?? []).reduce((sum, p) => sum + p.ms, 0)}
							<div
								class="sheet"
								class:sheet--live={expanded}
								style:left="{CX - CARD_W / 2}px"
								style:width="{CARD_W}px"
								{@attach sheetMotion}
								{@attach measure((_, h) => (sheetH = h))}
							>
								<div class="sheet-head">
									<AppIcon name={f.project} kind="project" icon={f.projectIcon} size="md" />
									<span class="sheet-who">
										<span class="sheet-app">{f.app}</span>
										<span class="sheet-project">{f.project}</span>
									</span>
									<span class="sheet-state sheet-state--{f.status}">
										{#if f.status === 'running'}
											<span class="pulse phase--{f.phaseId ?? 'build'}"></span>
											<span class="line">{f.phase}</span>
										{:else if f.status === 'success'}
											<Check size={13} strokeWidth={2.75} />
											<span class="line">Deployed</span>
										{:else}
											<CircleAlert size={13} strokeWidth={2.5} />
											<span class="line">Failed</span>
										{/if}
										{#if total}<span class="line sheet-clock">{clock(total)}</span>{/if}
									</span>
								</div>
								{#if f.phases && f.phases.length > 0 && total > 0}
									<span class="bar" role="img" aria-label="Where the time went">
										{#each f.phases as p (p.id)}
											<span
												class="seg phase--{p.id}"
												class:seg--live={p.live}
												style:flex-grow={Math.max(p.ms, total * 0.04)}
												title="{p.label} {clock(p.ms)}"
											></span>
										{/each}
									</span>
								{/if}
								{#if f.message || f.detail}
									<p class="sheet-msg line">
										{f.message ?? ''}{#if f.detail}<span class="sheet-detail"
												>{f.message ? ' · ' : ''}{f.detail}</span
											>{/if}
									</p>
								{/if}
								<div class="sheet-actions">
									<button type="button" class="act act--open" onclick={() => onOpen?.(f.id)}
										>Open</button
									>
									<button
										type="button"
										class="act"
										onclick={() => {
											close();
											onDismiss?.(f.id);
										}}>{f.status === 'running' ? 'Cancel' : 'Dismiss'}</button
									>
								</div>
							</div>
						{/if}
					</div>

					{#if geo.bud && shownSecondary}
						<div
							class="bud-face"
							style:left="{CX - 12}px"
							style:top="{PILL_H / 2 - 12}px"
							style:transform="translate({geo.bx - CX}px, {geo.cy - PILL_H / 2}px) scale({geo.br /
								BUD_R})"
							style:opacity={geo.budAlpha}
						>
							<AppIcon
								name={shownSecondary.project}
								kind="project"
								icon={shownSecondary.projectIcon}
								size="sm"
							/>
						</div>
					{/if}

					{#if primary && !expanded}
						<button
							type="button"
							class="hit hit--main"
							bind:this={hitMain}
							style:left="{targetMx - pillTarget / 2}px"
							style:width="{pillTarget}px"
							style:height="{PILL_H}px"
							aria-expanded="false"
							aria-label="{headline(primary)}, show details"
							onpointerenter={() => (hovered = true)}
							onpointerleave={() => (hovered = false)}
							onclick={() => open(primary?.id)}
						></button>
					{/if}
					{#if budOut && secondary}
						<button
							type="button"
							class="hit hit--bud"
							style:left="{targetMx + pillTarget / 2 + BUD_GAP}px"
							style:width="{BUD_R * 2}px"
							style:height="{BUD_R * 2}px"
							aria-label="{secondary.app}, show details"
							onpointerenter={() => (hovered = true)}
							onpointerleave={() => (hovered = false)}
							onclick={() => open(secondary?.id)}
						></button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.island {
		--island-fill: var(--neutral-10);
		--island-fg: var(--neutral-app);
		--island-muted: color-mix(in oklab, var(--island-fg) 62%, transparent);
		--island-ok: color-mix(in oklab, var(--green-7) 78%, var(--island-fg));
		--island-bad: color-mix(in oklab, var(--red-7) 72%, var(--island-fg));
		--island-shadow: color-mix(in oklab, var(--neutral-10) 26%, transparent);
		--island-edge: transparent;
		position: fixed;
		top: 0.75rem;
		z-index: var(--z-toast);
		pointer-events: none;
	}
	:global(:root.dark) .island {
		--island-fill: color-mix(in oklab, var(--neutral-app) 45%, black);
		--island-fg: var(--neutral-10);
		--island-shadow: color-mix(in oklab, black 55%, transparent);
		--island-edge: color-mix(in oklab, var(--neutral-10) 30%, transparent);
	}
	.announce {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.island[data-gone] {
		visibility: hidden;
	}
	.lift,
	.shake,
	.swell,
	.pop {
		position: absolute;
		inset: 0;
	}
	.swell {
		transform-origin: 50% 18px;
		transition: transform var(--spring-glide-duration) var(--spring-glide);
	}
	.swell[data-hover] {
		transform: scale(1.04);
	}
	.canvas {
		position: absolute;
		inset: 0;
		display: block;
		overflow: visible;
		filter: drop-shadow(0 0 0.6px var(--island-edge)) drop-shadow(0 8px 18px var(--island-shadow));
	}
	.shape,
	.shape :global(*) {
		fill: var(--island-fill);
	}
	.tint {
		opacity: 0;
		pointer-events: none;
	}
	.tint--success {
		fill: var(--green-7);
	}
	.tint--error {
		fill: var(--red-7);
	}

	.main-layer {
		position: absolute;
		inset: 0;
		color: var(--island-fg);
	}
	.face {
		position: absolute;
		top: 0;
		left: 0;
		display: grid;
		place-items: center;
		width: 100%;
	}
	.face-row {
		grid-area: 1 / 1;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 13rem;
		max-width: 18rem;
		height: 2.25rem;
		padding-inline: 0.375rem 0.75rem;
	}
	.face-row--past {
		pointer-events: none;
	}
	.face-row[data-status='success'],
	.face-row[data-status='error'] {
		padding-inline: 0.375rem;
	}
	.face-text {
		display: flex;
		flex: 1;
		align-items: baseline;
		gap: 0.375rem;
		min-width: 0;
		white-space: nowrap;
	}
	.face-app,
	.face-phase,
	.line {
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.face-app {
		min-width: 0;
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
	}
	.face-app--success {
		color: var(--island-ok);
	}
	.face-app--error {
		color: var(--island-bad);
		font-weight: var(--weight-semibold);
	}
	.face-phase {
		min-width: 0;
		color: var(--island-muted);
		font-size: var(--text-callout);
	}
	.glyph {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
	}
	.glyph--success {
		color: var(--island-ok);
		background: color-mix(in oklab, var(--island-ok) 22%, transparent);
	}
	.glyph--error {
		color: var(--island-bad);
		background: color-mix(in oklab, var(--island-bad) 22%, transparent);
	}

	.meter {
		flex-shrink: 0;
		transform: rotate(-90deg);
	}
	.meter-track,
	.meter-fill {
		fill: none;
		stroke-width: 2.25;
	}
	.meter-track {
		stroke: color-mix(in oklab, var(--island-fg) 18%, transparent);
	}
	.meter-fill {
		stroke: var(--phase);
		stroke-linecap: round;
	}
	.pulse {
		flex-shrink: 0;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--phase);
		animation: pulse 1.6s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
		}
	}

	.sheet {
		position: absolute;
		top: 0;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 0.875rem;
		pointer-events: none;
	}
	.sheet--live {
		pointer-events: auto;
	}
	.sheet-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.sheet-who {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}
	.sheet-app,
	.sheet-project {
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.sheet-app {
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
	}
	.sheet-project {
		color: var(--island-muted);
		font-size: var(--text-caption);
	}
	.sheet-state {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.375rem;
		color: var(--island-muted);
		font-size: var(--text-callout);
	}
	.sheet-state--success {
		color: var(--island-ok);
	}
	.sheet-state--error {
		color: var(--island-bad);
		font-weight: var(--weight-semibold);
	}
	.sheet-clock {
		color: var(--island-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		font-weight: var(--weight-regular);
	}
	.bar {
		display: flex;
		gap: 2px;
		height: 0.375rem;
	}
	.seg {
		flex-basis: 0;
		min-width: 3px;
		border-radius: var(--radius-pill);
		background: var(--phase);
	}
	.seg--live {
		animation: pulse 1.6s ease-in-out infinite;
	}
	.sheet-msg {
		margin: 0;
		font-size: var(--text-callout);
	}
	.sheet-detail {
		color: var(--island-muted);
	}
	.sheet-actions {
		display: flex;
		gap: 0.5rem;
	}
	.act {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		height: 2rem;
		padding: 0 0.75rem;
		border: none;
		border-radius: calc(0.5rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--island-fg) 14%, transparent);
		color: var(--island-fg);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
		cursor: pointer;
		transition: background-color var(--dur-fast) ease;
	}
	.act:hover {
		background: color-mix(in oklab, var(--island-fg) 22%, transparent);
	}
	.act--open {
		background: var(--island-fg);
		color: var(--island-fill);
	}
	.act--open:hover {
		background: color-mix(in oklab, var(--island-fg) 88%, var(--island-fill));
	}
	.act:focus-visible,
	.hit:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 55%, transparent);
	}

	.bud-face {
		position: absolute;
		width: 1.5rem;
		height: 1.5rem;
		transform-origin: center;
	}
	.hit {
		position: absolute;
		top: 0;
		padding: 0;
		border: none;
		border-radius: var(--radius-pill);
		background: transparent;
		cursor: pointer;
		pointer-events: auto;
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

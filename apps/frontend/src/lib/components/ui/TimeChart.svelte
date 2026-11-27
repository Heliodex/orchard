<script lang="ts">
	import {
		chartTime,
		nearestPoint,
		seriesColor,
		valueAt,
		type ChartBand,
		type ChartDisplay,
		type ChartEvent,
		type ChartThreshold,
		type ChartFinding,
		type ChartSeries
	} from './time-chart';
	import { chartAxis } from './chart-axis.svelte';

	let {
		series,
		from,
		to,
		formatY,
		height = undefined,
		label,
		display = 'lines',
		hover = $bindable(null),
		emphasis = $bindable(null),
		events = [],
		findings = [],
		thresholds = [],
		bands = [],
		peaks = 0,
		integer = false,
		sparse = false,
		onZoom = undefined
	}: {
		series: ChartSeries[];
		from: number;
		to: number;
		formatY: (value: number) => string;
		height?: number;
		label: string;
		display?: ChartDisplay;
		hover?: number | null;
		emphasis?: string | null;
		events?: ChartEvent[];
		findings?: ChartFinding[];
		thresholds?: ChartThreshold[];
		bands?: ChartBand[];
		peaks?: number;
		integer?: boolean;
		sparse?: boolean;
		onZoom?: (from: number, to: number) => void;
	} = $props();

	const uid = $props.id();
	const TOP = 10;
	const AXIS = 24;
	const GAP = 10;
	const MIN_ZOOM_PX = 12;
	const NEAR_PX = 6;
	const EVENT_TONE = {
		deploy: 'var(--status-deploy-solid)',
		error: 'var(--status-error-solid)',
		platform: 'var(--status-warning-solid)',
		neutral: 'var(--neutral-8)'
	};
	const TIME_STEPS = [
		15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000, 3_600_000, 7_200_000,
		10_800_000, 21_600_000, 43_200_000, 86_400_000
	];

	let width = $state(0);
	let boxHeight = $state(0);
	let wrap = $state<HTMLDivElement | null>(null);
	let charWidth = $state(6.6);
	let pointer = $state<{ x: number; y: number } | null>(null);
	let drag = $state<{ from: number; to: number } | null>(null);

	const h = $derived(height ?? boxHeight);
	const span = $derived(Math.max(1, to - from));
	const bottom = $derived(Math.max(TOP + 1, h - AXIS));

	const step = $derived.by(() => {
		if (sparse) return span / 40;
		const p = series.find((s) => s.points.length > 1)?.points;
		return p ? (p[p.length - 1].x - p[0].x) / (p.length - 1) : span / 60;
	});

	function niceStep(raw: number) {
		const mag = 10 ** Math.floor(Math.log10(raw));
		const n = raw / mag;
		return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
	}

	const stacks = $derived.by(() => {
		if (display !== 'stacked' && display !== 'stackedAreas') return null;
		const base = new Map<number, number>();
		return series.map((s) =>
			s.points.map((p) => {
				const y0 = base.get(p.x) ?? 0;
				base.set(p.x, y0 + p.y);
				return { x: p.x, y0, y1: y0 + p.y };
			})
		);
	});

	const yScale = $derived.by(() => {
		let peak = 0;
		if (stacks) {
			for (const s of stacks) for (const p of s) if (p.y1 > peak) peak = p.y1;
		} else {
			for (const s of series) for (const p of s.points) if (p.y > peak) peak = p.y;
		}
		const next = thresholds
			.map((t) => t.value)
			.filter((v) => v > peak)
			.sort((a, b) => a - b)[0];
		if (next !== undefined && peak >= next * 0.4) peak = next * 1.08;
		const raw = niceStep(peak > 0 ? (peak * 1.08) / 3 : 1 / 3);
		const unit = integer ? Math.max(1, Math.ceil(raw)) : raw;
		const max = Math.max(unit, Math.ceil((peak * 1.04) / unit) * unit);
		const ticks: { value: number; text: string }[] = [];
		let last = '';
		for (let v = 0; v <= max + unit / 2; v += unit) {
			const text = formatY(v);
			if (text === last) continue;
			last = text;
			ticks.push({ value: v, text });
		}
		return { max, ticks };
	});

	const axis = chartAxis();
	const ownGutter = $derived(
		Math.ceil(Math.max(0, ...yScale.ticks.map((t) => t.text.length)) * charWidth) + GAP
	);
	const gutter = $derived(Math.max(ownGutter, axis?.gutter ?? 0));

	$effect(() => {
		axis?.report(uid, ownGutter);
	});
	$effect(() => () => axis?.drop(uid));
	const plotW = $derived(Math.max(1, width - gutter));
	const sx = (t: number) => ((t - from) / span) * plotW;
	const sy = (v: number) => bottom - (v / yScale.max) * (bottom - TOP);
	const tAt = (px: number) => from + (px / plotW) * span;

	function runs(xs: number[]): [number, number][] {
		if (!xs.length) return [];
		if (sparse) return [[0, xs.length - 1]];
		const out: [number, number][] = [];
		let start = 0;
		for (let i = 1; i < xs.length; i++) {
			if (xs[i] - xs[i - 1] <= step * 2.5) continue;
			out.push([start, i - 1]);
			start = i;
		}
		out.push([start, xs.length - 1]);
		return out;
	}

	function monotone(pts: [number, number][]): string {
		const n = pts.length;
		if (n === 0) return '';
		if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
		const dx: number[] = [];
		const m: number[] = [];
		for (let i = 0; i < n - 1; i++) {
			dx[i] = pts[i + 1][0] - pts[i][0];
			m[i] = dx[i] ? (pts[i + 1][1] - pts[i][1]) / dx[i] : 0;
		}
		const t: number[] = Array.from({ length: n }, () => 0);
		t[0] = m[0];
		t[n - 1] = m[n - 2];
		for (let i = 1; i < n - 1; i++) {
			t[i] =
				m[i - 1] * m[i] <= 0
					? 0
					: (3 * (dx[i - 1] + dx[i])) /
						((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
		}
		let d = `M${pts[0][0]},${pts[0][1]}`;
		for (let i = 0; i < n - 1; i++) {
			const third = dx[i] / 3;
			d += `C${pts[i][0] + third},${pts[i][1] + t[i] * third} ${pts[i + 1][0] - third},${pts[i + 1][1] - t[i + 1] * third} ${pts[i + 1][0]},${pts[i + 1][1]}`;
		}
		return d;
	}

	const barW = $derived(Math.max(1, (step / span) * plotW * 0.72));

	function areaPath(
		ranges: [number, number][],
		top: [number, number][],
		floor: [number, number][] | null
	) {
		return ranges
			.filter(([a, b]) => b > a)
			.map(([a, b]) => {
				const seg = top.slice(a, b + 1);
				const base = floor
					? `L${monotone(floor.slice(a, b + 1).reverse()).slice(1)}`
					: `L${seg[seg.length - 1][0]},${bottom}L${seg[0][0]},${bottom}`;
				return `${monotone(seg)}${base}Z`;
			})
			.join('');
	}

	const drawn = $derived(
		series.map((s, i) => {
			const layered = display === 'stackedAreas' && stacks ? stacks[i] : null;
			const pts = layered
				? layered.map((p) => [sx(p.x), sy(p.y1)] as [number, number])
				: s.points.map((p) => [sx(p.x), sy(p.y)] as [number, number]);
			const flat = display === 'bars' || display === 'stacked';
			const ranges = flat ? [] : runs(s.points.map((p) => p.x));
			const out = ranges.map(([a, b]) => pts.slice(a, b + 1));
			const bridges = ranges.slice(1).map(([a], k) => {
				const prev = pts[ranges[k][1]];
				return [prev[0], prev[1], pts[a][0], pts[a][1]] as [number, number, number, number];
			});
			const line = out.map(monotone).join('');
			const area =
				display === 'areas'
					? areaPath(ranges, pts, null)
					: layered
						? areaPath(
								ranges,
								pts,
								layered.map((p) => [sx(p.x), sy(p.y0)] as [number, number])
							)
						: '';
			const blocks =
				stacks && display === 'stacked'
					? stacks[i].map((p) => ({ x: sx(p.x), top: sy(p.y1), bottom: sy(p.y0) }))
					: [];
			return {
				...s,
				pts,
				line,
				area,
				blocks,
				bridges,
				color: seriesColor(s),
				index: i
			};
		})
	);

	const zones = $derived.by(() => {
		const sorted = [...thresholds].sort((a, b) => a.value - b.value);
		return sorted.flatMap((t, i) => {
			if (t.value >= yScale.max) return [];
			const top = i + 1 < sorted.length ? Math.min(sorted[i + 1].value, yScale.max) : yScale.max;
			return [{ ...t, y: sy(top), h: sy(t.value) - sy(top), line: sy(t.value) }];
		});
	});

	const tinted = $derived(
		bands
			.filter((b) => b.to >= from && b.from <= to)
			.map((b) => {
				const x = sx(Math.max(b.from, from));
				const w = Math.max(3, sx(Math.min(b.to, to)) - x);
				return { ...b, x, w };
			})
	);

	const peakMarks = $derived.by(() => {
		if (!peaks || (display !== 'lines' && display !== 'areas')) return [];
		const s = drawn.find((d) => d.points.length > 4);
		if (!s) return [];
		const ys = s.points.map((p) => p.y);
		const sorted = [...ys].sort((a, b) => a - b);
		const typical = sorted[sorted.length >> 1];
		const candidates = s.points
			.map((p, i) => ({ p, i }))
			.filter(
				({ i }) =>
					(i === 0 || ys[i] >= ys[i - 1]) &&
					(i === ys.length - 1 || ys[i] >= ys[i + 1]) &&
					ys[i] > typical * 1.4
			)
			.sort((a, b) => b.p.y - a.p.y);
		const picked: { x: number; y: number; text: string; color: string }[] = [];
		for (const c of candidates) {
			const x = sx(c.p.x);
			if (picked.some((k) => Math.abs(k.x - x) < plotW * 0.12)) continue;
			picked.push({ x, y: sy(c.p.y), text: formatY(c.p.y), color: s.color });
			if (picked.length >= peaks) break;
		}
		return picked;
	});

	const extent = $derived.by(() => {
		let lo = Infinity;
		let hi = -Infinity;
		for (const s of series) {
			if (!s.points.length) continue;
			lo = Math.min(lo, s.points[0].x);
			hi = Math.max(hi, s.points[s.points.length - 1].x);
		}
		return Number.isFinite(lo) ? { lo, hi } : null;
	});

	const gaps = $derived.by(() => {
		if (sparse) return [];
		if (!extent) return [{ x: 0, w: plotW }];
		const out: { x: number; w: number }[] = [];
		if (extent.lo - from > span * 0.02) out.push({ x: 0, w: sx(extent.lo) });
		if (to - extent.hi > span * 0.04) out.push({ x: sx(extent.hi), w: plotW - sx(extent.hi) });
		return out;
	});

	const xTicks = $derived.by(() => {
		const target = Math.max(2, Math.floor(plotW / 110));
		const every = TIME_STEPS.find((s) => span / s <= target) ?? TIME_STEPS[TIME_STEPS.length - 1];
		const offset = -new Date(from).getTimezoneOffset() * 60_000;
		const out: { t: number; x: number; text: string }[] = [];
		for (let t = Math.ceil((from + offset) / every) * every - offset; t <= to; t += every) {
			const x = sx(t);
			if (x < 18 || x > plotW - 18) continue;
			const d = new Date(t);
			const midnight = d.getHours() === 0 && d.getMinutes() === 0;
			const text =
				every >= 86_400_000 || (span > 86_400_000 && midnight)
					? d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
					: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
			out.push({ t, x, text });
		}
		return out;
	});

	const marks = $derived(
		events
			.filter((e) => e.t >= from && e.t <= to)
			.map((e) => ({ ...e, x: sx(e.t), color: EVENT_TONE[e.tone ?? 'neutral'] }))
	);

	const rings = $derived(
		findings.flatMap((f) => {
			const s = series.find((x) => x.id === f.seriesId);
			const v = s ? valueAt(s.points, f.t, step) : null;
			return v == null || f.t < from || f.t > to ? [] : [{ ...f, x: sx(f.t), y: sy(v) }];
		})
	);

	const crosshair = $derived(hover !== null && hover >= from && hover <= to ? sx(hover) : null);

	const readings = $derived(
		hover === null
			? []
			: drawn.flatMap((s) => {
					const v = valueAt(s.points, hover!, step * 0.75);
					const top = stacks
						? stacks[s.index].find((p) => Math.abs(p.x - hover!) <= step * 0.75)?.y1
						: undefined;
					return v == null
						? []
						: [{ id: s.id, label: s.label ?? s.id, color: s.color, v, y: sy(top ?? v) }];
				})
	);

	const nearest = $derived.by(() => {
		if (!pointer || !readings.length) return null;
		return readings.reduce((a, b) =>
			Math.abs(b.y - pointer!.y) < Math.abs(a.y - pointer!.y) ? b : a
		);
	});

	const nearMarks = $derived(
		pointer ? marks.filter((m) => Math.abs(m.x - pointer!.x) <= NEAR_PX) : []
	);
	const nearBands = $derived(
		pointer ? tinted.filter((b) => pointer!.x >= b.x - 2 && pointer!.x <= b.x + b.w + 2) : []
	);
	const nearRings = $derived(
		pointer ? rings.filter((r) => Math.abs(r.x - pointer!.x) <= NEAR_PX * 2) : []
	);

	const pillText = $derived(hover === null ? '' : chartTime(hover, span, step < 60_000));
	const pillW = $derived(pillText.length * charWidth + 14);

	function local(ev: PointerEvent) {
		const box = (ev.currentTarget as HTMLElement).getBoundingClientRect();
		return {
			x: Math.min(Math.max(ev.clientX - box.left, 0), plotW),
			y: Math.min(Math.max(ev.clientY - box.top, 0), bottom)
		};
	}

	function snap(t: number): number {
		if (!sparse) {
			const primary = series.find((s) => s.points.length > 0);
			return primary ? (nearestPoint(primary.points, t)?.x ?? t) : t;
		}
		let best: number | null = null;
		for (const s of series) {
			const p = nearestPoint(s.points, t);
			if (p && (best === null || Math.abs(p.x - t) < Math.abs(best - t))) best = p.x;
		}
		return best !== null && Math.abs(best - t) <= step * 0.75 ? best : t;
	}

	function move(ev: PointerEvent) {
		if (ev.pointerType === 'touch') return;
		const p = local(ev);
		pointer = p;
		if (drag) drag = { ...drag, to: p.x };
		hover = snap(tAt(p.x));
		if (series.length > 1) emphasis = nearest?.id ?? null;
	}

	function leave() {
		if (drag) return;
		pointer = null;
		hover = null;
		if (series.length > 1) emphasis = null;
	}

	function down(ev: PointerEvent) {
		if (!onZoom || ev.button !== 0 || ev.pointerType === 'touch') return;
		const p = local(ev);
		drag = { from: p.x, to: p.x };
		(ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
	}

	function up(ev: PointerEvent) {
		const d = drag;
		drag = null;
		(ev.currentTarget as HTMLElement).releasePointerCapture?.(ev.pointerId);
		if (!d || !onZoom || Math.abs(d.to - d.from) < MIN_ZOOM_PX) return;
		onZoom(tAt(Math.min(d.from, d.to)), tAt(Math.max(d.from, d.to)));
	}

	$effect(() => {
		const el = wrap;
		if (!el) return;
		const ctx = document.createElement('canvas').getContext('2d');
		if (!ctx) return;
		const style = getComputedStyle(el);
		ctx.font = `450 ${style.getPropertyValue('--chart-label-size') || '11px'} ${style.fontFamily}`;
		charWidth = ctx.measureText('0000000000').width / 10;
	});
</script>

<div
	bind:this={wrap}
	class="chart"
	class:chart--zoomable={!!onZoom}
	style:height={height != null ? `${height}px` : undefined}
	bind:clientWidth={width}
	bind:clientHeight={boxHeight}
	role="img"
	aria-label={label}
>
	{#if width > 0 && h > 0}
		<svg {width} height={h} aria-hidden="true">
			<defs>
				<clipPath id="plot-{uid}">
					<rect x="0" y="0" width={plotW} height={bottom + 1} />
				</clipPath>
				<pattern
					id="gap-{uid}"
					width="6"
					height="6"
					patternUnits="userSpaceOnUse"
					patternTransform="rotate(45)"
				>
					<line class="hatch" x1="0" y1="0" x2="0" y2="6" />
				</pattern>
				{#each drawn as s (s.id)}
					<linearGradient id="fill-{uid}-{s.index}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color={s.color} stop-opacity="0.24" />
						<stop offset="100%" stop-color={s.color} stop-opacity="0.02" />
					</linearGradient>
				{/each}
			</defs>

			{#each yScale.ticks as tick (tick.value)}
				<line class="grid" x1="0" x2={plotW} y1={sy(tick.value)} y2={sy(tick.value)} />
				<text
					class="label"
					x={width}
					y={sy(tick.value)}
					text-anchor="end"
					dominant-baseline="middle">{tick.text}</text
				>
			{/each}

			{#each gaps as g, i (i)}
				<rect
					x={g.x}
					y={TOP}
					width={Math.max(0, g.w)}
					height={bottom - TOP}
					fill="url(#gap-{uid})"
				/>
			{/each}

			{#each zones as z, i (i)}
				<rect class="zone zone--{z.tone}" x="0" y={z.y} width={plotW} height={Math.max(0, z.h)} />
				<line class="zone-edge zone-edge--{z.tone}" x1="0" x2={plotW} y1={z.line} y2={z.line} />
			{/each}

			{#each tinted as b, i (i)}
				<rect
					class="incident incident--{b.tone ?? 'error'}"
					x={b.x}
					y={TOP}
					width={b.w}
					height={bottom - TOP}
				/>
				<rect
					class="incident-mark incident-mark--{b.tone ?? 'error'}"
					x={b.x}
					y={bottom - 1}
					width={b.w}
					height="3"
				/>
			{/each}

			<g clip-path="url(#plot-{uid})">
				{#each drawn as s (s.id)}
					<g class="series" class:series--dim={emphasis !== null && emphasis !== s.id}>
						{#if display === 'stacked'}
							{#each s.blocks as b, i (i)}
								<rect
									class="bar"
									x={b.x - barW / 2}
									y={b.top}
									width={barW}
									height={Math.max(0, b.bottom - b.top)}
									fill={s.color}
								/>
							{/each}
						{:else if display === 'bars'}
							{#each s.pts as p, i (i)}
								<rect
									class="bar"
									x={p[0] - barW / 2}
									y={p[1]}
									width={barW}
									height={Math.max(0, bottom - p[1])}
									fill={s.color}
								/>
							{/each}
						{:else}
							{#if s.area && display === 'stackedAreas'}
								<path class="layer" d={s.area} fill={s.color} />
							{:else if s.area}
								<path d={s.area} fill="url(#fill-{uid}-{s.index})" />
							{/if}
							{#each s.bridges as b, i (i)}
								<line class="bridge" x1={b[0]} y1={b[1]} x2={b[2]} y2={b[3]} stroke={s.color} />
							{/each}
							<path
								class="line"
								class:line--dashed={s.dashed}
								class:line--strong={emphasis === s.id}
								d={s.line}
								stroke={s.color}
							/>
						{/if}
					</g>
				{/each}
			</g>

			{#each marks as m, i (i)}
				<line class="event" x1={m.x} x2={m.x} y1={TOP - 4} y2={bottom} stroke={m.color} />
				<rect
					x={m.x - 3}
					y={TOP - 7}
					width="6"
					height="6"
					rx="1.5"
					fill={m.color}
					transform="rotate(45 {m.x} {TOP - 4})"
				/>
			{/each}

			{#each peakMarks as k, i (i)}
				<circle class="peak" cx={k.x} cy={k.y} r="3" fill={k.color} />
				<text
					class="peak-text"
					x={Math.min(Math.max(k.x, 24), plotW - 24)}
					y={Math.max(k.y - 8, TOP + 8)}
					text-anchor="middle">{k.text}</text
				>
			{/each}

			{#each rings as r, i (i)}
				<circle class="ring" cx={r.x} cy={r.y} r="7" />
			{/each}

			{#if drag}
				<rect
					class="band"
					x={Math.min(drag.from, drag.to)}
					y={TOP}
					width={Math.abs(drag.to - drag.from)}
					height={bottom - TOP}
				/>
			{/if}

			{#if crosshair !== null}
				<line class="cross" x1={crosshair} x2={crosshair} y1={TOP} y2={bottom} />
				{#if !drag}
					{#each readings as r (r.id)}
						<circle
							class="knob"
							class:knob--dim={emphasis !== null && emphasis !== r.id}
							cx={crosshair}
							cy={r.y}
							r="3.5"
							fill={r.color}
						/>
					{/each}
				{/if}
			{/if}

			{#each xTicks as tick (tick.t)}
				<text
					class="label"
					class:label--hidden={crosshair !== null && Math.abs(tick.x - crosshair) < pillW / 2 + 24}
					x={tick.x}
					y={h - 6}
					text-anchor="middle">{tick.text}</text
				>
			{/each}

			{#if crosshair !== null}
				{@const px = Math.min(Math.max(crosshair - pillW / 2, 0), plotW - pillW)}
				<rect class="pill" x={px} y={h - 19} width={pillW} height="17" rx="8.5" />
				<text class="pill-text" x={px + pillW / 2} y={h - 6} text-anchor="middle">{pillText}</text>
			{/if}
		</svg>

		{#if pointer && crosshair !== null && !drag && (nearest || nearMarks.length || nearRings.length || nearBands.length)}
			{@const left = crosshair > plotW * 0.62}
			<div
				class="tip"
				class:tip--left={left}
				style:left="{left ? crosshair - 10 : crosshair + 10}px"
				style:top="{TOP}px"
			>
				{#if nearest}
					<span class="tip-row">
						<span class="tip-swatch" style:background={nearest.color}></span>
						<span class="tip-name">{nearest.label}</span>
						<span class="tip-value">{formatY(nearest.v)}</span>
					</span>
				{/if}
				{#each nearMarks as m, i (i)}
					<span class="tip-row tip-row--note">
						<span class="tip-swatch tip-swatch--event" style:background={m.color}></span>
						<span class="tip-note">
							{m.label}
							{#if m.detail || m.actor}
								<span class="tip-detail"
									>{[m.detail, m.actor ? `by ${m.actor}` : null].filter(Boolean).join(' · ')}</span
								>
							{/if}
						</span>
					</span>
				{/each}
				{#each nearBands as b, i (i)}
					<span class="tip-row tip-row--note">
						<span class="tip-swatch tip-swatch--band tip-swatch--{b.tone ?? 'error'}"></span>
						<span class="tip-note">{b.label}</span>
					</span>
				{/each}
				{#each nearRings as r, i (i)}
					<span class="tip-row tip-row--note">
						<span class="tip-swatch tip-swatch--finding"></span>
						<span class="tip-note">{r.label}</span>
					</span>
				{/each}
			</div>
		{/if}

		<div
			class="hit"
			style:width="{plotW}px"
			style:height="{bottom}px"
			onpointermove={move}
			onpointerdown={down}
			onpointerup={up}
			onpointercancel={up}
			onpointerleave={leave}
		></div>
	{/if}
</div>

<style>
	.chart {
		--chart-label-size: 11px;
		--chart-ground: var(--bg-surface);
		position: relative;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		font-size: var(--chart-label-size);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		user-select: none;
	}
	svg {
		position: absolute;
		inset: 0;
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--border-default);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}
	.hatch {
		stroke: var(--border-default);
		stroke-width: 1;
	}
	.label {
		fill: var(--text-faint);
	}
	.label--hidden {
		visibility: hidden;
	}
	.series {
		transition: opacity var(--dur-fast) ease;
	}
	.series--dim {
		opacity: 0.22;
	}
	.line {
		fill: none;
		stroke-width: 1.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.line--strong {
		stroke-width: 2.25;
	}
	.line--dashed {
		stroke-dasharray: 3 3;
	}
	.bar {
		opacity: 0.85;
	}
	.layer {
		opacity: 0.3;
	}
	.event {
		stroke-width: 1;
		stroke-dasharray: 2 3;
		opacity: 0.8;
	}
	.zone--warning {
		fill: color-mix(in oklab, var(--status-warning-solid) 9%, transparent);
	}
	.zone--error {
		fill: color-mix(in oklab, var(--status-error-solid) 10%, transparent);
	}
	.zone-edge {
		stroke-width: 1;
		stroke-dasharray: 4 3;
		shape-rendering: crispEdges;
	}
	.zone-edge--warning {
		stroke: color-mix(in oklab, var(--status-warning-solid) 55%, transparent);
	}
	.zone-edge--error {
		stroke: color-mix(in oklab, var(--status-error-solid) 55%, transparent);
	}
	.incident--error {
		fill: color-mix(in oklab, var(--status-error-solid) 13%, transparent);
	}
	.incident--warning {
		fill: color-mix(in oklab, var(--status-warning-solid) 12%, transparent);
	}
	.incident-mark--error {
		fill: var(--status-error-solid);
	}
	.incident-mark--warning {
		fill: var(--status-warning-solid);
	}
	.bridge {
		stroke-width: 1.25;
		stroke-dasharray: 2 4;
		opacity: 0.6;
	}
	.peak {
		stroke: var(--chart-ground);
		stroke-width: 1.5;
	}
	.peak-text {
		fill: var(--text-default);
		font-weight: var(--weight-medium);
	}
	.ring {
		fill: none;
		stroke: var(--status-warning-solid);
		stroke-width: 1.5;
	}
	.cross {
		stroke: color-mix(in oklab, var(--text-default) 45%, transparent);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}
	.knob {
		stroke: var(--chart-ground);
		stroke-width: 2;
	}
	.knob--dim {
		opacity: 0.3;
	}
	.band {
		fill: color-mix(in oklab, var(--text-default) 8%, transparent);
		stroke: color-mix(in oklab, var(--text-default) 22%, transparent);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}
	.pill {
		fill: var(--text-default);
	}
	.pill-text {
		fill: var(--bg-surface);
		font-weight: var(--weight-medium);
	}
	.tip {
		position: absolute;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-width: 18rem;
		padding: 0.375rem 0.5rem;
		border-radius: calc(0.5rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-raised);
		box-shadow:
			inset 0 0 0 0.5px var(--border-strong),
			var(--shadow-floating);
		color: var(--text-default);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		pointer-events: none;
	}
	.tip--left {
		translate: -100% 0;
	}
	.tip-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		white-space: nowrap;
	}
	.tip-row--note {
		align-items: flex-start;
		white-space: normal;
	}
	.tip-swatch {
		flex-shrink: 0;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 2px;
	}
	.tip-row--note .tip-swatch {
		margin-top: 0.25rem;
	}
	.tip-swatch--event {
		rotate: 45deg;
		border-radius: 1px;
	}
	.tip-swatch--band {
		border-radius: 1px;
	}
	.tip-swatch--error {
		background: var(--status-error-solid);
	}
	.tip-swatch--warning {
		background: var(--status-warning-solid);
	}
	.tip-swatch--finding {
		border-radius: 50%;
		box-shadow: inset 0 0 0 1.5px var(--status-warning-solid);
	}
	.tip-name {
		overflow: hidden;
		color: var(--text-muted);
		text-overflow: ellipsis;
	}
	.tip-value {
		margin-left: auto;
		padding-left: 0.5rem;
		font-weight: var(--weight-medium);
	}
	.tip-note {
		color: var(--text-default);
	}
	.tip-detail {
		display: block;
		color: var(--text-muted);
	}
	.hit {
		position: absolute;
		top: 0;
		left: 0;
		touch-action: pan-y;
	}
	.chart--zoomable .hit {
		cursor: crosshair;
	}
</style>

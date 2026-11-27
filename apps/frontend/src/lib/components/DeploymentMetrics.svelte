<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { apiFetch, selectedOrganization, subscribeOrgEvents } from '$lib/stores';
	import {
		demoResourceSeries,
		demoResourceSeriesByPod,
		demoHttpMetrics
	} from '$lib/utils/observe-demo';
	import { METRIC_COLORS_LIGHT, METRIC_COLORS_DARK, type MetricId } from '$lib/utils/metric-colors';
	import {
		Activity,
		Cpu,
		MemoryStick,
		ArrowDown,
		ArrowUp,
		Maximize2,
		X,
		Pause,
		Play,
		CalendarRange
	} from 'lucide-svelte';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import { statusMeta } from '$lib/components/ui/status';

	type Props = {
		kind: 'deployment' | 'database';
		id: string | null;
		active?: boolean;
		showTitle?: boolean;
		showHeader?: boolean;
		source?: 'resources' | 'http';
		windowMs?: number;
		paused?: boolean;
		groupBy?: 'none' | 'pod';
	};
	let {
		kind,
		id: entityId,
		active = true,
		showTitle = true,
		showHeader = true,
		source = 'resources',
		windowMs = $bindable(60 * 60 * 1000),
		paused = $bindable(false),
		groupBy = $bindable<'none' | 'pod'>('none')
	}: Props = $props();

	type QuickRange = {
		id: '5m' | '15m' | '30m' | '1h' | '6h' | '24h' | '7d';
		label: string;
		ms: number;
	};
	const QUICK_RANGES: QuickRange[] = [
		{ id: '5m', label: '5m', ms: 5 * 60 * 1000 },
		{ id: '15m', label: '15m', ms: 15 * 60 * 1000 },
		{ id: '30m', label: '30m', ms: 30 * 60 * 1000 },
		{ id: '1h', label: '1h', ms: 60 * 60 * 1000 },
		{ id: '6h', label: '6h', ms: 6 * 60 * 60 * 1000 },
		{ id: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
		{ id: '7d', label: '7d', ms: 7 * 24 * 60 * 60 * 1000 }
	];

	function chooseStep(ms: number): number {
		// Upstream scrapes every 15s, so 15s is the finest meaningful step
		// for short windows. Coarsen for longer windows to keep point
		// counts manageable.
		if (ms <= 30 * 60 * 1000) return 15_000; // ≤30m: 15s
		if (ms <= 60 * 60 * 1000) return 30_000; // ≤1h: 30s
		if (ms <= 6 * 60 * 60 * 1000) return 60_000; // ≤6h: 1m
		if (ms <= 24 * 60 * 60 * 1000) return 5 * 60_000; // ≤24h: 5m
		return 30 * 60_000; // 7d+: 30m
	}

	let customStart = $state<number | null>(null);
	let customEnd = $state<number | null>(null);
	let now = $state(Date.now());
	let expandedCardId = $state<'cpu' | 'mem' | 'rx' | 'tx' | null>(null);
	let crosshairX = $state<number | null>(null);
	let hoveringChart = $state(false);
	let grouped = $state<Record<MetricId, { key: string; points: Series }[]>>({
		cpu: [],
		mem: [],
		rx: [],
		tx: []
	});
	const GROUP_HUES = [
		'--hue-blue',
		'--hue-amber',
		'--hue-violet',
		'--hue-emerald',
		'--hue-pink',
		'--hue-slate'
	];
	function groupColor(i: number): string {
		if (typeof window === 'undefined') return '';
		const root = getComputedStyle(document.documentElement);
		return (
			root.getPropertyValue(GROUP_HUES[i % GROUP_HUES.length]).trim() ||
			root.getPropertyValue('--hue-slate').trim()
		);
	}
	const podKeys = $derived(
		[...new Set(Object.values(grouped).flatMap((g) => g.map((s) => s.key)))].sort()
	);
	const canGroup = $derived(kind === 'deployment' && source === 'resources');
	let brushFrom = $state<number | null>(null);
	let brushTo = $state<number | null>(null);
	let brushEl = $state<HTMLDivElement | null>(null);
	let brushDrag: {
		mode: 'move' | 'from' | 'to' | 'new';
		originX: number;
		from: number;
		to: number;
	} | null = null;
	let Line: any = $state(null);
	let chartReady = $state(false);
	let showCustom = $state(false);
	let customStartInput = $state('');
	let customEndInput = $state('');
	let customError = $state<string | null>(null);

	const windowEnd = $derived(customEnd ?? now);
	const windowStart = $derived(customStart ?? windowEnd - windowMs);
	const effectiveWindowMs = $derived(windowEnd - windowStart);
	const step = $derived(chooseStep(effectiveWindowMs));
	const isCustom = $derived(customStart != null && customEnd != null);
	const isLive = $derived(!paused && !isCustom);

	type Series = { x: number; y: number }[];
	type MetricCard = {
		id: MetricId;
		label: string;
		icon: any;
		formatter: (v: number) => string;
	};

	let isDark = $state(false);
	$effect(() => {
		if (!browser) return;
		const el = document.documentElement;
		const update = () => (isDark = el.classList.contains('dark'));
		update();
		const mo = new MutationObserver(update);
		mo.observe(el, { attributes: true, attributeFilter: ['class'] });
		return () => mo.disconnect();
	});

	function colorOf(id: MetricId): string {
		return isDark ? METRIC_COLORS_DARK[id] : METRIC_COLORS_LIGHT[id];
	}

	let tip = $state<{ id: MetricId; x: number; y: number } | null>(null);

	const RESOURCE_CARDS: MetricCard[] = [
		{
			id: 'cpu',
			label: 'CPU usage',
			icon: Cpu,
			formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} cores` : `${v.toFixed(0)}m`)
		},
		{
			id: 'mem',
			label: 'Memory',
			icon: MemoryStick,
			formatter: (v) => (v >= 1024 ? `${(v / 1024).toFixed(2)} GB` : `${v.toFixed(0)} MB`)
		},
		{
			id: 'rx',
			label: 'Network in',
			icon: ArrowDown,
			formatter: (v) => (v >= 1024 ? `${(v / 1024).toFixed(2)} MB/s` : `${v.toFixed(0)} KB/s`)
		},
		{
			id: 'tx',
			label: 'Network out',
			icon: ArrowUp,
			formatter: (v) => (v >= 1024 ? `${(v / 1024).toFixed(2)} MB/s` : `${v.toFixed(0)} KB/s`)
		}
	];

	const HTTP_CARDS: MetricCard[] = [
		{
			id: 'req',
			label: 'Requests',
			icon: Activity,
			formatter: (v) => `${v.toFixed(v >= 10 ? 0 : 1)}/s`
		},
		{ id: 'err', label: 'Error rate', icon: Activity, formatter: (v) => `${v.toFixed(2)}%` },
		{
			id: 'lat',
			label: 'Avg latency',
			icon: Activity,
			formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v.toFixed(0)} ms`)
		},
		{
			id: 'latmax',
			label: 'Max latency',
			icon: Activity,
			formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v.toFixed(0)} ms`)
		}
	];

	const CARDS = $derived(source === 'http' ? HTTP_CARDS : RESOURCE_CARDS);
	let lastCardKey = '';
	$effect(() => {
		const key = CARDS.map((c) => c.id).join(',');
		if (key === lastCardKey) return;
		lastCardKey = key;
		untrack(() => {
			series = Object.fromEntries(CARDS.map((c) => [c.id, []])) as Record<MetricId, Series>;
			grouped = Object.fromEntries(CARDS.map((c) => [c.id, []])) as any;
		});
	});
	const EMPTY_SERIES = $derived(
		Object.fromEntries(CARDS.map((c) => [c.id, []])) as Record<MetricId, Series>
	);

	const expandedCard = $derived(
		expandedCardId ? (CARDS.find((c) => c.id === expandedCardId) ?? null) : null
	);

	let series = $state<Record<MetricId, Series>>({ cpu: [], mem: [], rx: [], tx: [] } as any);
	let initialLoading = $state(false);
	let loaded = $state(false);
	let fetchError = $state<string | null>(null);
	let fetchSeq = 0;
	const hasData = $derived(CARDS.some((card) => (series[card.id] ?? []).length > 0));

	const demo = $derived($page.url.searchParams.has('demo'));

	async function loadSeries(start: number, end: number, stepMs: number, id: string) {
		if (!id) return;
		if (demo) {
			if (source === 'http') {
				const h = demoHttpMetrics(start, end, stepMs);
				grouped = EMPTY_SERIES as any;
				series = {
					req: h.requestRate,
					err: h.errorRate,
					lat: h.latencyAvg,
					latmax: h.latencyMax
				} as Record<MetricId, Series>;
				fetchError = null;
				loaded = true;
				initialLoading = false;
				return;
			}
			if (groupBy === 'pod') {
				const g = demoResourceSeriesByPod(start, end, stepMs);
				grouped = g;
				series = {
					cpu: mergeGrouped(g.cpu),
					mem: mergeGrouped(g.mem),
					rx: mergeGrouped(g.rx),
					tx: mergeGrouped(g.tx)
				};
			} else {
				grouped = { cpu: [], mem: [], rx: [], tx: [] };
				series = demoResourceSeries(start, end, stepMs);
			}
			fetchError = null;
			loaded = true;
			initialLoading = false;
			return;
		}
		const seq = ++fetchSeq;
		if (!loaded && !fetchError) initialLoading = true;
		try {
			const groupParam = groupBy === 'pod' ? '&groupBy=pod' : '';
			const url =
				source === 'http'
					? `/apiv1/observe/deployments/${encodeURIComponent(id)}/http-metrics?start=${start}&end=${end}&step=${stepMs}`
					: `/apiv1/${kind === 'database' ? 'databases' : 'deployments'}/${encodeURIComponent(id)}/metrics?start=${start}&end=${end}&step=${stepMs}${groupParam}`;
			const res = await apiFetch(url);
			if (!res.ok) {
				const detail = await res.json().catch(() => null);
				throw new Error(
					res.status === 503 ? 'Metrics store unreachable' : detail?.message || `HTTP ${res.status}`
				);
			}
			const body = await res.json();
			if (seq !== fetchSeq) return;
			if (source === 'http') {
				grouped = EMPTY_SERIES as any;
				series = {
					req: body?.requestRate ?? [],
					err: body?.errorRate ?? [],
					lat: body?.latencyAvg ?? [],
					latmax: body?.latencyMax ?? []
				} as Record<MetricId, Series>;
				fetchError = null;
				loaded = true;
				return;
			}
			if (body?.groupBy === 'pod' && body?.grouped) {
				grouped = body.grouped;
				series = {
					cpu: mergeGrouped(body.grouped.cpu),
					mem: mergeGrouped(body.grouped.mem),
					rx: mergeGrouped(body.grouped.rx),
					tx: mergeGrouped(body.grouped.tx)
				};
			} else {
				grouped = { cpu: [], mem: [], rx: [], tx: [] };
				series = body?.data ?? { cpu: [], mem: [], rx: [], tx: [] };
			}
			fetchError = null;
			loaded = true;
		} catch (err) {
			if (seq !== fetchSeq) return;
			fetchError = (err as Error).message;
		} finally {
			if (seq === fetchSeq) initialLoading = false;
		}
	}

	$effect(() => {
		const start = windowStart;
		const end = windowEnd;
		const s = step;
		const id = entityId;
		void groupBy;
		if (!id || !active) return;
		untrack(() => {
			// A stale crosshair timestamp from a wider range falls outside
			// a narrower one and the plugin silently skips drawing it.
			if (crosshairX != null && (crosshairX < start || crosshairX > end)) {
				crosshairX = null;
			}
			loadSeries(start, end, s, id);
		});
	});

	function shortPod(name: string): string {
		const parts = name.split('-');
		return parts.length > 1 ? parts[parts.length - 1] : name;
	}

	function mergeGrouped(g: { key: string; points: Series }[] | undefined): Series {
		if (!g?.length) return [];
		const acc = new Map<number, number>();
		for (const s of g) for (const p of s.points) acc.set(p.x, (acc.get(p.x) ?? 0) + p.y);
		return [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
	}

	function summarize(s: Series) {
		if (!s.length) return { current: 0, avg: 0, max: 0, p95: 0 };
		const ys = s.map((p) => p.y);
		const sorted = [...ys].sort((a, b) => a - b);
		return {
			current: ys[ys.length - 1],
			avg: ys.reduce((a, b) => a + b, 0) / ys.length,
			max: sorted[sorted.length - 1],
			p95: sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]
		};
	}

	const summaries = $derived(
		Object.fromEntries(CARDS.map((c) => [c.id, summarize(series[c.id] ?? [])])) as Record<
			MetricId,
			ReturnType<typeof summarize>
		>
	);

	// Cached diagonal-hatch CanvasPattern, regenerated when the stroke
	// color changes (light/dark theme switches).
	let hatchPattern: CanvasPattern | null = null;
	let hatchStroke: string | null = null;
	function getHatchPattern(ctx: CanvasRenderingContext2D, stroke: string): CanvasPattern | null {
		if (hatchPattern && hatchStroke === stroke) return hatchPattern;
		const tile = document.createElement('canvas');
		tile.width = 8;
		tile.height = 8;
		const tctx = tile.getContext('2d');
		if (!tctx) return null;
		tctx.strokeStyle = stroke;
		tctx.lineWidth = 1;
		tctx.beginPath();
		tctx.moveTo(-1, 9);
		tctx.lineTo(9, -1);
		tctx.moveTo(-1, 17);
		tctx.lineTo(17, -1);
		tctx.moveTo(-9, 1);
		tctx.lineTo(1, -9);
		tctx.stroke();
		hatchPattern = ctx.createPattern(tile, 'repeat');
		hatchStroke = stroke;
		return hatchPattern;
	}

	// Hatch any region of the visible x-axis that falls outside the
	// available data extent, i.e. before VM started collecting, or after
	// the most recent sample. Communicates "no data here" without lying
	// with a flat zero line.
	const pendingPlugin = {
		id: 'pendingRegions',
		beforeDatasetsDraw(chart: any, _args: any, options: any) {
			if (!options) return;
			const xs = chart.scales?.x;
			const area = chart.chartArea;
			if (!xs || !area) return;
			const { top, bottom } = area;
			const xMin = xs.min as number;
			const xMax = xs.max as number;
			const dataMin = options.dataMin as number | null | undefined;
			const dataMax = options.dataMax as number | null | undefined;
			const pattern = getHatchPattern(chart.ctx, options.stroke ?? 'rgba(120,120,128,0.35)');
			if (!pattern) return;
			chart.ctx.save();
			chart.ctx.fillStyle = pattern;
			// No data at all → hatch the whole area.
			if (dataMin == null || dataMax == null) {
				chart.ctx.fillRect(area.left, top, area.right - area.left, bottom - top);
			} else {
				if (dataMin > xMin) {
					const left = xs.getPixelForValue(xMin);
					const right = xs.getPixelForValue(dataMin);
					if (right > left) chart.ctx.fillRect(left, top, right - left, bottom - top);
				}
				if (dataMax < xMax) {
					const left = xs.getPixelForValue(dataMax);
					const right = xs.getPixelForValue(xMax);
					if (right > left) chart.ctx.fillRect(left, top, right - left, bottom - top);
				}
			}
			chart.ctx.restore();
		}
	};

	// Track every Chart instance so a hover on one redraws the crosshair
	// on all of them.
	const chartInstances: Set<any> = new Set();

	const crosshairPlugin = {
		id: 'crosshair',
		afterDraw(chart: any) {
			if (crosshairX == null) return;
			const xs = chart.scales?.x;
			const area = chart.chartArea;
			if (!xs || !area) return;
			if (crosshairX < xs.min || crosshairX > xs.max) return;
			const px = xs.getPixelForValue(crosshairX);
			const ctx = chart.ctx;
			ctx.save();
			ctx.strokeStyle = 'rgba(120, 120, 128, 0.6)';
			ctx.lineWidth = 1;
			ctx.setLineDash([3, 3]);
			ctx.beginPath();
			ctx.moveTo(px, area.top);
			ctx.lineTo(px, area.bottom);
			ctx.stroke();
			ctx.restore();
		}
	};

	const trackPlugin = {
		id: 'track-instance',
		afterInit(chart: any) {
			chartInstances.add(chart);
		},
		beforeDestroy(chart: any) {
			chartInstances.delete(chart);
		}
	};

	function redrawAll() {
		for (const c of chartInstances) {
			try {
				c.render();
			} catch {
				/* no-op */
			}
		}
	}

	function findChartFor(canvas: HTMLCanvasElement) {
		for (const c of chartInstances) {
			if (c.canvas === canvas) return c;
		}
		return null;
	}

	if (browser) {
		Promise.all([import('chart.js'), import('svelte5-chartjs')])
			.then(([{ Chart, LinearScale, PointElement, LineElement, Filler, Decimation }, mod]) => {
				Chart.register(
					LinearScale,
					PointElement,
					LineElement,
					Filler,
					Decimation,
					crosshairPlugin,
					trackPlugin,
					pendingPlugin
				);
				Line = mod.Line;
				chartReady = true;
			})
			.catch(() => {});
	}

	let tickHandle: ReturnType<typeof setInterval> | null = null;
	$effect(() => {
		if (!isLive || !active) return;
		// 15s matches the upstream scrape interval: no point refetching faster.
		tickHandle = setInterval(() => {
			if (hoveringChart || brushActive) return;
			now = Date.now();
		}, 15_000);
		return () => {
			if (tickHandle) {
				clearInterval(tickHandle);
				tickHandle = null;
			}
		};
	});

	// Fresh-scrape push: the metrics pusher emits deployment.metrics on the org
	// bus right after new samples land, so the chart refreshes the moment data
	// exists instead of on the next 15s tick (which stays as the fallback).
	$effect(() => {
		if (!isLive || !active || kind === 'database') return;
		const orgId = $selectedOrganization?.id;
		const id = entityId;
		if (!orgId || !id) return;
		return subscribeOrgEvents(orgId, (ev) => {
			if (ev.type === 'deployment.metrics' && ev.id === id) {
				if (hoveringChart || brushActive) return;
				now = Date.now();
			}
		});
	});
	// A pointer that leaves via tab switch or window blur never fires
	// pointerleave, so the hover freeze would strand live updates. Re-arm on
	// blur; the next pointermove sets it again.
	$effect(() => {
		if (!browser) return;
		const release = () => {
			hoveringChart = false;
		};
		window.addEventListener('blur', release);
		document.addEventListener('visibilitychange', release);
		return () => {
			window.removeEventListener('blur', release);
			document.removeEventListener('visibilitychange', release);
		};
	});

	onDestroy(() => {
		if (tickHandle) clearInterval(tickHandle);
	});

	function pendingExtent(s: Series): {
		dataMin: number | null;
		dataMax: number | null;
		stroke: string;
	} {
		const stroke = 'rgba(120,120,128,0.35)';
		if (!s?.length) return { dataMin: null, dataMax: null, stroke };
		return { dataMin: s[0].x, dataMax: s[s.length - 1].x, stroke };
	}

	function chartData(card: MetricCard, style: 'flat' | 'gradient' = 'flat') {
		const col = colorOf(card.id);
		const backgroundColor =
			style === 'flat'
				? col + '22'
				: (context: any) => {
						const { ctx, chartArea } = context.chart;
						if (!chartArea) return col + '33';
						const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
						g.addColorStop(0, col + '4d');
						g.addColorStop(1, col + '00');
						return g;
					};
		const g = grouped[card.id];
		if (groupBy === 'pod' && g?.length) {
			return {
				datasets: g.map((s, i) => ({
					label: s.key,
					data: s.points as any,
					borderColor: groupColor(i),
					backgroundColor: 'transparent',
					borderWidth: 1.75,
					pointRadius: 0,
					pointHoverRadius: 0,
					fill: false,
					tension: 0.25,
					spanGaps: true
				}))
			};
		}
		return {
			datasets: [
				{
					data: (series[card.id] ?? []) as any,
					borderColor: col,
					backgroundColor,
					borderWidth: style === 'gradient' ? 2 : 1.5,
					pointRadius: 0,
					pointHoverRadius: 0,
					fill: true,
					tension: style === 'gradient' ? 0.3 : 0.25,
					spanGaps: true
				}
			]
		};
	}

	function chartOptions(
		card: MetricCard,
		opts: { xTicks?: boolean; dense?: boolean; mini?: boolean; from?: number; to?: number } = {}
	) {
		return {
			responsive: true,
			maintainAspectRatio: false,
			animation: false as const,
			parsing: false as const,
			normalized: true,
			events: [] as any, // we drive hover ourselves at the wrapper level
			plugins: {
				legend: { display: false },
				tooltip: { enabled: false },
				decimation: { enabled: true, algorithm: 'lttb' as const, samples: 200 },
				pendingRegions: pendingExtent(series[card.id] ?? [])
			},
			scales: {
				x: {
					type: 'linear' as const,
					min: opts.from ?? windowStart,
					max: opts.to ?? windowEnd,
					ticks: {
						display: !opts.mini && opts.xTicks !== false,
						color: 'rgba(140,140,150,0.85)',
						maxRotation: 0,
						autoSkip: true,
						maxTicksLimit: 6,
						callback: (v: any) => formatTick(v as number)
					},
					grid: opts.dense || opts.mini ? { display: false } : { color: 'rgba(120,120,128,0.08)' }
				},
				y: {
					beginAtZero: true,
					ticks: {
						display: !opts.mini,
						color: 'rgba(140,140,150,0.85)',
						maxTicksLimit: 4,
						callback: (v: any, i: number, arr: any[]) => {
							const label = card.formatter(v as number);
							if (i > 0 && card.formatter(arr[i - 1].value as number) === label) return undefined;
							return label;
						}
					},
					grid: opts.mini ? { display: false } : { color: 'rgba(120,120,128,0.08)' }
				}
			}
		};
	}

	const viewFrom = $derived(brushFrom ?? windowStart);
	const viewTo = $derived(brushTo ?? windowEnd);
	const brushActive = $derived(brushFrom != null && brushTo != null);

	function clipSeries(s: Series, from: number, to: number): Series {
		if (!s?.length) return s ?? [];
		return s.filter((p) => p.x >= from && p.x <= to);
	}

	function resetBrush() {
		brushFrom = null;
		brushTo = null;
	}

	function brushPlot(): { left: number; width: number } | null {
		const el = brushEl;
		if (!el) return null;
		const canvas = el.querySelector('canvas') as HTMLCanvasElement | null;
		const chart = canvas ? findChartFor(canvas) : null;
		const track = el.getBoundingClientRect();
		if (!chart?.chartArea || !canvas) return { left: 0, width: track.width };
		const cr = canvas.getBoundingClientRect();
		const offset = cr.left - track.left;
		return {
			left: offset + chart.chartArea.left,
			width: Math.max(1, chart.chartArea.right - chart.chartArea.left)
		};
	}

	function pxToTime(clientX: number): number {
		const el = brushEl;
		const plot = brushPlot();
		if (!el || !plot) return windowStart;
		const r = el.getBoundingClientRect();
		const ratio = Math.min(1, Math.max(0, (clientX - r.left - plot.left) / plot.width));
		return windowStart + ratio * (windowEnd - windowStart);
	}

	function timeToPct(t: number): number {
		const span = windowEnd - windowStart;
		if (span <= 0) return 0;
		const plot = brushPlot();
		const el = brushEl;
		const ratio = (t - windowStart) / span;
		if (!plot || !el) return ratio * 100;
		const trackW = el.getBoundingClientRect().width || 1;
		return ((plot.left + ratio * plot.width) / trackW) * 100;
	}

	const MIN_BRUSH_MS = 15_000;

	function startBrush(e: PointerEvent, mode: 'move' | 'from' | 'to' | 'new') {
		e.preventDefault();
		e.stopPropagation();
		try {
			(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
		} catch {
			/* pointer may not be active (synthetic events, cancelled gestures) */
		}
		const t = pxToTime(e.clientX);
		if (mode === 'new') {
			brushFrom = t;
			brushTo = t;
			brushDrag = { mode: 'to', originX: e.clientX, from: t, to: t };
		} else {
			brushDrag = {
				mode,
				originX: e.clientX,
				from: brushFrom ?? windowStart,
				to: brushTo ?? windowEnd
			};
		}
	}

	function moveBrush(e: PointerEvent) {
		const d = brushDrag;
		if (!d) return;
		const t = pxToTime(e.clientX);
		const span = windowEnd - windowStart;
		if (d.mode === 'from') {
			brushFrom = Math.min(t, (brushTo ?? windowEnd) - MIN_BRUSH_MS);
		} else if (d.mode === 'to') {
			brushTo = Math.max(t, (brushFrom ?? windowStart) + MIN_BRUSH_MS);
		} else {
			const deltaRatio = (e.clientX - d.originX) / (brushEl?.getBoundingClientRect().width || 1);
			let nf = d.from + deltaRatio * span;
			let nt = d.to + deltaRatio * span;
			const width = nt - nf;
			if (nf < windowStart) {
				nf = windowStart;
				nt = nf + width;
			}
			if (nt > windowEnd) {
				nt = windowEnd;
				nf = nt - width;
			}
			brushFrom = nf;
			brushTo = nt;
		}
	}

	function endBrush(e: PointerEvent) {
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
		} catch {
			/* capture may already be released */
		}
		if (brushDrag && brushFrom != null && brushTo != null) {
			if (brushTo - brushFrom < MIN_BRUSH_MS) resetBrush();
			else {
				const a = Math.min(brushFrom, brushTo);
				const b = Math.max(brushFrom, brushTo);
				brushFrom = a;
				brushTo = b;
			}
		}
		brushDrag = null;
	}

	$effect(() => {
		void expandedCardId;
		void windowMs;
		untrack(() => resetBrush());
	});

	function formatTick(t: number): string {
		const d = new Date(t);
		const h = String(d.getHours()).padStart(2, '0');
		const m = String(d.getMinutes()).padStart(2, '0');
		if (effectiveWindowMs > 24 * 60 * 60 * 1000)
			return `${d.getMonth() + 1}/${d.getDate()} ${h}:00`;
		if (effectiveWindowMs > 6 * 60 * 60 * 1000)
			return `${d.getMonth() + 1}/${d.getDate()} ${h}:${m}`;
		return `${h}:${m}`;
	}

	function valueAtCrosshair(s: Series): number | null {
		if (crosshairX == null || !s?.length) return null;
		let lo = 0,
			hi = s.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			if (s[mid].x < crosshairX) lo = mid + 1;
			else hi = mid;
		}
		const a = s[Math.max(0, lo - 1)];
		const b = s[lo];
		return Math.abs(a.x - crosshairX) < Math.abs(b.x - crosshairX) ? a.y : b.y;
	}

	function onChartMove(e: PointerEvent, wrapper: HTMLElement, tipId?: MetricId) {
		const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
		if (!canvas) return;
		const chart = findChartFor(canvas);
		if (!chart) return;
		const rect = canvas.getBoundingClientRect();
		const px = e.clientX - rect.left;
		const v = chart.scales?.x?.getValueForPixel(px);
		if (v == null || !isFinite(v)) return;
		hoveringChart = true;
		crosshairX = v;
		if (tipId) {
			const wrect = wrapper.getBoundingClientRect();
			tip = { id: tipId, x: e.clientX - wrect.left, y: e.clientY - wrect.top };
		}
		redrawAll();
	}

	function onChartLeave() {
		tip = null;
		hoveringChart = false;
		if (crosshairX != null) {
			crosshairX = null;
			redrawAll();
		}
	}

	function fmtTipTime(t: number): string {
		const d = new Date(t);
		const pad = (n: number) => String(n).padStart(2, '0');
		if (effectiveWindowMs > 24 * 60 * 60 * 1000) {
			return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
		}
		return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}

	function setQuickRange(ms: number) {
		windowMs = ms;
		customStart = null;
		customEnd = null;
		showCustom = false;
		customError = null;
	}

	function applyCustomRange() {
		const s = customStartInput ? new Date(customStartInput).getTime() : NaN;
		const e = customEndInput ? new Date(customEndInput).getTime() : NaN;
		if (!isFinite(s) || !isFinite(e)) {
			customError = 'Enter a start and an end';
			return;
		}
		if (s >= e) {
			customError = 'The start must be before the end';
			return;
		}
		customStart = s;
		customEnd = e;
		customError = null;
		showCustom = false;
	}

	function clearCustomRange() {
		customStart = null;
		customEnd = null;
		customError = null;
	}

	function togglePause() {
		if (isCustom) {
			clearCustomRange();
			paused = false;
			now = Date.now();
		} else {
			paused = !paused;
			if (!paused) now = Date.now();
		}
	}

	function toLocalInput(ts: number): string {
		const d = new Date(ts);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function toggleCustomPanel() {
		if (showCustom) {
			showCustom = false;
		} else {
			customStartInput = toLocalInput(windowStart);
			customEndInput = toLocalInput(windowEnd);
			showCustom = true;
		}
	}

	function fmtFull(t: number): string {
		return new Date(t).toLocaleString();
	}

	const activeQuickId = $derived.by(() => {
		if (isCustom) return null;
		return QUICK_RANGES.find((r) => r.ms === windowMs)?.id ?? null;
	});
</script>

{#snippet controls()}
	{#if canGroup}
		<div class="metrics-rangepick" role="tablist" aria-label="Group by">
			<button
				class="metrics-rangebtn"
				class:active={groupBy === 'none'}
				onclick={() => (groupBy = 'none')}
				type="button">Total</button
			>
			<button
				class="metrics-rangebtn"
				class:active={groupBy === 'pod'}
				onclick={() => (groupBy = 'pod')}
				type="button">By pod</button
			>
		</div>
	{/if}
	<div class="metrics-rangepick" role="tablist" aria-label="Time range">
		{#each QUICK_RANGES as r (r.id)}
			<button
				class="metrics-rangebtn"
				class:active={activeQuickId === r.id}
				onclick={() => setQuickRange(r.ms)}
				type="button">{r.label}</button
			>
		{/each}
		<button
			class="metrics-rangebtn metrics-rangebtn--icon"
			class:active={isCustom || showCustom}
			onclick={toggleCustomPanel}
			type="button"
			title="Custom range"
			aria-label="Custom range"><CalendarRange class="h-3.5 w-3.5" /></button
		>
	</div>
	<button
		class="metrics-iconbtn"
		onclick={togglePause}
		type="button"
		title={isLive ? 'Pause' : isCustom ? 'Resume live' : 'Resume'}
		aria-label={isLive ? 'Pause' : 'Resume'}
	>
		{#if isLive}<Pause class="h-3.5 w-3.5" />{:else}<Play class="h-3.5 w-3.5" />{/if}
	</button>
{/snippet}

{#snippet customPanel()}
	{#if showCustom}
		<div class="metrics-custompanel" role="group" aria-label="Custom date range">
			<label>
				<span>From</span>
				<input type="datetime-local" bind:value={customStartInput} />
			</label>
			<label>
				<span>To</span>
				<input type="datetime-local" bind:value={customEndInput} />
			</label>
			<div class="metrics-custompanel-actions">
				<button class="btn-mini" type="button" onclick={() => (showCustom = false)}>Cancel</button>
				<button class="btn-mini btn-mini--primary" type="button" onclick={applyCustomRange}
					>Apply</button
				>
				{#if isCustom}
					<button
						class="btn-mini btn-mini--ghost"
						type="button"
						onclick={() => {
							clearCustomRange();
							showCustom = false;
						}}>Clear</button
					>
				{/if}
			</div>
			{#if customError}<div class="metrics-custompanel-error">{customError}</div>{/if}
		</div>
	{/if}
{/snippet}

{#snippet stateBadge()}
	{#if isLive}
		<span class="metrics-badge metrics-badge--live"
			><StatusDot meta={statusMeta('success', 'Live', true)} size={8} />live</span
		>
	{:else if isCustom}
		<span class="metrics-badge metrics-badge--custom">custom</span>
	{:else}
		<span class="metrics-badge metrics-badge--paused">paused</span>
	{/if}
{/snippet}

{#snippet card(c: MetricCard, height: string, showExpand: boolean)}
	{@const Icon = c.icon}
	{@const zoomed = !showExpand && brushActive}
	{@const sum = zoomed
		? summarize(clipSeries(series[c.id] ?? [], viewFrom, viewTo))
		: (summaries[c.id] ?? summarize([]))}
	{@const hover = valueAtCrosshair(series[c.id] ?? [])}
	<article class="metrics-card" style="--accent: {colorOf(c.id)}">
		<div class="metrics-card-head">
			<div class="metrics-card-head-right">
				<div class="metrics-card-now">
					{c.formatter(hover ?? sum.current)}
				</div>
				{#if showExpand}
					<button
						class="metrics-iconbtn metrics-iconbtn--small"
						onclick={() => (expandedCardId = c.id)}
						type="button"
						title="Expand"
						aria-label="Expand {c.label}"><Maximize2 class="h-3 w-3" /></button
					>
				{/if}
			</div>
		</div>
		<div
			class="metrics-card-chart"
			style="height: {height}"
			onpointermove={(e) => onChartMove(e, e.currentTarget, c.id)}
			onpointerleave={onChartLeave}
		>
			{#if chartReady && Line}
				<svelte:component
					this={Line}
					data={chartData(c)}
					options={chartOptions(c, { from: viewFrom, to: viewTo })}
				/>
			{:else}
				<div class="metrics-card-skeleton"></div>
			{/if}
			{@render chartTip(c, 0)}
		</div>
		<dl class="metrics-card-stats">
			<div>
				<dt>avg</dt>
				<dd>{c.formatter(sum.avg)}</dd>
			</div>
			<div>
				<dt>p95</dt>
				<dd>{c.formatter(sum.p95)}</dd>
			</div>
			<div>
				<dt>max</dt>
				<dd>{c.formatter(sum.max)}</dd>
			</div>
		</dl>
	</article>
{/snippet}

{#snippet chartTip(c: MetricCard, wrapperWidth: number)}
	{#if tip && tip.id === c.id && crosshairX != null}
		<div
			class="mtx-tip"
			class:mtx-tip--flip={wrapperWidth > 0 && tip.x > wrapperWidth - 150}
			style="left: {tip.x}px; top: {Math.max(tip.y - 8, 4)}px"
		>
			<span class="mtx-tip-time">{fmtTipTime(crosshairX)}</span>
			{#if groupBy === 'pod' && grouped[c.id]?.length}
				{#each grouped[c.id] as s, i (s.key)}
					<span class="mtx-tip-val">
						<span class="mtx-chip" style="background: {groupColor(i)}"></span>
						<span class="mtx-tip-key">{shortPod(s.key)}</span>
						{c.formatter(valueAtCrosshair(s.points) ?? 0)}
					</span>
				{/each}
			{:else}
				<span class="mtx-tip-val">
					<span class="mtx-chip" style="background: {colorOf(c.id)}"></span>
					{c.formatter(valueAtCrosshair(series[c.id] ?? []) ?? 0)}
				</span>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet boardCell(c: MetricCard)}
	{@const sum = summaries[c.id]}
	<article class="mtx-cell">
		<div class="mtx-cell-head">
			<span class="mtx-chip" style="background: {colorOf(c.id)}"></span>
			<span class="mtx-cell-label">{c.label}</span>
			<span class="mtx-cell-now">{c.formatter(sum.current)}</span>
			<button
				class="metrics-iconbtn metrics-iconbtn--small"
				onclick={() => (expandedCardId = c.id)}
				type="button"
				title="Expand"
				aria-label="Expand {c.label}"><Maximize2 class="h-3 w-3" /></button
			>
		</div>
		<div
			class="mtx-cell-chart"
			onpointermove={(e) => onChartMove(e, e.currentTarget, c.id)}
			onpointerleave={onChartLeave}
		>
			{#if chartReady && Line}
				<svelte:component
					this={Line}
					data={chartData(c, 'gradient')}
					options={chartOptions(c, { dense: true })}
				/>
			{:else}
				<div class="metrics-card-skeleton"></div>
			{/if}
			{@render chartTip(c, 0)}
		</div>
		<div class="mtx-cell-foot">
			<span>avg <b>{c.formatter(sum.avg)}</b></span>
			<span>p95 <b>{c.formatter(sum.p95)}</b></span>
			<span>max <b>{c.formatter(sum.max)}</b></span>
		</div>
	</article>
{/snippet}

{#snippet band(c: MetricCard, isLast: boolean)}
	{@const sum = summaries[c.id]}
	<div class="mtx-band">
		<div class="mtx-band-gutter">
			<div class="mtx-band-label">
				<span class="mtx-chip" style="background: {colorOf(c.id)}"></span>
				{c.label}
			</div>
			<div class="mtx-band-now">{c.formatter(sum.current)}</div>
			<div class="mtx-band-stats">
				<span>avg {c.formatter(sum.avg)}</span>
				<span>p95 {c.formatter(sum.p95)}</span>
				<span>max {c.formatter(sum.max)}</span>
			</div>
		</div>
		<div
			class="mtx-band-chart"
			style="height: {isLast ? '110px' : '88px'}"
			onpointermove={(e) => onChartMove(e, e.currentTarget, c.id)}
			onpointerleave={onChartLeave}
		>
			{#if chartReady && Line}
				<svelte:component
					this={Line}
					data={chartData(c, 'gradient')}
					options={chartOptions(c, { dense: true, xTicks: isLast })}
				/>
			{:else}
				<div class="metrics-card-skeleton"></div>
			{/if}
			{@render chartTip(c, 0)}
		</div>
	</div>
{/snippet}

<div class="metrics-root">
	{#if showHeader}
		<header class="metrics-header">
			<div class="metrics-heading">
				<div class="metrics-title">
					{#if showTitle}
						<Activity class="h-4 w-4" />
						<span>Metrics</span>
					{/if}
				</div>
				<div class="metrics-rangelabel">
					{fmtFull(windowStart)} → {fmtFull(windowEnd)}
				</div>
			</div>
			<div class="metrics-controls">
				{@render controls()}
			</div>
		</header>

		{@render customPanel()}
	{/if}

	{#if initialLoading && !loaded}
		<div class="mtx-board" role="status" aria-label="Loading metrics">
			{#each CARDS as c (c.id)}
				<div class="mtx-cell mtx-loading-cell">
					<span class="mtx-cell-label">{c.label}</span>
					<div class="mtx-loading-chart"><div class="metrics-card-skeleton"></div></div>
				</div>
			{/each}
		</div>
	{:else if !hasData && !fetchError && !loaded}
		<div class="mtx-empty" role="status">
			<p>No {source === 'http' ? 'HTTP' : 'resource'} metrics in this time range</p>
			{#if source === 'http'}
				<span>Metrics appear here once requests reach this app.</span>
			{/if}
		</div>
	{:else if !hasData && fetchError && !loaded}
		<div class="mtx-empty" role="alert">
			<p>
				{fetchError === 'Metrics store unreachable'
					? 'Metrics store unreachable'
					: "Couldn't load metrics"}
			</p>
			{#if fetchError !== 'Metrics store unreachable'}<span>{fetchError}</span>{/if}
		</div>
	{:else}
		<div class="mtx-board">
			{#each CARDS as c (c.id)}
				{@render boardCell(c)}
			{/each}
		</div>
	{/if}

	<p class="metrics-foot">
		{#if fetchError}
			<span class="metrics-foot-err">Couldn't load metrics: {fetchError}</span>
		{:else if initialLoading}
			Loading…
		{:else}
			Live from <code>victoriametrics.orchard-metrics</code> · {source === 'http'
				? 'HAProxy'
				: 'cAdvisor'}
		{/if}
	</p>
</div>

{#if expandedCard}
	<div class="metrics-modal-backdrop" role="presentation" onclick={() => (expandedCardId = null)}>
		<div
			class="metrics-modal"
			role="dialog"
			aria-modal="true"
			aria-label="{expandedCard.label} expanded"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				if (e.key === 'Escape') expandedCardId = null;
			}}
		>
			<header class="metrics-modal-head">
				<div class="metrics-title">
					<Activity class="h-4 w-4" style="color: {colorOf(expandedCard.id)}" />
					<span>{expandedCard.label}</span>
				</div>
				<div class="metrics-controls">
					{@render controls()}
					<button
						class="metrics-iconbtn"
						onclick={() => (expandedCardId = null)}
						type="button"
						aria-label="Close"><X class="h-4 w-4" /></button
					>
				</div>
			</header>

			{@render customPanel()}

			<div class="metrics-rangelabel metrics-rangelabel--modal">
				{fmtFull(windowStart)} → {fmtFull(windowEnd)}
			</div>

			<div class="metrics-modal-body">
				{@render card(expandedCard, '420px', false)}
			</div>

			{#if groupBy === 'pod' && podKeys.length}
				<div class="mtx-legend">
					{#each podKeys as key, i (key)}
						<span class="mtx-legend-item">
							<span class="mtx-legend-swatch" style="background:{groupColor(i)}"></span>
							<span class="mtx-legend-name">{key}</span>
						</span>
					{/each}
				</div>
			{/if}

			<div class="mtx-brush">
				<div class="mtx-brush-head">
					<span class="mtx-brush-label">
						{#if brushActive}
							Showing {fmtFull(viewFrom)} to {fmtFull(viewTo)}
						{:else}
							Drag below to zoom into a range
						{/if}
					</span>
					{#if brushActive}
						<button class="mtx-brush-reset" type="button" onclick={resetBrush}>Reset zoom</button>
					{/if}
				</div>
				<div
					class="mtx-brush-track"
					bind:this={brushEl}
					role="slider"
					tabindex="0"
					aria-label="Zoom range"
					aria-valuemin={windowStart}
					aria-valuemax={windowEnd}
					aria-valuenow={viewFrom}
					onpointerdown={(e) => startBrush(e, 'new')}
					onpointermove={moveBrush}
					onpointerup={endBrush}
					onpointercancel={endBrush}
				>
					{#if chartReady && Line}
						<svelte:component
							this={Line}
							data={chartData(expandedCard, 'gradient')}
							options={chartOptions(expandedCard, { mini: true })}
						/>
					{/if}
					{#if brushActive}
						<div
							class="mtx-brush-mask"
							style="left:0; width:{Math.max(0, timeToPct(viewFrom))}%"
						></div>
						<div
							class="mtx-brush-mask"
							style="left:{Math.min(100, timeToPct(viewTo))}%; right:0"
						></div>
						<div
							class="mtx-brush-window"
							style="left:{timeToPct(viewFrom)}%; width:{Math.max(
								0.5,
								timeToPct(viewTo) - timeToPct(viewFrom)
							)}%"
							onpointerdown={(e) => startBrush(e, 'move')}
						>
							<span
								class="mtx-brush-handle mtx-brush-handle--from"
								onpointerdown={(e) => startBrush(e, 'from')}
							></span>
							<span
								class="mtx-brush-handle mtx-brush-handle--to"
								onpointerdown={(e) => startBrush(e, 'to')}
							></span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.metrics-root {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.metrics-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.metrics-heading {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}
	.metrics-controls {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.metrics-title {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
		font-size: var(--text-headline);
		line-height: var(--lh-headline);
		color: var(--text-default);
	}

	.metrics-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-pill);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
	}
	.metrics-badge--live {
		background-color: var(--status-success-bg);
		color: var(--status-success);
	}
	.metrics-badge--paused {
		background-color: var(--status-warning-bg);
		color: var(--status-warning);
	}
	.metrics-badge--custom {
		background-color: var(--status-info-bg);
		color: var(--status-info);
	}

	.metrics-rangepick {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		padding: 0.25rem;
		border-radius: var(--radius-md);
		background-color: var(--bg-sunken);
		border: 1px solid var(--border-default);
	}
	.metrics-rangebtn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-width: 2rem;
		padding: 0.3125rem var(--space-3);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		border: 0;
		background: none;
		color: var(--text-muted);
		border-radius: var(--radius-xs);
		cursor: pointer;
		transition:
			background-color var(--dur-fast) var(--ease-out),
			color var(--dur-fast) var(--ease-out);
	}
	.metrics-rangebtn--icon {
		padding: 0.3125rem var(--space-2);
	}
	.metrics-rangebtn:hover {
		color: var(--text-default);
	}
	.metrics-rangebtn.active {
		background-color: var(--bg-surface);
		color: var(--text-default);
		box-shadow: var(--elev-1);
	}

	.metrics-iconbtn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.875rem;
		height: 1.875rem;
		padding: 0;
		border-radius: var(--radius-sm);
		border: 0;
		cursor: pointer;
		background-color: var(--fill-soft);
		color: var(--text-muted);
		transition:
			background-color var(--dur-fast) var(--ease-out),
			color var(--dur-fast) var(--ease-out);
	}
	.metrics-iconbtn:hover {
		background-color: var(--fill-medium);
		color: var(--text-default);
	}
	.metrics-iconbtn--small {
		width: 1.375rem;
		height: 1.375rem;
	}

	.metrics-rangelabel {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		color: var(--text-faint);
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.metrics-rangelabel--modal {
		margin-top: -0.125rem;
	}

	@media (max-width: 560px) {
		.metrics-controls {
			flex-wrap: nowrap;
			width: 100%;
			overflow-x: auto;
			scrollbar-width: none;
		}
		.metrics-controls::-webkit-scrollbar {
			display: none;
		}
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	@media (max-width: 720px) {
		.metrics-grid {
			grid-template-columns: 1fr;
		}
	}

	.metrics-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 16px 12px;
		border-radius: var(--radius-md);
		background: var(--surface, white);
		border: 1px solid rgba(120, 120, 128, 0.12);
		min-width: 0;
	}
	:global(:root.dark) .metrics-card {
		background: rgba(255, 255, 255, 0.03);
		border-color: rgba(255, 255, 255, 0.06);
	}

	.metrics-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.metrics-card-head-right {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.metrics-card-label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted, rgba(140, 140, 150, 0.95));
	}
	.metrics-card-label :global(svg) {
		color: var(--accent);
	}
	.metrics-card-now {
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		font-weight: 600;
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
		color: var(--accent);
		letter-spacing: -0.01em;
	}

	.metrics-card-chart {
		position: relative;
		min-width: 0;
		touch-action: none;
	}
	.mtx-loading-cell {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.mtx-loading-chart {
		height: 12rem;
	}
	.mtx-empty {
		padding: 4rem 1rem;
		text-align: center;
		color: var(--text-muted);
	}
	.mtx-empty p {
		color: var(--text-default);
		margin-bottom: 0.5rem;
	}
	.metrics-card-skeleton {
		width: 100%;
		height: 100%;
		border-radius: var(--radius-xs);
		background: linear-gradient(
			90deg,
			rgba(120, 120, 128, 0.06) 0%,
			rgba(120, 120, 128, 0.1) 50%,
			rgba(120, 120, 128, 0.06) 100%
		);
		background-size: 200% 100%;
		animation: metrics-shimmer 1.4s linear infinite;
	}
	@keyframes metrics-shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	.metrics-card-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
		margin: 0;
		padding-top: 8px;
		border-top: 1px dashed rgba(120, 120, 128, 0.18);
	}
	.metrics-card-stats > div {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.metrics-card-stats dt {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
		letter-spacing: 0.06em;
		color: var(--text-muted, rgba(140, 140, 150, 0.95));
	}
	.metrics-card-stats dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		font-weight: 600;
		color: var(--text-primary, inherit);
	}

	.metrics-foot {
		margin: 4px 0 0;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted, rgba(140, 140, 150, 0.85));
	}
	.metrics-foot code {
		padding: 1px 4px;
		border-radius: var(--radius-xs);
		background: rgba(120, 120, 128, 0.1);
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
	}
	.metrics-foot-err {
		color: #d04a4a;
	}

	.metrics-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: rgba(15, 15, 20, 0.55);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		animation: metrics-fade 140ms ease-out;
	}
	@keyframes metrics-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.metrics-modal {
		width: min(1000px, 100%);
		max-height: calc(100vh - 48px);
		overflow: auto;
		background: var(--surface, white);
		border-radius: var(--radius-lg);
		border: 1px solid rgba(120, 120, 128, 0.18);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
		padding: 18px 20px 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		animation: metrics-pop 180ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	:global(:root.dark) .metrics-modal {
		background: #161618;
		border-color: rgba(255, 255, 255, 0.08);
	}
	@keyframes metrics-pop {
		from {
			opacity: 0;
			transform: scale(0.97);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	.metrics-modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.metrics-modal-body {
		display: flex;
		flex-direction: column;
		gap: 12px;
		flex: 1 1 auto;
		min-height: 0;
	}
	.metrics-modal-body :global(.metrics-card) {
		flex: 1 1 auto;
		min-height: 0;
	}
	.metrics-modal-body :global(.metrics-card-chart) {
		flex: 1 1 auto;
		min-height: 12rem;
	}

	.metrics-custompanel {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		flex-wrap: wrap;
		padding: 12px 12px;
		border-radius: var(--radius-sm);
		background: rgba(120, 120, 128, 0.06);
		border: 1px solid rgba(120, 120, 128, 0.12);
	}
	.metrics-custompanel label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted, rgba(140, 140, 150, 0.95));
	}
	.metrics-custompanel input[type='datetime-local'] {
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		padding: 4px 8px;
		border-radius: var(--radius-xs);
		border: 1px solid rgba(120, 120, 128, 0.25);
		background: var(--surface, white);
		color: var(--text-primary, inherit);
	}
	:global(:root.dark) .metrics-custompanel input[type='datetime-local'] {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.1);
	}
	.metrics-custompanel-actions {
		display: inline-flex;
		gap: 8px;
	}
	.metrics-custompanel-error {
		flex-basis: 100%;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: #d04a4a;
	}

	.btn-mini {
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
		padding: 4px 12px;
		border-radius: var(--radius-xs);
		cursor: pointer;
		border: 1px solid rgba(120, 120, 128, 0.2);
		background: transparent;
		color: var(--text-primary, inherit);
	}
	.btn-mini:hover {
		background: rgba(120, 120, 128, 0.08);
	}
	.btn-mini--primary {
		background: #5a3ed1;
		color: white;
		border-color: transparent;
	}
	.btn-mini--primary:hover {
		filter: brightness(1.08);
	}

	.mtx-chip {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-xs);
		flex-shrink: 0;
		display: inline-block;
	}

	.mtx-tip {
		position: absolute;
		z-index: 5;
		transform: translate(12px, -100%);
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 9px;
		border-radius: var(--radius-xs);
		background: var(--surface, white);
		border: 1px solid rgba(120, 120, 128, 0.25);
		box-shadow: var(--elev-3);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		white-space: nowrap;
	}
	:global(:root.dark) .mtx-tip {
		background: rgba(33, 33, 33, 0.97);
		border-color: rgba(255, 255, 255, 0.12);
	}
	.mtx-tip--flip {
		transform: translate(calc(-100% - 12px), -100%);
	}
	.mtx-tip-time {
		color: var(--text-muted, rgba(140, 140, 150, 0.95));
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.mtx-tip-val {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}

	.mtx-board {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	@media (max-width: 720px) {
		.mtx-board {
			grid-template-columns: 1fr;
		}
	}
	.mtx-cell {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 12px 8px;
		border-radius: var(--radius-sm);
		background: var(--surface, white);
		border: 1px solid rgba(120, 120, 128, 0.14);
		min-width: 0;
	}
	:global(:root.dark) .mtx-cell {
		background: rgba(255, 255, 255, 0.03);
		border-color: rgba(255, 255, 255, 0.07);
	}
	.mtx-cell-head {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.mtx-cell-label {
		flex: 1;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
		color: var(--text-muted, rgba(140, 140, 150, 0.95));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.mtx-cell-now {
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		letter-spacing: -0.01em;
		color: var(--text-primary, inherit);
	}
	.mtx-cell-chart {
		position: relative;
		height: 150px;
		min-width: 0;
		touch-action: none;
	}
	.mtx-cell-foot {
		display: flex;
		gap: 16px;
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--text-muted, rgba(140, 140, 150, 0.9));
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		padding-top: 4px;
	}
	.mtx-cell-foot b {
		font-weight: 600;
		color: var(--text-primary, inherit);
	}

	.mtx-bands {
		display: flex;
		flex-direction: column;
	}
	.mtx-band {
		display: grid;
		grid-template-columns: 9.5rem minmax(0, 1fr);
		gap: 16px;
		align-items: stretch;
		padding: 12px 0;
	}
	.mtx-band + .mtx-band {
		border-top: 1px solid rgba(120, 120, 128, 0.14);
	}
	.mtx-band-gutter {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		padding-top: 4px;
	}
	.mtx-band-label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
		color: var(--text-muted, rgba(140, 140, 150, 0.95));
	}
	.mtx-band-now {
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		letter-spacing: -0.015em;
		color: var(--text-primary, inherit);
	}
	.mtx-band-stats {
		display: flex;
		flex-direction: column;
		gap: 1px;
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--text-muted, rgba(140, 140, 150, 0.9));
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.mtx-band-chart {
		position: relative;
		min-width: 0;
		touch-action: none;
	}
	@media (max-width: 720px) {
		.mtx-band {
			grid-template-columns: 1fr;
			gap: 8px;
		}
		.mtx-band-gutter {
			flex-direction: row;
			align-items: baseline;
			gap: 12px;
		}
		.mtx-band-stats {
			flex-direction: row;
			gap: 8px;
			margin-left: auto;
		}
	}

	.btn-mini--ghost {
		border: 0;
		padding: 4px 8px;
		color: var(--text-muted, rgba(140, 140, 150, 0.95));
	}

	.mtx-brush {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border-subtle, var(--surface-border));
	}
	.mtx-brush-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.mtx-brush-label {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.mtx-brush-reset {
		border: none;
		background: none;
		padding: 0;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
		color: var(--accent);
		cursor: pointer;
	}
	.mtx-brush-reset:hover {
		opacity: 0.75;
	}
	.mtx-brush-track {
		position: relative;
		height: 3.25rem;
		border-radius: var(--radius-sm);
		background-color: var(--fill-quiet);
		overflow: hidden;
		cursor: crosshair;
		touch-action: none;
	}
	.mtx-brush-mask {
		position: absolute;
		top: 0;
		bottom: 0;
		background-color: color-mix(in srgb, var(--bg-app) 62%, transparent);
		pointer-events: none;
	}
	.mtx-brush-window {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: 1px solid var(--accent);
		border-right: 1px solid var(--accent);
		background-color: color-mix(in srgb, var(--accent) 10%, transparent);
		cursor: grab;
		touch-action: none;
	}
	.mtx-brush-window:active {
		cursor: grabbing;
	}
	.mtx-brush-handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 0.625rem;
		cursor: ew-resize;
		touch-action: none;
	}
	.mtx-brush-handle::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0.125rem;
		height: 1.25rem;
		transform: translate(-50%, -50%);
		border-radius: var(--radius-pill);
		background-color: var(--accent);
	}
	.mtx-brush-handle--from {
		left: -0.3125rem;
	}
	.mtx-brush-handle--to {
		right: -0.3125rem;
	}

	.mtx-legend {
		flex: 0 0 auto;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
	}
	.mtx-legend-item {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.mtx-legend-swatch {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: var(--radius-xs);
		flex-shrink: 0;
	}
	.mtx-legend-name {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mtx-tip-key {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		color: var(--text-muted);
		margin-right: var(--space-2);
	}
</style>

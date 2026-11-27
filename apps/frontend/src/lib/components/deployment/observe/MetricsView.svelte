<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/stores';
	import { SYMPTOM_PANELS, momentLink, releaseLink } from './permalink';
	import { goto } from '$app/navigation';
	import { Boxes, GitCommitHorizontal, Info, TriangleAlert } from 'lucide-svelte';
	import { Button, Disclosure, EmptyState, LogViewer, Modal, Table } from '$lib/components/ui';
	import MetaList from '$lib/components/ui/MetaList.svelte';
	import LoadingBar from '$lib/components/ui/LoadingBar.svelte';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import TopList from '$lib/components/ui/TopList.svelte';
	import Widget from '$lib/components/ui/Widget.svelte';
	import AlertStack from '$lib/components/patterns/AlertStack.svelte';
	import CapacityList, { capacityTone } from '$lib/components/ui/CapacityList.svelte';
	import MetricPanel from '$lib/components/patterns/MetricPanel.svelte';
	import {
		SERIES_COLORS,
		type ChartBand,
		type ChartFinding,
		type ChartPoint,
		type ChartSeries,
		type ChartThreshold,
		type ChartTone
	} from '$lib/components/ui/time-chart';
	import { provideChartAxis } from '$lib/components/ui/chart-axis.svelte';
	import { selectedOrganization, subscribeOrgEvents } from '$lib/stores';
	import { podLabel } from '$lib/utils/format';
	import { anomalies } from './findings';
	import { entryLine, type LogEntry } from './logs.svelte';
	import { bucketSize, clock, clockOrDay, runsAbove, stackByKey } from './signals';
	import {
		STATUS_CLASSES,
		type BuildRun,
		type ChartId,
		type ChartMode,
		type MetricsState,
		type PodSeries,
		type ResourceId,
		type StatusClass
	} from './metrics.svelte';

	let {
		metrics,
		runtimeLabel = undefined,
		uptimeLabel = undefined,
		deployment,
		active,
		demo,
		hasIngress,
		sharedHttp,
		httpRecorded = true
	}: {
		metrics: MetricsState;
		runtimeLabel?: string;
		uptimeLabel?: string;
		deployment: any;
		active: boolean;
		demo: boolean;
		hasIngress: boolean;
		sharedHttp: boolean;
		httpRecorded?: boolean;
	} = $props();

	const MIB = 1024 * 1024;
	const cpu = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} cores` : `${Math.round(v)}m`);
	const mem = (v: number) => (v >= 1024 ? `${(v / 1024).toFixed(2)} GB` : `${Math.round(v)} MB`);
	const net = (v: number) =>
		v >= 1024 ? `${(v / 1024).toFixed(2)} MB/s` : `${Math.round(v)} KB/s`;
	const rate = (v: number) =>
		v >= 1000 ? `${(v / 1000).toFixed(1)}k/s` : `${v.toFixed(v >= 10 ? 0 : 1)}/s`;
	const percent = (v: number) => `${v.toFixed(2)}%`;
	const share = (v: number) => `${v === 0 || v >= 10 ? Math.round(v) : v.toFixed(1)}%`;
	const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`);
	const count = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
	const minutes = (v: number) =>
		v >= 60 ? `${Math.floor(v / 60)}m ${Math.round(v % 60)}s` : `${Math.round(v)}s`;
	const bytes = (v: number) => {
		const gb = v / 1024 ** 3;
		if (gb >= 1) return `${gb >= 100 ? Math.round(gb) : Math.round(gb * 10) / 10} GB`;
		return `${Math.round(v / 1024 ** 2)} MB`;
	};

	const REASON_COLORS: Record<string, string> = {
		OOMKilled: 'var(--status-error-solid)',
		Error: 'var(--red-9)',
		BackOff: 'var(--red-9)',
		CrashLoopBackOff: 'var(--red-9)',
		Unhealthy: 'var(--status-warning-solid)',
		Failed: 'var(--amber-9)',
		FailedScheduling: 'var(--amber-9)',
		error: 'var(--status-error-solid)',
		warn: 'var(--status-warning-solid)',
		failed: 'var(--status-error-solid)',
		succeeded: 'var(--status-success-solid)',
		building: 'var(--status-warning-solid)'
	};

	const RESTART_COLORS: Record<string, string> = {
		OOMKilled: 'var(--status-error-solid)',
		Error: 'var(--red-6)',
		ContainerCannotRun: 'var(--red-8)',
		DeadlineExceeded: 'var(--amber-7)',
		Evicted: 'var(--amber-9)',
		Completed: 'var(--neutral-7)',
		restart: 'var(--neutral-8)'
	};

	const WAITING_COLORS: Record<string, string> = {
		CrashLoopBackOff: 'var(--status-error-solid)',
		ImagePullBackOff: 'var(--red-6)',
		ErrImagePull: 'var(--red-5)',
		InvalidImageName: 'var(--red-8)',
		CreateContainerConfigError: 'var(--red-10)',
		CreateContainerError: 'var(--red-10)',
		ContainerCreating: 'var(--amber-7)',
		PodInitializing: 'var(--amber-5)'
	};

	const STATUS_SERIES: Record<StatusClass, { label: string; tone?: ChartTone; color?: string }> = {
		'2xx': { label: '2xx OK', tone: 'neutral' },
		'3xx': { label: '3xx Redirect', color: 'var(--blue-7)' },
		'4xx': { label: '4xx Client error', tone: 'warning' },
		'5xx': { label: '5xx Server error', tone: 'error' }
	};

	const SOURCES: Record<string, string> = { haproxy: 'HAProxy', traefik: 'Traefik' };

	const OUTCOMES: Record<string, { label: string; tone: ChartTone }> = {
		succeeded: { label: 'Succeeded', tone: 'neutral' },
		failed: { label: 'Failed', tone: 'error' },
		building: { label: 'Building', tone: 'warning' }
	};

	const PHASE_COLORS: Record<string, string> = {
		queue: 'var(--neutral-6)',
		schedule: 'var(--neutral-7)',
		start: 'var(--neutral-8)',
		clone: 'var(--blue-5)',
		build: 'var(--blue-7)',
		push: 'var(--blue-9)',
		rollout: 'var(--status-deploy-solid)'
	};
	const PHASE_ORDER = Object.keys(PHASE_COLORS);

	provideChartAxis();

	let open = $state({ traffic: true, resources: true, pods: true, logs: true, deploys: true });
	let picked = $state<LogEntry | null>(null);
	let reading = $state(false);

	const step = $derived(metrics.step);
	const pods = $derived(Math.max(1, (deployment?.pods ?? []).length));
	const split = $derived(metrics.byPod && (metrics.pods.cpu?.length ?? 0) > 0);
	const bucket = $derived(bucketSize(metrics.from, metrics.to));

	function latest(points: ChartPoint[]) {
		return points.length ? points[points.length - 1].y : null;
	}

	function byPod(id: ResourceId, suffix = '', dashed = false): ChartSeries[] {
		return (metrics.pods[id] ?? []).map((g, i) => ({
			id: `${g.key}${suffix}`,
			label: `${podLabel(g.key)}${suffix ? ` ${suffix.trim()}` : ''}`,
			points: g.points,
			color: SERIES_COLORS[i % SERIES_COLORS.length],
			dashed
		}));
	}

	function limitZones(limit: number | null, format: (v: number) => string): ChartThreshold[] {
		if (!limit) return [];
		return [
			{ value: limit * 0.8, tone: 'warning', label: `80% of the ${format(limit)} limit` },
			{ value: limit, tone: 'error', label: `${format(limit)} limit` }
		];
	}

	function usage(points: ChartPoint[], limit: number | null, format: (v: number) => string) {
		const v = latest(points);
		if (v == null) return undefined;
		if (!limit) return { value: format(v) };
		const ratio = v / limit;
		return {
			value: `${format(v)} · ${Math.round(ratio * 100)}% of limit`,
			tone:
				ratio >= 1 ? ('error' as const) : ratio >= 0.8 ? ('warning' as const) : ('neutral' as const)
		};
	}

	const cpuPod = $derived(deployment?.cpuRequestMilli || null);
	const memPod = $derived(
		deployment?.memoryRequestBytes ? Number(deployment.memoryRequestBytes) / MIB : null
	);
	const cpuTotal = $derived(cpuPod ? cpuPod * pods : null);
	const forecastEnd = $derived.by(() => {
		const f = metrics.forecast;
		if (!f || !metrics.live || split) return null;
		const span = metrics.to - metrics.from;
		return Math.min(f.hitsLimitAt, metrics.to + span * 0.25);
	});
	const memSeries = $derived.by<ChartSeries[]>(() => {
		const f = metrics.forecast;
		if (!f || forecastEnd == null) return series.mem;
		const last = metrics.resources.mem.at(-1);
		if (!last) return series.mem;
		const perMs = f.slopeBytesPerHour / MIB / 3_600_000;
		return [
			...series.mem,
			{
				id: 'forecast',
				label: 'Projected',
				points: [last, { x: forecastEnd, y: last.y + perMs * (forecastEnd - last.x) }],
				tone: 'warning',
				dashed: true,
				projected: true
			}
		];
	});
	const memHeadline = $derived.by(() => {
		const f = metrics.forecast;
		if (f && !split) {
			return {
				value: `Reaches its limit around ${clockOrDay(f.hitsLimitAt)}`,
				tone: 'warning' as const
			};
		}
		return usage(metrics.resources.mem, memTotal, mem);
	});
	const THROTTLE_ZONE = 25;
	const throttleSeries = $derived<ChartSeries[]>([
		{ id: 'throttle', label: 'Throttled', points: metrics.throttle, tone: 'neutral' }
	]);
	const throttleHeadline = $derived.by(() => {
		const v = latest(metrics.throttle);
		if (v == null) return undefined;
		return {
			value: `${share(v)} of the time`,
			tone: v >= THROTTLE_ZONE ? ('warning' as const) : ('neutral' as const)
		};
	});
	const memTotal = $derived(memPod ? memPod * pods : null);

	const source = $derived(
		httpRecorded && metrics.http.source
			? (SOURCES[metrics.http.source] ?? metrics.http.source)
			: null
	);
	const unrecorded = $derived(
		httpRecorded ? null : "The ingress controller hasn't recorded requests for this app"
	);

	const statusSeries = $derived<ChartSeries[]>(
		STATUS_CLASSES.flatMap((c) => {
			const points = metrics.http.status[c] ?? [];
			return points.length ? [{ id: c, points, ...STATUS_SERIES[c] }] : [];
		})
	);
	const reqModes = $derived<ChartMode[]>(
		statusSeries.length ? ['stackedAreas', 'lines', 'stacked'] : ['areas', 'lines', 'bars']
	);
	const reqMode = $derived(
		metrics.modes.req && reqModes.includes(metrics.modes.req) ? metrics.modes.req : reqModes[0]
	);

	const percentiles = $derived(metrics.http.latency);
	const typicalLatency = $derived(latest(percentiles ? percentiles.p50 : metrics.http.lat));

	const servedErr = $derived.by(() => {
		if (!metrics.http.req.length) return metrics.http.err;
		const served = new Set(metrics.http.req.filter((p) => p.y > 0).map((p) => p.x));
		return metrics.http.err.filter((p) => served.has(p.x));
	});

	const series = $derived({
		req: statusSeries.length
			? statusSeries
			: [{ id: 'req', label: 'Per second', points: metrics.http.req, tone: 'neutral' }],
		err: [{ id: 'err', label: '5xx share', points: servedErr, tone: 'error' }],
		lat: percentiles
			? [
					{ id: 'p50', label: 'Typical (p50)', points: percentiles.p50, tone: 'neutral' },
					{ id: 'p95', label: 'Slow (p95)', points: percentiles.p95, color: SERIES_COLORS[0] },
					{
						id: 'p99',
						label: 'Worst (p99)',
						points: percentiles.p99,
						tone: 'faint',
						dashed: true
					}
				]
			: [
					{ id: 'avg', label: 'Average', points: metrics.http.lat, tone: 'neutral' },
					{ id: 'max', label: 'Slowest', points: metrics.http.latmax, tone: 'faint', dashed: true }
				],
		cpu: split
			? byPod('cpu')
			: [{ id: 'cpu', label: 'All pods', points: metrics.resources.cpu, tone: 'neutral' }],
		mem: split
			? byPod('mem')
			: [{ id: 'mem', label: 'All pods', points: metrics.resources.mem, tone: 'neutral' }],
		net: split
			? [...byPod('rx', ' in'), ...byPod('tx', ' out', true)]
			: [
					{ id: 'rx', label: 'In', points: metrics.resources.rx, tone: 'neutral' },
					{ id: 'tx', label: 'Out', points: metrics.resources.tx, tone: 'faint', dashed: true }
				]
	} as Record<ChartId, ChartSeries[]>);

	const SYMPTOM_CHART: Record<string, ChartId> = {
		'error-rate': 'err',
		p95: 'lat',
		'memory-step': 'mem',
		throttling: 'throttle'
	};

	function serverFindings(chart: ChartId, list: ChartSeries[]): ChartFinding[] {
		const target = chart === 'lat' ? (list.find((s) => s.id === 'p95') ?? list[0]) : list[0];
		if (!target) return [];
		return (metrics.findings ?? [])
			.filter((f) => SYMPTOM_CHART[f.kind] === chart)
			.map((f) => ({ t: f.at, seriesId: target.id, label: f.sentence }));
	}

	function findingsFor(
		list: ChartSeries[],
		format: (v: number) => string,
		chart?: ChartId
	): ChartFinding[] {
		if (metrics.findings && chart) return serverFindings(chart, list);
		if (metrics.findings) return [];
		return list.flatMap((s) =>
			anomalies(s.points, { format, events: metrics.events }).map((a) => ({
				t: a.t,
				seriesId: s.id,
				label: a.label
			}))
		);
	}

	const findings = $derived({
		req: findingsFor(series.req, rate),
		err: findingsFor(series.err, percent, 'err'),
		lat: findingsFor(series.lat, ms, 'lat'),
		cpu: findingsFor(series.cpu, cpu),
		throttle: findingsFor(throttleSeries, share, 'throttle'),
		mem: findingsFor(series.mem, mem, 'mem'),
		net: findingsFor(series.net, net)
	} as Record<ChartId, ChartFinding[]>);

	const incidents = $derived.by<ChartBand[]>(() => {
		const out: ChartBand[] = [];
		for (const k of metrics.killed) {
			if (!k.finishedAt) continue;
			const t = new Date(k.finishedAt).getTime();
			out.push({
				from: t - step,
				to: t + step,
				label: `${podLabel(k.pod)} / ${k.container}: ${k.reason}${k.exitCode != null ? ` (exit ${k.exitCode})` : ''} at ${clock(t)}`,
				tone: 'error'
			});
		}
		for (const w of metrics.warnings) {
			if (!/backoff|crashloop/i.test(`${w.reason} ${w.message}`)) continue;
			const a = w.firstTimestamp ? new Date(w.firstTimestamp).getTime() : null;
			const b = w.lastTimestamp ? new Date(w.lastTimestamp).getTime() : a;
			if (!a || !b) continue;
			out.push({
				from: a,
				to: Math.max(b, a + step),
				label: `${podLabel(w.pod)} kept crashing (${w.count ?? 1} restarts) from ${clock(a)} to ${clock(b)}`,
				tone: 'error'
			});
		}
		for (const r of metrics.releases) {
			if (r.status !== 'failed' || !r.startedAt) continue;
			out.push({
				from: r.startedAt,
				to: r.completedAt ?? r.at,
				label: `Deploy ${r.tag} failed${r.title ? `: ${r.title}` : ''}`,
				tone: 'warning'
			});
		}
		out.push(
			...runsAbove(
				metrics.http.err,
				5,
				(peak, a, b) =>
					`Error rate above 5% (up to ${percent(peak)}) from ${clock(a)} to ${clock(b)}`
			)
		);
		return out;
	});

	const health = $derived(metrics.podHealth);
	const kube = $derived(health?.available === true);
	const noHistory = $derived(
		health ? 'Pod history needs kube-state-metrics' : "Pod history couldn't be loaded"
	);

	function podSeries(
		groups: PodSeries[],
		colors: Record<string, string>,
		label: (key: string) => string = (k) => k
	): ChartSeries[] {
		return groups.map((g, i) => ({
			id: g.key,
			label: label(g.key),
			points: g.points,
			color: colors[g.key] ?? SERIES_COLORS[i % SERIES_COLORS.length]
		}));
	}

	const stopped = $derived(
		stackByKey(
			metrics.killed.flatMap((k) =>
				k.finishedAt ? [{ t: new Date(k.finishedAt).getTime(), key: k.reason }] : []
			),
			metrics.from,
			metrics.to,
			{ size: bucket, colors: REASON_COLORS }
		)
	);

	const restarts = $derived(
		kube && health
			? podSeries(health.restarts, RESTART_COLORS, (k) => (k === 'restart' ? 'Restarts' : k))
			: stopped
	);
	const waiting = $derived(kube && health ? podSeries(health.waiting, WAITING_COLORS) : []);
	const notReady = $derived<ChartSeries[]>(
		kube && health
			? [{ id: 'not-ready', label: 'Not ready', points: health.notReady, tone: 'warning' }]
			: []
	);

	const warnings = $derived(
		stackByKey(
			metrics.warnings.flatMap((w) => {
				const t = w.lastTimestamp ?? w.firstTimestamp;
				return t ? [{ t: new Date(t).getTime(), key: w.reason ?? 'Warning', n: w.count ?? 1 }] : [];
			}),
			metrics.from,
			metrics.to,
			{ size: bucket, colors: REASON_COLORS }
		)
	);

	const logsSince = $derived(
		metrics.logTail[0]?.timestamp ? new Date(metrics.logTail[0].timestamp).getTime() : null
	);

	const problemLines = $derived(
		metrics.logTail.filter((e) => /^(error|fatal|warn|warning)$/i.test(e.level ?? ''))
	);

	const storedLevelItems = $derived(
		metrics.storedLevels
			? (['error', 'warn'] as const).flatMap((key) =>
					(metrics.storedLevels?.[key] ?? []).map((p) => ({ t: p.x, key, n: p.y }))
				)
			: null
	);

	const logLevels = $derived(
		stackByKey(
			storedLevelItems ??
				problemLines.flatMap((e) =>
					e.timestamp
						? [
								{
									t: new Date(e.timestamp).getTime(),
									key: /^warn/i.test(e.level ?? '') ? 'warn' : 'error'
								}
							]
						: []
				),
			metrics.from,
			metrics.to,
			{
				size: bucket,
				colors: REASON_COLORS,
				label: (k) => (k === 'warn' ? 'Warnings' : 'Errors'),
				since: storedLevelItems ? undefined : (logsSince ?? undefined)
			}
		)
	);

	const latestErrors = $derived(
		problemLines
			.filter((e) => !/^warn/i.test(e.level ?? ''))
			.slice(-50)
			.reverse()
	);

	const buildAt = (b: BuildRun) => new Date(b.startedAt ?? b.scheduledAt).getTime();

	const ranged = $derived(
		metrics.builds
			.map((b) => ({ b, t: buildAt(b) }))
			.filter(({ t }) => Number.isFinite(t) && t >= metrics.from && t <= metrics.to)
			.sort((a, z) => a.t - z.t)
	);

	function median(values: number[]) {
		if (!values.length) return null;
		const sorted = [...values].sort((a, b) => a - b);
		return sorted[sorted.length >> 1];
	}

	function typical(values: number[]) {
		const m = median(values);
		return m == null ? undefined : { value: `${minutes(m)} typical` };
	}

	const buildTimes = $derived.by<ChartSeries[]>(() => {
		const groups = new Map<string, ChartPoint[]>();
		for (const { b, t } of ranged) {
			if (b.durationMs == null) continue;
			groups.set(b.status, [...(groups.get(b.status) ?? []), { x: t, y: b.durationMs / 1000 }]);
		}
		return [...groups].map(([status, points]) => ({
			id: status,
			label: OUTCOMES[status]?.label ?? status,
			tone: OUTCOMES[status]?.tone ?? 'faint',
			points
		}));
	});

	const queueWait = $derived<ChartSeries[]>([
		{
			id: 'queue',
			label: 'Waiting for a builder',
			tone: 'neutral',
			points: ranged.flatMap(({ b, t }) =>
				b.queueMs == null ? [] : [{ x: t, y: b.queueMs / 1000 }]
			)
		}
	]);

	const phases = $derived.by<ChartSeries[]>(() => {
		const labels = new Map<string, string>();
		for (const { b } of ranged) for (const p of b.phases ?? []) labels.set(p.id, p.label);
		const rank = (id: string) => {
			const i = PHASE_ORDER.indexOf(id);
			return i < 0 ? PHASE_ORDER.length : i;
		};
		return [...labels.keys()]
			.sort((a, z) => rank(a) - rank(z))
			.map((id, i) => ({
				id,
				label: labels.get(id) ?? id,
				color: PHASE_COLORS[id] ?? SERIES_COLORS[i % SERIES_COLORS.length],
				points: ranged.flatMap(({ b, t }) => {
					const p = (b.phases ?? []).find((x) => x.id === id);
					return p ? [{ x: t, y: p.ms / 1000 }] : [];
				})
			}));
	});

	const deploys = $derived(
		stackByKey(
			metrics.builds.map((b) => ({ t: buildAt(b), key: b.status || 'unknown' })),
			metrics.from,
			metrics.to,
			{
				size: bucket,
				colors: REASON_COLORS,
				label: (k) => k.charAt(0).toUpperCase() + k.slice(1)
			}
		)
	);

	function routeRank(
		pick: (r: (typeof metrics.http.routes)[number]) => number | null,
		color?: string
	) {
		return metrics.http.routes.flatMap((r) => {
			const value = pick(r);
			return value == null ? [] : [{ id: r.id, label: r.label, value, color }];
		});
	}

	const busiest = $derived(routeRank((r) => r.requestRate));
	const slowest = $derived(routeRank((r) => r.latencyMs));
	const failing = $derived(
		routeRank(
			(r) => ((r.errorRate ?? 0) > 0 || (r.errorPercent ?? 0) > 0 ? (r.errorPercent ?? 0) : null),
			'var(--status-error-solid)'
		)
	);

	const disks = $derived(
		metrics.volumes.map((v) => ({
			id: v.claim || v.name,
			label: v.name,
			detail: v.mountPath,
			value: v.usedBytes,
			max: v.capacityBytes
		}))
	);
	const fullest = $derived(
		Math.max(-1, ...disks.flatMap((d) => (d.value != null && d.max ? [d.value / d.max] : [])))
	);

	const podsByMemory = $derived(
		(metrics.pods.mem ?? []).map((g, i) => ({
			id: g.key,
			label: podLabel(g.key),
			value: latest(g.points),
			color: SERIES_COLORS[i % SERIES_COLORS.length]
		}))
	);

	const errorRank = $derived(
		metrics.errorGroups.map((g) => ({
			id: g.fingerprint,
			label: `${g.type}: ${g.message}`,
			value: g.count,
			color: 'var(--status-error-solid)'
		}))
	);

	function liveDeploy(t: number) {
		return metrics.releases
			.filter((r) => r.status === 'succeeded' && r.at <= t)
			.sort((a, b) => b.at - a.at)[0];
	}

	const context = $derived.by(() => {
		if (!picked) return [];
		const pod = picked.metadata?.pod;
		const same = metrics.logTail.filter((e) => !pod || e.metadata?.pod === pod);
		const at = same.indexOf(picked);
		return same.slice(Math.max(0, at - 25), at + 26).map(entryLine);
	});

	const pickedDeploy = $derived(
		picked?.timestamp ? liveDeploy(new Date(picked.timestamp).getTime()) : undefined
	);

	function load() {
		const id = deployment?.id;
		if (id) metrics.load(id, { http: hasIngress, demo });
	}

	function loadContext() {
		const id = deployment?.id;
		if (id) metrics.loadContext(id, { demo, pods: deployment?.pods ?? [] });
	}

	$effect(() => {
		void metrics.from;
		void metrics.to;
		void hasIngress;
		if (!deployment?.id || !active) return;
		untrack(load);
	});

	$effect(() => {
		void metrics.custom;
		void metrics.windowMs;
		if (!deployment?.id || !active) return;
		untrack(loadContext);
	});

	$effect(() => {
		if (!metrics.live || !active) return;
		const timer = setInterval(() => {
			if (metrics.hover === null && !document.hidden) metrics.tick();
		}, 15_000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		const orgId = $selectedOrganization?.id;
		const id = deployment?.id;
		if (!metrics.live || !active || !orgId || !id) return;
		return subscribeOrgEvents(orgId, (ev) => {
			if (ev.type === 'deployment.metrics' && ev.id === id && metrics.hover === null)
				metrics.tick();
			if ((ev.type === 'deployment.changed' || ev.type === 'pod.changed') && ev.id === id) {
				loadContext();
			}
		});
	});

	const dismissedFindings = new SvelteSet<string>();
	const findingKey = (f: { symptomId: string; at: number }) => `${f.symptomId}:${f.at}`;
	function findingRelease(f: { causeId: string | null }): string[] {
		const change = f.causeId ? metrics.changes?.find((c) => c.id === f.causeId) : null;
		return change?.imageHistoryId ? [change.imageHistoryId] : [];
	}
	const shownFindings = $derived(
		(metrics.findings ?? []).filter((f) => !dismissedFindings.has(findingKey(f)))
	);
</script>

{#snippet shared()}Includes every protected app in this project{/snippet}

{#snippet infoTip(text: string)}
	<Tooltip {text}>
		<span class="info" role="img" aria-label={text}><Info size={14} /></span>
	</Tooltip>
{/snippet}

{#snippet rank(
	title: string,
	info: string,
	items: { id: string; label: string; value: number | null; color?: string }[],
	format: (v: number) => string,
	empty: string
)}
	{#snippet meta()}{@render infoTip(info)}{/snippet}
	<Widget {title} {meta} class="metric-panel">
		<div class="rank">
			{#if items.length}
				<TopList label={title} {items} {format} />
			{:else}
				<p class="empty">{empty}</p>
			{/if}
		</div>
	</Widget>
{/snippet}

{#snippet diskMeta()}
	{#if fullest >= 0}
		<span class="headline headline--{capacityTone(fullest)}">{Math.round(fullest * 100)}% full</span
		>
	{/if}
	{@render infoTip(
		'How full each volume is right now, from the kubelet. Amber from 80%, red from 90%.'
	)}
{/snippet}

{#snippet errorsMeta()}
	{@render infoTip('The newest error lines. Open one to read the lines around it.')}
{/snippet}

{#snippet errorCell(e: LogEntry, col: { id: string })}
	{#if col.id === 'time'}
		<span class="mono">{e.timestamp ? clock(new Date(e.timestamp).getTime()) : ''}</span>
	{:else if col.id === 'pod'}
		<span class="mono">{e.metadata?.pod ? podLabel(e.metadata.pod) : ''}</span>
	{:else}
		<span class="mono message">{e.message ?? e.raw ?? ''}</span>
	{/if}
{/snippet}

<div class="board">
	{#if !metrics.loaded && metrics.error}
		<EmptyState title="Metrics aren't available" description={metrics.error}>
			{#snippet icon()}<TriangleAlert size={18} />{/snippet}
			<Button variant="secondary" onclick={load}>Retry</Button>
		</EmptyState>
	{:else if !metrics.loaded}
		<div class="waiting">
			<LoadingBar
				label="Loading metrics"
				value={metrics.loadTotal ? metrics.loadDone / metrics.loadTotal : null}
				detail={metrics.loadTotal ? `${metrics.loadDone} of ${metrics.loadTotal}` : undefined}
			/>
		</div>
	{:else}
		{#if shownFindings.length}
			<AlertStack
				ondismiss={(id) => dismissedFindings.add(id)}
				alerts={shownFindings.map((f) => ({
					id: findingKey(f),
					tone: 'warning' as const,
					title: f.sentence,
					dismissible: true,
					actions: [
						...findingRelease(f).map((id) => ({
							label: 'View deploy',
							onclick: () => goto(releaseLink($page.url, id), { noScroll: true })
						})),
						{
							label: 'Show',
							onclick: () =>
								metrics.zoom(f.at - 15 * 60_000, Math.min(Date.now(), f.at + 15 * 60_000))
						},
						{
							label: 'Copy link',
							onclick: () =>
								navigator.clipboard.writeText(
									momentLink($page.url, { at: f.at, panel: SYMPTOM_PANELS[f.kind] })
								)
						}
					]
				}))}
			/>
		{/if}

		{#if metrics.error}
			<p class="stale" role="status">
				Metrics aren't updating: {metrics.error}
				<Button size="sm" variant="ghost" onclick={load}>Retry</Button>
			</p>
		{/if}

		{#if hasIngress}
			<Disclosure
				title="Traffic and errors"
				size="lg"
				note={source ? `Measured at ${source}` : httpRecorded ? undefined : 'Not measured'}
				bind:open={open.traffic}
			>
				<div class="grid">
					<MetricPanel
						focus={metrics.focus}
						title="Requests"
						info={statusSeries.length
							? 'Requests per second reaching this app through its domains, by status class.'
							: 'Requests per second reaching this app through its domains.'}
						series={series.req}
						from={metrics.from}
						to={metrics.to}
						format={rate}
						bind:hover={metrics.hover}
						bind:mode={() => reqMode, (m) => (metrics.modes.req = m)}
						modes={reqModes}
						headline={latest(metrics.http.req) != null
							? { value: rate(latest(metrics.http.req)!) }
							: undefined}
						events={metrics.events}
						findings={findings.req}
						bands={incidents}
						empty={unrecorded ?? 'No requests reached this app in this range'}
						onZoom={(a, b) => metrics.zoom(a, b)}
						note={sharedHttp ? shared : undefined}
					/>
					<MetricPanel
						focus={metrics.focus}
						title="Error rate"
						info="Share of requests that returned a 5xx. Amber from 1%, red from 5%."
						series={series.err}
						from={metrics.from}
						to={metrics.to}
						format={percent}
						bind:hover={metrics.hover}
						bind:mode={() => metrics.modes.err ?? 'lines', (m) => (metrics.modes.err = m)}
						modes={['lines', 'areas', 'bars']}
						headline={latest(metrics.http.err) != null
							? {
									value: percent(latest(metrics.http.err)!),
									tone:
										latest(metrics.http.err)! >= 5
											? 'error'
											: latest(metrics.http.err)! >= 1
												? 'warning'
												: 'neutral'
								}
							: undefined}
						thresholds={[
							{ value: 1, tone: 'warning', label: '1%' },
							{ value: 5, tone: 'error', label: '5%' }
						]}
						events={metrics.events}
						findings={findings.err}
						bands={incidents}
						empty={unrecorded ?? 'No requests, so no error rate'}
						zeroIsData
						onZoom={(a, b) => metrics.zoom(a, b)}
					/>
					<MetricPanel
						focus={metrics.focus}
						title="Response time"
						info={percentiles
							? 'Half of requests finish faster than typical; 1 in 20 is slower than slow, 1 in 100 slower than worst.'
							: "Average and slowest response per interval. Percentiles aren't recorded."}
						series={series.lat}
						from={metrics.from}
						to={metrics.to}
						format={ms}
						bind:hover={metrics.hover}
						bind:mode={() => metrics.modes.lat ?? 'lines', (m) => (metrics.modes.lat = m)}
						modes={['lines', 'areas']}
						headline={typicalLatency != null
							? { value: `${ms(typicalLatency)} ${percentiles ? 'typical' : 'average'}` }
							: undefined}
						peaks={2}
						events={metrics.events}
						findings={findings.lat}
						bands={incidents}
						empty={unrecorded ?? 'No requests to time in this range'}
						onZoom={(a, b) => metrics.zoom(a, b)}
					/>
				</div>
				<div class="grid grid--lists">
					{@render rank(
						'Slowest routes',
						'Average response time of each domain and path over this range.',
						slowest,
						ms,
						unrecorded ?? 'No requests to time in this range'
					)}
					{@render rank(
						'Busiest routes',
						'Requests per second to each domain and path over this range.',
						busiest,
						rate,
						unrecorded ?? 'No requests reached this app in this range'
					)}
					{@render rank(
						'Routes throwing errors',
						"Share of each route's requests that returned a 5xx over this range.",
						failing,
						percent,
						'No route is returning errors'
					)}
					{@render rank(
						'Most frequent errors',
						'Exceptions grouped by fingerprint, ranked by how often they happened in this range.',
						errorRank,
						count,
						'No errors in this range'
					)}
				</div>
			</Disclosure>
		{/if}

		<Disclosure title="Resources" size="lg" note={runtimeLabel} bind:open={open.resources}>
			<div class="grid">
				<MetricPanel
					focus={metrics.focus}
					title="CPU"
					info="CPU used against the limit. Amber from 80% of the limit, red at the limit, where the app gets throttled."
					series={series.cpu}
					from={metrics.from}
					to={metrics.to}
					format={cpu}
					bind:hover={metrics.hover}
					bind:mode={() => metrics.modes.cpu ?? 'lines', (m) => (metrics.modes.cpu = m)}
					headline={usage(metrics.resources.cpu, cpuTotal, cpu)}
					thresholds={limitZones(split ? cpuPod : cpuTotal, cpu)}
					events={metrics.events}
					findings={findings.cpu}
					bands={incidents}
					empty="No CPU samples in this range"
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
				{#if metrics.throttle.length > 0}
					<MetricPanel
						focus={metrics.focus}
						title="CPU throttling"
						info="Share of scheduling periods where the CPU limit held the app back. Above 25% the limit is the bottleneck."
						series={throttleSeries}
						from={metrics.from}
						to={metrics.to}
						format={share}
						bind:hover={metrics.hover}
						bind:mode={() => metrics.modes.throttle ?? 'areas', (m) => (metrics.modes.throttle = m)}
						modes={['areas', 'lines']}
						headline={throttleHeadline}
						thresholds={[
							{ value: THROTTLE_ZONE, tone: 'warning', label: `${THROTTLE_ZONE}% throttled` }
						]}
						events={metrics.events}
						findings={findings.throttle}
						bands={incidents}
						empty="No throttling samples in this range"
						onZoom={(a, b) => metrics.zoom(a, b)}
					/>
				{/if}
				<MetricPanel
					focus={metrics.focus}
					title="Memory"
					info="Memory used against the limit. At the limit, the container is killed."
					series={memSeries}
					from={metrics.from}
					to={forecastEnd ?? metrics.to}
					format={mem}
					bind:hover={metrics.hover}
					bind:mode={() => metrics.modes.mem ?? 'lines', (m) => (metrics.modes.mem = m)}
					headline={memHeadline}
					thresholds={limitZones(split ? memPod : memTotal, mem)}
					events={metrics.events}
					findings={findings.mem}
					bands={incidents}
					empty="No memory samples in this range"
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
				<MetricPanel
					focus={metrics.focus}
					title="Network"
					info="Bytes per second received (in) and sent (out) by the app's pods."
					series={series.net}
					from={metrics.from}
					to={metrics.to}
					format={net}
					bind:hover={metrics.hover}
					bind:mode={() => metrics.modes.net ?? 'areas', (m) => (metrics.modes.net = m)}
					modes={['areas', 'lines', 'top']}
					events={metrics.events}
					findings={findings.net}
					bands={incidents}
					empty="No network samples in this range"
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
			</div>
			<div class="grid grid--lists">
				{@render rank(
					'Pods by memory',
					'Memory each pod is using right now, largest first.',
					podsByMemory,
					mem,
					'No per-pod memory samples yet'
				)}
				{#if disks.length}
					<Widget title="Disk" meta={diskMeta} class="metric-panel">
						<CapacityList label="Disk" items={disks} format={bytes} />
					</Widget>
				{/if}
			</div>
		</Disclosure>

		<Disclosure title="Pods" size="lg" note={uptimeLabel} bind:open={open.pods}>
			<div class="grid">
				<MetricPanel
					focus={metrics.focus}
					title="Restarts and out-of-memory kills"
					info={kube
						? 'Container restarts per interval, by the reason the container last stopped.'
						: 'Containers that stopped, per interval, by the reason Kubernetes gave.'}
					series={restarts}
					from={metrics.from}
					to={metrics.to}
					format={count}
					bind:hover={metrics.hover}
					mode="stacked"
					modes={['stacked']}
					sum
					events={metrics.events}
					bands={incidents}
					empty={kube
						? 'No container restarted in this range'
						: health
							? 'No container stopped recently. Pod history needs kube-state-metrics'
							: 'No container stopped in this range'}
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
				<MetricPanel
					focus={metrics.focus}
					title="Waiting containers by reason"
					info="Containers waiting to run per interval, by the reason Kubernetes gave (crash back-off, image pull, still creating)."
					series={waiting}
					from={metrics.from}
					to={metrics.to}
					format={count}
					bind:hover={metrics.hover}
					mode="stacked"
					modes={['stacked']}
					events={metrics.events}
					bands={incidents}
					empty={kube ? 'No container was stuck waiting in this range' : noHistory}
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
				<MetricPanel
					focus={metrics.focus}
					title="Pods not ready"
					info="Pods that were running but not ready to take traffic, per interval."
					series={notReady}
					from={metrics.from}
					to={metrics.to}
					format={count}
					bind:hover={metrics.hover}
					mode="bars"
					modes={['bars']}
					events={metrics.events}
					bands={incidents}
					empty={kube ? 'Every pod was ready in this range' : noHistory}
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
				<MetricPanel
					focus={metrics.focus}
					title="Kubernetes warnings"
					info="Warnings Kubernetes recorded for this app's pods (failed probes, back-off, scheduling), by reason."
					series={warnings}
					from={metrics.from}
					to={metrics.to}
					format={count}
					bind:hover={metrics.hover}
					mode="stacked"
					modes={['stacked']}
					sum
					events={metrics.events}
					bands={incidents}
					empty="Kubernetes recorded no warnings in this range"
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
			</div>
		</Disclosure>

		<Disclosure title="Logs" size="lg" bind:open={open.logs}>
			<div class="grid">
				<MetricPanel
					focus={metrics.focus}
					title="Error and warning lines"
					info={storedLevelItems
						? 'Log lines at error or warning level per interval, from the stored logs.'
						: `Log lines at error or warning level per interval, from the latest ${metrics.logTail.length} lines across all pods.`}
					series={logLevels}
					from={metrics.from}
					to={metrics.to}
					format={count}
					bind:hover={metrics.hover}
					mode="stacked"
					modes={['stacked']}
					sum
					events={metrics.events}
					bands={incidents}
					empty="No error or warning lines in this range"
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
			</div>
			<div class="grid grid--lists">
				<Widget title="Latest errors" meta={errorsMeta} class="metric-panel">
					<Table
						label="Latest errors"
						dense
						inset={false}
						maxHeight="16.5rem"
						columns={[
							{ id: 'time', label: 'Time', width: '5rem' },
							{ id: 'pod', label: 'Pod', width: '4.5rem' },
							{ id: 'message', label: 'Message' }
						]}
						rows={latestErrors}
						rowKey={(e, i) => e._key ?? i}
						cell={errorCell}
						onRowClick={(e) => {
							picked = e;
							reading = true;
						}}
						emptyText="No error lines in the latest logs"
					/>
				</Widget>
			</div>
		</Disclosure>

		<Disclosure title="Deploys" size="lg" bind:open={open.deploys}>
			<div class="grid">
				<MetricPanel
					focus={metrics.focus}
					title="Deploys"
					info="Builds started for this app per interval, by outcome."
					series={deploys}
					from={metrics.from}
					to={metrics.to}
					format={count}
					bind:hover={metrics.hover}
					mode="stacked"
					modes={['stacked']}
					sum
					events={metrics.events}
					bands={incidents}
					empty="Nothing was deployed in this range"
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
				<MetricPanel
					focus={metrics.focus}
					title="Build time"
					info="How long each build took from start to finish, by outcome."
					series={buildTimes}
					from={metrics.from}
					to={metrics.to}
					format={minutes}
					bind:hover={metrics.hover}
					mode="bars"
					modes={['bars']}
					sparse
					headline={typical(buildTimes.flatMap((s) => s.points.map((p) => p.y)))}
					events={metrics.events}
					bands={incidents}
					empty="Nothing was built in this range"
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
				<MetricPanel
					focus={metrics.focus}
					title="Queue wait"
					info="How long each build waited for a builder before it started."
					series={queueWait}
					from={metrics.from}
					to={metrics.to}
					format={minutes}
					bind:hover={metrics.hover}
					mode="bars"
					modes={['bars']}
					sparse
					headline={typical(queueWait[0].points.map((p) => p.y))}
					events={metrics.events}
					bands={incidents}
					empty="Nothing was built in this range"
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
				<MetricPanel
					focus={metrics.focus}
					title="Where build time goes"
					info="Each build split into its steps, from waiting in the queue to applying the new version."
					series={phases}
					from={metrics.from}
					to={metrics.to}
					format={minutes}
					bind:hover={metrics.hover}
					mode="stacked"
					modes={['stacked']}
					sparse
					events={metrics.events}
					bands={incidents}
					empty="Nothing was built in this range"
					onZoom={(a, b) => metrics.zoom(a, b)}
				/>
			</div>
		</Disclosure>
	{/if}
</div>

<Modal
	bind:open={reading}
	title={picked?.timestamp
		? `Error at ${new Date(picked.timestamp).toLocaleTimeString()}`
		: 'Error'}
	size="xl"
>
	{#if picked}
		<div class="detail">
			<MetaList
				items={[
					...(picked.metadata?.pod
						? [{ label: picked.metadata.pod, icon: Boxes, mono: true }]
						: []),
					...(pickedDeploy
						? [
								{
									label: `Running ${pickedDeploy.tag}${pickedDeploy.title ? ` ${pickedDeploy.title}` : ''}`,
									icon: GitCommitHorizontal
								}
							]
						: [])
				]}
			/>
			<div class="context">
				<LogViewer lines={context} toolbar filename="error-context" sourceLabel="Pod" />
			</div>
		</div>
	{/if}
</Modal>

<style>
	.waiting {
		display: grid;
		place-items: center;
		min-height: 17rem;
		padding: 0 1rem;
	}
	.waiting > :global(.ui-loadbar) {
		max-width: 24rem;
	}
	.board {
		container: board / inline-size;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		min-width: 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}
	.grid > :global(:last-child:nth-child(odd)) {
		grid-column: 1 / -1;
	}
	.rank {
		max-height: 11rem;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.empty {
		display: grid;
		place-items: center;
		min-height: 3rem;
		margin: 0;
		color: var(--text-faint);
		font-size: var(--text-callout);
	}
	.headline {
		margin-right: 0.25rem;
		color: var(--text-default);
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.headline--warning {
		color: var(--status-warning);
	}
	.headline--error {
		color: var(--status-error);
	}
	.info {
		display: grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		color: var(--text-faint);
	}
	.mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
	}
	.message {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.stale {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		padding-inline: 0.25rem;
		color: var(--status-warning);
		font-size: var(--text-footnote);
	}
	.detail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.context {
		display: flex;
		height: 24rem;
		padding: 0.75rem 1rem;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--console-bg);
	}
	@container board (max-width: 46rem) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChartArea, ChartBarDecreasing, ChartColumn, ChartLine, Info } from 'lucide-svelte';
	import Widget from '$lib/components/ui/Widget.svelte';
	import { stateEcho } from '$lib/utils/motion.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import TimeChart from '$lib/components/ui/TimeChart.svelte';
	import SeriesTable, { type SeriesRow } from '$lib/components/ui/SeriesTable.svelte';
	import TopList from '$lib/components/ui/TopList.svelte';
	import {
		chartTime,
		seriesColor,
		seriesStats,
		valueAt,
		type ChartBand,
		type ChartDisplay,
		type ChartEvent,
		type ChartFinding,
		type ChartSeries,
		type ChartThreshold
	} from '$lib/components/ui/time-chart';

	type Mode = ChartDisplay | 'top';

	let {
		title,
		info = undefined,
		series,
		from,
		to,
		format,
		hover = $bindable(null),
		mode = $bindable('lines'),
		modes = ['lines', 'areas', 'bars', 'top'],
		headline = undefined,
		events = [],
		findings = [],
		thresholds = [],
		bands = [],
		peaks = 0,
		empty = 'No data in this range',
		zeroIsData = false,
		table = true,
		sum = false,
		sparse = false,
		height = 168,
		onZoom = undefined,
		note = undefined,
		focus = null
	}: {
		title: string;
		info?: string;
		series: ChartSeries[];
		from: number;
		to: number;
		format: (v: number) => string;
		hover?: number | null;
		mode?: Mode;
		modes?: Mode[];
		headline?: { value: string; tone?: 'neutral' | 'warning' | 'error' };
		events?: ChartEvent[];
		findings?: ChartFinding[];
		thresholds?: ChartThreshold[];
		bands?: ChartBand[];
		peaks?: number;
		empty?: string;
		zeroIsData?: boolean;
		table?: boolean;
		sum?: boolean;
		sparse?: boolean;
		height?: number;
		onZoom?: (from: number, to: number) => void;
		note?: Snippet;
		focus?: { panel: string; key: number } | null;
	} = $props();

	const anchor = $derived(
		`panel-${title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')}`
	);

	let emphasis = $state<string | null>(null);

	const ALL = [
		{ value: 'lines', label: 'Lines', icon: ChartLine },
		{ value: 'areas', label: 'Areas', icon: ChartArea },
		{ value: 'stackedAreas', label: 'Stacked areas', icon: ChartArea },
		{ value: 'bars', label: 'Bars', icon: ChartColumn },
		{ value: 'stacked', label: 'Stacked bars', icon: ChartColumn },
		{ value: 'top', label: 'Top list', icon: ChartBarDecreasing }
	];
	const options = $derived(ALL.filter((o) => modes.includes(o.value as Mode)));

	const step = $derived.by(() => {
		if (sparse) return (to - from) / 40;
		const p = series.find((s) => s.points.length > 1)?.points;
		return p ? (p[p.length - 1].x - p[0].x) / (p.length - 1) : (to - from) / 60;
	});

	const hasData = $derived(
		series.some((s) => (zeroIsData ? s.points.length > 0 : s.points.some((p) => p.y !== 0)))
	);

	const rows = $derived<SeriesRow[]>(
		series
			.filter((s) => !s.projected)
			.map((s) => {
				const stats = seriesStats(s.points);
				const total = s.points.reduce((a, p) => a + p.y, 0);
				return {
					id: s.id,
					label: s.label ?? s.id,
					color: seriesColor(s),
					dashed: s.dashed,
					avg: sum ? total : (stats?.avg ?? null),
					min: stats?.min ?? null,
					max: stats?.max ?? null,
					value: hover === null ? (stats?.last ?? null) : valueAt(s.points, hover, step * 0.75),
					finding: findings.find((f) => f.seriesId === s.id)?.label ?? null
				};
			})
	);

	const valueLabel = $derived(hover === null ? 'Now' : chartTime(hover, to - from));
</script>

{#snippet meta()}
	{#if headline}
		<span class="headline headline--{headline.tone ?? 'neutral'}">{headline.value}</span>
	{/if}
	{#if info}
		<Tooltip text={info}>
			<span class="info" role="img" aria-label={info}><Info size={14} /></span>
		</Tooltip>
	{/if}
	{#if options.length > 1}
		<SegmentedControl
			label="{title} display"
			size="sm"
			shape="capsule"
			iconOnly
			bind:value={mode}
			{options}
		/>
	{/if}
{/snippet}

<div
	class="anchor motion-echo"
	id={anchor}
	{@attach stateEcho(() => (focus?.panel === anchor ? focus.key : null))}
>
	<Widget {title} {meta} class="metric-panel">
		<div class="body">
			<div class="view" style:height="{height}px">
				{#if mode === 'top'}
					<TopList
						label="{title} ranked by {hover === null ? 'average' : `value at ${valueLabel}`}"
						items={rows.map((r) => ({
							id: r.id,
							label: r.label,
							color: r.color,
							value: hover === null ? r.avg : r.value
						}))}
						{format}
						bind:emphasis
					/>
				{:else}
					<TimeChart
						{series}
						{from}
						{to}
						formatY={format}
						{height}
						label="{title} over time"
						display={mode}
						bind:hover
						bind:emphasis
						{events}
						{findings}
						{thresholds}
						{bands}
						{peaks}
						integer={sum}
						{sparse}
						{onZoom}
					/>
					{#if !hasData}
						<p class="empty">{empty}</p>
					{/if}
				{/if}
			</div>
			{#if table && hasData}
				<SeriesTable
					{rows}
					{format}
					{valueLabel}
					avgLabel={sum ? 'Total' : 'Avg'}
					label="{title} series"
					bind:emphasis
				/>
			{/if}
			{#if note}<div class="note">{@render note()}</div>{/if}
		</div>
	</Widget>
</div>

<style>
	.anchor {
		display: flex;
		flex-direction: column;
		min-width: 0;
		border-radius: calc(var(--radius-widget) * var(--corner-scale));
		corner-shape: var(--corner);
		scroll-margin-top: 1rem;
	}
	.anchor > :global(.widget) {
		flex: 1;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.view {
		position: relative;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.empty {
		position: absolute;
		inset: 0 0 1.5rem;
		display: grid;
		place-items: center;
		margin: 0;
		color: var(--text-faint);
		font-size: var(--text-callout);
		pointer-events: none;
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
	.note {
		font-size: var(--text-caption);
		color: var(--text-faint);
	}
</style>

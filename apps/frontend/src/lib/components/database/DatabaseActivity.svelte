<script lang="ts">
	import { apiFetch } from '$lib/stores';
	import { Button } from '$lib/components/ui';
	import Sparkline from '$lib/components/ui/Sparkline.svelte';
	import Widget from '$lib/components/ui/Widget.svelte';

	let {
		databaseId,
		observeHref,
		refreshKey = 0
	}: { databaseId: string; observeHref: string; refreshKey?: number } = $props();

	type Point = { x: number; y: number };
	type Series = Record<string, Point[] | undefined>;

	let data = $state<Series | null>(null);

	async function load() {
		const end = Date.now();
		const start = end - 60 * 60_000;
		try {
			const res = await apiFetch(
				`/apiv1/databases/${databaseId}/metrics?start=${start}&end=${end}&step=60000`
			);
			if (!res.ok) return;
			const body = await res.json();
			data = body?.data ?? null;
		} catch {
			data = null;
		}
	}

	$effect(() => {
		void databaseId;
		void refreshKey;
		load();
		const timer = setInterval(load, 60_000);
		return () => clearInterval(timer);
	});

	const ROWS = [
		{
			id: 'tps',
			label: 'Transactions',
			format: (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1)),
			unit: '/s'
		},
		{ id: 'cacheHit', label: 'Cache hit', format: (v: number) => v.toFixed(1), unit: '%' },
		{
			id: 'connections',
			label: 'Connections',
			format: (v: number) => String(Math.round(v)),
			unit: ''
		},
		{ id: 'cpu', label: 'CPU', format: (v: number) => String(Math.round(v)), unit: 'm' },
		{
			id: 'mem',
			label: 'Memory',
			format: (v: number) => (v >= 1024 ? (v / 1024).toFixed(1) : String(Math.round(v))),
			unit: ''
		}
	] as const;

	const rows = $derived(
		ROWS.flatMap((row) => {
			const points = data?.[row.id] ?? [];
			if (!points.length) return [];
			const last = points[points.length - 1].y;
			const unit = row.id === 'mem' ? (last >= 1024 ? 'GB' : 'MB') : row.unit;
			const tone = row.id === 'cacheHit' && last < 90 ? ('warning' as const) : ('neutral' as const);
			return [{ ...row, value: row.format(last), unit, values: points.map((p) => p.y), tone }];
		})
	);
</script>

{#snippet details()}
	<Button variant="ghost" size="sm" href={observeHref}>Observe</Button>
{/snippet}

{#if rows.length}
	<Widget title="Activity" meta={details} fill>
		<ul class="rows">
			{#each rows as row (row.id)}
				<li class="row">
					<span class="label">{row.label}</span>
					<span class="value">{row.value}<span class="unit">{row.unit}</span></span>
					<span class="trend">
						<Sparkline
							values={row.values}
							height={24}
							tone={row.tone}
							label="{row.label} over the last hour"
						/>
					</span>
				</li>
			{/each}
		</ul>
	</Widget>
{/if}

<style>
	.rows {
		display: flex;
		flex-direction: column;
		height: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 6rem;
		align-items: center;
		column-gap: 0.875rem;
		flex: 1 1 auto;
		min-height: 1.75rem;
		max-height: 3.5rem;
	}
	.row + .row {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.label {
		font-size: var(--text-callout);
		color: var(--text-muted);
	}
	.value {
		font-size: var(--text-callout);
		font-weight: var(--weight-semibold);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		color: var(--text-default);
		white-space: nowrap;
	}
	.unit {
		margin-left: 0.125rem;
		font-weight: var(--weight-regular);
		color: var(--text-muted);
	}
	.trend {
		display: block;
		min-width: 0;
	}
</style>

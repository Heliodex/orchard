<script lang="ts" module>
	export type SeriesRow = {
		id: string;
		label: string;
		color: string;
		dashed?: boolean;
		avg: number | null;
		min: number | null;
		max: number | null;
		value: number | null;
		finding?: string | null;
	};
</script>

<script lang="ts">
	import SearchField from './SearchField.svelte';

	let {
		rows,
		format,
		emphasis = $bindable(null),
		valueLabel = 'Now',
		avgLabel = 'Avg',
		filterAt = 6,
		label
	}: {
		rows: SeriesRow[];
		format: (v: number) => string;
		emphasis?: string | null;
		valueLabel?: string;
		avgLabel?: string;
		filterAt?: number;
		label: string;
	} = $props();

	let query = $state('');

	const shown = $derived(
		query.trim()
			? rows.filter((r) => r.label.toLowerCase().includes(query.trim().toLowerCase()))
			: rows
	);
	const hasFindings = $derived(rows.some((r) => r.finding));
	const cell = (v: number | null) => (v == null ? '–' : format(v));
</script>

<div class="series" class:series--findings={hasFindings}>
	{#if rows.length > filterAt}
		<SearchField size="sm" placeholder="Filter series" bind:value={query} />
	{/if}
	<div class="table" role="table" aria-label={label}>
		<div class="row row--head" role="row">
			<span role="columnheader" class="name">Series</span>
			{#if hasFindings}<span role="columnheader" class="finding">Findings</span>{/if}
			<span role="columnheader" class="num">{avgLabel}</span>
			<span role="columnheader" class="num num--min">Min</span>
			<span role="columnheader" class="num">Max</span>
			<span role="columnheader" class="num">{valueLabel}</span>
		</div>
		{#each shown as r (r.id)}
			<div
				class="row"
				class:row--on={emphasis === r.id}
				role="row"
				tabindex="-1"
				onpointerenter={() => (emphasis = r.id)}
				onpointerleave={() => (emphasis = null)}
			>
				<span role="cell" class="name">
					<span class="swatch" class:swatch--dashed={r.dashed} style:--swatch={r.color}></span>
					<span class="text">{r.label}</span>
				</span>
				{#if hasFindings}
					<span role="cell" class="finding" title={r.finding ?? undefined}>{r.finding ?? ''}</span>
				{/if}
				<span role="cell" class="num">{cell(r.avg)}</span>
				<span role="cell" class="num num--min">{cell(r.min)}</span>
				<span role="cell" class="num">{cell(r.max)}</span>
				<span role="cell" class="num num--value">{cell(r.value)}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.series {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}
	.table {
		display: flex;
		flex-direction: column;
		min-width: 0;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) repeat(4, 4.75rem);
		align-items: center;
		gap: 0.5rem;
		min-height: 1.5rem;
		margin-inline: -0.5rem;
		padding-inline: 0.5rem;
		border-radius: calc(0.375rem * var(--corner-scale));
		corner-shape: var(--corner);
		outline: none;
	}
	.series--findings .row {
		grid-template-columns: minmax(6rem, 0.8fr) minmax(0, 1.4fr) repeat(4, 4.75rem);
	}
	.row--head {
		min-height: 1.25rem;
		color: var(--text-faint);
	}
	.row:not(.row--head):hover,
	.row--on {
		background: var(--bg-hover);
	}
	.name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.text {
		overflow: hidden;
		color: var(--text-default);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row--head .name {
		color: var(--text-faint);
	}
	.swatch {
		flex-shrink: 0;
		width: 0.75rem;
		height: 0;
		border-top: 2px solid var(--swatch);
		border-radius: 1px;
	}
	.swatch--dashed {
		border-top-style: dashed;
	}
	.finding {
		overflow: hidden;
		color: var(--status-warning);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row--head .finding {
		color: var(--text-faint);
	}
	.num {
		text-align: right;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.row--head .num {
		color: var(--text-faint);
	}
	.num--value {
		color: var(--text-default);
		font-weight: var(--weight-medium);
	}
	.row--head .num--value {
		font-weight: var(--weight-regular);
	}
	@container (max-width: 28rem) {
		.row {
			grid-template-columns: minmax(0, 1fr) repeat(4, 4.25rem);
		}
		.series--findings .row {
			grid-template-columns: minmax(5rem, 0.8fr) minmax(0, 1.4fr) repeat(4, 4.25rem);
		}
	}
	@container (max-width: 24rem) {
		.row {
			grid-template-columns: minmax(0, 1fr) repeat(3, 4rem);
		}
		.series--findings .row {
			grid-template-columns: minmax(5rem, 0.8fr) minmax(0, 1.4fr) repeat(3, 4rem);
		}
		.num--min {
			display: none;
		}
	}
</style>

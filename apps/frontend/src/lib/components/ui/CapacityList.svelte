<script lang="ts" module>
	export type CapacityItem = {
		id: string;
		label: string;
		detail?: string;
		value: number | null;
		max: number | null;
		format?: (v: number) => string;
	};

	export function capacityTone(
		ratio: number,
		warning = 0.8,
		error = 0.9
	): 'neutral' | 'warning' | 'error' {
		return ratio >= error ? 'error' : ratio >= warning ? 'warning' : 'neutral';
	}
</script>

<script lang="ts">
	let {
		items,
		format,
		label,
		warning = 0.8,
		error = 0.9,
		missing = 'Not measured'
	}: {
		items: CapacityItem[];
		format: (v: number) => string;
		label: string;
		warning?: number;
		error?: number;
		missing?: string;
	} = $props();

	const rows = $derived(
		items.map((item) => {
			const measured = item.value != null && !!item.max;
			const ratio = measured ? Math.min(1, Math.max(0, item.value! / item.max!)) : 0;
			return {
				...item,
				measured,
				ratio,
				tone: measured ? capacityTone(item.value! / item.max!, warning, error) : 'neutral',
				text: measured
					? `${(item.format ?? format)(item.value!)} of ${(item.format ?? format)(item.max!)} · ${Math.round((item.value! / item.max!) * 100)}%`
					: missing
			};
		})
	);
</script>

<ul class="capacity" aria-label={label}>
	{#each rows as row (row.id)}
		<li class="item item--{row.tone}" class:item--missing={!row.measured}>
			<span class="track">
				{#if row.measured}
					<span class="fill" style:width="{row.ratio * 100}%"></span>
				{/if}
				<span class="tick tick--warning" style:left="{warning * 100}%"></span>
				<span class="tick tick--error" style:left="{error * 100}%"></span>
				<span class="name">
					{row.label}
					{#if row.detail}<span class="detail">{row.detail}</span>{/if}
				</span>
			</span>
			<span class="value">{row.text}</span>
		</li>
	{/each}
</ul>

<style>
	.capacity {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		gap: 0.25rem 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.item {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		align-items: center;
		--bar: var(--neutral-8);
		--value: var(--text-default);
	}
	.item--warning {
		--bar: var(--status-warning-solid);
		--value: var(--status-warning);
	}
	.item--error {
		--bar: var(--status-error-solid);
		--value: var(--status-error);
	}
	.track {
		position: relative;
		display: flex;
		align-items: center;
		height: 1.75rem;
		min-width: 0;
		overflow: hidden;
		border-radius: calc(0.375rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--neutral-8) 9%, transparent);
	}
	.item--missing .track {
		background: repeating-linear-gradient(-45deg, var(--border-default) 0 1px, transparent 1px 6px);
		box-shadow: inset 0 0 0 1px var(--border-default);
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		min-width: 2px;
		background: color-mix(in oklab, var(--bar) 28%, transparent);
	}
	.tick {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
	}
	.tick--warning {
		background: color-mix(in oklab, var(--status-warning-solid) 55%, transparent);
	}
	.tick--error {
		background: color-mix(in oklab, var(--status-error-solid) 55%, transparent);
	}
	.name {
		position: relative;
		overflow: hidden;
		padding-inline: 0.5rem;
		color: var(--text-default);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.detail {
		margin-left: 0.375rem;
		color: var(--text-faint);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
	}
	.value {
		text-align: right;
		color: var(--value);
		font-weight: var(--weight-medium);
		white-space: nowrap;
	}
	.item--missing .value {
		color: var(--text-faint);
		font-weight: var(--weight-regular);
	}
</style>

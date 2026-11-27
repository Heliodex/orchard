<script lang="ts">
	import type { Snippet } from 'svelte';
	import NumberRoll from './NumberRoll.svelte';

	let {
		label,
		value,
		unit = undefined,
		detail = undefined,
		tone = 'neutral',
		chart = undefined,
		roll = false,
		stretch = false,
		size = 'md'
	}: {
		label: string;
		value: string | number;
		unit?: string;
		detail?: string;
		tone?: 'neutral' | 'success' | 'warning' | 'error';
		chart?: Snippet;
		roll?: boolean;
		stretch?: boolean;
		size?: 'sm' | 'md';
	} = $props();
</script>

<div class="metric metric--{size}" class:metric--stretch={stretch}>
	<span class="label">{label}</span>
	<span class="value-line">
		<span class="value"
			>{#if roll}<NumberRoll value={String(value)} />{:else}{value}{/if}</span
		>
		{#if unit}<span class="unit">{unit}</span>{/if}
	</span>
	{#if detail}<span class="detail detail--{tone}">{detail}</span>{/if}
	{#if chart}<div class="chart">{@render chart()}</div>{/if}
</div>

<style>
	.metric {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}
	.label {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.value-line {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}
	.value {
		font-size: var(--text-title-2);
		line-height: var(--lh-title-2);
		font-weight: var(--weight-semibold);
		letter-spacing: -0.014em;
		color: var(--text-default);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.metric--sm .value {
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
	}
	.metric--sm .detail {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.unit {
		font-size: var(--text-callout);
		color: var(--text-muted);
	}
	.detail {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.detail--success {
		color: var(--status-success);
	}
	.detail--warning {
		color: var(--status-warning);
	}
	.detail--error {
		color: var(--status-error);
	}
	.chart {
		margin-top: 0.5rem;
	}
	.metric--stretch {
		height: 100%;
	}
	.metric--stretch .chart {
		margin-top: auto;
		padding-top: 0.5rem;
	}
</style>

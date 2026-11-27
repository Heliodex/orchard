<script lang="ts">
	import SeverityMeter from './SeverityMeter.svelte';
	import { severityMeta, type Severity } from './severity';

	let {
		counts,
		label = 'Findings by severity'
	}: {
		counts: Partial<Record<Severity, number>>;
		label?: string;
	} = $props();

	const shown = $derived(
		(['critical', 'high', 'medium', 'low', 'unknown'] as const).filter(
			(s) => s !== 'unknown' || (counts.unknown ?? 0) > 0
		)
	);
	const total = $derived(shown.reduce((sum, s) => sum + (counts[s] ?? 0), 0));
	const segments = $derived(
		shown
			.map((s) => ({ severity: s, count: counts[s] ?? 0, meta: severityMeta(s) }))
			.filter((s) => s.count > 0)
	);
</script>

<div class="severity-bar">
	<div class="track" role="img" aria-label={label}>
		{#each segments as seg (seg.severity)}
			<span
				class="seg seg--{seg.meta.tone}"
				class:seg--top={seg.meta.level === 4}
				style:flex-grow={seg.count}
			></span>
		{/each}
	</div>
	<ul class="legend" style:--cols={shown.length}>
		{#each shown as s (s)}
			{@const n = counts[s] ?? 0}
			<li class="item" class:item--zero={n === 0}>
				<span class="count">{n}</span>
				<SeverityMeter severity={s} label quiet={n === 0} />
			</li>
		{/each}
	</ul>
	{#if total === 0}<span class="a11y-note">No findings</span>{/if}
</div>

<style>
	.severity-bar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.track {
		display: flex;
		gap: 0.125rem;
		height: 0.375rem;
		overflow: hidden;
		border-radius: 999px;
		background: var(--bg-active);
	}
	.seg {
		flex-basis: 0.375rem;
		min-width: 0.375rem;
	}
	.seg--error {
		background: color-mix(in oklab, var(--status-error-solid) 70%, transparent);
	}
	.seg--top {
		background: var(--status-error-solid);
	}
	.seg--warning {
		background: var(--status-warning-solid);
	}
	.seg--neutral {
		background: var(--status-neutral-solid);
	}
	.legend {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(max-content, 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}
	.count {
		color: var(--text-default);
		font-size: var(--text-title-3);
		font-weight: var(--weight-medium);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		line-height: 1;
		text-box: trim-both cap alphabetic;
	}
	.item--zero .count {
		color: var(--text-faint);
	}
	.a11y-note {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>

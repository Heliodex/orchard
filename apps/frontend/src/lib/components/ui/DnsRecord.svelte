<script lang="ts">
	import CopyButton from './CopyButton.svelte';

	type DnsEntry = { type: string; name: string; value: string };

	let { records, label = 'DNS records' }: { records: DnsEntry[]; label?: string } = $props();
</script>

<div class="dns" role="table" aria-label={label}>
	<div class="row head" role="row">
		<span role="columnheader">Type</span>
		<span role="columnheader">Name</span>
		<span role="columnheader">Value</span>
	</div>
	{#each records as record (`${record.type}:${record.name}:${record.value}`)}
		<div class="row" role="row">
			<span class="cell type" role="cell">{record.type}</span>
			<span class="cell" role="cell">
				<span class="value">{record.name}</span>
				<CopyButton value={record.name} label="Copy name" />
			</span>
			<span class="cell" role="cell">
				<span class="value">{record.value}</span>
				<CopyButton value={record.value} label="Copy value" />
			</span>
		</div>
	{/each}
</div>

<style>
	.dns {
		--dns-r: calc(var(--radius-card) * var(--corner-scale));
		display: grid;
		grid-template-columns: max-content minmax(5rem, max-content) minmax(0, 1fr);
		min-width: 0;
		border-radius: var(--dns-r);
		corner-shape: var(--corner);
		background: var(--bg-sunken);
		box-shadow: inset 0 0 0 0.5px var(--border-default);
	}
	.row {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		align-items: center;
		column-gap: 1.25rem;
		min-height: 2.75rem;
		padding: 0 0.375rem 0 1rem;
	}
	.row + .row {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.head {
		min-height: 2rem;
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-weight: var(--weight-medium);
	}
	.cell {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
	}
	.cell:last-child {
		justify-content: space-between;
	}
	.type {
		color: var(--text-default);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
		font-weight: var(--weight-medium);
	}
	.value {
		min-width: 0;
		overflow-x: clip;
		color: var(--text-default);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>

<script lang="ts">
	import StatusDot from './StatusDot.svelte';
	import type { CheckItem } from './checklist';

	let { items, label }: { items: CheckItem[]; label: string } = $props();

	const metered = $derived(items.some((i) => i.ratio != null));
</script>

<ul class="checks" class:checks--metered={metered} aria-label={label}>
	{#each items as item (item.id)}
		{@const ratio = item.ratio == null ? null : Math.min(1, Math.max(0, item.ratio))}
		<li class="check check--{item.meta.kind}">
			<svelte:element
				this={item.href ? 'a' : 'div'}
				class="row"
				class:row--link={!!item.href}
				href={item.href}
			>
				<span class="dot"><StatusDot meta={item.meta} label={item.meta.label} /></span>
				<span class="text" class:text--wide={metered && item.ratio === undefined}>
					<span class="label" title={item.label}>{item.label}</span>
					{#if item.detail}<span class="detail" title={item.detail}>{item.detail}</span>{/if}
				</span>
				{#if metered}
					{#if item.ratio !== undefined}
						<span class="meter" aria-hidden="true">
							{#if ratio != null}<span class="fill" style:width="{ratio * 100}%"></span>{/if}
						</span>
					{/if}
				{/if}
				{#if item.value}<span class="value">{item.value}</span>{/if}
			</svelte:element>
		</li>
	{/each}
</ul>

<style>
	.checks {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.check + .check {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.row {
		display: grid;
		grid-template-columns: 1rem minmax(0, 1fr) auto;
		align-items: center;
		column-gap: 0.625rem;
		min-height: 2.25rem;
		margin-inline: -0.5rem;
		padding-inline: 0.5rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		color: var(--text-default);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		transition: background-color var(--dur-fast) ease;
	}
	.checks--metered .row {
		grid-template-columns: 1rem minmax(0, 1fr) 3.5rem minmax(6.5rem, auto);
	}
	.row--link:hover {
		background: var(--bg-hover);
	}
	.row--link:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.dot {
		display: grid;
		place-items: center;
	}
	.text--wide {
		grid-column: 2 / span 2;
	}
	.text {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
	}
	.label {
		flex-shrink: 0;
		max-width: 100%;
		min-width: 0;
		overflow-x: clip;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.detail {
		flex-shrink: 100;
		min-width: 0;
		overflow-x: clip;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: var(--text-footnote);
		color: var(--text-faint);
	}
	.meter {
		position: relative;
		height: 0.25rem;
		border-radius: 999px;
		background: var(--bg-sunken);
		overflow: hidden;
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: inherit;
		background: var(--text-faint);
	}
	.check--warning .fill {
		background: var(--status-warning);
	}
	.check--error .fill {
		background: var(--status-error);
	}
	.value {
		justify-self: end;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
	}
	.check--warning .value {
		color: var(--status-warning);
	}
	.check--error .value {
		color: var(--status-error);
		font-weight: var(--weight-semibold);
	}
</style>

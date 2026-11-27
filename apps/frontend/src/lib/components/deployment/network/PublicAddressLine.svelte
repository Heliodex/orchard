<script lang="ts">
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { PUBLIC_ADDRESS_DOCS, publicStatusMeta, type PublicStatus } from './network';

	let {
		address,
		status,
		copyLabel = 'Copy public address'
	}: {
		address: string | null;
		status: PublicStatus | null | undefined;
		copyLabel?: string;
	} = $props();

	const meta = $derived(publicStatusMeta(status));
</script>

<span class="line">
	{#if status?.state === 'pending' && meta}
		<StatusDot {meta} />
		<span class="note">{meta.label}</span>
	{:else if status?.state === 'failed' && meta}
		<StatusDot {meta} />
		<span class="reason" title={meta.label}>{meta.label}</span>
		<a class="help" href={PUBLIC_ADDRESS_DOCS} target="_blank" rel="noopener noreferrer">Help</a>
	{:else if address}
		{#if meta}<StatusDot {meta} label={meta.label} />{/if}
		<span class="address">{address}</span>
		<CopyButton value={address} label={copyLabel} />
	{/if}
</span>

<style>
	.line {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		max-width: 100%;
		pointer-events: auto;
	}
	.address {
		min-width: 0;
		overflow-x: clip;
		color: var(--text-default);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.note {
		color: var(--text-muted);
		font-size: var(--text-footnote);
		white-space: nowrap;
	}
	.reason {
		min-width: 0;
		overflow-x: clip;
		color: var(--status-error);
		font-size: var(--text-footnote);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.help {
		flex-shrink: 0;
		color: var(--text-default);
		font-size: var(--text-footnote);
		text-decoration: underline;
		text-decoration-color: var(--border-default);
		text-underline-offset: 2px;
	}
	.help:hover {
		text-decoration-color: currentColor;
	}
	.line :global(button) {
		width: 1.5rem;
		height: 1.5rem;
	}
</style>

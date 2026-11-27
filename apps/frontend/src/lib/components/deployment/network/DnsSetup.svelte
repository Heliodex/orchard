<script lang="ts">
	import { untrack } from 'svelte';
	import { Button, StatusBadge } from '$lib/components/ui';
	import { statusMeta } from '$lib/components/ui/status';
	import DnsRecord from '$lib/components/ui/DnsRecord.svelte';
	import { apexOf, type DnsCheck } from './network';

	let {
		host,
		watch = false,
		onCheckDns = undefined
	}: {
		host: string;
		watch?: boolean;
		onCheckDns?: (domain: string) => Promise<DnsCheck>;
	} = $props();

	let phase = $state<'checking' | 'valid' | 'invalid'>('checking');
	let records = $state<NonNullable<DnsCheck['records']>>([]);
	let checkedAt = $state<number | null>(null);
	let now = $state(Date.now());

	const connected = $derived(phase === 'valid');
	const apex = $derived(records.some((r) => r.type === 'A'));
	const ago = $derived(checkedAt ? Math.max(0, Math.round((now - checkedAt) / 1000)) : null);
	const meta = $derived(
		connected
			? statusMeta('success', 'Connected')
			: phase === 'checking' && checkedAt === null
				? statusMeta('progress', 'Checking', true)
				: statusMeta('warning', 'Waiting for DNS', watch)
	);

	async function check() {
		if (!onCheckDns || !host) return;
		phase = 'checking';
		try {
			const result = await onCheckDns(host);
			if (result.records?.length) records = result.records;
			phase = result.valid ? 'valid' : 'invalid';
		} catch {
			phase = 'invalid';
		}
		checkedAt = Date.now();
	}

	$effect(() => {
		if (!host) return;
		untrack(() => {
			records = [];
			checkedAt = null;
			check();
		});
	});

	$effect(() => {
		if (!watch || connected) return;
		const poll = setInterval(() => {
			if (untrack(() => phase) !== 'checking') check();
		}, 5000);
		const tick = setInterval(() => (now = Date.now()), 1000);
		return () => {
			clearInterval(poll);
			clearInterval(tick);
		};
	});
</script>

<div class="dns-setup">
	{#if records.length > 0}
		<p class="lead">
			Add {records.length > 1 ? 'these records' : 'this record'} in the DNS settings where you bought
			<strong>{apexOf(host)}</strong>.
		</p>
		<DnsRecord {records} />
		{#if apex}
			<p class="note">Some providers write @ as {apexOf(host)} or leave the name empty.</p>
		{/if}
	{/if}
	<div class="foot">
		<span class="state">
			<StatusBadge {meta} variant="plain" />
			{#if ago !== null && !connected}<span class="ago"
					>Checked {ago < 2 ? 'just now' : `${ago}s ago`}</span
				>{/if}
		</span>
		{#if onCheckDns && !watch}
			<Button variant="secondary" size="sm" loading={phase === 'checking'} onclick={check}
				>Check again</Button
			>
		{/if}
	</div>
</div>

<style>
	.dns-setup {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		min-width: 0;
	}
	.lead {
		color: var(--text-default);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		text-wrap: pretty;
	}
	.lead strong {
		font-weight: var(--weight-semibold);
	}
	.note {
		margin-top: -0.25rem;
		color: var(--text-muted);
		font-size: var(--text-footnote);
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 2rem;
	}
	.state {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
	}
	.ago {
		color: var(--text-faint);
		font-size: var(--text-footnote);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
</style>

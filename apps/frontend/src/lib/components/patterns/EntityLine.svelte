<script lang="ts">
	import { Box, Database, Timer } from 'lucide-svelte';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import Sparkline from '$lib/components/ui/Sparkline.svelte';
	import NumberRoll from '$lib/components/ui/NumberRoll.svelte';
	import { trafficReading, type Traffic } from '$lib/components/ui/traffic';
	import type { StatusMeta } from '$lib/components/ui/status';

	let {
		kind,
		name,
		status,
		href,
		detail = undefined,
		metrics = undefined,
		traffic = undefined,
		updatedAt = undefined
	}: {
		kind: 'deployment' | 'database' | 'job';
		name: string;
		status: StatusMeta;
		href: string;
		detail?: string;
		metrics?: string;
		traffic?: Traffic;
		updatedAt?: string | null;
	} = $props();

	const KIND_ICON = { deployment: Box, database: Database, job: Timer };
	const KindIcon = $derived(KIND_ICON[kind]);
	const loud = $derived(status.kind === 'error' || status.kind === 'progress');
	let scrub = $state<number | null>(null);
	const reading = $derived(traffic ? trafficReading(traffic, scrub) : null);
</script>

<a class="line" data-entity={name} {href}>
	<StatusDot meta={status} size={8} />
	<span class="kind"><KindIcon size={14} /></span>
	<span class="name" title={name}>{name}</span>
	{#if loud}<span class="state state--{status.kind}">{status.label}</span>{/if}
	<span class="detail">{detail ?? ''}</span>
	{#if traffic}
		<span class="traffic">
			<span class="spark"
				><Sparkline
					values={traffic.values}
					height={12}
					tone="neutral"
					interactive
					onScrub={(i) => (scrub = i)}
				/></span
			>
			<span class="num num--traffic" style:min-width="{reading?.width}ch">
				{#if reading?.scrubbing}{reading.text}{:else}<NumberRoll value={traffic.label} />{/if}
			</span>
		</span>
	{:else if metrics}<span class="num">{metrics}</span>{/if}
	{#if updatedAt}<span class="when"><RelativeTime date={updatedAt} /></span>{/if}
</a>

<style>
	.line {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		height: 1.75rem;
		padding: 0 0.5rem;
		border-radius: calc(0.5rem * var(--corner-scale));
		corner-shape: var(--corner);
		color: var(--text-default);
		font-size: var(--text-caption);
		text-decoration: none;
		transition: background-color var(--dur-fast) ease;
	}
	.line:hover {
		--spark-ground: var(--bg-hover);
		background: var(--bg-hover);
	}
	.kind {
		display: flex;
		flex-shrink: 0;
		color: var(--text-faint);
	}
	.name,
	.detail,
	.state,
	.num,
	.when {
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
	}
	.name {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
	}
	.state {
		flex-shrink: 0;
		font-size: var(--text-caption);
	}
	.state--error {
		color: var(--red-9);
	}
	.state--progress {
		color: var(--amber-9);
	}
	.detail {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-faint);
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.traffic {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}
	.spark {
		width: 3rem;
	}
	.num,
	.when {
		flex-shrink: 0;
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.num--traffic {
		display: inline-flex;
		justify-content: flex-end;
	}
	.when {
		min-width: 3.25rem;
		text-align: right;
	}
</style>

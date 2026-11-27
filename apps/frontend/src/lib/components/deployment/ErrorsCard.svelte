<script lang="ts">
	import { Button, LoadingBar } from '$lib/components/ui';
	import Widget from '$lib/components/ui/Widget.svelte';
	import NumberRoll from '$lib/components/ui/NumberRoll.svelte';
	import Sparkline from '$lib/components/ui/Sparkline.svelte';
	import { apiFetch } from '$lib/stores';

	let {
		deploymentId,
		onopen
	}: {
		deploymentId: string;
		onopen: () => void;
	} = $props();

	let rates = $state<number[] | null>(null);
	let failed = $state(false);
	let scrub = $state<number | null>(null);
	let chartHeight = $state(0);

	async function load(id: string) {
		const end = Date.now();
		try {
			const res = await apiFetch(
				`/apiv1/observe/deployments/${encodeURIComponent(id)}/http-metrics?start=${end - 30 * 60_000}&end=${end}&step=60000`
			);
			if (!res.ok) {
				if (rates === null) failed = true;
				return;
			}
			const body = await res.json();
			rates = ((body?.errorRate ?? []) as { y: number }[]).map((p) => p.y);
			failed = false;
		} catch {
			if (rates === null) failed = true;
		}
	}

	$effect(() => {
		const id = deploymentId;
		if (!id) return;
		load(id);
		const timer = setInterval(() => {
			if (!document.hidden) load(id);
		}, 60_000);
		return () => clearInterval(timer);
	});

	const latest = $derived(rates?.length ? rates[rates.length - 1] : null);
	const shown = $derived(scrub !== null && rates ? rates[scrub] : latest);
	const tone = $derived(
		latest == null ? 'neutral' : latest >= 5 ? 'error' : latest >= 1 ? 'warning' : 'neutral'
	);
</script>

{#snippet headRight()}
	{#if shown != null}<span class="mini mini--{tone}">{shown.toFixed(2)}%</span>{/if}
	<Button variant="ghost" size="sm" onclick={onopen}>All errors</Button>
{/snippet}

<Widget title="Error rate" meta={headRight} fill class="errors">
	{#if shown != null && rates}
		<div class="body body--{tone}">
			<div class="reading">
				<span class="value"
					>{#if scrub === null}<NumberRoll value={shown.toFixed(2)} />{:else}{shown.toFixed(
							2
						)}{/if}%</span
				>
				<span class="of">of requests failed{scrub === null ? ' · last 30 min' : ''}</span>
			</div>
			<div class="chart" bind:clientHeight={chartHeight}>
				{#if chartHeight > 0}
					<Sparkline
						values={rates}
						height={chartHeight}
						{tone}
						label="Error rate over the last 30 minutes"
						interactive
						onScrub={(i) => (scrub = i)}
					/>
				{/if}
			</div>
		</div>
	{:else if rates}
		<p class="none">No requests recorded in the last 30 minutes.</p>
	{:else if failed}
		<div class="waiting">
			<p class="none">The error rate didn't load.</p>
			<Button
				variant="secondary"
				size="sm"
				onclick={() => {
					failed = false;
					load(deploymentId);
				}}>Retry</Button
			>
		</div>
	{:else}
		<div class="waiting"><LoadingBar label="Loading error rate" /></div>
	{/if}
</Widget>

<style>
	.waiting {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		height: 100%;
		min-height: 4rem;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: 100%;
		min-height: 0;
		padding: 0;
	}
	.reading {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.value {
		display: inline-flex;
		align-items: baseline;
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
		font-weight: var(--weight-semibold);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		color: var(--text-default);
	}
	.body--warning .value {
		color: var(--status-warning);
	}
	.body--error .value {
		color: var(--status-error);
	}
	.of {
		font-size: var(--text-caption);
		color: var(--text-muted);
	}
	.chart {
		position: relative;
		flex: 1 1 0;
		min-height: 0;
		overflow: hidden;
	}
	.chart > :global(*) {
		position: absolute;
		inset: 0;
	}
	.none {
		margin: 0;
		font-size: var(--text-callout);
		color: var(--text-muted);
	}
	.mini {
		display: none;
		font-size: var(--text-callout);
		font-weight: var(--weight-semibold);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		color: var(--text-default);
	}
	.mini--warning {
		color: var(--status-warning);
	}
	.mini--error {
		color: var(--status-error);
	}
	@container errors (max-height: 7rem) {
		.mini {
			display: inline;
		}
		.reading,
		.none {
			display: none;
		}
	}
	@container errors (max-height: 3.5rem) {
		:global(.widget.errors > .fill) {
			display: none;
		}
	}
</style>

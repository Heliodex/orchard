<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { apiFetch } from '$lib/stores';
	import { ScrollText } from 'lucide-svelte';
	import { Button, EmptyState, List, ListRow } from '$lib/components/ui';
	import Widget from '$lib/components/ui/Widget.svelte';
	import MetricPanel from '$lib/components/patterns/MetricPanel.svelte';
	import type { ChartSeries } from '$lib/components/ui/time-chart';

	type Kind = 'scanner' | 'injection' | 'auth-bruteforce' | 'flood';
	type Source = { ip: string; count: number; kinds: Kind[]; hidden?: boolean };
	type Report = {
		recorded?: boolean;
		byKind: Record<Kind, number>;
		series: ({ t: number } & Record<Kind, number>)[];
		topSources: Source[];
	};

	let {
		deploymentId,
		hasDomains = false,
		active
	}: { deploymentId: string; hasDomains?: boolean; active: boolean } = $props();

	const ACCESS_LOGS_DOCS = 'https://docs.orchard.hackclub.com/operate/logs/';

	const DAY = 24 * 60 * 60_000;
	const KINDS: { id: Kind; label: string; color: string }[] = [
		{ id: 'scanner', label: 'Scanners', color: 'var(--amber-7)' },
		{ id: 'injection', label: 'Injection', color: 'var(--red-7)' },
		{ id: 'auth-bruteforce', label: 'Password guessing', color: 'var(--hue-pink)' },
		{ id: 'flood', label: 'Floods', color: 'var(--blue-7)' }
	];
	const KIND = Object.fromEntries(KINDS.map((k) => [k.id, k])) as Record<
		Kind,
		(typeof KINDS)[number]
	>;

	let now = $state(Date.now());

	const query = createQuery<Report | null>(() => ({
		queryKey: ['attacks', deploymentId],
		enabled: !!deploymentId && active,
		staleTime: 60_000,
		queryFn: async () => {
			const end = Date.now();
			now = end;
			const res = await apiFetch(
				`/apiv1/deployments/${deploymentId}/security/attacks?start=${end - DAY}&end=${end}`
			);
			return res.ok ? ((await res.json()) as Report) : null;
		}
	}));

	const report = $derived(query.data ?? null);
	const total = $derived(report ? KINDS.reduce((n, k) => n + (report.byKind[k.id] ?? 0), 0) : 0);
	const series = $derived<ChartSeries[]>(
		report
			? KINDS.filter((k) => report.series.some((b) => b[k.id] > 0)).map((k) => ({
					id: k.id,
					label: k.label,
					color: k.color,
					points: report.series.map((b) => ({ x: b.t, y: b[k.id] ?? 0 }))
				}))
			: []
	);
	const count = (v: number) => Math.round(v).toLocaleString();
</script>

{#snippet kinds(source: Source)}
	<span class="kinds">
		{#each source.kinds as kind (kind)}
			<span class="kind"
				><span class="swatch" style:--swatch={KIND[kind].color}></span>{KIND[kind].label}</span
			>
		{/each}
	</span>
{/snippet}

{#if report?.recorded === false}
	{#if hasDomains}
		<Widget>
			<EmptyState
				title="Requests aren't recorded yet"
				description="Attack attempts appear here once access logs reach Orchard's log store."
			>
				{#snippet icon()}<ScrollText size={18} />{/snippet}
				<Button href={ACCESS_LOGS_DOCS} target="_blank" rel="noreferrer">Set up access logs</Button>
			</EmptyState>
		</Widget>
	{/if}
{:else if report}
	<div class="attacks">
		<MetricPanel
			title="Attack attempts"
			info="Requests that probed for secrets or admin pages, carried injection payloads, guessed passwords or flooded the app, from its access logs."
			{series}
			from={now - DAY}
			to={now}
			format={count}
			mode="stacked"
			modes={['stacked']}
			sum
			headline={total ? { value: `${count(total)} in 24h`, tone: 'warning' } : undefined}
			empty="No attack attempts in the last 24 hours"
		/>
		<Widget title="Top sources">
			{#if report.topSources.length}
				<List inset={false} label="Top sources">
					{#each report.topSources as source (source.hidden ? 'hidden' : source.ip)}
						<ListRow flush title={source.hidden ? 'Hidden by the load balancer' : source.ip}>
							{#snippet subtitle()}{@render kinds(source)}{/snippet}
							{#snippet trailing()}
								<span class="count">{count(source.count)}</span>
							{/snippet}
						</ListRow>
					{/each}
				</List>
			{:else}
				<p class="empty">No source stands out.</p>
			{/if}
		</Widget>
	</div>
{/if}

<style>
	.attacks {
		display: grid;
		grid-template-columns: minmax(0, 1.618fr) minmax(21rem, 1fr);
		gap: 1rem;
		align-items: stretch;
	}
	@media (max-width: 64rem) {
		.attacks {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
	}
	.kind {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		white-space: nowrap;
	}
	.swatch {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 2px;
		background: var(--swatch);
	}
	.count {
		color: var(--text-default);
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.empty {
		color: var(--text-muted);
		font-size: var(--text-footnote);
	}
	.empty {
		margin: 0;
		padding: 1rem 0;
	}
</style>

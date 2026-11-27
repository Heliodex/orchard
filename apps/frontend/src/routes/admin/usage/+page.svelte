<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/stores';
	import { formatCpuMilli, formatMemoryBytes } from '$lib/quantity';
	import { springRotate } from '$lib/utils/motion.svelte';
	import { ChevronRight, RefreshCw } from 'lucide-svelte';
	import {
		Alert,
		Avatar,
		Button,
		Card,
		EmptyState,
		ItemLabel,
		SectionCard,
		Skeleton,
		Stack,
		Swap,
		Table
	} from '$lib/components/ui';
	import type { TableColumn } from '$lib/components/ui/Table.svelte';
	import Metric from '$lib/components/ui/Metric.svelte';

	interface UsageRow {
		organization: { id: string; name: string; slug: string; avatarUrl: string | null };
		cpuMilli: number;
		memoryBytes: number;
		pods: number;
		byNode: Array<{ nodeName: string; cpuMilli: number; memBytes: number; pods: number }>;
	}

	type TableRow =
		| { kind: 'org'; key: string; org: UsageRow }
		| {
				kind: 'node';
				key: string;
				orgId: string;
				node: UsageRow['byNode'][number];
		  };

	const COLUMNS: TableColumn<TableRow>[] = [
		{ id: 'name', label: 'Organization' },
		{ id: 'cpu', label: 'CPU requested', numeric: true },
		{ id: 'memory', label: 'Memory requested', numeric: true },
		{ id: 'pods', label: 'Pods', numeric: true },
		{ id: 'nodes', label: 'Nodes', numeric: true }
	];

	let rows = $state<UsageRow[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let expanded = $state<Record<string, boolean>>({});

	const stage = $derived(
		loading ? 'loading' : error ? 'error' : rows.length === 0 ? 'empty' : 'ready'
	);

	const tableRows = $derived(
		rows.flatMap((org): TableRow[] => [
			{ kind: 'org', key: org.organization.id, org },
			...(expanded[org.organization.id]
				? org.byNode.map((node): TableRow => ({
						kind: 'node',
						key: `${org.organization.id}:${node.nodeName}`,
						orgId: org.organization.id,
						node
					}))
				: [])
		])
	);

	const totals = $derived({
		cpuMilli: rows.reduce((a, r) => a + r.cpuMilli, 0),
		memoryBytes: rows.reduce((a, r) => a + r.memoryBytes, 0),
		pods: rows.reduce((a, r) => a + r.pods, 0)
	});

	async function load() {
		loading = true;
		error = null;
		try {
			const res = await apiFetch('/apiv1/admin/usage');
			if (!res.ok) throw new Error(`The server answered ${res.status}.`);
			const next: UsageRow[] = await res.json();
			rows = next.toSorted((a, b) => b.cpuMilli - a.cpuMilli);
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't load usage";
		} finally {
			loading = false;
		}
	}

	function toggle(row: TableRow) {
		const id = row.kind === 'org' ? row.org.organization.id : row.orgId;
		expanded[id] = !expanded[id];
	}

	function rowLabel(row: TableRow) {
		if (row.kind === 'node') return `Collapse nodes`;
		const name = row.org.organization.name;
		return `${expanded[row.org.organization.id] ? 'Collapse' : 'Expand'} nodes for ${name}`;
	}

	onMount(load);
</script>

<Swap key={stage}>
	{#if stage === 'loading'}
		<Stack gap="md">
			<Skeleton height="5.5rem" rounded="var(--radius-card)" />
			<Skeleton height="16rem" rounded="var(--radius-card)" />
		</Stack>
	{:else if stage === 'error'}
		<Alert tone="error" title="Couldn't load usage">
			{error}
			{#snippet actions()}
				<Button variant="secondary" size="sm" onclick={load}>Try again</Button>
			{/snippet}
		</Alert>
	{:else if stage === 'empty'}
		<SectionCard flush>
			<EmptyState title="No workloads running yet">
				<Button variant="secondary" icon={RefreshCw} onclick={load}>Refresh</Button>
			</EmptyState>
		</SectionCard>
	{:else}
		<Stack gap="md">
			<div class="metrics">
				<Card>
					<Metric label="Total CPU requested" value={formatCpuMilli(totals.cpuMilli)} />
				</Card>
				<Card>
					<Metric label="Total memory requested" value={formatMemoryBytes(totals.memoryBytes)} />
				</Card>
				<Card><Metric label="Total pods" value={totals.pods} /></Card>
			</div>

			<Table
				columns={COLUMNS}
				rows={tableRows}
				rowKey={(row) => row.key}
				onRowClick={toggle}
				{rowLabel}
				label="Usage by organization"
			>
				{#snippet cell(row, col)}
					{#if row.kind === 'org'}
						{#if col.id === 'name'}
							<ItemLabel title={row.org.organization.name}>
								{#snippet leading()}
									<span class="lead">
										<span
											class="chevron"
											class:chevron--none={row.org.byNode.length === 0}
											{@attach springRotate(() => expanded[row.org.organization.id], {
												rest: 0,
												on: 90
											})}
										>
											<ChevronRight size={14} aria-hidden="true" />
										</span>
										<Avatar
											user={{
												id: row.org.organization.id,
												imageUrl: row.org.organization.avatarUrl
											}}
											size={24}
										/>
									</span>
								{/snippet}
							</ItemLabel>
						{:else if col.id === 'cpu'}
							{formatCpuMilli(row.org.cpuMilli)}
						{:else if col.id === 'memory'}
							{formatMemoryBytes(row.org.memoryBytes)}
						{:else if col.id === 'pods'}
							{row.org.pods}
						{:else}
							{row.org.byNode.length}
						{/if}
					{:else if col.id === 'name'}
						<span class="node" title={row.node.nodeName}>{row.node.nodeName}</span>
					{:else if col.id === 'cpu'}
						<span class="muted">{formatCpuMilli(row.node.cpuMilli)}</span>
					{:else if col.id === 'memory'}
						<span class="muted">{formatMemoryBytes(row.node.memBytes)}</span>
					{:else if col.id === 'pods'}
						<span class="muted">{row.node.pods}</span>
					{/if}
				{/snippet}
			</Table>
		</Stack>
	{/if}
</Swap>

<style>
	.metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--space-3);
	}
	.lead {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.chevron {
		display: inline-flex;
		color: var(--text-faint);
	}
	.chevron--none {
		visibility: hidden;
	}
	.node {
		min-width: 0;
		padding-left: 3.625rem;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-muted);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
	}
	.muted {
		color: var(--text-muted);
	}
</style>

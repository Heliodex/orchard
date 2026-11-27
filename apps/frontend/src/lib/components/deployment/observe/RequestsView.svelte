<script lang="ts">
	import { untrack } from 'svelte';
	import { Globe, Search, X } from 'lucide-svelte';
	import { apiFetch } from '$lib/stores';
	import {
		Button,
		Dropdown,
		EmptyState,
		Input,
		LogViewer,
		Modal,
		SegmentedControl,
		StatusBadge,
		Table
	} from '$lib/components/ui';
	import MetaList from '$lib/components/ui/MetaList.svelte';
	import { formatMemoryBytes } from '$lib/quantity';
	import type { TableColumn } from '$lib/components/ui/Table.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { httpStatus } from '$lib/components/ui/status';
	import { entryLine, type LogEntry } from './logs.svelte';

	type RequestRow = {
		t: string;
		method: string;
		host: string;
		path: string;
		route: string;
		status: number;
		durationMs: number;
		bytes: number | null;
		clientIp: string;
		userAgent: string;
		pod: string | null;
	};

	let {
		deploymentId,
		active,
		windowMs = 60 * 60_000,
		custom = null
	}: {
		deploymentId: string;
		active: boolean;
		windowMs?: number;
		custom?: { from: number; to: number } | null;
	} = $props();

	const MAX = 500;
	const COLUMNS: TableColumn<RequestRow>[] = [
		{ id: 'time', label: 'Time', width: '7rem' },
		{ id: 'method', label: 'Method', width: '5rem' },
		{ id: 'path', label: 'Path' },
		{ id: 'status', label: 'Status', width: '6rem' },
		{ id: 'duration', label: 'Duration', width: '6rem', align: 'end', numeric: true },
		{ id: 'client', label: 'Client', width: '9rem' }
	];

	const STATUS_OPTIONS = [
		{ value: 'all', label: 'All' },
		{ value: '2', label: '2xx' },
		{ value: '3', label: '3xx' },
		{ value: '4', label: '4xx' },
		{ value: '5', label: '5xx' }
	];
	const METHOD_OPTIONS = ['all', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(
		(m) => ({ value: m, label: m === 'all' ? 'Any method' : m })
	);
	const SLOW_OPTIONS = [
		{ value: '0', label: 'Any duration' },
		{ value: '100', label: 'Over 100 ms' },
		{ value: '500', label: 'Over 500 ms' },
		{ value: '1000', label: 'Over 1 s' },
		{ value: '5000', label: 'Over 5 s' }
	];

	let statusClass = $state('all');
	let method = $state('all');
	let minMs = $state('0');
	let pathQuery = $state('');
	let path = $state('');
	let client = $state<string | null>(null);
	let pathTimer: ReturnType<typeof setTimeout> | undefined;

	function setPath(v: string) {
		pathQuery = v;
		clearTimeout(pathTimer);
		pathTimer = setTimeout(() => (path = v.trim()), 300);
	}

	const filtered = $derived(
		statusClass !== 'all' || method !== 'all' || minMs !== '0' || !!path || !!client
	);

	function matches(r: RequestRow) {
		if (statusClass !== 'all' && Math.floor(r.status / 100) !== Number(statusClass)) return false;
		if (method !== 'all' && r.method !== method) return false;
		if (Number(minMs) && r.durationMs < Number(minMs)) return false;
		if (path && !r.path.toLowerCase().includes(path.toLowerCase())) return false;
		if (client && r.clientIp !== client) return false;
		return true;
	}

	function filterParams() {
		const p = new URLSearchParams();
		if (statusClass !== 'all') p.set('status', statusClass);
		if (method !== 'all') p.set('method', method);
		if (Number(minMs)) p.set('minMs', minMs);
		if (path) p.set('path', path);
		if (client) p.set('client', client);
		const q = p.toString();
		return q ? `&${q}` : '';
	}

	function clearFilters() {
		statusClass = 'all';
		method = 'all';
		minMs = '0';
		pathQuery = '';
		path = '';
		client = null;
	}

	let rows = $state<RequestRow[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let picked = $state<RequestRow | null>(null);
	let contextOpen = $state(false);
	let context = $state<LogEntry[]>([]);
	let contextLoading = $state(false);

	const time = (t: string) =>
		new Date(t).toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});

	const key = (r: RequestRow) => `${r.t}|${r.method}|${r.path}|${r.clientIp}|${r.status}`;

	async function load(id: string) {
		loading = true;
		const end = custom ? custom.to : Date.now();
		const start = custom ? custom.from : end - windowMs;
		try {
			const res = await apiFetch(
				`/apiv1/observe/deployments/${encodeURIComponent(id)}/requests?view=recent&start=${start}&end=${end}&limit=${MAX}${filterParams()}`
			);
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
			rows = body?.requests ?? [];
			error = null;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		const id = deploymentId;
		void windowMs;
		void custom;
		void filterParams();
		if (!id || !active) return;
		untrack(() => load(id));
	});

	$effect(() => {
		const id = deploymentId;
		if (!id || !active || custom || error) return;
		const es = new EventSource(
			`/apiv1/observe/deployments/${encodeURIComponent(id)}/requests/stream`
		);
		es.onmessage = (e) => {
			try {
				const fresh: RequestRow[] = JSON.parse(e.data)?.requests ?? [];
				if (!fresh.length) return;
				const known = new Set(rows.map(key));
				const next = fresh.filter((r) => !known.has(key(r)) && matches(r));
				if (next.length) rows = [...next.reverse(), ...rows].slice(0, MAX);
			} catch {
				return;
			}
		};
		return () => es.close();
	});

	async function open(row: RequestRow) {
		picked = row;
		contextOpen = true;
		contextLoading = true;
		context = [];
		const at = Date.parse(row.t);
		try {
			const res = await apiFetch(
				`/apiv1/observe/deployments/${encodeURIComponent(deploymentId)}/logs/context?at=${at}&before=30000&after=30000`
			);
			const body = await res.json().catch(() => null);
			context = res.ok ? (body?.entries ?? []) : [];
		} finally {
			contextLoading = false;
		}
	}

	const contextLines = $derived(context.map(entryLine));

	const pickedFacts = $derived(
		picked
			? [
					{ label: `${Math.round(picked.durationMs)} ms` },
					...(picked.bytes != null ? [{ label: formatMemoryBytes(picked.bytes) }] : []),
					{ label: picked.clientIp, mono: true },
					{ label: new Date(picked.t).toLocaleString() }
				]
			: []
	);
</script>

{#snippet cell(r: RequestRow, col: TableColumn<RequestRow>)}
	{#if col.id === 'time'}
		<span class="mono faint">{time(r.t)}</span>
	{:else if col.id === 'method'}
		<span class="mono">{r.method}</span>
	{:else if col.id === 'path'}
		<span class="mono path" title="{r.host}{r.path}">{r.path}</span>
	{:else if col.id === 'status'}
		<StatusBadge meta={httpStatus(r.status)} />
	{:else if col.id === 'duration'}
		<span class="mono">{Math.round(r.durationMs)} ms</span>
	{:else}
		<button
			type="button"
			class="mono faint client"
			title="Only requests from {r.clientIp}"
			onclick={(e) => {
				e.stopPropagation();
				client = r.clientIp;
			}}>{r.clientIp}</button
		>
	{/if}
{/snippet}

{#if !error}
	<div class="filters">
		<div class="search">
			<Input
				size="sm"
				shape="capsule"
				icon={Search}
				placeholder="Filter by path"
				value={pathQuery}
				oninput={(e: Event) => setPath((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<SegmentedControl
			label="Status"
			size="sm"
			shape="capsule"
			options={STATUS_OPTIONS}
			value={statusClass}
			onchange={(v) => (statusClass = v)}
		/>
		<div class="pick">
			<Dropdown
				size="sm"
				shape="capsule"
				ariaLabel="Method"
				options={METHOD_OPTIONS}
				value={method}
				onchange={(v) => (method = v)}
			/>
		</div>
		<div class="pick">
			<Dropdown
				size="sm"
				shape="capsule"
				ariaLabel="Duration"
				options={SLOW_OPTIONS}
				value={minMs}
				onchange={(v) => (minMs = v)}
			/>
		</div>
		{#if client}
			<Button variant="secondary" size="sm" iconRight={X} onclick={() => (client = null)}
				><span class="mono">{client}</span></Button
			>
		{/if}
		{#if filtered}
			<Button variant="ghost" size="sm" onclick={clearFilters}>Clear</Button>
		{/if}
	</div>
{/if}

{#if loading && rows.length === 0}
	<Skeleton height="20rem" rounded="calc(var(--radius-widget) * var(--corner-scale))" />
{:else if error}
	<EmptyState title="Requests aren't recorded here" description={error}>
		{#snippet icon()}<Globe size={18} />{/snippet}
	</EmptyState>
{:else if rows.length === 0}
	<EmptyState
		title={filtered ? 'No requests match these filters' : 'No requests in this range'}
		description={filtered
			? undefined
			: 'Requests show up here as they reach the app through its domains.'}
	>
		{#snippet icon()}<Globe size={18} />{/snippet}
		{#if filtered}<Button variant="secondary" size="sm" onclick={clearFilters}>Clear filters</Button
			>{/if}
	</EmptyState>
{:else}
	<Table
		label="Requests"
		dense
		columns={COLUMNS}
		{rows}
		{cell}
		rowKey={key}
		rowLabel={(r) => `${r.method} ${r.path} ${r.status}`}
		onRowClick={open}
	/>
{/if}

<Modal
	bind:open={contextOpen}
	title={picked ? `${picked.method} ${picked.path}` : 'Request'}
	size="lg"
>
	{#if picked}
		<div class="request">
			<div class="request-head">
				<StatusBadge meta={httpStatus(picked.status)} />
				<span class="mono url" title="{picked.host}{picked.path}">{picked.host}{picked.path}</span>
			</div>
			<MetaList items={pickedFacts} />
			{#if picked.userAgent}<p class="ua" title={picked.userAgent}>{picked.userAgent}</p>{/if}
		</div>
	{/if}
	<p class="context-label">App logs 30 seconds either side</p>
	<div class="context">
		<LogViewer
			lines={contextLines}
			loading={contextLoading}
			toolbar
			filename="request-context"
			sourceLabel="Pod"
		>
			{#snippet empty()}
				<p class="context-empty">The app wrote no log lines around this request.</p>
			{/snippet}
		</LogViewer>
	</div>
</Modal>

<style>
	.mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
	}
	.faint {
		color: var(--text-faint);
	}
	.path {
		display: block;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.search {
		flex: 1 1 14rem;
		min-width: 10rem;
		max-width: 22rem;
	}
	.pick {
		width: 9.5rem;
	}
	.client {
		display: block;
		min-width: 0;
		max-width: 100%;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
	}
	.client:hover {
		color: var(--text-default);
		text-decoration: underline;
	}
	.request {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-width: 0;
		margin-bottom: 1rem;
	}
	.request-head {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 0;
	}
	.url {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-default);
	}
	.ua {
		margin: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-faint);
		font-size: var(--text-caption);
	}
	.context-label {
		margin: 0 0 0.5rem;
		color: var(--text-muted);
		font-size: var(--text-callout);
	}
	.context-empty {
		margin: 0;
		color: var(--text-faint);
		font-size: var(--text-callout);
	}
	.context {
		height: 24rem;
		display: flex;
		flex-direction: column;
	}
</style>

<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { Boxes, Download, File, FileSymlink, Folder, FolderUp } from 'lucide-svelte';
	import { apiBase, apiFetch } from '$lib/stores/api';
	import { formatMemory } from '$lib/utils/format';
	import type { Pod } from '$lib/types/deployment';
	import { getNewestPod, podLabel } from './deployment-helpers';
	import Alert from '$lib/components/ui/Alert.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Menu from '$lib/components/ui/Menu.svelte';
	import MenuItem from '$lib/components/ui/MenuItem.svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import SelectTrigger from '$lib/components/ui/SelectTrigger.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Table, { type TableColumn } from '$lib/components/ui/Table.svelte';

	type FileKind = 'file' | 'dir' | 'symlink' | 'other';

	interface Entry {
		name: string;
		kind: FileKind;
		size: number | null;
	}

	interface Listing {
		path: string;
		entries: Entry[];
	}

	let {
		deploymentId,
		namespace,
		pods = [],
		active = true
	}: {
		deploymentId: string;
		namespace: string;
		pods?: Pod[];
		active?: boolean;
	} = $props();

	const runningPods = $derived(
		pods.filter((p) => ['running', 'ready'].includes(p.status?.toLowerCase() ?? ''))
	);

	let chosenPod = $state<string>('');
	const podName = $derived(
		runningPods.some((p) => p.name === chosenPod)
			? chosenPod
			: (getNewestPod(runningPods)?.name ?? '')
	);

	function podChoice(pod: Pod | undefined): string {
		if (!pod) return '';
		const container = pod.containers?.[0]?.name;
		return container ? `${podLabel(pod.name)} / ${container}` : podLabel(pod.name);
	}

	let path = $state('/');

	const segments = $derived(path.split('/').filter(Boolean));

	function childPath(dir: string, name: string): string {
		return dir === '/' ? `/${name}` : `${dir}/${name}`;
	}

	function parentOf(dir: string): string {
		const parts = dir.split('/').filter(Boolean);
		parts.pop();
		return '/' + parts.join('/');
	}

	function crumbPath(index: number): string {
		return '/' + segments.slice(0, index + 1).join('/');
	}

	function query(extra: Record<string, string> = {}): string {
		return new URLSearchParams({ namespace, ...extra }).toString();
	}

	async function errorMessage(res: Response): Promise<string> {
		try {
			const body = await res.json();
			if (typeof body?.message === 'string') return body.message;
		} catch {
			return res.statusText || `Request failed (${res.status})`;
		}
		return res.statusText || `Request failed (${res.status})`;
	}

	const listingQuery = createQuery(() => ({
		queryKey: ['deployment-files', deploymentId, podName, path],
		queryFn: async (): Promise<Listing> => {
			const res = await apiFetch(
				`/apiv1/pods/${encodeURIComponent(podName)}/files?${query({ path })}`
			);
			if (!res.ok) throw new Error(await errorMessage(res));
			return (await res.json()) as Listing;
		},
		enabled: active && !!deploymentId && !!podName,
		staleTime: 10_000,
		retry: false
	}));

	const listing = $derived(listingQuery.data as Listing | undefined);
	const loadError = $derived(
		listingQuery.error && !listing ? (listingQuery.error as Error).message : null
	);

	const columns: TableColumn<Entry>[] = [
		{ id: 'name', label: 'Name' },
		{ id: 'size', label: 'Size', align: 'end', numeric: true, width: '6rem' },
		{ id: 'action', label: '', align: 'end' }
	];

	function downloadHref(name: string): string {
		return `${$apiBase}/apiv1/pods/${encodeURIComponent(podName)}/files/download?${query({
			path: childPath(path, name)
		})}`;
	}

	function open(name: string) {
		path = childPath(path, name);
	}
</script>

<SectionCard title="Files" description="Browse the container's file system and download files.">
	{#if runningPods.length === 0}
		<EmptyState title="No running pods" description="Files are read from a running pod." />
	{:else}
		<div class="files">
			<div class="toolbar">
				<Menu placement="bottom-start">
					{#snippet trigger(attrs, isOpen)}
						<SelectTrigger
							shape="capsule"
							{...attrs}
							open={isOpen}
							size="sm"
							mono
							value={podChoice(runningPods.find((p) => p.name === podName))}
							placeholder="Pick a pod"
						/>
					{/snippet}
					{#each runningPods as pod (pod.name)}
						<MenuItem
							icon={Boxes}
							checked={pod.name === podName}
							onclick={() => (chosenPod = pod.name)}
						>
							{podChoice(pod)}
						</MenuItem>
					{/each}
				</Menu>
				<nav class="crumbs" aria-label="Current folder">
					<Button variant="ghost" size="sm" onclick={() => (path = '/')}>/</Button>
					{#each segments as segment, i (i)}
						<Button variant="ghost" size="sm" onclick={() => (path = crumbPath(i))}>
							{segment}
						</Button>
					{/each}
				</nav>
			</div>

			{#if listing && path !== '/'}
				<div class="up">
					<Button variant="ghost" size="sm" icon={FolderUp} onclick={() => (path = parentOf(path))}>
						Up one level
					</Button>
				</div>
			{/if}

			{#if loadError}
				<Alert tone="error" title="Could not read this folder">{loadError}</Alert>
			{:else if !listing}
				<div class="loading" aria-busy="true">
					<Skeleton height="2rem" />
					<Skeleton height="2rem" />
					<Skeleton height="2rem" />
				</div>
			{:else if listing.entries.length === 0}
				<EmptyState title="Empty folder" />
			{:else}
				<Table
					{columns}
					rows={listing.entries}
					rowKey={(e: Entry) => e.name}
					onRowClick={(e: Entry) => open(e.name)}
					rowActive={(e: Entry) => e.kind === 'dir'}
					rowLabel={(e: Entry) => `Open ${e.name}`}
					label="Files in {path}"
				>
					{#snippet cell(entry, col)}
						{#if col.id === 'name'}
							<span class="name">
								{#if entry.kind === 'dir'}
									<Folder size={16} aria-hidden="true" />
								{:else if entry.kind === 'symlink'}
									<FileSymlink size={16} aria-hidden="true" />
								{:else}
									<File size={16} aria-hidden="true" />
								{/if}
								<span>{entry.name}</span>
							</span>
						{:else if col.id === 'size'}
							<span class="muted">
								{#if entry.kind === 'other'}
									special file
								{:else if entry.kind === 'file' && entry.size != null}
									{formatMemory(entry.size)}
								{/if}
							</span>
						{:else if entry.kind === 'file' || entry.kind === 'symlink'}
							<a class="download" href={downloadHref(entry.name)} download={entry.name}>
								<Download size={14} aria-hidden="true" />
								<span>Download</span>
							</a>
						{/if}
					{/snippet}
				</Table>
			{/if}
		</div>
	{/if}
</SectionCard>

<style>
	.files {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}

	.loading {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.name {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		color: var(--text-default, inherit);
		overflow-wrap: anywhere;
	}

	.muted {
		color: var(--text-muted, inherit);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		padding-inline-end: 1.5rem;
	}

	.download {
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--accent, inherit);
		text-decoration: none;
	}

	.download:hover {
		text-decoration: underline;
	}

	.up {
		display: flex;
		justify-content: flex-start;
	}
</style>

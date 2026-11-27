<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy, untrack } from 'svelte';
	import { apiFetch, toasts, selectedOrganization, subscribeOrgEvents } from '$lib/stores';
	import { Loader2, RefreshCw, MoreVertical, Trash2, Terminal } from 'lucide-svelte';
	import {
		Button,
		Dropdown,
		Alert,
		Menu,
		MenuItem,
		StatusDot,
		PageHeader,
		LogViewer,
		podStatus,
		statusMeta
	} from '$lib/components/ui';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { PodLogSource } from '$lib/utils/log-sources.svelte';
	import { formatRelativeTime } from '$lib/utils/format';
	import type { PageData } from './$types';

	interface ContainerStatus {
		name: string;
		ready: boolean;
		restartCount?: number;
	}

	interface PodContainer {
		name: string;
		image: string;
	}

	interface Pod {
		metadata: {
			name: string;
			namespace: string;
		};
		spec: {
			containers: PodContainer[];
		};
		status: {
			phase: string;
			podIP?: string;
			hostIP?: string;
			startTime?: string;
			containerStatuses?: ContainerStatus[];
		};
	}

	let pod = $state<Pod | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedContainer = $state<string>('');
	let live = $state(false);
	let scrolledUp = $state(false);
	let showDeleteModal = $state(false);
	let deleting = $state(false);

	let { data } = $props<{ data: PageData }>();
	const podName = $derived(data.podName);
	const orgSlug = $derived($page.params.orgSlug);
	const namespace = $derived(data.namespace);
	let podSseUnsub: (() => void) | null = null;

	const logSource = new PodLogSource({
		podName: () => podName,
		namespace: () => namespace,
		container: () => selectedContainer,
		restarts: () =>
			pod?.status?.containerStatuses?.find((s) => s.name === selectedContainer)?.restartCount ?? 0
	});

	const containers = $derived(pod?.spec?.containers ?? []);
	const singleImage = $derived(containers.length === 1 ? containers[0].image : null);

	async function fetchPodDetails(opts?: { silent?: boolean }) {
		const silent = opts?.silent === true;
		if (!silent) {
			loading = true;
			error = null;
		}

		try {
			const response = await apiFetch(`/apiv1/pods/${podName}?namespace=${namespace}`);
			if (!response.ok) {
				throw new Error("Couldn't load pod details");
			}
			pod = await response.json();
			if (pod?.spec?.containers?.length && !selectedContainer) {
				selectedContainer = pod.spec.containers[0].name;
			}
		} catch (e) {
			if (!silent) {
				error = e instanceof Error ? e.message : "Couldn't load pod details";
			}
		} finally {
			if (!silent) loading = false;
		}
	}

	async function deletePod() {
		if (deleting) return;
		deleting = true;
		try {
			const res = await apiFetch(`/apiv1/pods/${podName}?namespace=${namespace}`, {
				method: 'DELETE'
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.message || "Couldn't delete pod");
			}
			toasts.add({
				title: 'Pod deleted',
				description: 'Kubernetes starts a replacement',
				color: 'success'
			});
			window.history.back();
		} catch (e) {
			toasts.add({
				title: "Couldn't delete pod",
				description: e instanceof Error ? e.message : "Couldn't delete pod",
				color: 'error'
			});
		} finally {
			deleting = false;
		}
	}

	$effect(() => {
		const container = selectedContainer;
		if (!container) return;
		untrack(() => {
			logSource.clear();
			logSource.refresh();
		});
	});

	$effect(() => {
		if (!live || !selectedContainer) return;
		const handle = setInterval(() => {
			if (document.hidden) return;
			logSource.refresh();
		}, 3000);
		return () => clearInterval(handle);
	});

	onMount(() => {
		data.podPromise
			.then((seed: any) => {
				if (!pod) {
					pod = seed;
					if (pod?.spec?.containers?.length && !selectedContainer) {
						selectedContainer = pod.spec.containers[0].name;
					}
					loading = false;
				}
			})
			.catch(() => {});
		fetchPodDetails();
		const orgIdForSse = $selectedOrganization?.id;
		if (orgIdForSse) {
			podSseUnsub = subscribeOrgEvents(orgIdForSse, (ev) => {
				if (ev.type === 'pod.changed' || ev.type === 'deployment.changed') {
					fetchPodDetails({ silent: true });
				}
			});
		}
	});

	onDestroy(() => podSseUnsub?.());
</script>

<div class="mx-auto max-w-5xl p-6">
	{#if error}
		<div class="mb-6">
			<Alert tone="error" title={error} />
		</div>
	{/if}

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="text-center">
				<Loader2 class="mx-auto h-8 w-8 animate-spin text-primary-600" />
				<p class="mt-2 text-sm text-muted">Loading pod details…</p>
			</div>
		</div>
	{:else if pod}
		<PageHeader
			back={{ label: 'Back', onclick: () => window.history.back() }}
			title={pod.metadata.name}
			mono
			status={podStatus(pod.status.phase)}
		>
			{#snippet meta()}
				<span>{pod.metadata.namespace}</span>
				{#if pod.status.startTime}
					<span class="meta-sep">&middot;</span>
					<span title={new Date(pod.status.startTime).toLocaleString()}>
						started {formatRelativeTime(new Date(pod.status.startTime))}
					</span>
				{/if}
				{#if pod.status.podIP}
					<span class="meta-sep">&middot;</span>
					<span class="type-ident">{pod.status.podIP}</span>
				{/if}
				{#if pod.status.hostIP}
					<span class="type-ident">&rarr; node {pod.status.hostIP}</span>
				{/if}
				{#if singleImage}
					<span class="meta-sep">&middot;</span>
					<span class="type-ident truncate" title={singleImage}>{singleImage}</span>
				{/if}
			{/snippet}
			{#snippet actions()}
				<Button variant="secondary" size="sm" onclick={() => fetchPodDetails()} disabled={loading}>
					<RefreshCw class="h-4 w-4" />
					Refresh
				</Button>
				<Menu placement="bottom-end">
					{#snippet trigger(attrs, _open)}
						<Button variant="ghost" size="sm" aria-label="More actions" {...attrs}>
							<MoreVertical class="h-4 w-4" />
						</Button>
					{/snippet}
					<MenuItem onclick={() => (showDeleteModal = true)}>
						<Trash2 size={14} /> Delete pod
					</MenuItem>
				</Menu>
			{/snippet}
		</PageHeader>

		{#if containers.length > 1}
			<div class="pod-containers">
				{#each containers as container (container.name)}
					{@const cs = pod.status.containerStatuses?.find((s) => s.name === container.name)}
					<button
						type="button"
						class="pod-container-row"
						class:pod-container-row--active={selectedContainer === container.name}
						onclick={() => (selectedContainer = container.name)}
					>
						<StatusDot
							meta={statusMeta(cs?.ready ? 'success' : 'error', cs?.ready ? 'Ready' : 'Not ready')}
							size={8}
						/>
						<span class="pod-container-name">{container.name}</span>
						<span class="pod-container-image" title={container.image}>{container.image}</span>
					</button>
				{/each}
			</div>
		{/if}

		<div class="pod-logs">
			<div class="pod-logs-toolbar">
				{#if containers.length > 1}
					<div class="pod-logs-container">
						<Dropdown
							bind:value={selectedContainer}
							ariaLabel="Container"
							options={containers.map((container) => ({
								value: container.name,
								label: container.name
							}))}
						/>
					</div>
				{/if}
				<div class="flex-1"></div>
				<Button variant={live ? 'primary' : 'secondary'} size="sm" onclick={() => (live = !live)}>
					Live
				</Button>
				<Button
					variant="secondary"
					size="sm"
					onclick={() => logSource.refresh()}
					loading={logSource.loading}
					aria-label="Refresh logs"
				>
					{#if !logSource.loading}
						<RefreshCw class="h-4 w-4" />
					{/if}
				</Button>
			</div>
			<LogViewer
				surface="dark"
				toolbar
				filename={podName}
				lines={logSource.lines}
				loading={logSource.loading}
				loadingMore={logSource.loadingMore}
				error={logSource.error}
				atStart={logSource.atStart}
				bind:scrolledUp
				onLoadEarlier={() => logSource.loadEarlier()}
			>
				{#snippet empty()}
					<div class="pod-logs-empty">
						<Terminal size={16} class="h-4 w-4 opacity-30" />
						<span>No output yet</span>
					</div>
				{/snippet}
			</LogViewer>
		</div>
	{/if}
</div>

<ConfirmModal
	bind:open={showDeleteModal}
	title="Delete pod"
	description="The pod stops, and Kubernetes starts a replacement."
	confirmLabel="Delete pod"
	onconfirm={deletePod}
	oncancel={() => {}}
/>

<style>
	.meta-sep {
		opacity: 0.5;
	}

	.pod-containers {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		margin-bottom: 1rem;
	}

	.pod-container-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		border: none;
		background: none;
		text-align: start;
		cursor: pointer;
		min-width: 0;
		transition: background-color var(--dur-fast) ease;
	}

	.pod-container-row:hover {
		background-color: var(--bg-hover);
	}

	.pod-container-row--active {
		background-color: var(--accent-subtle);
	}

	.pod-container-name {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		color: var(--text-default);
		flex-shrink: 0;
	}

	.pod-container-image {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.pod-logs {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.pod-logs-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.pod-logs-container {
		width: 14rem;
		min-width: 0;
	}

	.pod-logs :global(.lv--dark) {
		height: min(62vh, 40rem);
	}

	.pod-logs-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 3rem 1rem;
		opacity: 0.7;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
	}
</style>

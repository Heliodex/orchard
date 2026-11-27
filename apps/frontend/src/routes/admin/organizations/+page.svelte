<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Building2,
		ChevronLeft,
		ChevronRight,
		Gauge,
		MoreHorizontal,
		Pencil,
		Plus,
		Trash2
	} from 'lucide-svelte';
	import { apiFetch, instanceFeatures, toasts } from '$lib/stores';
	import { formatCpuMilli, formatMemoryBytes } from '$lib/quantity';
	import {
		Alert,
		Avatar,
		Button,
		Dropdown,
		EmptyState,
		Field,
		FieldGrid,
		Input,
		ItemLabel,
		List,
		ListRow,
		Menu,
		MenuItem,
		Modal,
		ModalIntro,
		RelativeTime,
		SearchField,
		SearchPicker,
		SectionCard,
		SectionTitle,
		SegmentedControl,
		Skeleton,
		Stack,
		Swap,
		Table,
		Textarea
	} from '$lib/components/ui';
	import type { TableColumn } from '$lib/components/ui/Table.svelte';
	import Metric from '$lib/components/ui/Metric.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

	interface OrgItem {
		id: string;
		name: string;
		slug: string;
		description?: string | null;
		avatarUrl?: string | null;
		plan?: string | null;
		createdAt: string;
		creator?: {
			id: string;
			email: string;
			username: string;
			firstName?: string | null;
			lastName?: string | null;
		} | null;
		_count: {
			members: number;
			projects: number;
		};
	}

	type CapId = 'cpu' | 'memory' | 'pods' | 'services' | 'projects' | 'environments' | 'deployments';

	const COLUMNS: TableColumn<OrgItem>[] = [
		{ id: 'organization', label: 'Organization', width: 'minmax(14rem, 1fr)' },
		{ id: 'members', label: 'Members', numeric: true },
		{ id: 'projects', label: 'Projects', numeric: true },
		{ id: 'creator', label: 'Creator', width: 'minmax(5rem, 9rem)' },
		{ id: 'created', label: 'Created', width: '5.5rem' },
		{ id: 'actions', width: '3.5rem', align: 'end' }
	];

	const PLAN_OPTIONS = [
		{ value: '', label: 'None' },
		{ value: 'free', label: 'Free' },
		{ value: 'pro', label: 'Pro' },
		{ value: 'enterprise', label: 'Enterprise' }
	];

	const CAPS: { id: CapId; label: string; unit: string; example: string }[] = [
		{ id: 'cpu', label: 'CPU', unit: 'millicores', example: '4000' },
		{ id: 'memory', label: 'Memory', unit: 'MiB', example: '8192' },
		{ id: 'pods', label: 'Max pods', unit: 'pods', example: '100' },
		{ id: 'services', label: 'Max services', unit: 'services', example: '20' },
		{ id: 'projects', label: 'Max projects', unit: 'projects', example: '50' },
		{ id: 'environments', label: 'Max environments', unit: 'environments', example: '100' },
		{ id: 'deployments', label: 'Max deployments', unit: 'deployments', example: '200' }
	];

	const CAP_MODES = [
		{ value: 'unlimited', label: 'Unlimited' },
		{ value: 'custom', label: 'Set a limit' }
	];

	let organizations = $state<OrgItem[]>([]);
	let loaded = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let total = $state(0);
	let currentPage = $state(1);
	let totalPages = $state(1);
	let searchQuery = $state('');
	let searchTimeout: ReturnType<typeof setTimeout>;
	let latestRequest = 0;

	let showCreate = $state(false);
	let createName = $state('');
	let createSlug = $state('');
	let createDescription = $state('');
	let createImageUrl = $state('');
	let createPlan = $state('');
	let createPrimaryOwnerEmail = $state('');
	let creating = $state(false);

	let editOpen = $state(false);
	let editingOrg = $state<OrgItem | null>(null);
	let editName = $state('');
	let editDescription = $state('');
	let saving = $state(false);

	let deleteOpen = $state(false);
	let deletingOrg = $state<OrgItem | null>(null);

	let quotaOpen = $state(false);
	let quotaOrg = $state<OrgItem | null>(null);
	let quotaLoading = $state(false);
	let quotaSaving = $state(false);
	let quotaUsage = $state<{
		cpuMilli: number;
		memoryBytes: number;
		pods: number;
		services: number;
	} | null>(null);
	let qCaps = $state<Record<CapId, { custom: boolean; value: string | number }>>(emptyCaps());
	let qDefaultCpu = $state<string | number>('');
	let qDefaultMemMi = $state<string | number>('');

	let qConnections = $state<Array<{ id: string; name: string; slug: string }>>([]);
	let qConnectSearch = $state('');
	let qConnectPick = $state('');
	let qConnectResults = $state<OrgItem[]>([]);
	let qConnectSearching = $state(false);
	let qConnectBusy = $state(false);
	let qConnectSearchTimeout: ReturnType<typeof setTimeout>;

	const view = $derived(
		!loaded ? 'loading' : loadError ? 'error' : organizations.length === 0 ? 'empty' : 'rows'
	);
	const pristine = $derived(view === 'empty' && !searchQuery.trim());

	const connectOptions = $derived(
		qConnectResults.map((o) => ({ value: o.id, label: o.name, description: o.slug }))
	);

	const usageTiles = $derived.by(() => {
		if (!quotaUsage) return [];
		const count = (n: number) => n.toLocaleString();
		const memoryCap = parseIntOrNull(capValue('memory'));
		const tile = (
			id: CapId,
			label: string,
			used: number,
			cap: number | null,
			format: (n: number) => string
		) => ({
			id,
			label,
			value: format(used),
			detail: cap === null ? 'No limit' : `of ${format(cap)}`,
			over: cap !== null && used > cap
		});
		return [
			tile('cpu', 'CPU', quotaUsage.cpuMilli, parseIntOrNull(capValue('cpu')), formatCpuMilli),
			tile(
				'memory',
				'Memory',
				quotaUsage.memoryBytes,
				memoryCap === null ? null : memoryCap * 1024 * 1024,
				formatMemoryBytes
			),
			tile('pods', 'Pods', quotaUsage.pods, parseIntOrNull(capValue('pods')), count),
			tile('services', 'Services', quotaUsage.services, parseIntOrNull(capValue('services')), count)
		];
	});

	function emptyCaps(): Record<CapId, { custom: boolean; value: string | number }> {
		return {
			cpu: { custom: false, value: '' },
			memory: { custom: false, value: '' },
			pods: { custom: false, value: '' },
			services: { custom: false, value: '' },
			projects: { custom: false, value: '' },
			environments: { custom: false, value: '' },
			deployments: { custom: false, value: '' }
		};
	}

	function capValue(id: CapId) {
		return qCaps[id].custom ? qCaps[id].value : '';
	}

	function capFrom(value: number | null | undefined) {
		return { custom: !!value, value: value ? String(value) : '' };
	}

	function parseIntOrNull(v: string | number | null | undefined): number | null {
		const t = String(v ?? '').trim();
		if (!t) return null;
		const n = parseInt(t, 10);
		return Number.isFinite(n) && n > 0 ? n : null;
	}

	function creatorName(org: OrgItem) {
		if (!org.creator) return null;
		return org.creator.firstName || org.creator.username || org.creator.email;
	}

	function orgDetail(org: OrgItem) {
		return org.description ? `${org.slug} · ${org.description}` : org.slug;
	}

	function applyQuota(data: {
		usage: NonNullable<typeof quotaUsage>;
		org: {
			cpuLimitMilli: number | null;
			memoryLimitBytes: number | null;
			maxPods: number | null;
			maxServices: number | null;
			maxProjects: number | null;
			maxEnvironments: number | null;
			maxDeployments: number | null;
			defaultPodCpuMilli: number | null;
			defaultPodMemoryBytes: number | null;
		};
		connections?: typeof qConnections;
	}) {
		const toMi = (bytes: number | null) => (bytes ? Math.round(bytes / (1024 * 1024)) : null);
		quotaUsage = data.usage;
		qCaps = {
			cpu: capFrom(data.org.cpuLimitMilli),
			memory: capFrom(toMi(data.org.memoryLimitBytes)),
			pods: capFrom(data.org.maxPods),
			services: capFrom(data.org.maxServices),
			projects: capFrom(data.org.maxProjects),
			environments: capFrom(data.org.maxEnvironments),
			deployments: capFrom(data.org.maxDeployments)
		};
		qDefaultCpu = data.org.defaultPodCpuMilli ? String(data.org.defaultPodCpuMilli) : '';
		qDefaultMemMi = toMi(data.org.defaultPodMemoryBytes)?.toString() ?? '';
		qConnections = data.connections ?? [];
	}

	async function openQuota(org: OrgItem) {
		quotaOrg = org;
		quotaOpen = true;
		quotaLoading = true;
		quotaUsage = null;
		qCaps = emptyCaps();
		qDefaultCpu = qDefaultMemMi = '';
		qConnections = [];
		qConnectSearch = '';
		qConnectPick = '';
		qConnectResults = [];
		try {
			const res = await apiFetch(`/apiv1/admin/organizations/${org.id}/quota`);
			if (!res.ok) throw new Error("Couldn't load quota");
			applyQuota(await res.json());
		} catch (e) {
			toasts.add({
				title: "Couldn't load quotas",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
			quotaOpen = false;
		} finally {
			quotaLoading = false;
		}
	}

	function closeQuota() {
		quotaOpen = false;
	}

	function handleConnectSearch() {
		clearTimeout(qConnectSearchTimeout);
		qConnectSearching = !!qConnectSearch.trim();
		qConnectSearchTimeout = setTimeout(async () => {
			const q = qConnectSearch.trim();
			if (!q) {
				qConnectResults = [];
				qConnectSearching = false;
				return;
			}
			try {
				const params = new URLSearchParams({ page: '1', limit: '8', search: q });
				const res = await apiFetch(`/apiv1/admin/organizations?${params}`);
				if (!res.ok) return;
				const data = await res.json();
				const connectedIds = new Set(qConnections.map((c) => c.id));
				qConnectResults = (data.organizations as OrgItem[]).filter(
					(o) => o.id !== quotaOrg?.id && !connectedIds.has(o.id)
				);
			} catch {
				qConnectResults = [];
			} finally {
				qConnectSearching = false;
			}
		}, 250);
	}

	async function refreshQuota() {
		if (!quotaOrg) return;
		const res = await apiFetch(`/apiv1/admin/organizations/${quotaOrg.id}/quota`);
		if (!res.ok) return;
		applyQuota(await res.json());
	}

	async function connectOrg(other: OrgItem) {
		if (!quotaOrg) return;
		qConnectPick = '';
		qConnectBusy = true;
		try {
			const res = await apiFetch(`/apiv1/admin/organizations/${quotaOrg.id}/quota/connect`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ otherOrgId: other.id })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || "Couldn't connect");
			}
			toasts.add({
				title: 'Connected',
				description: `${quotaOrg.name} and ${other.name} now share the same quota pool.`,
				color: 'success'
			});
			await refreshQuota();
		} catch (e) {
			toasts.add({
				title: "Couldn't connect",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			qConnectResults = [];
			qConnectSearch = '';
			qConnectBusy = false;
		}
	}

	async function disconnectQuota() {
		if (!quotaOrg) return;
		qConnectBusy = true;
		try {
			const res = await apiFetch(`/apiv1/admin/organizations/${quotaOrg.id}/quota/disconnect`, {
				method: 'POST'
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || "Couldn't disconnect");
			}
			toasts.add({
				title: 'Disconnected',
				description: 'Quota pool is no longer shared.',
				color: 'success'
			});
			await refreshQuota();
		} catch (e) {
			toasts.add({
				title: "Couldn't disconnect",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			qConnectBusy = false;
		}
	}

	async function saveQuota() {
		if (!quotaOrg) return;
		quotaSaving = true;
		try {
			const memMi = parseIntOrNull(capValue('memory'));
			const defMemMi = parseIntOrNull(qDefaultMemMi);
			const body = {
				cpuLimitMilli: parseIntOrNull(capValue('cpu')),
				memoryLimitBytes: memMi === null ? null : memMi * 1024 * 1024,
				maxPods: parseIntOrNull(capValue('pods')),
				maxServices: parseIntOrNull(capValue('services')),
				maxProjects: parseIntOrNull(capValue('projects')),
				maxEnvironments: parseIntOrNull(capValue('environments')),
				maxDeployments: parseIntOrNull(capValue('deployments')),
				defaultPodCpuMilli: parseIntOrNull(qDefaultCpu),
				defaultPodMemoryBytes: defMemMi === null ? null : defMemMi * 1024 * 1024
			};
			const res = await apiFetch(`/apiv1/admin/organizations/${quotaOrg.id}/quota`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) throw new Error('Save failed');
			toasts.add({ title: 'Saved', description: 'Quotas applied', color: 'success' });
			closeQuota();
		} catch (e) {
			toasts.add({
				title: "Couldn't save quotas",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			quotaSaving = false;
		}
	}

	async function fetchOrganizations(page: number = 1) {
		const request = ++latestRequest;
		loading = true;
		try {
			const params = new URLSearchParams({ page: String(page), limit: '20' });
			if (searchQuery) params.set('search', searchQuery);
			const response = await apiFetch(`/apiv1/admin/organizations?${params}`);
			if (!response.ok) throw new Error(`The server answered ${response.status}.`);
			const data = await response.json();
			if (request !== latestRequest) return;
			if (data.organizations.length === 0 && data.page > 1 && data.totalPages > 0) {
				await fetchOrganizations(data.totalPages);
				return;
			}
			organizations = data.organizations;
			total = data.total;
			currentPage = data.page;
			totalPages = data.totalPages;
			loadError = null;
		} catch (e) {
			if (request !== latestRequest) return;
			loadError = e instanceof Error ? e.message : "Couldn't load organizations";
		} finally {
			if (request === latestRequest) {
				loading = false;
				loaded = true;
			}
		}
	}

	function retryLoad() {
		loaded = false;
		fetchOrganizations(currentPage);
	}

	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			fetchOrganizations(1);
		}, 300);
	}

	function clearSearch() {
		searchQuery = '';
		clearTimeout(searchTimeout);
		fetchOrganizations(1);
	}

	function generateSlug() {
		createSlug = createName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function resetCreate() {
		createName = '';
		createSlug = '';
		createDescription = '';
		createImageUrl = '';
		createPlan = '';
		createPrimaryOwnerEmail = '';
	}

	function openCreateModal() {
		resetCreate();
		showCreate = true;
	}

	async function createOrganization() {
		if (!createName || !createSlug) return;
		creating = true;
		try {
			const response = await apiFetch('/apiv1/admin/organizations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: createName,
					slug: createSlug,
					description: createDescription || undefined,
					avatarUrl: createImageUrl || undefined,
					plan: createPlan || undefined,
					primaryOwnerEmail: createPrimaryOwnerEmail.trim() || undefined
				})
			});
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || "Couldn't create organization");
			}
			const data = await response.json();
			const inviteLink: string | undefined = data.inviteLink;
			toasts.add({
				title: 'Organization created',
				description: inviteLink
					? 'Share the invite link with the primary owner so they can join.'
					: undefined,
				color: 'success'
			});
			if (inviteLink) {
				try {
					await navigator.clipboard.writeText(inviteLink);
					toasts.add({ title: 'Invite link copied to clipboard', color: 'success' });
				} catch {
					toasts.add({
						title: "Couldn't copy the invite link",
						description: inviteLink,
						color: 'warning'
					});
				}
			}
			showCreate = false;
			resetCreate();
			fetchOrganizations(1);
		} catch (e) {
			toasts.add({
				title: "Couldn't create organization",
				description: e instanceof Error ? e.message : "Couldn't create organization",
				color: 'error'
			});
		} finally {
			creating = false;
		}
	}

	function openEdit(org: OrgItem) {
		editingOrg = org;
		editName = org.name;
		editDescription = org.description || '';
		editOpen = true;
	}

	function closeEdit() {
		editOpen = false;
	}

	async function saveOrg() {
		if (!editingOrg) return;
		saving = true;
		try {
			const response = await apiFetch(`/apiv1/admin/organizations/${editingOrg.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: editName, description: editDescription })
			});
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || "Couldn't update organization");
			}
			toasts.add({ title: 'Organization updated', color: 'success' });
			closeEdit();
			fetchOrganizations(currentPage);
		} catch (e) {
			toasts.add({
				title: "Couldn't update organization",
				description: e instanceof Error ? e.message : "Couldn't update organization",
				color: 'error'
			});
		} finally {
			saving = false;
		}
	}

	function askDelete(org: OrgItem) {
		deletingOrg = org;
		deleteOpen = true;
	}

	async function confirmDelete() {
		if (!deletingOrg) return;
		try {
			const response = await apiFetch(`/apiv1/admin/organizations/${deletingOrg.id}`, {
				method: 'DELETE'
			});
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || "Couldn't delete organization");
			}
			toasts.add({ title: 'Organization deleted', color: 'success' });
			fetchOrganizations(currentPage);
		} catch (e) {
			toasts.add({
				title: "Couldn't delete organization",
				description: e instanceof Error ? e.message : "Couldn't delete organization",
				color: 'error'
			});
		}
	}

	onMount(() => {
		instanceFeatures.load().catch(() => undefined);
		fetchOrganizations();
	});
</script>

{#snippet pager()}
	<span class="page-label">Page {currentPage} of {totalPages}</span>
	<Button
		variant="ghost"
		size="sm"
		icon={ChevronLeft}
		label="Previous page"
		disabled={currentPage <= 1 || loading}
		onclick={() => fetchOrganizations(currentPage - 1)}
	/>
	<Button
		variant="ghost"
		size="sm"
		icon={ChevronRight}
		label="Next page"
		disabled={currentPage >= totalPages || loading}
		onclick={() => fetchOrganizations(currentPage + 1)}
	/>
{/snippet}

{#snippet noResults(typed: string)}
	<span class="combo-empty">
		{#if !typed}
			Type a name or slug
		{:else if qConnectSearching}
			Searching
		{:else}
			No organizations match “{typed}”
		{/if}
	</span>
{/snippet}

<SectionCard
	title="Organizations"
	description={view === 'rows' ? `${total.toLocaleString()} total` : undefined}
	flush
	footer={view === 'rows' && totalPages > 1 ? pager : undefined}
>
	{#snippet actions()}
		{#if !pristine}
			<div class="search">
				<SearchField
					size="sm"
					placeholder="Search name or slug"
					bind:value={
						() => searchQuery,
						(v) => {
							searchQuery = v;
							handleSearch();
						}
					}
				/>
			</div>
			<Button variant="primary" size="sm" icon={Plus} onclick={openCreateModal}
				>New organization</Button
			>
		{/if}
	{/snippet}

	<Swap key={view}>
		{#if view === 'loading'}
			<div class="inset">
				<Stack gap="xs">
					<Skeleton height="2.75rem" />
					<Skeleton height="2.75rem" />
					<Skeleton height="2.75rem" />
					<Skeleton height="2.75rem" />
					<Skeleton height="2.75rem" />
				</Stack>
			</div>
		{:else if view === 'error'}
			<div class="inset">
				<Alert tone="error" title="Couldn't load organizations">
					{loadError}
					{#snippet actions()}
						<Button size="sm" onclick={retryLoad}>Retry</Button>
					{/snippet}
				</Alert>
			</div>
		{:else if view === 'empty'}
			{#if pristine}
				<EmptyState title="No organizations yet">
					{#snippet icon()}<Building2 size={20} />{/snippet}
					<Button variant="primary" icon={Plus} onclick={openCreateModal}>New organization</Button>
				</EmptyState>
			{:else}
				<EmptyState title="No organizations match “{searchQuery.trim()}”">
					<Button onclick={clearSearch}>Clear search</Button>
				</EmptyState>
			{/if}
		{:else}
			<Table
				columns={COLUMNS}
				rows={organizations}
				rowKey={(org) => org.id}
				inset={false}
				label="Organizations"
			>
				{#snippet cell(org, col)}
					{#if col.id === 'organization'}
						<ItemLabel title={org.name} detail={orgDetail(org)}>
							{#snippet leading()}
								<Avatar
									user={org.avatarUrl ? { id: org.id, imageUrl: org.avatarUrl } : undefined}
									seed={org.id}
									size={32}
								/>
							{/snippet}
						</ItemLabel>
					{:else if col.id === 'members'}
						{org._count.members.toLocaleString()}
					{:else if col.id === 'projects'}
						{org._count.projects.toLocaleString()}
					{:else if col.id === 'creator'}
						{@const name = creatorName(org)}
						<span class="cell-text" title={name ?? undefined}>{name ?? 'System'}</span>
					{:else if col.id === 'created'}
						<span class="cell-text"><RelativeTime date={org.createdAt} /></span>
					{:else if col.id === 'actions'}
						<Menu>
							{#snippet trigger(attrs)}
								<Button
									{...attrs}
									variant="ghost"
									size="sm"
									icon={MoreHorizontal}
									label="More for {org.name}"
								/>
							{/snippet}
							<MenuItem icon={Gauge} onclick={() => openQuota(org)}>Resource quotas</MenuItem>
							<MenuItem icon={Pencil} onclick={() => openEdit(org)}>Edit</MenuItem>
							<MenuItem danger icon={Trash2} onclick={() => askDelete(org)}>Delete</MenuItem>
						</Menu>
					{/if}
				{/snippet}
			</Table>
		{/if}
	</Swap>
</SectionCard>

<Modal bind:open={showCreate} title="New organization">
	<div class="form">
		<Field label="Name" for="create-org-name">
			<Input
				id="create-org-name"
				bind:value={createName}
				oninput={generateSlug}
				placeholder="My Organization"
			/>
		</Field>
		<Field label="Slug" for="create-org-slug">
			<Input id="create-org-slug" bind:value={createSlug} mono placeholder="my-organization" />
		</Field>
		<Field label="Description (optional)" for="create-org-description">
			<Textarea
				id="create-org-description"
				bind:value={createDescription}
				rows={3}
				placeholder="A brief description"
			/>
		</Field>
		<Field label="Image URL (optional)" for="create-org-image-url">
			<Input
				id="create-org-image-url"
				type="url"
				bind:value={createImageUrl}
				placeholder="https://..."
			/>
		</Field>
		<Field label="Plan (optional)" for="create-org-plan">
			<Dropdown id="create-org-plan" bind:value={createPlan} options={PLAN_OPTIONS} />
		</Field>
		<Field
			label="Primary owner email (optional)"
			for="create-primary-owner-email"
			hint="An existing account becomes owner now. Anyone else is invited and becomes owner on accepting."
		>
			<Input
				id="create-primary-owner-email"
				type="email"
				bind:value={createPrimaryOwnerEmail}
				placeholder="client@example.com"
			/>
		</Field>
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (showCreate = false)}>Cancel</Button>
		<Button
			variant="primary"
			onclick={createOrganization}
			loading={creating}
			disabled={!createName || !createSlug}
		>
			Create
		</Button>
	{/snippet}
</Modal>

<Modal bind:open={editOpen} title="Edit organization">
	<div class="form">
		<Field label="Name" for="edit-org-name">
			<Input id="edit-org-name" bind:value={editName} />
		</Field>
		<Field label="Description" for="edit-org-description">
			<Textarea id="edit-org-description" bind:value={editDescription} rows={3} />
		</Field>
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={closeEdit}>Cancel</Button>
		<Button variant="primary" onclick={saveOrg} loading={saving}>Save changes</Button>
	{/snippet}
</Modal>

<ConfirmModal
	bind:open={deleteOpen}
	title="Delete {deletingOrg?.name ?? 'this organization'}?"
	description="This permanently deletes {deletingOrg?.slug ??
		'the organization'} and all its projects and apps."
	confirmLabel="Delete"
	onconfirm={confirmDelete}
	oncancel={() => undefined}
/>

<Modal bind:open={quotaOpen} size="lg" labelledby="quota-title">
	<div class="form form--wide">
		<ModalIntro
			id="quota-title"
			icon={Gauge}
			tone="accent"
			title="Resource quotas"
			description={quotaOrg?.name}
		/>

		{#if $instanceFeatures.resourceLimits === 'off'}
			<Alert tone="info" title="Resource limits are off">
				These values apply only when limits are turned on in Configuration.
			</Alert>
		{/if}

		<Swap key={quotaLoading ? 'loading' : 'form'}>
			{#if quotaLoading}
				<Stack gap="sm">
					<Skeleton height="3.5rem" />
					<Skeleton height="8rem" />
					<Skeleton height="4rem" />
				</Stack>
			{:else}
				<div class="form form--wide">
					{#if quotaUsage}
						<div class="usage">
							{#each usageTiles as tile (tile.id)}
								<Metric
									size="sm"
									label={tile.label}
									value={tile.value}
									detail={tile.detail}
									tone={tile.over ? 'warning' : 'neutral'}
								/>
							{/each}
						</div>
					{/if}

					<Stack gap="sm">
						<div class="group-head">
							<SectionTitle title="Limits" size="md" />
							<p class="hint">
								Limits apply across all projects in this organization. New organizations start with
								the instance default, which is unlimited unless you set one in Instance admin under
								Limits.
							</p>
						</div>
						<FieldGrid>
							{#each CAPS as cap (cap.id)}
								<Field label={cap.label} for="quota-{cap.id}">
									<div class="choice">
										<SegmentedControl
											label="{cap.label} limit"
											options={CAP_MODES}
											grow
											bind:value={
												() => (qCaps[cap.id].custom ? 'custom' : 'unlimited'),
												(v) => (qCaps[cap.id].custom = v === 'custom')
											}
										/>
										<Input
											id="quota-{cap.id}"
											type="number"
											min="1"
											bind:value={qCaps[cap.id].value}
											disabled={!qCaps[cap.id].custom}
											placeholder={qCaps[cap.id].custom ? cap.example : 'Unlimited'}
											suffix={cap.unit}
										/>
									</div>
								</Field>
							{/each}
						</FieldGrid>
					</Stack>

					<Stack gap="sm">
						<div class="group-head">
							<SectionTitle title="Per-pod defaults" size="md" />
							<p class="hint">
								Applies to containers with no requests. Required if you set CPU or memory limits.
							</p>
						</div>
						<FieldGrid>
							<Field label="Default CPU per pod" for="quota-default-cpu">
								<Input
									id="quota-default-cpu"
									type="number"
									min="1"
									bind:value={qDefaultCpu}
									placeholder="100"
									suffix="millicores"
								/>
							</Field>
							<Field label="Default memory per pod" for="quota-default-memory">
								<Input
									id="quota-default-memory"
									type="number"
									min="1"
									bind:value={qDefaultMemMi}
									placeholder="128"
									suffix="MiB"
								/>
							</Field>
						</FieldGrid>
					</Stack>

					<Stack gap="sm">
						<div class="group-head">
							<SectionTitle title="Connected organizations" size="md">
								{#snippet actions()}
									{#if qConnections.length > 0}
										<Button
											variant="ghost"
											size="sm"
											disabled={qConnectBusy}
											onclick={disconnectQuota}
										>
											Disconnect
										</Button>
									{/if}
								{/snippet}
							</SectionTitle>
							<p class="hint">
								They share the same limits and one usage pool, so their combined usage can't exceed
								the limit.
							</p>
						</div>
						{#if qConnections.length > 0}
							<List inset={false} label="Connected organizations">
								{#each qConnections as conn (conn.id)}
									<ListRow flush pinned title={conn.name} subtitle={conn.slug}>
										{#snippet leading()}<Avatar seed={conn.id} size={32} />{/snippet}
									</ListRow>
								{/each}
							</List>
						{/if}
						<SearchPicker
							bind:value={qConnectPick}
							bind:query={
								() => qConnectSearch,
								(v) => {
									qConnectSearch = v;
									handleConnectSearch();
								}
							}
							block
							filter={false}
							options={connectOptions}
							placeholder="Connect an organization"
							searchPlaceholder="Search name or slug"
							searching={qConnectSearching}
							loading={qConnectBusy}
							disabled={qConnectBusy}
							empty={noResults}
							onchange={(id) => {
								const other = qConnectResults.find((o) => o.id === id);
								if (other) connectOrg(other);
							}}
						/>
					</Stack>
				</div>
			{/if}
		</Swap>
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={closeQuota}>Cancel</Button>
		<Button variant="primary" onclick={saveQuota} loading={quotaSaving} disabled={quotaLoading}>
			Save quotas
		</Button>
	{/snippet}
</Modal>

<style>
	.search {
		width: 13rem;
	}
	.inset {
		padding: 0 var(--space-4) var(--space-4);
	}
	.page-label {
		margin-right: auto;
		color: var(--text-muted);
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.cell-text {
		display: block;
		min-width: 0;
		overflow-x: clip;
		color: var(--text-muted);
		font-size: var(--text-callout);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.form--wide {
		gap: var(--space-6);
	}
	.usage {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
		gap: var(--space-4);
	}
	.group-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.hint {
		color: var(--text-muted);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
	}
	.choice {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.combo-empty {
		color: var(--text-muted);
		font-size: var(--text-callout);
	}
</style>

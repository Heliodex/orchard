<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch, toasts } from '$lib/stores';
	import { ChevronLeft, ChevronRight, Pencil, UserCheck, UserX } from 'lucide-svelte';
	import {
		Alert,
		Avatar,
		Badge,
		Button,
		EmptyState,
		Field,
		FieldGrid,
		Input,
		ItemLabel,
		Modal,
		RelativeTime,
		SearchField,
		SectionCard,
		Skeleton,
		Stack,
		Swap,
		Table,
		ToggleRow
	} from '$lib/components/ui';
	import type { TableColumn } from '$lib/components/ui/Table.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

	interface UserItem {
		id: string;
		email: string;
		username: string;
		firstName?: string | null;
		lastName?: string | null;
		imageUrl?: string | null;
		isSuperAdmin: boolean;
		createdAt: string;
		disabledAt?: string | null;
		homeOrganizationId?: string | null;
		_count: {
			organizationMembers: number;
			projectMembers: number;
		};
	}

	const COLUMNS: TableColumn<UserItem>[] = [
		{ id: 'user', label: 'User', width: 'minmax(10rem, 1.6fr)' },
		{ id: 'username', label: 'Username', width: 'minmax(7rem, 1fr)' },
		{ id: 'role', label: 'Role', width: '5rem' },
		{ id: 'organizations', label: 'Orgs', numeric: true },
		{ id: 'projects', label: 'Projects', numeric: true },
		{ id: 'created', label: 'Created', width: '5.5rem', align: 'end' },
		{ id: 'actions', width: '5rem', align: 'end' }
	];

	let users = $state<UserItem[]>([]);
	let loaded = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let total = $state(0);
	let currentPage = $state(1);
	let totalPages = $state(1);
	let searchQuery = $state('');

	let searchTimeout: ReturnType<typeof setTimeout>;
	let lastQuery = '';
	let latestRequest = 0;

	let editingUser = $state<UserItem | null>(null);
	let editOpen = $state(false);
	let editFirstName = $state('');
	let editLastName = $state('');
	let editIsSuperAdmin = $state(false);
	let saving = $state(false);

	let deletingUser = $state<UserItem | null>(null);
	let deleteOpen = $state(false);
	let deletingId = $state<string | null>(null);

	const trimmedQuery = $derived(searchQuery.trim());
	const stage = $derived(error && !loaded ? 'error' : loaded ? 'ready' : 'loading');
	const showPager = $derived(totalPages > 1 && stage === 'ready');
	const deleteDescription = $derived.by(() => {
		if (!deletingUser) return '';
		const name = displayName(deletingUser);
		const who = name ? `${name} (${deletingUser.email})` : deletingUser.email;
		return deletingUser.disabledAt
			? `${who} can sign in again with any method they had. Their memberships come back as they were.`
			: `${who} is signed out everywhere, every token stops working, and no sign-in method lets them back in until you turn the account on again. Nothing they own is deleted.`;
	});

	function displayName(user: UserItem) {
		return [user.firstName, user.lastName].filter(Boolean).join(' ');
	}

	async function fetchUsers(page: number = 1) {
		const request = ++latestRequest;
		loading = true;
		try {
			const params = new URLSearchParams({ page: String(page), limit: '20' });
			if (searchQuery) params.set('search', searchQuery);
			const response = await apiFetch(`/apiv1/admin/users?${params}`);
			if (!response.ok) throw new Error(`The server answered ${response.status}.`);
			const data = await response.json();
			if (request !== latestRequest) return;
			if (data.users.length === 0 && data.totalPages > 0 && page > data.totalPages) {
				await fetchUsers(data.totalPages);
				return;
			}
			users = data.users;
			total = data.total;
			currentPage = data.page;
			totalPages = data.totalPages;
			loaded = true;
			error = null;
		} catch (e) {
			if (request !== latestRequest) return;
			const message = e instanceof Error ? e.message : "Couldn't load users";
			if (loaded)
				toasts.add({ title: "Couldn't load users", description: message, color: 'error' });
			error = message;
		} finally {
			if (request === latestRequest) loading = false;
		}
	}

	$effect(() => {
		const query = searchQuery;
		if (query === lastQuery) return;
		lastQuery = query;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchUsers(1), 300);
	});

	function openEdit(user: UserItem) {
		editingUser = user;
		editFirstName = user.firstName || '';
		editLastName = user.lastName || '';
		editIsSuperAdmin = user.isSuperAdmin;
		editOpen = true;
	}

	function openDelete(user: UserItem) {
		deletingUser = user;
		deleteOpen = true;
	}

	async function saveUser() {
		if (!editingUser) return;
		saving = true;
		try {
			const response = await apiFetch(`/apiv1/admin/users/${editingUser.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					firstName: editFirstName,
					lastName: editLastName,
					isSuperAdmin: editIsSuperAdmin
				})
			});
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || "Couldn't update user");
			}
			toasts.add({ title: 'User updated', color: 'success' });
			editOpen = false;
			fetchUsers(currentPage);
		} catch (e) {
			toasts.add({
				title: "Couldn't update user",
				description: e instanceof Error ? e.message : "Couldn't update user",
				color: 'error'
			});
		} finally {
			saving = false;
		}
	}

	async function confirmDelete() {
		if (!deletingUser) return;
		const target = deletingUser;
		deletingId = target.id;
		try {
			const action = target.disabledAt ? 'enable' : 'disable';
			const response = await apiFetch(`/apiv1/admin/users/${target.id}/${action}`, {
				method: 'POST'
			});
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || "Couldn't change the account");
			}
			toasts.add({
				title: target.disabledAt ? 'Account turned on' : 'Account turned off',
				color: 'success'
			});
			await fetchUsers(currentPage);
		} catch (e) {
			toasts.add({
				title: "Couldn't change the account",
				description: e instanceof Error ? e.message : "Couldn't change the account",
				color: 'error'
			});
		} finally {
			deletingId = null;
		}
	}

	onMount(() => {
		fetchUsers();
		return () => clearTimeout(searchTimeout);
	});
</script>

{#snippet pager()}
	<div class="pager">
		<span class="page-count">Page {currentPage} of {totalPages}</span>
		<Button
			variant="ghost"
			size="sm"
			icon={ChevronLeft}
			label="Previous page"
			disabled={currentPage <= 1 || loading}
			onclick={() => fetchUsers(currentPage - 1)}
		/>
		<Button
			variant="ghost"
			size="sm"
			icon={ChevronRight}
			label="Next page"
			disabled={currentPage >= totalPages || loading}
			onclick={() => fetchUsers(currentPage + 1)}
		/>
	</div>
{/snippet}

<SectionCard
	title="Users"
	description={loaded ? `${total.toLocaleString()} total` : undefined}
	footer={showPager ? pager : undefined}
	flush
>
	{#snippet actions()}
		<div class="search">
			<SearchField
				size="sm"
				bind:value={searchQuery}
				placeholder="Search by name, email or username"
			/>
		</div>
	{/snippet}

	<Swap key={stage}>
		{#if stage === 'loading'}
			<div class="placeholder">
				<Stack gap="sm">
					{#each [0, 1, 2, 3, 4] as row (row)}
						<Skeleton height="2.75rem" />
					{/each}
				</Stack>
			</div>
		{:else if stage === 'error'}
			<div class="placeholder">
				<Alert tone="error" title="Couldn't load users">
					{error}
					{#snippet actions()}
						<Button variant="secondary" size="sm" {loading} onclick={() => fetchUsers(currentPage)}>
							Try again
						</Button>
					{/snippet}
				</Alert>
			</div>
		{:else}
			<Table columns={COLUMNS} rows={users} rowKey={(user) => user.id} inset={false} label="Users">
				{#snippet cell(user, col)}
					{#if col.id === 'user'}
						<ItemLabel
							title={displayName(user) || 'No name'}
							detail={user.homeOrganizationId
								? `${user.email} · Organization identity`
								: user.email}
						>
							{#snippet leading()}<Avatar {user} size={32} />{/snippet}
						</ItemLabel>
					{:else if col.id === 'username'}
						<span class="username" title={user.username}>{user.username}</span>
					{:else if col.id === 'role'}
						{#if user.disabledAt}
							<Badge tone="warning">Turned off</Badge>
						{:else if user.isSuperAdmin}
							<Badge tone="accent">Admin</Badge>
						{:else}
							<Badge>User</Badge>
						{/if}
					{:else if col.id === 'organizations'}
						{user._count.organizationMembers}
					{:else if col.id === 'projects'}
						{user._count.projectMembers}
					{:else if col.id === 'created'}
						<span class="quiet"><RelativeTime date={user.createdAt} /></span>
					{:else}
						<span class="row-actions">
							<Button
								variant="ghost"
								size="sm"
								icon={Pencil}
								label="Edit {displayName(user) || user.email}"
								onclick={() => openEdit(user)}
							/>
							<Button
								variant="ghost"
								size="sm"
								icon={user.disabledAt ? UserCheck : UserX}
								label="{user.disabledAt ? 'Turn on' : 'Turn off'} {displayName(user) || user.email}"
								loading={deletingId === user.id}
								onclick={() => openDelete(user)}
							/>
						</span>
					{/if}
				{/snippet}
				{#snippet empty()}
					<EmptyState title={trimmedQuery ? `Nobody matches “${trimmedQuery}”` : 'No users yet'}>
						{#if trimmedQuery}
							<Button variant="secondary" onclick={() => (searchQuery = '')}>Clear search</Button>
						{/if}
					</EmptyState>
				{/snippet}
			</Table>
		{/if}
	</Swap>
</SectionCard>

<Modal bind:open={editOpen} title="Edit user">
	{#if editingUser}
		<Stack gap="md">
			<Field label="Email" for="edit-user-email">
				<Input id="edit-user-email" value={editingUser.email} disabled />
			</Field>
			<FieldGrid>
				<Field label="First name" for="edit-user-first-name">
					<Input id="edit-user-first-name" bind:value={editFirstName} />
				</Field>
				<Field label="Last name" for="edit-user-last-name">
					<Input id="edit-user-last-name" bind:value={editLastName} />
				</Field>
			</FieldGrid>
			<ToggleRow label="Superadmin" bind:checked={editIsSuperAdmin} />
		</Stack>
	{/if}
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (editOpen = false)}>Cancel</Button>
		<Button variant="primary" onclick={saveUser} loading={saving}>Save changes</Button>
	{/snippet}
</Modal>

<ConfirmModal
	bind:open={deleteOpen}
	title={deletingUser?.disabledAt ? 'Turn this account on?' : 'Turn this account off?'}
	description={deleteDescription}
	onconfirm={confirmDelete}
	oncancel={() => {}}
/>

<style>
	.search {
		width: 19rem;
	}
	.placeholder {
		padding: 0 var(--space-4) var(--space-4);
	}
	.username {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-muted);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
	}
	.quiet {
		color: var(--text-muted);
		font-size: var(--text-callout);
		white-space: nowrap;
	}
	.row-actions {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.pager {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.page-count {
		margin-right: var(--space-2);
		color: var(--text-muted);
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
</style>

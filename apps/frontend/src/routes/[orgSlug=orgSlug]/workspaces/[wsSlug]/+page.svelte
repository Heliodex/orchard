<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import { apiFetch, user, toasts, selectedOrganization, subscribeOrgEvents } from '$lib/stores';
	import { mergeAttrs } from 'melt';
	import { SpatialMenu } from 'melt/builders';
	import {
		Loader2,
		Plus,
		FolderKanban,
		Calendar,
		User,
		Trash2,
		UserPlus,
		LogOut,
		Check,
		X,
		Users,
		Boxes
	} from 'lucide-svelte';
	import { Combobox, Dropdown } from '$lib/components/ui';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';

	interface Project {
		id: string;
		name: string;
		slug: string;
		description?: string;
		repositoryUrl?: string;
		_count?: {
			deployments: number;
		};
		members?: Member[];
	}

	interface Member {
		id: string;
		role: {
			name: string;
		};
		user: {
			id: string;
			firstName?: string;
			lastName?: string;
			email: string;
			imageUrl?: string;
		};
	}

	interface Workspace {
		id: string;
		name: string;
		slug: string;
		description?: string;
		createdAt: string;
		createdBy?: {
			firstName?: string;
			lastName?: string;
			email: string;
		};
		projects?: Project[];
		members?: Member[];
		organization?: {
			id: string;
			name: string;
			slug: string;
		};
	}

	interface OrgMember {
		id: string;
		userId: string;
		role: 'owner' | 'admin' | 'member' | 'guest';
		user: {
			id: string;
			email: string;
			firstName?: string;
			lastName?: string;
			imageUrl?: string;
		};
	}

	const projectMenu = new SpatialMenu<Project>({
		wrap: true,
		crossAxis: true
	});

	let workspace = $state<Workspace | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let projectSearch = $state('');
	let deleteError = $state<string | null>(null);
	let deletingWorkspace = $state(false);
	let orgMembers = $state<OrgMember[]>([]);
	let loadingOrgMembers = $state(false);
	let showInviteDialog = $state(false);
	let selectedUserId = $state<string>('');
	let selectedRoleId = $state<string>('');
	let inviting = $state(false);
	let joining = $state(false);
	let leaving = $state(false);
	let showLeaveModal = $state(false);
	let showDeleteWorkspaceModal = $state(false);
	let roles = $state<Array<{ id: string; name: string }>>([]);
	let currentOrgMembership = $state<OrgMember | null>(null);

	const currentUserId = $derived($user?.id);
	const currentUserMember = $derived.by(() => {
		if (!workspace || !currentUserId) return null;
		return workspace.members?.find((m) => m.user.id === currentUserId);
	});
	const isWorkspaceAdmin = $derived(currentUserMember?.role?.name === 'admin');
	const isOrgAdminOrOwner = $derived(
		currentOrgMembership &&
			(currentOrgMembership.role === 'owner' || currentOrgMembership.role === 'admin')
	);
	const canManageMembers = $derived(isWorkspaceAdmin || isOrgAdminOrOwner);
	const isMember = $derived(!!currentUserMember);

	let filteredProjects = $derived.by(() => {
		const list = workspace?.projects ?? [];
		const query = projectSearch.trim().toLowerCase();
		if (!query) return list;
		return list.filter((project) => {
			const name = project.name.toLowerCase();
			const slugMatch = project.slug.toLowerCase();
			const description = project.description?.toLowerCase() ?? '';
			return name.includes(query) || slugMatch.includes(query) || description.includes(query);
		});
	});

	const wsSlug = $derived($page.params.wsSlug);
	const orgSlug = $derived($page.params.orgSlug);

	async function fetchWorkspace() {
		if (!workspace) loading = true;
		error = null;

		try {
			const response = await apiFetch(`/apiv1/workspaces/slug/${wsSlug}`);
			if (!response.ok) {
				throw new Error("Couldn't load workspace");
			}
			workspace = await response.json();

			// If workspace has a project with the same slug, redirect to the project page
			// This merges the workspace/project abstraction for the user
			const matchingProject = workspace?.projects?.find((p) => p.slug === wsSlug);
			if (matchingProject) {
				goto(`/${orgSlug}/workspaces/${wsSlug}/projects/${matchingProject.slug}`, {
					replaceState: true
				});
				return;
			}

			// If workspace has exactly one project, redirect to it
			if (workspace?.projects?.length === 1) {
				goto(`/${orgSlug}/workspaces/${wsSlug}/projects/${workspace.projects[0].slug}`, {
					replaceState: true
				});
				return;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't load workspace";
		} finally {
			loading = false;
		}
	}

	async function fetchRoles() {
		try {
			const response = await apiFetch('/apiv1/workspaces/roles');
			if (response.ok) {
				roles = await response.json();
			}
		} catch (e) {
			console.error('Failed to fetch roles:', e);
		}
	}

	async function fetchOrgMembers() {
		if (!workspace?.organization?.id) return;

		loadingOrgMembers = true;
		try {
			const response = await apiFetch(`/apiv1/organizations/${workspace.organization.id}/members`);
			if (response.ok) {
				orgMembers = await response.json();
			} else {
				console.error('Failed to fetch org members:', response.status, await response.text());
			}
		} catch (e) {
			console.error('Failed to fetch org members:', e);
		} finally {
			loadingOrgMembers = false;
		}
	}

	async function fetchCurrentOrgMembership() {
		if (!workspace?.organization?.id) return;

		try {
			const response = await apiFetch(
				`/apiv1/organizations/${workspace.organization.id}/members/me`
			);
			if (response.ok) {
				currentOrgMembership = await response.json();
			}
		} catch (e) {
			console.error('Failed to fetch current org membership:', e);
		}
	}

	async function addMember() {
		if (!workspace || !selectedUserId || !selectedRoleId || inviting) return;

		inviting = true;
		try {
			const response = await apiFetch(`/apiv1/workspaces/${workspace.id}/members`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: selectedUserId,
					roleId: selectedRoleId
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || "Couldn't add member");
			}

			toasts.add({
				title: 'Member added',
				color: 'success'
			});

			showInviteDialog = false;
			selectedUserId = '';
			selectedRoleId = '';
			fetchWorkspace();
		} catch (e) {
			toasts.add({
				title: "Couldn't add member",
				description: e instanceof Error ? e.message : "Couldn't add member",
				color: 'error'
			});
		} finally {
			inviting = false;
		}
	}

	async function joinWorkspace() {
		if (!workspace || joining) return;

		joining = true;
		try {
			const response = await apiFetch(`/apiv1/workspaces/${workspace.id}/join`, {
				method: 'POST'
			});

			if (!response.ok) {
				const data = await response.json();
				const errorMessage = data.message || "Couldn't join workspace";

				if (errorMessage.includes('already a member')) {
					toasts.add({
						title: 'Already a member',
						description: 'Refreshing workspace…',
						color: 'info'
					});
					await fetchWorkspace();
					return;
				}

				throw new Error(errorMessage);
			}

			toasts.add({
				title: 'Joined workspace',
				color: 'success'
			});

			await fetchWorkspace();
		} catch (e) {
			toasts.add({
				title: "Couldn't join workspace",
				description: e instanceof Error ? e.message : "Couldn't join workspace",
				color: 'error'
			});
		} finally {
			joining = false;
		}
	}

	async function leaveWorkspace() {
		if (!workspace || leaving) return;

		leaving = true;
		try {
			const response = await apiFetch(`/apiv1/workspaces/${workspace.id}/leave`, {
				method: 'POST'
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || "Couldn't leave workspace");
			}

			toasts.add({
				title: 'Left workspace',
				color: 'success'
			});

			goto(`/${orgSlug}`);
		} catch (e) {
			toasts.add({
				title: "Couldn't leave workspace",
				description: e instanceof Error ? e.message : "Couldn't leave workspace",
				color: 'error'
			});
		} finally {
			leaving = false;
		}
	}

	let unsub: (() => void) | null = null;
	let subscribedOrgId: string | null = null;
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const id = $selectedOrganization?.id ?? null;
		if (!id || id === subscribedOrgId) return;
		subscribedOrgId = id;
		unsub?.();
		unsub = subscribeOrgEvents(id, (ev) => {
			if (ev.type === 'deployment.metrics' || ev.type === 'heartbeat') return;
			if (refreshTimer) return;
			refreshTimer = setTimeout(() => {
				refreshTimer = null;
				fetchWorkspace();
			}, 2000);
		});
	});

	onDestroy(() => {
		unsub?.();
		if (refreshTimer) clearTimeout(refreshTimer);
	});

	onMount(async () => {
		await user.fetchUser();
		await fetchWorkspace();
		await fetchRoles();
		await fetchCurrentOrgMembership();
	});

	function openProject(projectSlug: string) {
		return goto(`/${orgSlug}/workspaces/${wsSlug}/projects/${projectSlug}`);
	}

	function handleProjectClick(event: MouseEvent, projectSlug: string) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
			return;
		}

		event.preventDefault();
		openProject(projectSlug);
	}

	async function deleteWorkspace() {
		if (!workspace || deletingWorkspace) return;

		deletingWorkspace = true;
		deleteError = null;

		try {
			const response = await apiFetch(`/apiv1/workspaces/${workspace.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || "Couldn't delete workspace");
			}

			goto(`/${orgSlug}`);
		} catch (e) {
			deleteError = e instanceof Error ? e.message : "Couldn't delete workspace";
		} finally {
			deletingWorkspace = false;
		}
	}
</script>

<div class="ws-page">
	{#if error}
		<div class="ws-error">{error}</div>
	{/if}

	{#if loading}
		<div class="ws-header">
			<div class="ws-header-top">
				<div class="ws-header-info">
					<div class="skeleton" style="height: 1.5rem; width: 40%; margin-bottom: 0.5rem;"></div>
					<div class="skeleton" style="height: 0.875rem; width: 60%;"></div>
				</div>
			</div>
		</div>
		<div class="ws-stats">
			{#each Array(3) as _, i (i)}
				<div
					class="skeleton"
					style="height: 1.75rem; width: 5.5rem; border-radius: var(--radius-sm);"
				></div>
			{/each}
		</div>
		<div class="ws-projects-header">
			<div class="skeleton" style="height: 1.125rem; width: 5rem;"></div>
		</div>
		<div class="ws-project-grid">
			{#each Array(4) as _, i (i)}
				<div class="ws-project-card" style="pointer-events: none;">
					<div class="ws-project-card-top">
						<div class="skeleton skeleton-icon"></div>
						<div class="skeleton skeleton-badge"></div>
					</div>
					<div class="ws-project-card-body">
						<div class="skeleton skeleton-title"></div>
						<div class="skeleton skeleton-desc"></div>
					</div>
				</div>
			{/each}
		</div>
		<div class="ws-team">
			<div class="ws-team-header">
				<div class="skeleton" style="height: 0.75rem; width: 4rem;"></div>
			</div>
			<div class="ws-team-avatars">
				{#each Array(3) as _, i (i)}
					<div
						class="skeleton"
						style="width: 5rem; height: 1.875rem; border-radius: var(--radius-pill);"
					></div>
				{/each}
			</div>
		</div>
	{:else if workspace}
		<div class="mb-4">
			<Breadcrumbs crumbs={[{ label: 'Home', href: `/${orgSlug}` }, { label: workspace.name }]} />
		</div>

		<div class="ws-header">
			<div class="ws-header-top">
				<div class="ws-header-info">
					<h1 class="ws-title">{workspace.name}</h1>
					{#if workspace.description}
						<p class="ws-description">{workspace.description}</p>
					{/if}
				</div>
				{#if canManageMembers}
					<button
						class="ws-btn ws-btn-danger"
						onclick={() => {
							showDeleteWorkspaceModal = true;
						}}
						disabled={deletingWorkspace}
					>
						{#if deletingWorkspace}
							<Loader2 class="h-4 w-4 animate-spin" />
						{:else}
							<Trash2 class="h-4 w-4" />
						{/if}
						Delete
					</button>
				{/if}
			</div>
			{#if deleteError}
				<div class="ws-error" style="margin-top: 0.75rem;">{deleteError}</div>
			{/if}
		</div>

		<div class="ws-stats">
			<div class="ws-stat">
				<FolderKanban class="h-4 w-4" />
				<span class="ws-stat-value">{workspace.projects?.length ?? 0}</span>
				<span class="ws-stat-label">Projects</span>
			</div>
			<div class="ws-stat">
				<Users class="h-4 w-4" />
				<span class="ws-stat-value">{workspace.members?.length ?? 0}</span>
				<span class="ws-stat-label">Members</span>
			</div>
			<div class="ws-stat">
				<Calendar class="h-4 w-4" />
				<span class="ws-stat-label">{new Date(workspace.createdAt).toLocaleDateString()}</span>
			</div>
			{#if workspace.createdBy}
				<div class="ws-stat">
					<User class="h-4 w-4" />
					<span class="ws-stat-label"
						>by {workspace.createdBy.firstName || workspace.createdBy.email}</span
					>
				</div>
			{/if}
		</div>

		<div class="ws-projects-header">
			<h2 class="ws-section-title">Projects</h2>
			<div class="ws-projects-toolbar">
				{#if workspace.projects?.length}
					<div class="ws-project-search-bar" {...projectMenu.root}>
						<input
							type="search"
							placeholder="Search projects"
							class="ws-search-input"
							bind:value={projectSearch}
							{...projectMenu.input}
						/>
					</div>
				{/if}
				<a href="/{orgSlug}/workspaces/{wsSlug}/projects/new" class="ws-btn ws-btn-primary">
					<Plus class="h-4 w-4" />
					New project
				</a>
			</div>
		</div>

		{#if !workspace.projects?.length}
			<div class="ws-empty-card">
				<span style:color="var(--surface-muted)"><FolderKanban class="h-10 w-10" /></span>
				<p>No projects yet</p>
				<a
					href="/{orgSlug}/workspaces/{wsSlug}/projects/new"
					class="ws-btn ws-btn-primary ws-btn-mt"
				>
					<Plus class="h-4 w-4" />
					Create project
				</a>
			</div>
		{:else if filteredProjects.length}
			<div class="ws-project-grid">
				{#each filteredProjects as project (project.id)}
					{@const href = `/${orgSlug}/workspaces/${wsSlug}/projects/${project.slug}`}
					{@const item = projectMenu.getItem(project, {
						onSelect: () => openProject(project.slug)
					})}
					<a
						class="ws-project-card"
						class:is-highlighted={item.highlighted}
						{...mergeAttrs(item.attrs, {
							href,
							onclick: (event: Event) => handleProjectClick(event as MouseEvent, project.slug)
						})}
					>
						<div class="ws-project-card-top">
							<div class="ws-project-icon">
								<FolderKanban class="h-6 w-6" />
							</div>
							<div class="ws-project-deploy-badge">
								<span class="ws-project-deploy-count">
									{project._count?.deployments ?? 0}
								</span>
								<span>apps</span>
							</div>
						</div>
						<div class="ws-project-card-body">
							<span class="ws-project-name">{project.name}</span>
							{#if project.description}
								<span class="ws-project-desc">{project.description}</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<div class="ws-empty-card">
				<p>No projects match "{projectSearch}"</p>
			</div>
		{/if}

		<div class="ws-team">
			<div class="ws-team-header">
				<h3 class="ws-team-title">
					<Users class="h-3.5 w-3.5" />
					Team ({workspace.members?.length ?? 0})
				</h3>
				<div class="ws-team-actions">
					{#if $user && currentUserId}
						{#if !isMember}
							<button
								class="ws-btn ws-btn-primary ws-btn-sm"
								onclick={joinWorkspace}
								disabled={joining}
							>
								{#if joining}
									<Loader2 class="h-3 w-3 animate-spin" />
								{:else}
									<Check class="h-3 w-3" />
								{/if}
								Join
							</button>
						{:else if !isWorkspaceAdmin}
							<button
								class="ws-btn ws-btn-ghost ws-btn-sm"
								onclick={() => {
									showLeaveModal = true;
								}}
								disabled={leaving}
							>
								{#if leaving}
									<Loader2 class="h-3 w-3 animate-spin" />
								{:else}
									<LogOut class="h-3 w-3" />
								{/if}
								Leave
							</button>
						{/if}
					{/if}
					{#if canManageMembers}
						<button
							class="ws-btn ws-btn-secondary ws-btn-sm"
							onclick={() => {
								showInviteDialog = true;
								fetchOrgMembers();
							}}
						>
							<UserPlus class="h-3 w-3" />
							Add
						</button>
					{/if}
				</div>
			</div>

			{#if workspace.members?.length}
				<div class="ws-team-avatars">
					{#each workspace.members as member (member.user.id)}
						<div
							class="ws-team-member"
							title="{member.user.firstName || ''} {member.user.lastName || ''} ({member.role
								.name})"
						>
							{#if member.user.imageUrl}
								<img
									src={member.user.imageUrl}
									alt={member.user.firstName || member.user.email}
									class="ws-team-avatar"
								/>
							{:else}
								<div class="ws-team-avatar-fallback">
									{member.user.firstName?.[0] || member.user.email[0].toUpperCase()}
								</div>
							{/if}
							<span class="ws-team-name"
								>{member.user.firstName || member.user.email.split('@')[0]}</span
							>
							<span class="ws-team-role">{member.role.name}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="ws-team-empty">No members yet</p>
			{/if}
		</div>
	{/if}
</div>

{#if showInviteDialog}
	<div
		class="ws-dialog-overlay"
		onclick={(e) => {
			if (e.target === e.currentTarget) showInviteDialog = false;
		}}
		role="dialog"
		aria-modal="true"
	>
		<div class="ws-dialog">
			<div class="ws-dialog-header">
				<h2>Add member</h2>
				<button
					class="ws-btn ws-btn-ghost"
					onclick={() => {
						showInviteDialog = false;
						selectedUserId = '';
						selectedRoleId = '';
					}}
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="ws-dialog-body">
				<div class="ws-field">
					<label class="ws-label">Organization member</label>
					{#if loadingOrgMembers}
						<p class="ws-field-hint">Loading members…</p>
					{:else if orgMembers.length === 0}
						<p class="ws-field-hint">No organization members found.</p>
					{:else}
						{@const availableMembers = orgMembers.filter(
							(om) => !workspace?.members?.some((m) => m.user.id === om.user.id)
						)}
						{#if availableMembers.length === 0}
							<p class="ws-field-hint">All organization members are already in this workspace.</p>
						{:else}
							<Combobox
								bind:value={selectedUserId}
								disabled={inviting}
								placeholder="Select a member"
								label="Organization member"
								options={availableMembers.map((orgMember) => {
									const name = [orgMember.user.firstName, orgMember.user.lastName]
										.filter(Boolean)
										.join(' ');
									return {
										value: orgMember.user.id,
										label: name || orgMember.user.email,
										description: name ? orgMember.user.email : undefined
									};
								})}
							/>
						{/if}
					{/if}
				</div>

				<div class="ws-field">
					<label class="ws-label">Role</label>
					<Dropdown
						bind:value={selectedRoleId}
						disabled={inviting}
						placeholder="Select a role"
						ariaLabel="Role"
						options={roles.map((role) => ({ value: role.id, label: role.name }))}
					/>
				</div>

				<div class="ws-dialog-actions">
					<button
						class="ws-btn ws-btn-secondary"
						onclick={() => {
							showInviteDialog = false;
							selectedUserId = '';
							selectedRoleId = '';
						}}
						disabled={inviting}
					>
						Cancel
					</button>
					<button
						class="ws-btn ws-btn-primary"
						onclick={addMember}
						disabled={!selectedUserId || !selectedRoleId || inviting}
					>
						{#if inviting}
							<Loader2 class="h-4 w-4 animate-spin" />
						{:else}
							<UserPlus class="h-4 w-4" />
						{/if}
						Add member
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if workspace}
	<ConfirmModal
		bind:open={showLeaveModal}
		title="Leave this workspace?"
		description="You need a new <strong>invitation</strong> to rejoin this workspace."
		html
		confirmLabel="Leave"
		danger={false}
		onconfirm={leaveWorkspace}
		oncancel={() => {}}
	/>
	<ConfirmModal
		bind:open={showDeleteWorkspaceModal}
		title={`Delete "${workspace.name}"?`}
		description="This permanently <strong>deletes this workspace</strong> and all its projects, apps, databases and domains. You can't undo this."
		html
		confirmLabel="Delete workspace"
		onconfirm={deleteWorkspace}
		oncancel={() => {}}
	/>
{/if}

<style>
	.ws-page {
		max-width: 52rem;
		margin: 0 auto;
		padding: 2.5rem 2.5rem 3rem;
	}

	.ws-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 3rem 0;
		color: var(--surface-muted);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
	}

	.ws-error {
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		background-color: color-mix(in srgb, var(--error-text-color) 10%, transparent);
		color: var(--error-text-color);
		border: 1px solid color-mix(in srgb, var(--error-text-color) 25%, transparent);
		margin-bottom: 1.5rem;
	}

	.ws-header {
		margin-bottom: 1.5rem;
	}

	.ws-header-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.ws-header-info {
		flex: 1;
		min-width: 0;
	}

	.ws-title {
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
		font-weight: 700;
		letter-spacing: -0.011em;
		color: var(--center-channel-color);
		margin: 0;
	}

	.ws-description {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--surface-muted);
		margin: 0.25rem 0 0;
	}

	.ws-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.ws-stat {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--surface-muted);
		background-color: color-mix(in srgb, var(--surface-border) 40%, transparent);
	}

	.ws-stat-value {
		font-weight: 600;
		color: var(--center-channel-color);
	}

	.ws-projects-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.ws-section-title {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
		letter-spacing: 0.05em;
		color: var(--surface-muted);
		margin: 0;
	}

	.ws-projects-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ws-project-search-bar {
		width: 14rem;
	}

	.ws-search-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--surface-border);
		background-color: var(--center-channel-bg);
		color: var(--center-channel-color);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
	}

	.ws-search-input::placeholder {
		color: var(--surface-muted);
	}

	.ws-search-input:focus {
		outline: none;
		border-color: var(--sidebar-text-active-border);
	}

	.ws-project-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.ws-project-card {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 1.125rem;
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-lg);
		background-color: var(--surface-bg);
		text-decoration: none;
		color: var(--center-channel-color);
		transition:
			border-color var(--dur-fast),
			box-shadow var(--dur-fast);
		box-shadow:
			0 1px 3px rgb(0 0 0 / 0.03),
			0 1px 2px rgb(0 0 0 / 0.02);
		cursor: pointer;
	}

	.ws-project-card:hover,
	.ws-project-card.is-highlighted {
		border-color: var(--sidebar-text-active-border);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--sidebar-text-active-border) 25%, transparent);
	}

	.ws-project-card-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.ws-project-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: var(--radius-md);
		background-color: color-mix(in srgb, var(--sidebar-text-active-border) 12%, transparent);
		color: var(--sidebar-text-active-border);
		flex-shrink: 0;
	}

	.ws-project-deploy-badge {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--surface-muted);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-pill);
		background-color: color-mix(in srgb, var(--surface-border) 40%, transparent);
	}

	.ws-project-deploy-count {
		font-weight: 700;
		color: var(--center-channel-color);
	}

	.ws-project-card-body {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.ws-project-name {
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: 600;
		color: var(--center-channel-color);
	}

	.ws-project-desc {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--surface-muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.ws-empty-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 3rem 1rem;
		color: var(--surface-muted);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		border: 1px dashed var(--surface-border);
		border-radius: var(--radius-lg);
		margin-bottom: 1.5rem;
	}

	.ws-team {
		margin-top: 0.5rem;
		padding: 0.875rem 1rem;
		border: 1px solid color-mix(in srgb, var(--surface-border) 60%, transparent);
		border-radius: var(--radius-lg);
		background-color: color-mix(in srgb, var(--surface-bg) 50%, transparent);
	}

	.ws-team-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.ws-team-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
		color: var(--surface-muted);
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
		letter-spacing: 0.05em;
		margin: 0;
	}

	.ws-team-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ws-team-avatars {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.ws-team-member {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem 0.25rem 0.25rem;
		border-radius: var(--radius-pill);
		background-color: color-mix(in srgb, var(--surface-border) 35%, transparent);
		transition: background-color var(--dur-fast);
		cursor: default;
	}

	.ws-team-member:hover {
		background-color: color-mix(in srgb, var(--surface-border) 55%, transparent);
	}

	.ws-team-avatar {
		width: 1.375rem;
		height: 1.375rem;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.ws-team-avatar-fallback {
		width: 1.375rem;
		height: 1.375rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		background-color: color-mix(in srgb, var(--surface-border) 80%, var(--center-channel-bg));
		color: var(--center-channel-color);
		flex-shrink: 0;
	}

	.ws-team-name {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
		color: var(--center-channel-color);
	}

	.ws-team-role {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--surface-muted);
		text-transform: capitalize;
	}

	.ws-team-empty {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--surface-muted);
		margin: 0;
	}

	.ws-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.875rem;
		border-radius: var(--radius-sm);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		border: none;
		cursor: pointer;
		text-decoration: none;
		transition: opacity var(--dur-fast);
		white-space: nowrap;
	}

	.ws-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ws-btn-primary {
		background-color: var(--sidebar-text-active-border);
		color: #fff;
		box-shadow:
			0 1px 3px rgb(0 0 0 / 0.1),
			0 1px 2px rgb(0 0 0 / 0.06);
	}

	.ws-btn-primary:hover:not(:disabled) {
		opacity: 0.9;
		transform: translateY(-0.5px);
		box-shadow:
			0 4px 6px rgb(0 0 0 / 0.1),
			0 2px 4px rgb(0 0 0 / 0.06);
	}

	.ws-btn-mt {
		margin-top: 0.5rem;
	}

	.ws-btn-secondary {
		background-color: color-mix(in srgb, var(--surface-border) 60%, transparent);
		color: var(--center-channel-color);
	}

	.ws-btn-secondary:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--surface-border) 90%, transparent);
	}

	.ws-btn-danger {
		background-color: color-mix(in srgb, var(--error-text-color) 12%, transparent);
		color: var(--error-text-color);
	}

	.ws-btn-danger:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--error-text-color) 20%, transparent);
	}

	.ws-btn-ghost {
		background: none;
		color: var(--surface-muted);
		padding: 0.5rem;
		border-radius: var(--radius-xs);
	}

	.ws-btn-ghost:hover {
		background-color: color-mix(in srgb, var(--surface-border) 50%, transparent);
	}

	.ws-btn-sm {
		padding: 0.3125rem 0.75rem;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		gap: 0.25rem;
	}

	.ws-btn-full {
		width: 100%;
		justify-content: center;
	}

	.ws-dialog-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.5);
		padding: 1rem;
	}

	.ws-dialog {
		width: 100%;
		max-width: 28rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--surface-border);
		background-color: var(--surface-bg);
		color: var(--center-channel-color);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
	}

	.ws-dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--surface-border);
		font-weight: 600;
	}

	.ws-dialog-body {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.ws-dialog-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		padding-top: 0.5rem;
	}

	.ws-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ws-label {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		color: var(--center-channel-color);
	}

	.ws-field-hint {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--surface-muted);
	}
</style>

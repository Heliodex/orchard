<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		apiFetch,
		toasts,
		fetchProjectContext,
		buildBasePath,
		type ProjectContext
	} from '$lib/stores';
	import { Loader2, FileText, Github } from 'lucide-svelte';
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';
	import ProjectSwitcher from '$lib/components/ProjectSwitcher.svelte';
	import { EnvironmentSwitcher } from '$lib/components/environment';
	import { Alert, Button, Field, Input, Badge, SearchPicker } from '$lib/components/ui';
	import { parseRepoInput } from '$lib/utils/repo-input';

	interface Repository {
		id: number;
		full_name: string;
		clone_url: string;
		default_branch: string;
		private: boolean;
	}
	interface Branch {
		name: string;
		protected: boolean;
		default?: boolean;
	}

	let project = $state<ProjectContext | null>(null);
	let loading = $state(true);
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let formError = $state<string | null>(null);

	let githubLinked = $state(false);
	let hasGitHubApp = $state(false);
	let githubAppInstallUrl = $state<string | null>(null);
	let repositories = $state<Repository[]>([]);
	let branches = $state<Branch[]>([]);
	let loadingRepos = $state(false);
	let reposError = $state<string | null>(null);
	let loadingBranches = $state(false);

	let selectedRepo = $state<Repository | null>(null);
	let repoIsPasted = $state(false);
	let selectedBranch = $state<Branch | null>(null);
	let repoSearch = $state('');
	let branchSearch = $state('');
	let branchQuery = $state('');

	let name = $state('');
	let composePath = $state('docker-compose.yml');
	let autoDeployEnabled = $state(true);
	// Environment every child deployment lands in. Seeded from ?env= (the env
	// the user was viewing); the switcher falls back to the project default.
	let selectedEnvId = $state($page.url.searchParams.get('env') ?? '');

	const projectSlug = $derived($page.params.projectSlug ?? '');
	const orgSlug = $derived($page.params.orgSlug ?? '');
	const wsSlug = $derived($page.params.wsSlug);
	const basePath = $derived(buildBasePath({ orgSlug, projectSlug, wsSlug }));

	async function fetchProjectData() {
		loading = true;
		error = null;
		try {
			project = await fetchProjectContext({ orgSlug, projectSlug, wsSlug });
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't load project";
		} finally {
			loading = false;
		}
	}

	async function checkGitHubStatus() {
		try {
			const response = await apiFetch('/apiv1/github/status');
			if (response.ok) {
				const status = await response.json();
				githubLinked = status.linked;
				hasGitHubApp = (status.installations?.length ?? 0) > 0;
				if (status.linked) fetchRepositories();
			}
			const installRes = await apiFetch('/apiv1/github/app/install');
			if (installRes.ok) {
				const data = await installRes.json();
				githubAppInstallUrl = data.url;
			}
		} catch (e) {
			console.error('Failed to check GitHub status:', e);
		}
	}

	async function fetchRepositories() {
		loadingRepos = true;
		reposError = null;
		try {
			const response = await apiFetch('/apiv1/github/repositories');
			if (response.ok) {
				const data = await response.json();
				repositories = Array.isArray(data) ? data : (data.repositories ?? []);
			} else {
				const body = await response.json().catch(() => null);
				reposError = body?.message || "Couldn't load your repositories.";
			}
		} catch (e) {
			console.error('Failed to fetch repositories:', e);
			reposError = "Couldn't load your repositories.";
		} finally {
			loadingRepos = false;
		}
	}

	async function fetchBranches(repo: Repository) {
		loadingBranches = true;
		branches = [];
		selectedBranch = null;
		branchSearch = '';
		try {
			const [owner, repoName] = repo.full_name.split('/');
			const response = await apiFetch(`/apiv1/github/repositories/${owner}/${repoName}/branches`);
			if (response.ok) {
				branches = await response.json();
				const defaultBranch =
					branches.find((b) => b.default) ?? branches.find((b) => b.name === repo.default_branch);
				if (defaultBranch) {
					selectedBranch = defaultBranch;
					branchSearch = defaultBranch.name;
				}
			}
		} catch (e) {
			console.error('Failed to fetch branches:', e);
		} finally {
			loadingBranches = false;
		}
	}

	function selectRepo(repo: Repository) {
		selectedRepo = repo;
		if (!name) name = repo.full_name.split('/')[1] ?? '';
		fetchBranches(repo);
	}

	function clearRepoSelection() {
		selectedRepo = null;
		repoIsPasted = false;
		repoSearch = '';
		branches = [];
		selectedBranch = null;
	}

	function selectBranch(b: Branch) {
		selectedBranch = b;
		branchSearch = b.name;
	}

	function clearBranchSelection() {
		selectedBranch = null;
		branchSearch = '';
		branchQuery = '';
	}

	function useCustomBranch(branchName: string) {
		selectedBranch = null;
		branchSearch = branchName;
	}

	const repoOptions = $derived(
		repositories.map((r) => ({ value: r.full_name, label: r.full_name }))
	);
	const privateRepos = $derived(
		new Set(repositories.filter((r) => r.private).map((r) => r.full_name))
	);
	const branchOptions = $derived(branches.map((b) => ({ value: b.name, label: b.name })));

	const parsedRepoQuery = $derived(parseRepoInput(repoSearch.trim()));
	const repoQueryIsListed = $derived(
		!!parsedRepoQuery &&
			repositories.some(
				(r) =>
					r.full_name.toLowerCase() ===
					`${parsedRepoQuery.owner}/${parsedRepoQuery.repo}`.toLowerCase()
			)
	);
	const canAutoDeploy = $derived(hasGitHubApp && !repoIsPasted);

	function pickRepo(fullName: string) {
		const repo = repositories.find((r) => r.full_name === fullName);
		if (repo) {
			repoIsPasted = false;
			selectRepo(repo);
			return;
		}
		const parsed = parseRepoInput(fullName);
		if (!parsed) return;
		repoIsPasted = true;
		selectRepo({
			id: 0,
			full_name: `${parsed.owner}/${parsed.repo}`,
			clone_url: parsed.url,
			default_branch: '',
			private: false
		});
	}

	function pickBranch(branchName: string) {
		const listed = branches.find((b) => b.name === branchName);
		if (listed) selectBranch(listed);
		else useCustomBranch(branchName);
	}

	onMount(() => {
		fetchProjectData();
		checkGitHubStatus();
	});

	async function handleSubmit() {
		formError = null;
		if (!project?.id) {
			formError = 'Project not loaded';
			return;
		}
		if (!name.trim()) {
			formError = 'Enter a stack name';
			return;
		}
		if (!selectedRepo) {
			formError = 'Choose a repository';
			return;
		}
		const branch = selectedBranch?.name || branchSearch.trim();

		submitting = true;
		try {
			const response = await apiFetch(`/apiv1/projects/${project.id}/compose-stacks/from-github`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					repoUrl: selectedRepo.clone_url,
					...(branch ? { branch } : {}),
					composePath: composePath.trim() || 'docker-compose.yml',
					autoDeployEnabled: canAutoDeploy && autoDeployEnabled,
					...(selectedEnvId ? { environmentId: selectedEnvId } : {})
				})
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || "Couldn't create compose stack");
			}

			const stack = await response.json();
			toasts.add({
				title: 'Compose stack created',
				description: 'Services are deploying. Builds run in the background.',
				color: 'success'
			});
			goto(`/${orgSlug}/compose-stacks/${stack.id}`);
		} catch (e) {
			formError = e instanceof Error ? e.message : "Couldn't create compose stack";
		} finally {
			submitting = false;
		}
	}
</script>

<div class="cs-page">
	{#if loading}
		<div class="cs-loader"><Loader2 class="h-5 w-5 animate-spin" /> Loading project…</div>
	{:else if error}
		<div class="cs-warning">
			<p class="cs-warning-title">Couldn't load project</p>
			<p class="cs-warning-desc">{error}</p>
		</div>
	{:else if project}
		<div class="mb-4">
			<Breadcrumbs
				crumbs={[
					{ label: 'Home', href: `/${orgSlug}` },
					{ label: project?.name || projectSlug || '', href: basePath },
					{ label: 'New compose stack' }
				]}
			/>
		</div>

		<div class="cs-hero">
			<h1 class="cs-page-title">Deploy Compose from GitHub</h1>
			<p class="cs-page-subtitle">
				Deploy a <code>docker-compose.yml</code> from a repository. Orchard builds services with
				<code>build:</code>
				and pulls services with <code>image:</code>.
			</p>
		</div>

		<div class="cs-main-card">
			<div class="cs-source-row">
				<span class="cs-source-label"><Github class="h-3.5 w-3.5" /> GitHub source</span>
			</div>

			<div class="cs-owner-row">
				<ProjectSwitcher
					currentProjectName={project?.name || projectSlug}
					pathSuffix="/compose-stacks/new"
				/>
				{#if project?.id}
					<EnvironmentSwitcher projectId={project.id} bind:selectedEnvId />
				{/if}
				<span class="cs-slash">/</span>
				<input type="text" bind:value={name} placeholder="my-stack" class="cs-name-input" />
			</div>

			<div class="cs-card-body">
				{#if !githubLinked}
					<Alert tone="warning" title="GitHub not connected">
						Paste owner/repo into the repository search to deploy a public repo.
						{#snippet actions()}
							<Button variant="secondary" size="sm" href="/user/settings">Connect GitHub</Button>
							{#if githubAppInstallUrl}
								<Button variant="secondary" size="sm" href={githubAppInstallUrl} target="_blank">
									Install GitHub App
								</Button>
							{/if}
						{/snippet}
					</Alert>
				{/if}
				<div class="cs-pickers">
					<SearchPicker
						options={repoOptions}
						bind:value={() => selectedRepo?.full_name ?? '', pickRepo}
						bind:query={repoSearch}
						prefix="Repository"
						placeholder="owner/repo"
						searchPlaceholder="Search, or paste owner/repo"
						creatable={!!parsedRepoQuery && !repoQueryIsListed}
						createLabel={() =>
							parsedRepoQuery ? `Use ${parsedRepoQuery.owner}/${parsedRepoQuery.repo}` : ''}
						loading={loadingRepos}
						onclear={clearRepoSelection}
						width="24rem"
					>
						{#snippet leading()}<Github size={15} />{/snippet}
						{#snippet optionLeading()}<Github size={15} />{/snippet}
						{#snippet trailing(option)}
							{#if privateRepos.has(option.value)}<Badge tone="neutral">Private</Badge>{/if}
						{/snippet}
						{#snippet empty(typed)}
							{#if reposError}
								<span class="cs-picker-note">
									{reposError}
									<a href="/user/settings">Connect GitHub</a>
								</span>
							{:else}
								No matching repositories{#if typed}&nbsp;for “{typed}”{/if}
							{/if}
						{/snippet}
					</SearchPicker>

					{#if selectedRepo}
						<SearchPicker
							options={branchOptions}
							bind:value={() => branchSearch, pickBranch}
							bind:query={branchQuery}
							prefix="Branch"
							placeholder="Default branch"
							searchPlaceholder="Search branches"
							width="18rem"
							mono
							creatable
							loading={loadingBranches}
							disabled={loadingBranches}
							onclear={selectedBranch ? clearBranchSelection : undefined}
							empty={branches.length
								? 'No matching branches'
								: 'No branches found. Type a name to use anyway.'}
						/>
					{/if}
				</div>

				<Field label="Path to docker-compose.yml" for="cs-compose-path">
					<Input
						id="cs-compose-path"
						bind:value={composePath}
						placeholder="docker-compose.yml"
						class="type-ident"
					/>
					<p class="cs-hint">
						Relative to the repo root. Default: <code>docker-compose.yml</code>.
					</p>
				</Field>

				{#if canAutoDeploy}
					<label class="cs-toggle">
						<input type="checkbox" bind:checked={autoDeployEnabled} />
						<span class="cs-toggle-label">
							<span class="cs-toggle-title">Auto-deploy on push</span>
							<span class="cs-toggle-desc">
								Rebuild every <code>build:</code> service when you push to this branch.
							</span>
						</span>
					</label>
				{/if}

				{#if formError}
					<div class="cs-warning">
						<p class="cs-warning-desc">{formError}</p>
					</div>
				{/if}

				<div class="cs-actions">
					<Button variant="secondary" onclick={() => history.back()} disabled={submitting}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onclick={handleSubmit}
						loading={submitting}
						disabled={submitting || !selectedRepo}
					>
						{#if !submitting}<FileText class="h-3.5 w-3.5" />{/if}
						Deploy stack
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.cs-page {
		max-width: 44rem;
		margin: 0 auto;
		padding: 1.5rem 2.5rem 3rem;
	}

	.cs-hero {
		padding: 2rem 0 1.75rem;
	}

	.cs-page-title {
		font-size: var(--text-title-2);
		line-height: var(--lh-title-2);
		font-weight: 700;
		color: var(--center-channel-color);
		margin: 0;
		letter-spacing: -0.014em;
		background: linear-gradient(
			135deg,
			var(--sidebar-text-active-border),
			color-mix(in srgb, var(--sidebar-text-active-border) 60%, var(--link-color))
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.cs-page-subtitle {
		font-size: var(--text-footnote);
		color: var(--surface-muted);
		margin: 0.5rem 0 0;
		line-height: 1.5;
	}

	.cs-page-subtitle code,
	.cs-hint code,
	.cs-toggle-desc code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		padding: 0.0625rem 0.25rem;
		border-radius: var(--radius-xs);
		background-color: color-mix(in srgb, var(--surface-border) 50%, transparent);
	}

	.cs-main-card {
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-lg);
		background-color: var(--surface-bg);
		display: flex;
		flex-direction: column;
		box-shadow:
			0 1px 3px rgb(0 0 0 / 0.04),
			0 1px 2px rgb(0 0 0 / 0.02);
	}

	.cs-source-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		border-bottom: 1px solid var(--surface-border);
	}

	.cs-source-label {
		display: inline-flex;
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
	}

	.cs-owner-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--surface-border);
	}

	.cs-slash {
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
		font-weight: 300;
		color: var(--surface-muted);
		user-select: none;
	}

	.cs-name-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--surface-border);
		background-color: var(--center-channel-bg);
		color: var(--center-channel-color);
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.cs-name-input:focus {
		outline: none;
		border-color: var(--sidebar-text-active-border);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--sidebar-text-active-border) 15%, transparent);
	}

	.cs-card-body {
		padding: 1.25rem 1.5rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.cs-pickers {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		min-width: 0;
	}

	.cs-picker-note a {
		color: var(--text-link);
		font-weight: 600;
		text-decoration: underline;
	}

	.cs-hint {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--surface-muted);
		margin: 0;
	}

	.cs-toggle {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem 0.875rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--surface-border);
		background-color: color-mix(in srgb, var(--surface-border) 12%, transparent);
		cursor: pointer;
	}

	.cs-toggle input {
		margin-top: 0.25rem;
	}

	.cs-toggle-label {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.cs-toggle-title {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		color: var(--center-channel-color);
	}

	.cs-toggle-desc {
		font-size: var(--text-caption);
		color: var(--surface-muted);
		line-height: 1.45;
	}

	.cs-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.cs-warning {
		padding: 0.75rem 0.875rem;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--error-text-color) 30%, var(--surface-border));
		background-color: color-mix(in srgb, var(--error-text-color) 5%, var(--surface-bg));
	}

	.cs-warning-title {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		margin: 0 0 0.25rem;
		color: var(--center-channel-color);
	}

	.cs-warning-desc {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		margin: 0;
		color: var(--surface-muted);
	}

	.cs-loader {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 4rem 0;
		justify-content: center;
		color: var(--surface-muted);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
	}
</style>

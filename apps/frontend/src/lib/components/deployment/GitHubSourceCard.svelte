<script lang="ts">
	import { Github } from 'lucide-svelte';
	import { apiFetch, toasts } from '$lib/stores';
	import {
		SectionCard,
		Button,
		Badge,
		Alert,
		SearchPicker,
		Swap,
		FormActions
	} from '$lib/components/ui';
	import SettingsList from '$lib/components/ui/SettingsList.svelte';
	import SettingRow from '$lib/components/ui/SettingRow.svelte';

	interface Repository {
		id: number;
		full_name: string;
		default_branch: string;
		private: boolean;
	}

	interface Branch {
		name: string;
		protected: boolean;
	}

	let {
		deployment,
		onUpdated,
		onRebuild,
		rebuilding
	}: {
		deployment: any;
		onUpdated: (updated: any) => void;
		onRebuild: () => void;
		rebuilding: boolean;
	} = $props();

	let editing = $state(false);
	let saving = $state(false);
	let justSaved = $state(false);

	let repositories = $state<Repository[]>([]);
	let loadingRepos = $state(false);
	let reposError = $state<string | null>(null);
	let reposFetched = false;

	let repoQuery = $state('');
	let selectedRepo = $state<Repository | null>(null);
	let manualRepo = $state<{ owner: string; repo: string } | null>(null);

	let branches = $state<Branch[]>([]);
	let loadingBranches = $state(false);
	let branchQuery = $state('');
	let branchValue = $state('');

	let dockerfiles = $state<string[]>([]);
	let loadingDockerfiles = $state(false);
	let dockerfileQuery = $state('');
	let dockerfileValue = $state('Dockerfile');

	const needsDockerfile = $derived(deployment?.buildType !== 'railpack');

	const currentRepoName = $derived(
		String(deployment?.githubRepo || '').replace(/^https?:\/\/github\.com\//, '')
	);

	function parseRepoInput(value: string): { owner: string; repo: string } | null {
		const trimmed = value.trim().replace(/\.git$/, '');
		const urlMatch = trimmed.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i);
		if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
		const shortMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
		if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };
		return null;
	}

	const parsedRepoInput = $derived(parseRepoInput(repoQuery));
	const parsedRepoIsListed = $derived(
		!!parsedRepoInput &&
			repositories.some(
				(r) =>
					r.full_name.toLowerCase() ===
					`${parsedRepoInput.owner}/${parsedRepoInput.repo}`.toLowerCase()
			)
	);

	const repoNeedle = $derived(
		(parsedRepoInput
			? `${parsedRepoInput.owner}/${parsedRepoInput.repo}`
			: repoQuery.trim()
		).toLowerCase()
	);
	const repoOptions = $derived(
		repositories
			.filter((r) => r.full_name.toLowerCase().includes(repoNeedle))
			.map((r) => ({ value: r.full_name, label: r.full_name }))
	);
	const privateRepos = $derived(
		new Set(repositories.filter((r) => r.private).map((r) => r.full_name))
	);
	const branchOptions = $derived(branches.map((b) => ({ value: b.name, label: b.name })));
	const dockerfileOptions = $derived(dockerfiles.map((d) => ({ value: d, label: d })));

	const chosenRepo = $derived(
		selectedRepo
			? { owner: selectedRepo.full_name.split('/')[0], repo: selectedRepo.full_name.split('/')[1] }
			: manualRepo
	);

	const repoLabel = $derived(chosenRepo ? `${chosenRepo.owner}/${chosenRepo.repo}` : '');

	const canSave = $derived(
		!!chosenRepo && !!branchValue.trim() && (!needsDockerfile || !!dockerfileValue.trim())
	);

	async function fetchRepositories() {
		if (reposFetched) return;
		reposFetched = true;
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
		} catch {
			reposError = "Couldn't load your repositories.";
		} finally {
			loadingRepos = false;
		}
	}

	async function loadBranches(owner: string, repo: string, preferred?: string) {
		loadingBranches = true;
		branches = [];
		try {
			const response = await apiFetch(`/apiv1/github/repositories/${owner}/${repo}/branches`);
			if (response.ok) {
				branches = await response.json();
				const pick =
					(preferred && branches.find((b) => b.name === preferred)) ||
					branches.find((b) => b.name === 'main') ||
					branches.find((b) => b.name === 'master') ||
					branches[0];
				if (pick) branchValue = pick.name;
				else if (preferred) branchValue = preferred;
			} else if (preferred) {
				branchValue = preferred;
			}
		} catch {
			if (preferred) branchValue = preferred;
		} finally {
			loadingBranches = false;
		}
		if (needsDockerfile && branchValue) {
			loadDockerfiles(owner, repo, branchValue);
		}
	}

	async function loadDockerfiles(owner: string, repo: string, branchName: string) {
		loadingDockerfiles = true;
		dockerfiles = [];
		try {
			const response = await apiFetch(
				`/apiv1/github/repositories/${owner}/${repo}/dockerfiles?branch=${encodeURIComponent(branchName)}`
			);
			if (response.ok) {
				dockerfiles = await response.json();
			}
		} catch {
			dockerfiles = [];
		} finally {
			loadingDockerfiles = false;
		}
	}

	function startEditing() {
		editing = true;
		justSaved = false;
		const current = parseRepoInput(currentRepoName);
		selectedRepo = null;
		manualRepo = current;
		repoQuery = '';
		branchQuery = '';
		branchValue = deployment?.githubBranch || '';
		dockerfileQuery = '';
		dockerfileValue = deployment?.dockerfilePath || 'Dockerfile';
		fetchRepositories();
		if (current) loadBranches(current.owner, current.repo, branchValue || undefined);
	}

	function cancelEditing() {
		editing = false;
	}

	function selectRepo(repo: Repository) {
		selectedRepo = repo;
		manualRepo = null;
		repoQuery = '';
		dockerfileValue = 'Dockerfile';
		const [owner, name] = repo.full_name.split('/');
		loadBranches(owner, name, repo.default_branch);
	}

	function useManualRepo(parsed: { owner: string; repo: string }) {
		manualRepo = parsed;
		selectedRepo = null;
		repoQuery = '';
		dockerfileValue = 'Dockerfile';
		loadBranches(parsed.owner, parsed.repo);
	}

	function pickRepo(value: string) {
		const listed = repositories.find((r) => r.full_name === value);
		if (listed) {
			selectRepo(listed);
			return;
		}
		const parsed = parseRepoInput(value);
		if (parsed) useManualRepo(parsed);
	}

	function selectBranch(name: string) {
		branchValue = name;
		if (needsDockerfile && chosenRepo) {
			loadDockerfiles(chosenRepo.owner, chosenRepo.repo, name);
		}
	}

	function clearRepoSelection() {
		selectedRepo = null;
		manualRepo = null;
		repoQuery = '';
		branches = [];
		branchQuery = '';
		branchValue = '';
		dockerfiles = [];
		dockerfileQuery = '';
	}

	async function save() {
		if (!chosenRepo || saving) return;
		saving = true;
		try {
			const body: Record<string, string> = {
				repoUrl: `${chosenRepo.owner}/${chosenRepo.repo}`,
				branch: branchValue.trim()
			};
			if (needsDockerfile) body.dockerfilePath = dockerfileValue.trim();
			const response = await apiFetch(`/apiv1/deployments/${deployment.id}/github-repo`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || "Couldn't update repository");
			}
			const updated = await response.json();
			onUpdated(updated);
			editing = false;
			justSaved = true;
			toasts.add({
				title: 'Repository updated',
				description: 'Future builds use the new source',
				color: 'success'
			});
		} catch (e) {
			toasts.add({
				title: "Couldn't update repository",
				description: e instanceof Error ? e.message : "Couldn't update repository",
				color: 'error'
			});
		} finally {
			saving = false;
		}
	}
</script>

<SectionCard title="Source">
	<Swap key={editing}>
		{#if !editing}
			<SettingsList>
				<div class="src-row">
					<Github size={16} class="src-glyph" />
					<a
						class="src-repo"
						title={currentRepoName}
						href={deployment.githubRepo}
						target="_blank"
						rel="noopener noreferrer"
					>
						{currentRepoName}
					</a>
					{#if deployment.githubBranch}
						<Badge tone="neutral"
							><span class="src-mono" title={deployment.githubBranch}
								>{deployment.githubBranch}</span
							></Badge
						>
					{/if}
					{#if needsDockerfile && deployment.dockerfilePath}
						<span class="src-detail" title={deployment.dockerfilePath}
							>{deployment.dockerfilePath}</span
						>
					{/if}
					<span class="src-end">
						<Button size="sm" variant="secondary" onclick={startEditing}>Change</Button>
					</span>
				</div>
			</SettingsList>
			{#if justSaved}
				<div class="src-alert">
					<Alert tone="info" title="Still running the previous build">
						Rebuild to deploy from the new source.
						{#snippet actions()}
							<Button
								size="sm"
								variant="primary"
								loading={rebuilding}
								onclick={() => {
									justSaved = false;
									onRebuild();
								}}
							>
								Rebuild now
							</Button>
						{/snippet}
					</Alert>
				</div>
			{/if}
		{:else}
			<div class="src-form">
				<SettingsList>
					<SettingRow label="Repository" wide>
						<SearchPicker
							block
							options={repoOptions}
							bind:value={() => repoLabel, pickRepo}
							bind:query={repoQuery}
							placeholder="owner/repo or GitHub URL"
							searchPlaceholder="Search repos, or paste owner/repo"
							filter={false}
							loading={loadingRepos && !repoQuery.trim()}
							creatable={!!parsedRepoInput && !parsedRepoIsListed}
							createLabel={() => `Use ${parsedRepoInput?.owner}/${parsedRepoInput?.repo}`}
							onclear={clearRepoSelection}
						>
							{#snippet leading()}<Github size={15} />{/snippet}
							{#snippet optionLeading()}<Github size={15} />{/snippet}
							{#snippet trailing(option)}
								{#if privateRepos.has(option.value)}<Badge tone="neutral">Private</Badge>{/if}
							{/snippet}
							{#snippet empty()}
								{#if loadingRepos}
									Loading your repositories
								{:else if reposError}
									{reposError}
								{:else}
									Search your repos, or paste owner/repo or a GitHub URL
								{/if}
							{/snippet}
						</SearchPicker>
					</SettingRow>
					<SettingRow label="Branch" wide>
						<SearchPicker
							block
							options={branchOptions}
							bind:value={() => branchValue, selectBranch}
							bind:query={branchQuery}
							placeholder="main"
							searchPlaceholder="Search branches"
							mono
							creatable
							loading={loadingBranches}
							empty={branches.length
								? 'No matching branches'
								: 'No branches found. Type a name to use anyway.'}
						/>
					</SettingRow>
					{#if needsDockerfile}
						<SettingRow label="Dockerfile" wide>
							<SearchPicker
								block
								options={dockerfileOptions}
								bind:value={dockerfileValue}
								bind:query={dockerfileQuery}
								placeholder="Dockerfile"
								searchPlaceholder="Search paths"
								mono
								creatable
								loading={loadingDockerfiles}
								empty="No Dockerfiles found on this branch. Type a path to use anyway."
							/>
						</SettingRow>
					{/if}
				</SettingsList>
				<FormActions hint="The app keeps its current build until you rebuild.">
					<Button variant="ghost" disabled={saving} onclick={cancelEditing}>Cancel</Button>
					<Button variant="primary" loading={saving} disabled={!canSave} onclick={save}>Save</Button
					>
				</FormActions>
			</div>
		{/if}
	</Swap>
</SectionCard>

<style>
	.src-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		color: var(--text-default);
		font-size: var(--text-body);
		line-height: var(--lh-body);
	}
	.src-row :global(.src-glyph) {
		flex-shrink: 0;
		color: var(--text-muted);
	}
	.src-repo {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.src-repo:hover {
		color: var(--text-link);
		text-decoration: underline;
	}
	.src-mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
	}
	.src-detail {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
	}
	.src-end {
		display: flex;
		flex-shrink: 0;
		margin-left: auto;
	}
	.src-alert {
		margin-top: var(--space-5);
	}
	.src-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
</style>

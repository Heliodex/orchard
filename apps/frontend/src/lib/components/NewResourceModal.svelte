<script lang="ts">
	import { fade, scale } from '$lib/utils/transitions';
	import { goto } from '$app/navigation';
	import {
		X,
		Github,
		Container,
		Database,
		Globe,
		Search,
		LayoutTemplate,
		Server,
		FileText
	} from 'lucide-svelte';
	import { apiFetch } from '$lib/stores';

	interface Props {
		open: boolean;
		orgSlug: string;
		projectSlug: string;
		/** Environment the resource should be created in (the one the user is viewing). */
		selectedEnvId?: string;
	}

	let { open = $bindable(false), orgSlug, projectSlug, selectedEnvId = '' }: Props = $props();

	function withEnv(path: string): string {
		if (!selectedEnvId) return path;
		return `${path}${path.includes('?') ? '&' : '?'}env=${encodeURIComponent(selectedEnvId)}`;
	}

	interface Template {
		id: string;
		name: string;
		displayName: string;
		description?: string;
		icon?: string;
		version: string;
		category?: string;
		tags: string[];
		isBuiltIn: boolean;
	}

	let templates = $state<Template[]>([]);
	let loadingTemplates = $state(false);
	let search = $state('');

	const basePath = $derived(`/${orgSlug}/projects/${projectSlug}`);

	const quickActions = [
		{
			id: 'deployment-github',
			label: 'GitHub repository',
			description: 'Build and deploy from a GitHub repo',
			icon: Github,
			color: '#6e5494'
		},
		{
			id: 'deployment-image',
			label: 'Docker image',
			description: 'Deploy a container image',
			icon: Container,
			color: '#2496ed'
		},
		{
			id: 'compose-stack',
			label: 'Compose from GitHub',
			description: 'Deploy a docker-compose.yml from a repository',
			icon: FileText,
			color: '#0db7ed'
		},
		{
			id: 'database',
			label: 'Database',
			description: 'Create a managed database',
			icon: Database,
			color: '#f59e0b'
		}
	];

	const filteredTemplates = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return templates;
		return templates.filter(
			(t) =>
				t.displayName.toLowerCase().includes(q) ||
				t.description?.toLowerCase().includes(q) ||
				t.tags.some((tag) => tag.toLowerCase().includes(q))
		);
	});

	const filteredActions = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return quickActions;
		return quickActions.filter(
			(a) => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
		);
	});

	function getCategoryColor(category?: string) {
		switch (category) {
			case 'cms':
				return '#8b5cf6';
			case 'backend':
				return '#3b82f6';
			case 'frontend':
				return '#22c55e';
			case 'database':
				return '#f59e0b';
			default:
				return 'var(--surface-muted)';
		}
	}

	function getIconForTemplate(icon?: string) {
		switch (icon) {
			case 'wordpress':
			case 'ghost':
			case 'nodejs':
				return Server;
			case 'database':
				return Database;
			case 'globe':
				return Globe;
			default:
				return LayoutTemplate;
		}
	}

	function navigateToNew(type: string) {
		open = false;
		switch (type) {
			case 'deployment-github':
				goto(withEnv(`${basePath}/deployments/new?source=github`));
				break;
			case 'deployment-image':
				goto(withEnv(`${basePath}/deployments/new?source=image`));
				break;
			case 'database':
				goto(withEnv(`${basePath}/databases/new`));
				break;
			case 'compose-stack':
				goto(withEnv(`${basePath}/compose-stacks/new`));
				break;
		}
	}

	function navigateToTemplate(templateId: string) {
		open = false;
		goto(`${basePath}/templates/deploy/${templateId}`);
	}

	async function fetchTemplates() {
		loadingTemplates = true;
		try {
			const response = await apiFetch('/apiv1/templates');
			if (response.ok) {
				templates = await response.json();
			}
		} catch {
			/* silent */
		} finally {
			loadingTemplates = false;
		}
	}

	$effect(() => {
		if (open && templates.length === 0 && !loadingTemplates) {
			fetchTemplates();
		}
	});

	let searchInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (open) {
			search = '';
			setTimeout(() => searchInput?.focus(), 50);
		}
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="nr-overlay" transition:fade={{ duration: 150 }} onclick={() => (open = false)}>
		<div
			class="nr-modal"
			transition:scale={{ duration: 200, start: 0.95 }}
			onclick={(e) => e.stopPropagation()}
		>
			<div class="nr-header">
				<h2 class="nr-title">Create new resource</h2>
				<button class="nr-close" onclick={() => (open = false)}>
					<X size={16} />
				</button>
			</div>

			<div class="nr-search-wrap">
				<Search class="h-4 w-4 nr-search-icon" />
				<input
					bind:this={searchInput}
					type="search"
					placeholder="Search resources and templates"
					class="nr-search"
					bind:value={search}
				/>
			</div>

			<div class="nr-body">
				{#if filteredActions.length > 0}
					<div class="nr-section">
						<h3 class="nr-section-title">Quick start</h3>
						<div class="nr-quick-grid">
							{#each filteredActions as action (action.id)}
								{@const Icon = action.icon}
								<button class="nr-quick-card" onclick={() => navigateToNew(action.id)}>
									<div
										class="nr-quick-icon"
										style="background-color: color-mix(in srgb, {action.color} 12%, transparent)"
									>
										<Icon class="h-5 w-5" style="color: {action.color}" />
									</div>
									<div class="nr-quick-info">
										<span class="nr-quick-label">{action.label}</span>
										<span class="nr-quick-desc">{action.description}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<div class="nr-section">
					<div class="nr-section-header">
						<h3 class="nr-section-title">Templates</h3>
						<button
							class="nr-browse-link"
							onclick={() => {
								open = false;
								goto(`${basePath}/templates`);
							}}
						>
							Browse all
						</button>
					</div>

					{#if loadingTemplates}
						<div class="nr-tpl-grid">
							{#each Array(4) as _, i (i)}
								<div class="nr-tpl-card nr-tpl-skeleton">
									<div
										class="skeleton"
										style="width: 2.25rem; height: 2.25rem; border-radius: var(--radius-md); flex-shrink: 0;"
									></div>
									<div style="flex: 1; display: flex; flex-direction: column; gap: 0.25rem;">
										<div class="skeleton" style="height: 0.8125rem; width: 60%;"></div>
										<div class="skeleton" style="height: 0.6875rem; width: 80%;"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else if filteredTemplates.length === 0}
						<div class="nr-tpl-empty">
							<LayoutTemplate class="h-6 w-6" style="color: var(--surface-muted)" />
							<span
								>{search.trim() ? 'No templates match your search' : 'No templates available'}</span
							>
						</div>
					{:else}
						<div class="nr-tpl-grid">
							{#each filteredTemplates as template (template.id)}
								{@const Icon = getIconForTemplate(template.icon)}
								<button class="nr-tpl-card" onclick={() => navigateToTemplate(template.id)}>
									<div
										class="nr-tpl-icon"
										style="background-color: color-mix(in srgb, {getCategoryColor(
											template.category
										)} 12%, transparent)"
									>
										<Icon class="h-4 w-4" style="color: {getCategoryColor(template.category)}" />
									</div>
									<div class="nr-tpl-info">
										<span class="nr-tpl-name">{template.displayName}</span>
										{#if template.description}
											<span class="nr-tpl-desc">{template.description}</span>
										{/if}
									</div>
									{#if template.category}
										<span
											class="nr-tpl-badge"
											style="background-color: color-mix(in srgb, {getCategoryColor(
												template.category
											)} 15%, transparent); color: {getCategoryColor(template.category)}"
										>
											{template.category}
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.nr-overlay {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		z-index: 1000;
		padding: 6vh 1rem 1rem;
	}

	.nr-modal {
		background-color: var(--center-channel-bg);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 38rem;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.nr-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem 0;
	}

	.nr-title {
		font-size: var(--text-headline);
		line-height: var(--lh-headline);
		font-weight: 600;
		color: var(--center-channel-color);
		margin: 0;
	}

	.nr-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: var(--radius-xs);
		border: none;
		background: none;
		color: var(--surface-muted);
		cursor: pointer;
		transition:
			color var(--dur-fast),
			background-color var(--dur-fast);
	}

	.nr-close:hover {
		color: var(--center-channel-color);
		background-color: color-mix(in srgb, var(--surface-border) 50%, transparent);
	}

	.nr-search-wrap {
		position: relative;
		padding: 0.75rem 1.5rem;
	}

	.nr-search-wrap :global(.nr-search-icon) {
		position: absolute;
		left: 2.25rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--surface-muted);
		pointer-events: none;
	}

	.nr-search {
		width: 100%;
		padding: 0.5rem 0.75rem 0.5rem 2.25rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--surface-border);
		background-color: var(--center-channel-bg);
		color: var(--center-channel-color);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
	}

	.nr-search::placeholder {
		color: var(--surface-muted);
	}

	.nr-search:focus {
		outline: none;
		border-color: var(--sidebar-text-active-border);
	}

	.nr-body {
		overflow-y: auto;
		padding: 0 1.5rem 1.5rem;
	}

	.nr-section {
		margin-top: 1rem;
	}

	.nr-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.nr-section-title {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
		letter-spacing: 0.05em;
		color: var(--surface-muted);
		margin: 0 0 0.75rem;
	}

	.nr-browse-link {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--sidebar-text-active-border);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		margin-bottom: 0.75rem;
	}

	.nr-browse-link:hover {
		text-decoration: underline;
	}

	.nr-quick-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.nr-quick-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-md);
		background-color: var(--surface-bg);
		cursor: pointer;
		transition:
			border-color var(--dur-fast),
			box-shadow var(--dur-fast);
		text-align: left;
	}

	.nr-quick-card:hover {
		border-color: var(--sidebar-text-active-border);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--sidebar-text-active-border) 25%, transparent);
	}

	.nr-quick-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.nr-quick-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.nr-quick-label {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		color: var(--center-channel-color);
	}

	.nr-quick-desc {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--surface-muted);
	}

	.nr-tpl-grid {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.nr-tpl-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0.75rem;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		cursor: pointer;
		transition:
			background-color var(--dur-fast),
			border-color var(--dur-fast);
		text-align: left;
		width: 100%;
	}

	.nr-tpl-card:hover {
		background-color: color-mix(in srgb, var(--surface-border) 30%, transparent);
		border-color: var(--surface-border);
	}

	.nr-tpl-skeleton {
		pointer-events: none;
	}

	.nr-tpl-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.nr-tpl-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.nr-tpl-name {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		color: var(--center-channel-color);
	}

	.nr-tpl-desc {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--surface-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nr-tpl-badge {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		padding: 0.0625rem 0.5rem;
		border-radius: var(--radius-pill);
		text-transform: capitalize;
		flex-shrink: 0;
	}

	.nr-tpl-empty {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1.5rem;
		justify-content: center;
		color: var(--surface-muted);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
	}
</style>

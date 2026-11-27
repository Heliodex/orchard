<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiFetch, toasts } from '$lib/stores';
	import {
		ArrowLeft,
		Loader2,
		Search,
		LayoutTemplate,
		Database,
		Globe,
		Server,
		Plus,
		Package,
		Trash2
	} from 'lucide-svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

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
	let loading = $state(true);
	let error = $state<string | null>(null);
	let search = $state('');
	let selectedCategory = $state<string | null>(null);
	let showDeleteModal = $state(false);
	let templateToDelete = $state<Template | null>(null);
	let deleting = $state(false);

	const orgSlug = $derived($page.params.orgSlug);
	const wsSlug = $derived($page.params.wsSlug);
	const projectSlug = $derived($page.params.projectSlug);

	const categories = $derived(() => {
		const cats = new Set<string>();
		for (const t of templates) {
			if (t.category) cats.add(t.category);
		}
		return Array.from(cats).sort();
	});

	const filteredTemplates = $derived.by(() => {
		let result = templates;
		if (selectedCategory) {
			result = result.filter((t) => t.category === selectedCategory);
		}
		const q = search.trim().toLowerCase();
		if (q) {
			result = result.filter(
				(t) =>
					t.displayName.toLowerCase().includes(q) ||
					t.description?.toLowerCase().includes(q) ||
					t.tags.some((tag) => tag.toLowerCase().includes(q))
			);
		}
		return result;
	});

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

	async function fetchTemplates() {
		loading = true;
		try {
			const response = await apiFetch('/apiv1/templates');
			if (!response.ok) throw new Error("Couldn't load templates");
			templates = await response.json();
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't load templates";
		} finally {
			loading = false;
		}
	}

	function confirmDelete(template: Template, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		templateToDelete = template;
		showDeleteModal = true;
	}

	async function deleteTemplate() {
		if (!templateToDelete) return;
		deleting = true;
		try {
			const response = await apiFetch(`/apiv1/templates/${templateToDelete.id}`, {
				method: 'DELETE'
			});
			if (!response.ok) {
				let msg = "Couldn't delete template";
				try {
					const data = await response.json();
					if (data.message) msg = data.message;
				} catch {}
				throw new Error(msg);
			}
			toasts.add({
				title: 'Template deleted',
				description: `${templateToDelete.displayName} deleted`,
				color: 'success'
			});
			templates = templates.filter((t) => t.id !== templateToDelete!.id);
		} catch (e) {
			toasts.add({
				title: "Couldn't delete template",
				description: e instanceof Error ? e.message : "Couldn't delete template",
				color: 'error'
			});
		} finally {
			deleting = false;
			templateToDelete = null;
		}
	}

	onMount(fetchTemplates);
</script>

<div class="tpl-page">
	{#if error}
		<div class="tpl-error">{error}</div>
	{/if}

	{#if loading}
		<div class="skeleton" style="height: 0.8125rem; width: 6rem; margin-bottom: 1rem;"></div>
		<div class="tpl-header">
			<div class="tpl-header-info">
				<div class="skeleton" style="height: 1.5rem; width: 10rem; margin-bottom: 0.5rem;"></div>
				<div class="skeleton" style="height: 0.875rem; width: 24rem;"></div>
			</div>
			<div class="tpl-header-actions">
				<div
					class="skeleton"
					style="height: 2rem; width: 7rem; border-radius: var(--radius-sm);"
				></div>
			</div>
		</div>
		<div class="tpl-filters">
			<div
				class="skeleton"
				style="height: 2.25rem; width: 100%; border-radius: var(--radius-sm);"
			></div>
			<div style="display: flex; gap: 0.5rem;">
				{#each Array(4) as _, i (i)}
					<div
						class="skeleton"
						style="height: 1.75rem; width: 4rem; border-radius: var(--radius-pill);"
					></div>
				{/each}
			</div>
		</div>
		<div class="tpl-grid">
			{#each Array(6) as _, i (i)}
				<div class="tpl-card" style="pointer-events: none;">
					<div class="tpl-card-top">
						<div
							class="skeleton"
							style="width: 2.75rem; height: 2.75rem; border-radius: var(--radius-md);"
						></div>
						<div
							class="skeleton"
							style="height: 1.25rem; width: 3.5rem; border-radius: var(--radius-pill);"
						></div>
					</div>
					<div class="tpl-card-body">
						<div class="skeleton" style="height: 0.9375rem; width: 60%;"></div>
						<div class="skeleton" style="height: 0.8125rem; width: 90%;"></div>
						<div class="skeleton" style="height: 0.8125rem; width: 70%;"></div>
					</div>
					<div class="tpl-card-tags">
						{#each Array(3) as _, i (i)}
							<div
								class="skeleton"
								style="height: 1.125rem; width: 3rem; border-radius: var(--radius-xs);"
							></div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<button
			onclick={() => goto(`/${orgSlug}/workspaces/${wsSlug}/projects/${projectSlug}`)}
			class="tpl-back"
		>
			<ArrowLeft class="h-4 w-4" />
			Back to project
		</button>

		<div class="tpl-header">
			<div class="tpl-header-info">
				<h1 class="tpl-title">Templates</h1>
				<p class="tpl-subtitle">Deploy preconfigured app stacks.</p>
			</div>
			<div class="tpl-header-actions">
				<a
					href="/{orgSlug}/workspaces/{wsSlug}/projects/{projectSlug}/templates/new"
					class="tpl-btn tpl-btn-primary"
				>
					<Plus class="h-4 w-4" />
					Create template
				</a>
			</div>
		</div>

		<div class="tpl-stats">
			<div class="tpl-stat">
				<Package class="h-4 w-4" />
				<span class="tpl-stat-value">{templates.length}</span>
				<span class="tpl-stat-label">Available</span>
			</div>
			{#if templates.filter((t) => t.isBuiltIn).length}
				<div class="tpl-stat">
					<LayoutTemplate class="h-4 w-4" />
					<span class="tpl-stat-value">{templates.filter((t) => t.isBuiltIn).length}</span>
					<span class="tpl-stat-label">Built-in</span>
				</div>
			{/if}
			{#if categories().length}
				<div class="tpl-stat">
					<span class="tpl-stat-value">{categories().length}</span>
					<span class="tpl-stat-label">Categories</span>
				</div>
			{/if}
		</div>

		<div class="tpl-section-header">
			<h2 class="tpl-section-title">Browse templates</h2>
			<div class="tpl-toolbar">
				<div class="tpl-search-wrap">
					<Search class="h-4 w-4 tpl-search-icon" />
					<input
						type="search"
						placeholder="Search templates"
						class="tpl-search"
						bind:value={search}
					/>
				</div>
			</div>
		</div>

		<div class="tpl-categories">
			<button
				class="tpl-cat-btn"
				class:tpl-cat-active={!selectedCategory}
				onclick={() => (selectedCategory = null)}
			>
				All
			</button>
			{#each categories() as cat (cat)}
				<button
					class="tpl-cat-btn"
					class:tpl-cat-active={selectedCategory === cat}
					style={selectedCategory === cat
						? `background-color: ${getCategoryColor(cat)}; border-color: ${getCategoryColor(cat)};`
						: ''}
					onclick={() => (selectedCategory = selectedCategory === cat ? null : cat)}
				>
					{cat}
				</button>
			{/each}
		</div>

		{#if filteredTemplates.length === 0}
			<div class="tpl-empty">
				<LayoutTemplate class="h-10 w-10" style="color: var(--surface-muted)" />
				<p>No templates found</p>
			</div>
		{:else}
			<div class="tpl-grid">
				{#each filteredTemplates as template (template.id)}
					{@const Icon = getIconForTemplate(template.icon)}
					<a
						href="/{orgSlug}/workspaces/{wsSlug}/projects/{projectSlug}/templates/deploy/{template.id}"
						class="tpl-card"
					>
						<div class="tpl-card-top">
							<div
								class="tpl-card-icon"
								style="background-color: color-mix(in srgb, {getCategoryColor(
									template.category
								)} 12%, transparent)"
							>
								<Icon class="h-5 w-5" style="color: {getCategoryColor(template.category)}" />
							</div>
							<div class="tpl-card-top-right">
								{#if template.category}
									<span
										class="tpl-card-badge"
										style="background-color: color-mix(in srgb, {getCategoryColor(
											template.category
										)} 15%, transparent); color: {getCategoryColor(template.category)}"
									>
										{template.category}
									</span>
								{/if}
								{#if !template.isBuiltIn}
									<button
										class="tpl-card-delete"
										onclick={(e) => confirmDelete(template, e)}
										title="Delete template"
									>
										<Trash2 class="h-3.5 w-3.5" />
									</button>
								{/if}
							</div>
						</div>
						<div class="tpl-card-body">
							<span class="tpl-card-name">{template.displayName}</span>
							{#if template.description}
								<p class="tpl-card-desc">{template.description}</p>
							{/if}
						</div>
						{#if template.tags.length}
							<div class="tpl-card-tags">
								{#each template.tags.slice(0, 4) as tag (tag)}
									<span class="tpl-card-tag">{tag}</span>
								{/each}
							</div>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>

{#if templateToDelete}
	<ConfirmModal
		bind:open={showDeleteModal}
		title={`Delete "${templateToDelete.displayName}"?`}
		description="This permanently <strong>deletes this template</strong>. Existing instances keep running, but you can't deploy from it again."
		html
		confirmLabel="Delete template"
		onconfirm={deleteTemplate}
		oncancel={() => (templateToDelete = null)}
	/>
{/if}

<style>
	.tpl-page {
		max-width: 52rem;
		margin: 0 auto;
		padding: 2.5rem 2.5rem 3rem;
	}

	.tpl-back {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--surface-muted);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		margin-bottom: 1rem;
		transition: color var(--dur-fast);
	}

	.tpl-back:hover {
		color: var(--center-channel-color);
	}

	/* Header: matches project page layout */
	.tpl-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.tpl-header-info {
		flex: 1;
		min-width: 0;
	}

	.tpl-header-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.tpl-title {
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
		font-weight: 700;
		letter-spacing: -0.011em;
		color: var(--center-channel-color);
		margin: 0;
	}

	.tpl-subtitle {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--surface-muted);
		margin: 0.25rem 0 0;
	}

	/* Stats: matches project page stats row */
	.tpl-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.tpl-stat {
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

	.tpl-stat-value {
		font-weight: 600;
		color: var(--center-channel-color);
	}

	/* Section header: matches project page deployments header */
	.tpl-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
	}

	.tpl-section-title {
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

	.tpl-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.tpl-error {
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		background-color: color-mix(in srgb, var(--error-text-color) 10%, transparent);
		color: var(--error-text-color);
		border: 1px solid color-mix(in srgb, var(--error-text-color) 25%, transparent);
		margin-bottom: 1.5rem;
	}

	.tpl-filters {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.tpl-search-wrap {
		position: relative;
		width: 14rem;
	}

	.tpl-search-wrap :global(.tpl-search-icon) {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--surface-muted);
		pointer-events: none;
	}

	.tpl-search {
		width: 100%;
		padding: 0.5rem 0.75rem 0.5rem 2.25rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--surface-border);
		background-color: var(--center-channel-bg);
		color: var(--center-channel-color);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
	}

	.tpl-search::placeholder {
		color: var(--surface-muted);
	}

	.tpl-search:focus {
		outline: none;
		border-color: var(--sidebar-text-active-border);
	}

	.tpl-categories {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.tpl-cat-btn {
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-pill);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
		border: 1px solid var(--surface-border);
		background: transparent;
		color: var(--surface-muted);
		cursor: pointer;
		text-transform: capitalize;
		transition: all var(--dur-fast);
	}

	.tpl-cat-btn:hover {
		border-color: var(--center-channel-color);
		color: var(--center-channel-color);
	}

	.tpl-cat-active {
		background-color: var(--sidebar-text-active-border);
		border-color: var(--sidebar-text-active-border);
		color: #fff;
	}

	.tpl-cat-active:hover {
		color: #fff;
	}

	/* Grid: card layout matching project deployment cards */
	.tpl-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: 0.75rem;
	}

	.tpl-card {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 1.25rem;
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-lg);
		background-color: var(--surface-bg);
		text-decoration: none;
		color: var(--center-channel-color);
		transition:
			border-color var(--dur-fast),
			box-shadow var(--dur-fast);
		cursor: pointer;
		box-shadow:
			0 1px 3px rgb(0 0 0 / 0.03),
			0 1px 2px rgb(0 0 0 / 0.02);
	}

	.tpl-card:hover {
		border-color: var(--sidebar-text-active-border);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--sidebar-text-active-border) 25%, transparent);
	}

	.tpl-card-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.tpl-card-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.tpl-card-body {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.tpl-card-name {
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: 600;
		color: var(--center-channel-color);
	}

	.tpl-card-top-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.tpl-card-delete {
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
		opacity: 0;
		transition:
			opacity var(--dur-fast),
			color var(--dur-fast),
			background-color var(--dur-fast);
	}

	.tpl-card:hover .tpl-card-delete {
		opacity: 1;
	}

	.tpl-card-delete:hover {
		color: var(--error-text-color);
		background-color: color-mix(in srgb, var(--error-text-color) 12%, transparent);
	}

	.tpl-card-badge {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-pill);
		text-transform: capitalize;
		flex-shrink: 0;
	}

	.tpl-card-desc {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--surface-muted);
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.tpl-card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: auto;
	}

	.tpl-card-tag {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		padding: 0.0625rem 0.5rem;
		border-radius: var(--radius-xs);
		background-color: color-mix(in srgb, var(--surface-border) 50%, transparent);
		color: var(--surface-muted);
	}

	/* Buttons: matches project page button system */
	.tpl-btn {
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
		transition:
			opacity var(--dur-fast),
			transform var(--dur-fast),
			box-shadow var(--dur-fast);
		white-space: nowrap;
	}

	.tpl-btn-primary {
		background-color: var(--sidebar-text-active-border);
		color: #fff;
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.08),
			0 1px 1px rgb(0 0 0 / 0.04);
	}

	.tpl-btn-primary:hover {
		opacity: 0.95;
		transform: translateY(-0.5px);
		box-shadow:
			0 2px 4px rgb(0 0 0 / 0.08),
			0 4px 12px rgb(0 0 0 / 0.06);
	}

	.tpl-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 4rem 1.5rem;
		color: var(--surface-muted);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		border: 1px dashed var(--surface-border);
		border-radius: var(--radius-lg);
	}
</style>

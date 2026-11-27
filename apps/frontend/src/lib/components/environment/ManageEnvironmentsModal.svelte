<script lang="ts">
	import { escapeHtml } from '$lib/utils/html';
	import { createQuery } from '@tanstack/svelte-query';
	import { Star, Trash2, Plus, Pencil, Check, X } from 'lucide-svelte';
	import { apiFetch, toasts } from '$lib/stores';
	import { queryClient } from '$lib/query';
	import { environmentsQueryOptions } from '$lib/queries/environments';
	import { Modal, Button, Input, Badge } from '$lib/components/ui';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { envDotColor } from '$lib/utils/format';
	import type { Environment } from '$lib/types/environments';

	let {
		open = $bindable(false),
		projectId
	}: {
		open?: boolean;
		projectId: string;
	} = $props();

	const envQuery = createQuery(() => ({
		...environmentsQueryOptions(projectId),
		enabled: open && !!projectId
	}));
	const environments = $derived((envQuery.data ?? []) as Environment[]);

	let newName = $state('');
	let creating = $state(false);
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let savingRename = $state(false);

	function invalidate() {
		queryClient.invalidateQueries({ queryKey: ['environments', projectId] });
	}

	async function create() {
		if (!newName.trim() || creating) return;
		creating = true;
		try {
			const res = await apiFetch(`/apiv1/projects/${projectId}/environments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newName.trim() })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.message || "Couldn't create environment");
			}
			toasts.add({ title: `Created "${newName.trim()}"`, color: 'success' });
			newName = '';
			invalidate();
		} catch (e) {
			toasts.add({
				title: e instanceof Error ? e.message : "Couldn't save the environment",
				color: 'error'
			});
		} finally {
			creating = false;
		}
	}

	function startRename(env: Environment) {
		editingId = env.id;
		editName = env.name;
	}

	async function saveRename(env: Environment) {
		const trimmed = editName.trim();
		if (!trimmed || savingRename) return;
		if (trimmed === env.name) {
			editingId = null;
			return;
		}
		savingRename = true;
		try {
			const res = await apiFetch(`/apiv1/environments/${env.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: trimmed })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.message || "Couldn't rename environment");
			}
			toasts.add({ title: `Renamed to "${trimmed}"`, color: 'success' });
			editingId = null;
			invalidate();
		} catch (e) {
			toasts.add({
				title: e instanceof Error ? e.message : "Couldn't save the environment",
				color: 'error'
			});
		} finally {
			savingRename = false;
		}
	}

	async function setDefault(env: Environment) {
		const res = await apiFetch(`/apiv1/environments/${env.id}/set-default`, {
			method: 'POST'
		}).catch(() => null);
		if (!res?.ok) {
			const d = await res?.json().catch(() => ({}));
			toasts.add({
				title: `Couldn't make ${env.name} the default`,
				description: d?.message,
				color: 'error'
			});
			return;
		}
		toasts.add({ title: `${env.name} is now the default`, color: 'success' });
		invalidate();
	}

	let toDelete = $state<Environment | null>(null);
	let showDelete = $state(false);

	function describeContents(env: Environment): string {
		const c = env._count;
		if (!c) return 'everything in it';
		const parts = [
			c.deployments ? `${c.deployments} ${c.deployments === 1 ? 'app' : 'apps'}` : null,
			c.databases
				? `${c.databases} ${c.databases === 1 ? 'database' : 'databases'} with their data and backups`
				: null,
			c.ingresses ? `${c.ingresses} ${c.ingresses === 1 ? 'domain' : 'domains'}` : null
		].filter((p): p is string => p !== null);
		return parts.length ? parts.join(', ') : 'everything in it';
	}

	async function remove() {
		const env = toDelete;
		toDelete = null;
		if (!env) return;
		const res = await apiFetch(`/apiv1/environments/${env.id}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ confirmName: env.name })
		});
		if (!res.ok) {
			const d = await res.json().catch(() => ({}));
			toasts.add({ title: d.message || "Couldn't delete", color: 'error' });
			return;
		}
		toasts.add({ title: `Deleted ${env.name}`, color: 'success' });
		invalidate();
	}
</script>

<Modal bind:open title="Environments" size="md">
	<div class="env-modal-list">
		{#each environments as env (env.id)}
			<div class="env-row">
				<span class="env-dot" style:background={envDotColor(env.slug)}></span>
				{#if editingId === env.id}
					<span class="env-rename-input">
						<Input
							size="sm"
							bind:value={editName}
							aria-label="Environment name"
							onkeydown={(e: KeyboardEvent) => {
								if (e.key === 'Enter') saveRename(env);
								if (e.key === 'Escape') editingId = null;
							}}
						/>
					</span>
					<span class="env-row-actions">
						<Button
							variant="ghost"
							size="sm"
							icon={Check}
							label="Save name"
							disabled={savingRename}
							onclick={() => saveRename(env)}
						/>
						<Button
							variant="ghost"
							size="sm"
							icon={X}
							label="Cancel rename"
							disabled={savingRename}
							onclick={() => (editingId = null)}
						/>
					</span>
				{:else}
					<span class="env-row-name" title={env.name}>{env.name}</span>
					{#if env.isDefault}<Badge>Default</Badge>{/if}
					<code class="env-row-ns" title={env.namespace}>{env.namespace}</code>
					<span class="env-row-actions">
						<Button
							variant="ghost"
							size="sm"
							icon={Pencil}
							label="Rename"
							onclick={() => startRename(env)}
						/>
						{#if !env.isDefault}
							<Button
								variant="ghost"
								size="sm"
								icon={Star}
								label="Set as default"
								onclick={() => setDefault(env)}
							/>
							<Button
								variant="ghost"
								size="sm"
								icon={Trash2}
								label="Delete"
								onclick={() => {
									toDelete = env;
									showDelete = true;
								}}
							/>
						{/if}
					</span>
				{/if}
			</div>
		{/each}
	</div>

	{#snippet footer()}
		<div class="env-modal-create">
			<span class="env-create-input">
				<Input
					placeholder="staging"
					aria-label="New environment name"
					bind:value={newName}
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && create()}
				/>
			</span>
			<Button variant="primary" size="sm" icon={Plus} loading={creating} onclick={create}>
				New environment
			</Button>
		</div>
	{/snippet}
</Modal>

{#if toDelete}
	<ConfirmModal
		bind:open={showDelete}
		title={`Delete "${toDelete.name}"?`}
		description={`This <strong>permanently deletes the environment</strong> <code>${escapeHtml(toDelete.namespace)}</code>: ${describeContents(toDelete)}. You can't undo this.`}
		html
		confirmText={toDelete.name}
		confirmLabel="Delete environment forever"
		onconfirm={remove}
		oncancel={() => {
			toDelete = null;
		}}
	/>
{/if}

<style>
	.env-modal-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.env-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 2.75rem;
		padding: 0.375rem 0.375rem 0.375rem 0.75rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.env-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.env-row-name,
	.env-row-ns {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.env-row-ns {
		flex-shrink: 100;
	}
	.env-row-name {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.env-row-ns {
		margin-left: auto;
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
	}
	.env-row-actions {
		display: flex;
		flex-shrink: 0;
		gap: 0.25rem;
		margin-left: auto;
	}
	.env-row-ns + .env-row-actions {
		margin-left: 0;
	}
	.env-rename-input {
		flex: 1;
		min-width: 0;
	}
	.env-modal-create {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		width: 100%;
	}
	.env-create-input {
		flex: 1;
		min-width: 0;
	}
</style>

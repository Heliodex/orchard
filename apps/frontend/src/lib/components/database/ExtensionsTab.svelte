<script lang="ts">
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import {
		Button,
		EmptyState,
		SearchField,
		SectionCard,
		Skeleton,
		Spinner,
		Switch
	} from '$lib/components/ui';
	import SettingsList from '$lib/components/ui/SettingsList.svelte';
	import SettingRow from '$lib/components/ui/SettingRow.svelte';
	import type { DatabaseDetail, ExtInfo } from './types';

	type Extension = ExtInfo & {
		description?: string;
		requiresPreload?: boolean;
		featured?: boolean;
	};

	let {
		database,
		filteredExtensions,
		preloadedExts,
		extensionsLoading,
		extensionSearch = $bindable(),
		busyExtension,
		onFetchExtensions,
		onInstallExtension,
		onUninstallExtension
	}: {
		database: DatabaseDetail;
		filteredExtensions: Extension[];
		preloadedExts: string[];
		extensionsLoading: boolean;
		extensionSearch: string;
		busyExtension: string | null;
		onFetchExtensions: () => void;
		onInstallExtension: (name: string, addToPreload: boolean) => void | Promise<void>;
		onUninstallExtension: (name: string, removeFromPreload: boolean) => void | Promise<void>;
	} = $props();

	const uid = $props.id();

	const installedAtFirstSight = new Map<string, boolean>();

	const extensions = $derived.by(() => {
		for (const e of filteredExtensions) {
			if (!installedAtFirstSight.has(e.name)) installedAtFirstSight.set(e.name, e.installed);
		}
		const first = (e: Extension) => (installedAtFirstSight.get(e.name) ? 0 : 1);
		return [...filteredExtensions].sort((a, b) => first(a) - first(b));
	});

	let pending = $state<Record<string, boolean>>({});

	const preloaded = (e: Extension) => preloadedExts.includes(e.name);
	const restartsOnInstall = (e: Extension) => Boolean(e.requiresPreload) && !preloaded(e);
	const restartsOnToggle = (e: Extension) => (e.installed ? preloaded(e) : restartsOnInstall(e));
	const isOn = (e: Extension) => pending[e.name] ?? e.installed;

	const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

	let confirmOpen = $state(false);
	let confirming = $state<Extension | null>(null);

	const confirmCopy = $derived.by(() => {
		const e = confirming;
		if (!e) return { title: '', description: '', label: '', danger: false };
		if (e.installed) {
			return {
				title: `Drop ${e.name}?`,
				description: preloaded(e)
					? 'Columns, indexes and functions that use it are dropped with it, and the database restarts to unload it.'
					: 'Columns, indexes and functions that use it are dropped with it.',
				label: preloaded(e) ? 'Drop and restart' : 'Drop extension',
				danger: true
			};
		}
		return {
			title: `Install ${e.name}?`,
			description: 'It loads at startup, so the database restarts and open connections drop.',
			label: 'Install and restart',
			danger: false
		};
	});

	async function apply(e: Extension, next: boolean) {
		pending = { ...pending, [e.name]: next };
		try {
			if (next) await onInstallExtension(e.name, Boolean(e.requiresPreload));
			else await onUninstallExtension(e.name, preloaded(e));
		} finally {
			const rest = { ...pending };
			delete rest[e.name];
			pending = rest;
		}
	}

	function request(e: Extension, next: boolean) {
		if (next === e.installed) return;
		if (!next || restartsOnInstall(e)) {
			confirming = e;
			confirmOpen = true;
			return;
		}
		apply(e, next);
	}

	function confirmed() {
		const e = confirming;
		if (e) apply(e, !e.installed);
	}
</script>

<SectionCard title="Extensions">
	{#snippet actions()}
		{#if database.mode === 'cnpg'}
			<div class="ext-search">
				<SearchField size="sm" placeholder="Search extensions" bind:value={extensionSearch} />
			</div>
		{/if}
	{/snippet}

	{#if database.mode !== 'cnpg'}
		<EmptyState title="Extensions need a dedicated database" />
	{:else if extensionsLoading && filteredExtensions.length === 0}
		<SettingsList>
			{#each [0, 1, 2, 3] as i (i)}
				<div class="ext-skeleton">
					<div class="ext-skeleton-text">
						<Skeleton width="8rem" height="0.875rem" />
						<Skeleton width="16rem" height="0.75rem" />
					</div>
					<Skeleton width="2.25rem" height="1.375rem" rounded="999px" />
				</div>
			{/each}
		</SettingsList>
	{:else if filteredExtensions.length === 0}
		{#if extensionSearch.trim()}
			<EmptyState title="No extensions match “{extensionSearch.trim()}”">
				<Button variant="secondary" size="sm" onclick={() => (extensionSearch = '')}>
					Clear search
				</Button>
			</EmptyState>
		{:else}
			<EmptyState title="No extensions available">
				<Button variant="secondary" size="sm" onclick={onFetchExtensions}>Check again</Button>
			</EmptyState>
		{/if}
	{:else}
		<div class="ext-list">
			<SettingsList label="Extensions">
				{#each extensions as ext (ext.name)}
					{@const busy = busyExtension === ext.name || ext.name in pending}
					{@const version = ext.installed ? ext.version : ext.defaultVersion}
					<SettingRow label={ext.name} for="{uid}-{ext.name}">
						{#snippet hint()}
							<span class="ext-meta">
								{#if ext.description}<span>{sentence(ext.description)}</span>{/if}
								{#if version}<span class="ext-version">{version}</span>{/if}
							</span>
							{#if restartsOnToggle(ext)}
								<span class="ext-restart">Loads at startup, restarts the database</span>
							{/if}
						{/snippet}
						<span class="ext-busy" aria-hidden={!busy}>
							{#if busy}<Spinner size={14} label="Working on {ext.name}" />{/if}
						</span>
						<Switch
							id="{uid}-{ext.name}"
							label={ext.name}
							disabled={busy}
							bind:checked={() => isOn(ext), (next) => request(ext, next)}
						/>
					</SettingRow>
				{/each}
			</SettingsList>
		</div>
	{/if}
</SectionCard>

<ConfirmModal
	bind:open={confirmOpen}
	title={confirmCopy.title}
	description={confirmCopy.description}
	confirmLabel={confirmCopy.label}
	danger={confirmCopy.danger}
	onconfirm={confirmed}
	oncancel={() => {}}
/>

<style>
	.ext-search {
		width: 15rem;
		margin-right: calc(var(--section-control-shift, 0px) * -1);
	}
	.ext-list :global(.label) {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-callout);
	}
	.ext-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-2);
	}
	.ext-meta > * + *::before {
		content: '·';
		margin-right: var(--space-2);
		color: var(--text-faint);
	}
	.ext-version {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.ext-restart {
		display: block;
		color: var(--text-faint);
	}
	.ext-busy {
		display: inline-flex;
		justify-content: center;
		width: 1rem;
		color: var(--text-muted);
	}
	.ext-skeleton {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.ext-skeleton-text {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
</style>

<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { apiFetch, toasts, selectedOrganization, subscribeOrgEvents } from '$lib/stores';
	import {
		ArrowUpRight,
		Copy,
		Ellipsis,
		LayoutTemplate,
		Lock,
		Pencil,
		Trash2
	} from 'lucide-svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import RenameModal from '$lib/components/RenameModal.svelte';
	import ResourceHeader from '$lib/components/patterns/ResourceHeader.svelte';
	import EntityRow from '$lib/components/patterns/EntityRow.svelte';
	import ResourceTile from '$lib/components/patterns/ResourceTile.svelte';
	import {
		ActionRow,
		AvatarEdit,
		Breadcrumbs,
		Button,
		EmptyState,
		IconTile,
		List,
		ListRow,
		Menu,
		MenuItem,
		MenuSeparator,
		RelativeTime,
		SectionCard,
		SettingRow,
		SettingsList,
		Skeleton,
		StatusBadge,
		resourceStatus
	} from '$lib/components/ui';
	import { IMG_ICONS, favUrl, knownIcon } from '$lib/components/org-dashboard/helpers.svelte';

	interface ParameterDef {
		name: string;
		displayName: string;
		type: 'string' | 'number' | 'boolean' | 'select' | 'secret';
		options?: { label: string; value: string }[];
	}

	interface InstanceIngress {
		id: string;
		name: string;
		host: string;
		path: string;
		url?: string;
		deploymentId?: string | null;
	}

	interface TemplateInstance {
		id: string;
		name: string;
		status: string;
		projectId: string;
		parameters: Record<string, unknown> | null;
		parameterDefs?: ParameterDef[];
		createdAt: string;
		project?: { id: string; name: string; slug: string } | null;
		template: {
			id: string;
			name: string;
			displayName: string;
			icon?: string | null;
			category?: string;
		};
		deployments: {
			id: string;
			name: string;
			displayName?: string | null;
			status: string;
			buildStatus?: string;
			image?: string;
		}[];
		databases: { id: string; name: string; status: string; dbName: string }[];
		ingresses: InstanceIngress[];
	}

	type ParamRow = { key: string; label: string; value: string | null; mono: boolean };

	let instance = $state<TemplateInstance | null>(null);
	let loadError = $state<string | null>(null);
	let deleting = $state(false);
	let deleteOpen = $state(false);
	let renameOpen = $state(false);
	let renaming = $state(false);
	let iconFailed = $state(false);

	const orgSlug = $derived($page.params.orgSlug);
	const instanceId = $derived($page.params.instanceId);

	const projectHref = $derived(
		instance?.project ? `/${orgSlug}/projects/${instance.project.slug}` : null
	);
	const visitUrl = $derived(instance?.ingresses.find((i) => i.url)?.url ?? null);
	const appName = $derived(
		new Map((instance?.deployments ?? []).map((d) => [d.id, d.displayName || d.name]))
	);

	const params = $derived.by((): ParamRow[] => {
		if (!instance?.parameters) return [];
		const values = instance.parameters;
		const defs = new Map((instance.parameterDefs ?? []).map((d) => [d.name, d]));
		const order = [
			...(instance.parameterDefs ?? []).map((d) => d.name).filter((k) => k in values),
			...Object.keys(values).filter((k) => !defs.has(k))
		];
		return order.map((key) => {
			const def = defs.get(key);
			const raw = values[key];
			const hidden = def?.type === 'secret' || raw === null || raw === undefined;
			return {
				key,
				label: def?.displayName || humanize(key),
				value: hidden ? null : display(raw, def),
				mono: !hidden && def?.type !== 'boolean' && def?.type !== 'select'
			};
		});
	});

	function humanize(key: string) {
		const words = key
			.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
			.replace(/[_\-.]+/g, ' ')
			.trim()
			.toLowerCase();
		return words.charAt(0).toUpperCase() + words.slice(1);
	}

	function display(raw: unknown, def: ParameterDef | undefined) {
		if (typeof raw === 'boolean') return raw ? 'On' : 'Off';
		const text = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
		if (def?.type === 'select') return def.options?.find((o) => o.value === text)?.label ?? text;
		return text;
	}

	function depIcon(d: TemplateInstance['deployments'][number]) {
		const known = knownIcon(d.image);
		if (known) return known;
		const host = instance?.ingresses.find((i) => i.deploymentId === d.id)?.host;
		return host ? favUrl(host.split('/')[0]) : null;
	}

	function address(ing: InstanceIngress) {
		return `${ing.host}${ing.path && ing.path !== '/' ? ing.path : ''}`;
	}

	function plural(n: number, one: string, many: string) {
		return `${n} ${n === 1 ? one : many}`;
	}

	const contents = $derived.by(() => {
		if (!instance) return '';
		const parts = [
			instance.deployments.length && plural(instance.deployments.length, 'app', 'apps'),
			instance.databases.length && plural(instance.databases.length, 'database', 'databases'),
			instance.ingresses.length && plural(instance.ingresses.length, 'domain', 'domains')
		].filter(Boolean) as string[];
		if (parts.length < 2) return parts[0] ?? '';
		return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
	});

	const resourceTotal = $derived(
		(instance?.deployments.length ?? 0) +
			(instance?.databases.length ?? 0) +
			(instance?.ingresses.length ?? 0)
	);

	async function failure(response: Response, fallback: string) {
		const data = await response.json().catch(() => ({}));
		return new Error(data.message || fallback);
	}

	async function fetchInstance() {
		try {
			const response = await apiFetch(`/apiv1/template-instances/${instanceId}`);
			if (!response.ok) throw await failure(response, 'Template not found');
			instance = await response.json();
			loadError = null;
		} catch (e) {
			if (!instance) loadError = e instanceof Error ? e.message : 'Template not found';
		}
	}

	async function rename(name: string) {
		renaming = true;
		try {
			const response = await apiFetch(`/apiv1/template-instances/${instanceId}/name`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!response.ok) throw await failure(response, 'Rename failed');
			instance = await response.json();
			renameOpen = false;
			toasts.add({ title: 'Renamed', color: 'success' });
		} catch (e) {
			toasts.add({
				title: 'Rename failed',
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			renaming = false;
		}
	}

	async function remove() {
		if (!instance) return;
		deleting = true;
		try {
			const response = await apiFetch(`/apiv1/template-instances/${instanceId}`, {
				method: 'DELETE'
			});
			if (!response.ok) throw await failure(response, 'Delete failed');
			toasts.add({ title: `${instance.name} deleted`, color: 'success' });
			if (projectHref) goto(projectHref);
			else history.back();
		} catch (e) {
			toasts.add({
				title: 'Delete failed',
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			deleting = false;
		}
	}

	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		toasts.add({ title: 'Copied', description: text, color: 'success' });
	}

	let unsub: (() => void) | null = null;
	let subscribedOrgId: string | null = null;
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		const id = $selectedOrganization?.id ?? null;
		if (!id || id === subscribedOrgId) return;
		subscribedOrgId = id;
		unsub?.();
		unsub = subscribeOrgEvents(id, (ev) => {
			if (
				ev.type !== 'deployment.changed' &&
				ev.type !== 'database.changed' &&
				ev.type !== 'project.changed'
			)
				return;
			if (instance && ev.projectId && ev.projectId !== instance.projectId) return;
			if (refreshTimer) return;
			refreshTimer = setTimeout(() => {
				refreshTimer = null;
				fetchInstance();
			}, 500);
		});
	});

	$effect(() => {
		const status = instance?.status?.toLowerCase();
		const inFlight = status === 'provisioning' || status === 'pending' || status === 'deploying';
		if (inFlight && !pollTimer) {
			pollTimer = setInterval(fetchInstance, 10_000);
		} else if (!inFlight && pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	});

	onDestroy(() => {
		unsub?.();
		if (refreshTimer) clearTimeout(refreshTimer);
		if (pollTimer) clearInterval(pollTimer);
	});

	onMount(fetchInstance);
</script>

<svelte:head><title>{instance?.name ?? 'Template'}</title></svelte:head>

<div class="ti-page">
	{#if instance}
		<Breadcrumbs
			crumbs={[
				{ label: 'Home', href: `/${orgSlug}` },
				...(instance.project && projectHref
					? [{ label: instance.project.name, href: `${projectHref}?tab=templates` }]
					: []),
				{ label: instance.name }
			]}
		/>

		<ResourceHeader title={instance.name}>
			{#snippet leading()}
				<AvatarEdit
					label={instance!.template.displayName}
					size={56}
					editable={false}
					onchange={() => {}}
				>
					<IconTile
						src={iconFailed ? null : (instance!.template.icon ?? null)}
						alt=""
						tint="var(--bg-raised)"
						onerror={() => (iconFailed = true)}
					>
						{#snippet fallback()}<LayoutTemplate size={22} class="glyph" />{/snippet}
					</IconTile>
				</AvatarEdit>
			{/snippet}
			{#snippet badges()}<StatusBadge meta={resourceStatus(instance!.status)} />{/snippet}
			{#snippet actions()}
				{#if visitUrl}
					<Button
						variant="secondary"
						iconRight={ArrowUpRight}
						href={visitUrl}
						target="_blank"
						rel="noopener noreferrer">Visit</Button
					>
				{/if}
				<Menu placement="bottom-end">
					{#snippet trigger(props)}
						<Button {...props} variant="ghost" icon={Ellipsis} label="More actions" />
					{/snippet}
					<MenuItem icon={Pencil} onclick={() => (renameOpen = true)}>Rename</MenuItem>
					<MenuSeparator />
					<MenuItem icon={Trash2} danger disabled={deleting} onclick={() => (deleteOpen = true)}
						>Delete everything</MenuItem
					>
				</Menu>
			{/snippet}
			{#snippet facts()}
				<span class="fact"
					><LayoutTemplate size={14} />{instance!.template.displayName} template</span
				>
				{#if contents}<span>{contents}</span>{/if}
				<span>Deployed <RelativeTime date={instance!.createdAt} /></span>
			{/snippet}
		</ResourceHeader>

		<div class="ti-body">
			<div class="ti-main">
				{#if resourceTotal}
					<SectionCard title="Resources">
						<List inset={false} label="Resources">
							{#each instance.deployments as dep (dep.id)}
								<EntityRow
									flush
									kind="deployment"
									name={dep.displayName || dep.name}
									status={resourceStatus(dep.status, dep.buildStatus)}
									image={depIcon(dep)}
									detail={dep.image}
									href="/{orgSlug}/deployments/{dep.id}"
								/>
							{/each}
							{#each instance.databases as db (db.id)}
								<EntityRow
									flush
									kind="database"
									name={db.name}
									status={resourceStatus(db.status)}
									image={IMG_ICONS.postgres}
									detail={db.dbName}
									href="/{orgSlug}/databases/{db.id}"
								/>
							{/each}
							{#each instance.ingresses as ing (ing.id)}
								{@const target = ing.deploymentId ? appName.get(ing.deploymentId) : undefined}
								<ListRow
									flush
									pinned
									title={address(ing)}
									subtitle={target ? `Goes to ${target}` : undefined}
								>
									{#snippet leading()}<ResourceTile kind="domain" />{/snippet}
									{#snippet actions()}
										{#if ing.url}
											<span class="acts">
												<Button
													variant="ghost"
													size="sm"
													icon={Copy}
													label="Copy link to {ing.host}"
													onclick={() => copy(ing.url!)}
												/>
												<Button
													variant="ghost"
													size="sm"
													icon={ArrowUpRight}
													label="Open {ing.host}"
													href={ing.url}
													target="_blank"
													rel="noopener noreferrer"
												/>
											</span>
										{/if}
									{/snippet}
								</ListRow>
							{/each}
						</List>
					</SectionCard>
				{/if}

				<SectionCard title="Danger zone" tone="danger">
					<SettingsList>
						<ActionRow label="Delete {instance.name}">
							<Button
								variant="danger"
								size="sm"
								loading={deleting}
								onclick={() => (deleteOpen = true)}>Delete everything</Button
							>
						</ActionRow>
					</SettingsList>
				</SectionCard>
			</div>

			{#if params.length}
				<SectionCard title="Parameters">
					<SettingsList label="Parameters">
						{#each params as p (p.key)}
							<SettingRow label={p.label}>
								{#if p.value === null}
									<span class="hidden-value"><Lock size={13} aria-hidden="true" />Hidden</span>
								{:else if p.value === ''}
									<span class="empty-value">Not set</span>
								{:else}
									<span class="value" class:value--mono={p.mono} title={p.value}>{p.value}</span>
								{/if}
							</SettingRow>
						{/each}
					</SettingsList>
				</SectionCard>
			{/if}
		</div>
	{:else if loadError}
		<EmptyState title="This template didn't load" description={loadError}>
			<Button variant="secondary" onclick={fetchInstance}>Try again</Button>
		</EmptyState>
	{:else}
		<Skeleton width="12rem" height="1.25rem" rounded="999px" />
		<Skeleton height="6.5rem" rounded="calc(var(--radius-widget) * var(--corner-scale))" />
		<Skeleton height="9rem" rounded="calc(var(--radius-widget) * var(--corner-scale))" />
		<Skeleton height="12rem" rounded="calc(var(--radius-widget) * var(--corner-scale))" />
	{/if}
</div>

{#if instance}
	<ConfirmModal
		bind:open={deleteOpen}
		title="Delete {instance.name}?"
		description={contents
			? `Its ${contents} ${resourceTotal === 1 ? 'is' : 'are'} deleted with it. You can't undo this.`
			: "You can't undo this."}
		confirmLabel="Delete everything"
		confirmText={instance.name}
		onconfirm={remove}
		oncancel={() => {}}
	/>
	<RenameModal
		bind:open={renameOpen}
		title="Rename {instance.template.displayName}"
		value={instance.name}
		saving={renaming}
		onSave={rename}
	/>
{/if}

<style>
	.ti-page {
		--section-r: var(--radius-widget);
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		max-width: var(--page-wide);
		margin: 0 auto;
		padding: 1.5rem;
	}
	.ti-body {
		display: grid;
		grid-template-columns: minmax(0, 1.618fr) minmax(21rem, 1fr);
		align-items: start;
		gap: 1rem;
	}
	.ti-main {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}
	@media (max-width: 64rem) {
		.ti-body {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.ti-page :global(.glyph) {
		color: var(--text-muted);
	}
	.fact {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
	.acts {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
	}
	.value {
		display: block;
		max-width: 14rem;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-default);
		font-size: var(--text-callout);
	}
	.value--mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
	}
	.hidden-value {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		color: var(--text-muted);
		font-size: var(--text-callout);
	}
	.empty-value {
		color: var(--text-faint);
		font-size: var(--text-callout);
	}
</style>

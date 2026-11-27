<script lang="ts">
	import { onMount } from 'svelte';
	import { CircleArrowUp, Database, RefreshCw } from 'lucide-svelte';
	import { apiFetch, toasts } from '$lib/stores';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import {
		ActionRow,
		Button,
		EmptyState,
		SectionCard,
		SectionTitle,
		SettingsList,
		Skeleton,
		StatusDot,
		Table,
		resourceStatus
	} from '$lib/components/ui';
	import type { TableColumn } from '$lib/components/ui/Table.svelte';
	import SeverityMeter from '$lib/components/ui/SeverityMeter.svelte';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import { monthYear, severityOf, upgradeMajors } from '$lib/components/database/versions';
	import type {
		ProjectDatabaseSecurity,
		ProjectDatabaseSecurityRow
	} from '$lib/components/database/types';

	let {
		projectId,
		orgSlug,
		canEdit = false
	}: {
		projectId: string;
		orgSlug: string;
		canEdit?: boolean;
	} = $props();

	let data = $state<ProjectDatabaseSecurity | null>(null);
	let failed = $state(false);
	let pending = $state<ProjectDatabaseSecurityRow | null>(null);
	let confirmOpen = $state(false);
	let updatingId = $state<string | null>(null);

	async function load() {
		failed = false;
		try {
			const res = await apiFetch(`/apiv1/projects/${projectId}/database-security`);
			if (!res.ok) throw new Error();
			data = await res.json();
		} catch {
			failed = true;
		}
	}

	onMount(load);

	const rows = $derived(
		[...(data?.databases ?? [])].sort(
			(a, b) => rank(b) - rank(a) || (b.highestScore ?? -1) - (a.highestScore ?? -1)
		)
	);

	function rank(r: ProjectDatabaseSecurityRow) {
		if (r.action === 'major_upgrade' || r.supported === false) return 3;
		if (r.action === 'minor_update' && r.vulnerabilities > 0) return 2;
		if (r.action === 'minor_update') return 1;
		return 0;
	}

	const exposed = $derived(rows.filter((r) => r.vulnerabilities > 0).length);
	const orgSettingsHref = $derived(`/${orgSlug}/settings?tab=database`);

	const autoLine = $derived.by(() => {
		const a = data?.autoUpdate;
		if (!a) return '';
		if (!a.instance) return 'Turned off for this whole instance by its operator.';
		if (a.enabled)
			return 'On for this organization. Orchard applies minor releases a few databases at a time each morning (UTC).';
		return 'Off for this organization. Databases stay on their release until someone updates them here.';
	});

	function versionHint(r: ProjectDatabaseSecurityRow) {
		const ended = r.supported === false || (!!r.eolDate && Date.parse(r.eolDate) < Date.now());
		if (ended) return r.eolDate ? `No fixes since ${monthYear(r.eolDate)}` : 'No longer supported';
		if (r.eolDate) return `Supported until ${monthYear(r.eolDate)}`;
		return '';
	}

	function securityHref(r: ProjectDatabaseSecurityRow) {
		return `/${orgSlug}/databases/${r.id}?tab=security`;
	}

	const columns: TableColumn<ProjectDatabaseSecurityRow>[] = [
		{ id: 'name', label: 'Database', width: 'minmax(0, 1fr)', sortable: true },
		{ id: 'version', label: 'Version', width: 'minmax(9rem, 0.6fr)' },
		{
			id: 'vulns',
			label: 'Vulnerabilities',
			width: 'minmax(9rem, 0.6fr)',
			sortable: true,
			sortValue: (r) => r.highestScore ?? -1
		},
		{ id: 'action', label: '', width: 'minmax(11rem, auto)' }
	];

	async function applyMinor() {
		confirmOpen = false;
		const row = pending;
		if (!row?.minorUpdate) return;
		updatingId = row.id;
		try {
			const res = await apiFetch(`/apiv1/databases/${row.id}/minor-update`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Idempotency-Key': crypto.randomUUID()
				},
				body: '{}'
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.message || "Couldn't start the update");
			toasts.add({
				title: `Updating ${row.name} to Postgres ${body.to ?? row.minorUpdate.to}`,
				description: 'Instances restart one at a time, replicas first.',
				color: 'success'
			});
			await load();
		} catch (e) {
			toasts.add({
				title: `Couldn't update ${row.name}`,
				description: e instanceof Error ? e.message : "Couldn't start the update",
				color: 'error'
			});
		} finally {
			updatingId = null;
			pending = null;
		}
	}
</script>

{#if failed}
	<EmptyState title="Couldn't load database security">
		<Button variant="secondary" icon={RefreshCw} onclick={load}>Try again</Button>
	</EmptyState>
{:else if !data}
	<div class="stack">
		<Skeleton height="4rem" />
		<Skeleton height="10rem" />
	</div>
{:else if rows.length === 0}
	<EmptyState
		title="No dedicated databases in this project"
		description="Security reports cover the Postgres databases Orchard runs for this project."
	>
		{#snippet icon()}<Database size={20} />{/snippet}
	</EmptyState>
{:else}
	<div class="stack">
		<SectionCard title="Postgres updates">
			<SettingsList>
				<ActionRow label="Automatic minor updates" hint={autoLine}>
					{#if !data.autoUpdate.enabled && data.autoUpdate.instance}
						<Button size="sm" variant="ghost" href={orgSettingsHref}>Organization settings</Button>
					{:else}
						<span></span>
					{/if}
				</ActionRow>
			</SettingsList>
		</SectionCard>

		<section class="list" aria-label="Databases">
			<SectionTitle
				title={exposed
					? `${exposed} of ${rows.length} ${rows.length === 1 ? 'database has' : 'databases have'} known vulnerabilities`
					: 'Databases'}
				size="md"
				count={exposed ? undefined : rows.length}
			>
				{#snippet actions()}
					{#if data?.advisoriesFetchedAt}
						<span class="checked"
							>From postgresql.org, checked <RelativeTime date={data.advisoriesFetchedAt} /></span
						>
					{/if}
				{/snippet}
			</SectionTitle>
			<Table {columns} {rows} rowKey={(r) => r.id} label="Database security">
				{#snippet cell(r, col)}
					{#if col.id === 'name'}
						<a class="name" href={securityHref(r)}>
							<StatusDot meta={resourceStatus(r.status)} label={resourceStatus(r.status).label} />
							<span>{r.name}</span>
						</a>
					{:else if col.id === 'version'}
						<div class="ident">
							<span class="mono">{r.running ? `Postgres ${r.running}` : `Postgres ${r.major}`}</span
							>
							{#if versionHint(r)}<span class="hint">{versionHint(r)}</span>{/if}
						</div>
					{:else if col.id === 'vulns'}
						{#if r.vulnerabilities > 0}
							<span class="sev">
								<SeverityMeter severity={severityOf(r.highestScore)} label />
								<span class="count">{r.vulnerabilities}</span>
							</span>
						{:else if r.action === 'unknown'}
							<span class="hint">Version unknown</span>
						{:else}
							<span class="hint">None known</span>
						{/if}
					{:else if r.minorUpdate && !r.minorUpdate.blocked && canEdit}
						<Button
							size="sm"
							variant={r.vulnerabilities > 0 ? 'primary' : 'secondary'}
							icon={CircleArrowUp}
							loading={updatingId === r.id}
							disabled={!!updatingId || r.status !== 'ready'}
							onclick={() => {
								pending = r;
								confirmOpen = true;
							}}>Update to {r.minorUpdate.to}</Button
						>
					{:else if r.action === 'major_upgrade' && upgradeMajors(r).length}
						<Button size="sm" variant="secondary" href={securityHref(r)}
							>Upgrade to Postgres {upgradeMajors(r).at(-1)}</Button
						>
					{:else if r.minorUpdate?.blocked}
						<Button size="sm" variant="ghost" href={securityHref(r)}>Needs a manual move</Button>
					{:else if r.minorUpdate}
						<span class="hint">Update to {r.minorUpdate.to} available</span>
					{:else}
						<span class="hint">Up to date</span>
					{/if}
				{/snippet}
			</Table>
		</section>
	</div>
{/if}

{#if pending?.minorUpdate}
	<ConfirmModal
		bind:open={confirmOpen}
		title={`Update ${pending.name} to Postgres ${pending.minorUpdate.to}?`}
		description="CNPG restarts the instances one at a time, replicas first. A single instance restarts once, so connections drop for a few seconds."
		confirmLabel="Update"
		danger={false}
		onconfirm={applyMinor}
		oncancel={() => {
			confirmOpen = false;
			pending = null;
		}}
	/>
{/if}

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.checked {
		font-size: var(--text-caption);
		color: var(--text-faint);
	}
	.name {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		padding-block: 0.75rem;
		color: var(--text-default);
		font-weight: var(--weight-medium);
		text-decoration: none;
	}
	.name:hover span {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.ident {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}
	.mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-callout);
		color: var(--text-default);
	}
	.hint {
		font-size: var(--text-caption);
		color: var(--text-muted);
	}
	.sev {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.count {
		font-size: var(--text-caption);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
</style>

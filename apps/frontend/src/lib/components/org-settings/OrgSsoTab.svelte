<script lang="ts">
	import { ExternalLink, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-svelte';
	import {
		Alert,
		Button,
		ColorField,
		FormActions,
		Input,
		List,
		ListRow,
		Menu,
		MenuItem,
		SectionCard,
		SettingRow,
		SettingsList,
		Select,
		Skeleton,
		Spinner,
		StatusBadge,
		ToggleRow,
		ToneTile,
		statusMeta,
		type StatusMeta
	} from '$lib/components/ui';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import DnsRecord from '$lib/components/ui/DnsRecord.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { ProviderIcon } from '$lib/components/login';
	import { apiFetch, toasts } from '$lib/stores';
	import GroupRulesEditor from './GroupRulesEditor.svelte';
	import ProjectRulesEditor from './ProjectRulesEditor.svelte';
	import SsoProviderModal from './SsoProviderModal.svelte';
	import { removeProviderIcon, uploadProviderIcon } from './sso-icon';
	import type {
		ProviderDraft,
		SsoDomain,
		SsoOverview,
		SsoProvider,
		SsoSettings
	} from './sso-types';
	import { draftToPayload, DEFAULT_LOGIN_ACCENT, DEFAULT_LOGIN_BG } from './sso-types';

	let {
		organization,
		isOwner,
		baseDomain,
		onOrganizationChanged
	}: {
		organization: { id: string; name: string; subdomain?: string } | null;
		isOwner: boolean;
		baseDomain: string;
		onOrganizationChanged?: () => void;
	} = $props();

	let orgProjects = $state<Array<{ id: string; name: string }>>([]);

	$effect(() => {
		const id = organization?.id;
		if (!id) return;
		void apiFetch(`/apiv1/projects?orgId=${id}`)
			.then((res) => (res.ok ? res.json() : []))
			.then((list: Array<{ id: string; name: string }>) => {
				orgProjects = list.map((p) => ({ id: p.id, name: p.name }));
			})
			.catch(() => {
				orgProjects = [];
			});
	});

	let loading = $state(true);
	let overview = $state<SsoOverview | null>(null);
	let loadError = $state<string | null>(null);

	let savingSettings = $state(false);
	let savingProvider = $state(false);
	let providerError = $state<string | null>(null);
	let testing = $state<string | null>(null);
	let testResult = $state<{ id: string; success: boolean; error?: string } | null>(null);

	let showProviderModal = $state(false);
	let editingProvider = $state<SsoProvider | null>(null);
	let providerToDelete = $state<SsoProvider | null>(null);
	let showDeleteModal = $state(false);

	let rulesProviderId = $state('');

	let newDomain = $state('');
	let addingDomain = $state(false);
	let verifyingDomain = $state<string | null>(null);
	let domainError = $state<string | null>(null);
	let logoUrl = $state('');
	let welcomeText = $state('');
	let tagline = $state('');
	let primaryColor = $state('');
	let bgColor = $state('');
	let subdomain = $state('');
	let savingSubdomain = $state(false);
	let savingBranding = $state(false);

	const uid = $props.id();

	const settings = $derived(overview?.settings ?? null);
	const providers = $derived(overview?.providers ?? []);
	const domains = $derived(overview?.domains ?? []);
	const locked = $derived(settings ? !settings.platformEnabled : false);
	const mappable = $derived(providers.filter((p) => p.protocol !== 'oauth2'));
	const rulesProvider = $derived(
		mappable.find((p) => p.id === rulesProviderId) ?? mappable[0] ?? null
	);
	const canEnable = $derived(providers.some((p) => p.enabled && p.usable));
	const brandingDirty = $derived(
		!!settings &&
			(logoUrl !== (settings.loginLogoUrl ?? '') ||
				welcomeText !== (settings.loginWelcomeText ?? '') ||
				tagline !== (settings.loginTagline ?? '') ||
				primaryColor !== (settings.loginPrimaryColor ?? '') ||
				bgColor !== (settings.loginBgColor ?? ''))
	);

	$effect(() => {
		if (organization?.id) void load(organization.id);
	});

	async function load(organizationId: string) {
		loading = true;
		loadError = null;
		try {
			const res = await apiFetch(`/apiv1/organizations/${organizationId}/sso`);
			if (!res.ok) throw new Error("Couldn't load SSO settings");
			const data = (await res.json()) as SsoOverview;
			overview = data;
			logoUrl = data.settings.loginLogoUrl ?? '';
			welcomeText = data.settings.loginWelcomeText ?? '';
			tagline = data.settings.loginTagline ?? '';
			primaryColor = data.settings.loginPrimaryColor ?? '';
			bgColor = data.settings.loginBgColor ?? '';
			subdomain = organization?.subdomain ?? '';
		} catch (e) {
			loadError = e instanceof Error ? e.message : "Couldn't load SSO settings";
		} finally {
			loading = false;
		}
	}

	async function patchSettings(patch: Partial<SsoSettings>, successTitle?: string) {
		if (!organization) return;
		savingSettings = true;
		try {
			const res = await apiFetch(`/apiv1/organizations/${organization.id}/sso/settings`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(patch)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || "Couldn't save");
			if (overview) overview = { ...overview, settings: data as SsoSettings };
			if (successTitle) toasts.add({ title: successTitle, color: 'success' });
		} catch (e) {
			toasts.add({
				title: "Couldn't save",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
			if (organization) await load(organization.id);
		} finally {
			savingSettings = false;
		}
	}

	function providerUrl(id: string) {
		return `/apiv1/organizations/${organization?.id}/sso/providers/${id}`;
	}

	function replaceProvider(updated: SsoProvider) {
		if (overview) {
			overview = {
				...overview,
				providers: overview.providers.map((p) => (p.id === updated.id ? updated : p))
			};
		}
		if (editingProvider?.id === updated.id) editingProvider = updated;
	}

	async function sendIcon(id: string, file: File) {
		try {
			const updated = await uploadProviderIcon(providerUrl(id), file);
			replaceProvider(updated);
			return updated.iconUrl;
		} catch (e) {
			toasts.add({
				title: "Couldn't upload the icon",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
			return null;
		}
	}

	async function uploadIcon(file: File) {
		return editingProvider ? sendIcon(editingProvider.id, file) : null;
	}

	async function removeIcon() {
		if (!editingProvider) return;
		try {
			replaceProvider(await removeProviderIcon(providerUrl(editingProvider.id)));
		} catch (e) {
			toasts.add({
				title: "Couldn't remove the icon",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
			throw e;
		}
	}

	async function saveProvider(draft: ProviderDraft) {
		if (!organization) return;
		savingProvider = true;
		providerError = null;
		const pendingIcon = draft.pendingIcon ?? null;
		try {
			const base = `/apiv1/organizations/${organization.id}/sso/providers`;
			const res = await apiFetch(editingProvider ? `${base}/${editingProvider.id}` : base, {
				method: editingProvider ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(draftToPayload(draft))
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || "Couldn't save the connection");
			if (pendingIcon) await sendIcon((data as SsoProvider).id, pendingIcon);

			showProviderModal = false;
			editingProvider = null;
			toasts.add({ title: 'Connection saved', color: 'success' });
			await load(organization.id);
		} catch (e) {
			providerError = e instanceof Error ? e.message : "Couldn't save the connection";
		} finally {
			savingProvider = false;
		}
	}

	async function deleteProvider() {
		if (!organization || !providerToDelete) return;
		const { id } = providerToDelete;
		try {
			const res = await apiFetch(`/apiv1/organizations/${organization.id}/sso/providers/${id}`, {
				method: 'DELETE'
			});
			if (!res.ok) throw new Error("Couldn't remove the connection");
			toasts.add({ title: 'Connection removed', color: 'success' });
			await load(organization.id);
		} catch (e) {
			toasts.add({
				title: "Couldn't remove the connection",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			providerToDelete = null;
		}
	}

	async function testProvider(provider: SsoProvider) {
		if (!organization) return;
		testing = provider.id;
		testResult = null;
		try {
			const res = await apiFetch(
				`/apiv1/organizations/${organization.id}/sso/providers/${provider.id}/test`,
				{ method: 'POST' }
			);
			const data = await res.json().catch(() => ({}));
			testResult = { id: provider.id, success: Boolean(data?.success), error: data?.error };
		} catch {
			testResult = { id: provider.id, success: false, error: "Couldn't reach the provider" };
		} finally {
			testing = null;
		}
	}

	async function saveBranding() {
		savingBranding = true;
		try {
			await patchSettings(
				{
					loginLogoUrl: logoUrl.trim() || null,
					loginWelcomeText: welcomeText.trim() || null,
					loginTagline: tagline.trim() || null,
					loginPrimaryColor: primaryColor || null,
					loginBgColor: bgColor || null
				},
				'Sign-in page updated'
			);
		} finally {
			savingBranding = false;
		}
	}

	function discardBranding() {
		if (!settings) return;
		logoUrl = settings.loginLogoUrl ?? '';
		welcomeText = settings.loginWelcomeText ?? '';
		tagline = settings.loginTagline ?? '';
		primaryColor = settings.loginPrimaryColor ?? '';
		bgColor = settings.loginBgColor ?? '';
	}

	async function addDomain() {
		if (!organization || addingDomain) return;
		const value = newDomain.trim();
		if (!value) return;

		addingDomain = true;
		domainError = null;
		try {
			const res = await apiFetch(`/apiv1/organizations/${organization.id}/sso/domains`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ domain: value })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || "Couldn't add that domain");
			newDomain = '';
			await load(organization.id);
		} catch (e) {
			domainError = e instanceof Error ? e.message : "Couldn't add that domain";
		} finally {
			addingDomain = false;
		}
	}

	async function verifyDomain(domain: SsoDomain) {
		if (!organization || verifyingDomain) return;
		verifyingDomain = domain.id;
		domainError = null;
		try {
			const res = await apiFetch(
				`/apiv1/organizations/${organization.id}/sso/domains/${domain.id}/verify`,
				{ method: 'POST' }
			);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || "Couldn't check DNS");
			if (data?.verified) {
				toasts.add({ title: `${domain.domain} verified`, color: 'success' });
			}
			await load(organization.id);
		} catch (e) {
			domainError = e instanceof Error ? e.message : "Couldn't check DNS";
		} finally {
			verifyingDomain = null;
		}
	}

	async function removeDomain(domain: SsoDomain) {
		if (!organization) return;
		try {
			const res = await apiFetch(
				`/apiv1/organizations/${organization.id}/sso/domains/${domain.id}`,
				{ method: 'DELETE' }
			);
			if (!res.ok) throw new Error("Couldn't remove that domain");
			await load(organization.id);
		} catch (e) {
			toasts.add({
				title: "Couldn't remove that domain",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		}
	}

	async function saveSubdomain() {
		if (!organization) return;
		savingSubdomain = true;
		try {
			const res = await apiFetch(`/apiv1/organizations/${organization.id}/subdomain`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subdomain: subdomain.trim() || null })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.message || "Couldn't save the subdomain");
			onOrganizationChanged?.();
			toasts.add({ title: 'Vanity address updated', color: 'success' });
		} catch (e) {
			toasts.add({
				title: "Couldn't save the subdomain",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			savingSubdomain = false;
		}
	}

	function providerStatus(provider: SsoProvider): StatusMeta {
		if (!provider.usable) return statusMeta('warning', 'Incomplete');
		if (!provider.enabled) return statusMeta('neutral', 'Off');
		return statusMeta('success', 'Live');
	}

	function providerDetail(provider: SsoProvider) {
		const used = provider.lastUsedAt
			? `last used ${new Date(provider.lastUsedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
			: 'never used';
		return [provider.protocol.toUpperCase(), used, ...provider.allowedDomains].join(' · ');
	}

	function openProvider(provider: SsoProvider | null) {
		editingProvider = provider;
		providerError = null;
		showProviderModal = true;
	}
</script>

{#if loading || loadError || !settings || !overview}
	<SectionCard title="Single sign-on">
		{#if loadError}
			<Alert tone="error">{loadError}</Alert>
		{:else}
			<SettingsList>
				{#each [0, 1, 2] as row (row)}
					<div class="skeleton-row">
						<Skeleton width="12rem" height="0.875rem" />
						<Skeleton width="2.25rem" height="1.25rem" rounded="999px" />
					</div>
				{/each}
			</SettingsList>
		{/if}
	</SectionCard>
{:else}
	<SectionCard title="Single sign-on">
		{#if locked}
			<div class="notice">
				<Alert tone="warning" title="Turned off by an instance admin">
					Members can't sign in through it until an instance admin turns it back on. Orchard keeps
					your setup.
				</Alert>
			</div>
		{/if}
		<SettingsList>
			{#if overview.loginUrl}
				<SettingRow label="Sign-in page" hint="Shows your connections and branding">
					<span class="address">
						<code class="mono" title={overview.loginUrl}>{overview.loginUrl}</code>
						<CopyButton value={overview.loginUrl} label="Copy sign-in URL" />
						<Button
							variant="ghost"
							size="sm"
							icon={ExternalLink}
							label="Open the sign-in page"
							href={overview.loginUrl}
							target="_blank"
							rel="noopener"
						/>
					</span>
				</SettingRow>
			{/if}
			<ToggleRow
				checked={settings.enabled}
				disabled={locked || !canEnable || savingSettings}
				label="Use single sign-on"
				hint={canEnable
					? 'Members can sign in through the connections below'
					: 'Add and turn on a working connection first'}
				onchange={() => patchSettings({ enabled: !settings.enabled })}
			/>
			<ToggleRow
				checked={settings.enforced}
				disabled={locked || !settings.enabled || savingSettings}
				label="Require single sign-on"
				hint="Blocks email codes, passkeys and instance providers, and signs out members who signed in another way. API tokens and MCP connections made without it stop working in this organization."
				onchange={() => patchSettings({ enforced: !settings.enforced })}
			/>
		</SettingsList>
	</SectionCard>

	<SectionCard title="Connections">
		{#snippet actions()}
			<Button
				size="sm"
				shape="capsule"
				icon={Plus}
				disabled={locked}
				onclick={() => openProvider(null)}
			>
				Add connection
			</Button>
		{/snippet}
		{#if providers.length}
			<List inset={false} label="Connections">
				{#each providers as provider (provider.id)}
					{@const result = testResult?.id === provider.id ? testResult : null}
					{#snippet detail()}
						{#if testing === provider.id}
							<Spinner size={12} />Testing
						{:else if result}
							<span
								class="line {result.success ? 'ok' : 'bad'}"
								title={result.success ? undefined : `Test failed: ${result.error}`}
							>
								{result.success ? 'Reached the provider' : `Test failed: ${result.error}`}
							</span>
						{:else}
							<span class="line" title={providerDetail(provider)}>{providerDetail(provider)}</span>
						{/if}
					{/snippet}
					{#snippet controls()}
						<span class="icons">
							<Button
								variant="ghost"
								size="sm"
								icon={Pencil}
								label="Edit {provider.name}"
								onclick={() => openProvider(provider)}
							/>
							<Menu>
								{#snippet trigger(attrs)}
									<Button
										{...attrs}
										variant="ghost"
										size="sm"
										icon={MoreHorizontal}
										label="More for {provider.name}"
									/>
								{/snippet}
								<MenuItem disabled={testing !== null} onclick={() => testProvider(provider)}
									>Test connection</MenuItem
								>
								<MenuItem
									danger
									icon={Trash2}
									onclick={() => {
										providerToDelete = provider;
										showDeleteModal = true;
									}}>Remove</MenuItem
								>
							</Menu>
						</span>
					{/snippet}
					<ListRow flush pinned title={provider.name} subtitle={detail} actions={controls}>
						{#snippet leading()}
							<ToneTile size={32}>
								<ProviderIcon preset={provider.preset} iconUrl={provider.iconUrl} size={16} />
							</ToneTile>
						{/snippet}
						{#snippet titleSuffix()}
							<StatusBadge meta={providerStatus(provider)} variant="plain" />
						{/snippet}
					</ListRow>
				{/each}
			</List>
		{:else}
			<p class="quiet">
				Connect Google, Microsoft, Okta, GitHub, or any OpenID Connect or SAML provider.
			</p>
		{/if}
	</SectionCard>

	{#if rulesProvider && organization}
		{#if mappable.length > 1}
			<SectionCard title="Group rules">
				<SettingsList>
					<SettingRow
						label="Connection"
						for="{uid}-rules-provider"
						hint="Only one connection can map groups into this organization"
					>
						<Select
							id="{uid}-rules-provider"
							value={rulesProvider.id}
							onchange={(e: Event) =>
								(rulesProviderId = (e.currentTarget as HTMLSelectElement).value)}
						>
							{#each mappable as provider (provider.id)}
								<option value={provider.id}>{provider.name}</option>
							{/each}
						</Select>
					</SettingRow>
				</SettingsList>
			</SectionCard>
		{/if}
		<GroupRulesEditor
			baseUrl={providerUrl(rulesProvider.id)}
			providerName={rulesProvider.name}
			fixedOrganizationId={organization.id}
			readonly={locked}
		/>
		<ProjectRulesEditor
			baseUrl={providerUrl(rulesProvider.id)}
			providerName={rulesProvider.name}
			projects={orgProjects}
			readonly={locked}
		/>
	{/if}

	<SectionCard
		title="Email domains"
		description="Verified domains route work addresses here and let your providers create accounts for new people. Until then, people join by invitation."
	>
		<SettingsList>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					addDomain();
				}}
			>
				<SettingRow label="Add a domain" for="{uid}-domain" wide>
					<span class="inline">
						<span class="grow">
							<Input
								id="{uid}-domain"
								bind:value={newDomain}
								placeholder="acme.com"
								autocomplete="off"
								spellcheck={false}
								disabled={locked}
							/>
						</span>
						<Button type="submit" loading={addingDomain} disabled={locked || !newDomain.trim()}>
							Add
						</Button>
					</span>
				</SettingRow>
			</form>
			{#if domainError}
				<div class="notice-row">
					<Alert tone="error">{domainError}</Alert>
				</div>
			{/if}
			{#each domains as domain (domain.id)}
				<div class="domain">
					<SettingRow
						label={domain.domain}
						hint={domain.verified
							? undefined
							: (domain.lastError ?? 'Add this TXT record at your DNS provider, then check again')}
					>
						<span class="status">
							<StatusBadge
								meta={domain.verified
									? statusMeta('success', 'Verified')
									: statusMeta('warning', 'Pending')}
								variant="plain"
							/>
						</span>
						{#if !domain.verified}
							<Button
								size="sm"
								loading={verifyingDomain === domain.id}
								onclick={() => verifyDomain(domain)}
							>
								Check DNS
							</Button>
						{/if}
						<Button
							variant="ghost"
							size="sm"
							icon={Trash2}
							label="Remove {domain.domain}"
							onclick={() => removeDomain(domain)}
						/>
					</SettingRow>
					{#if !domain.verified}
						<DnsRecord
							label="DNS record for {domain.domain}"
							records={[
								{ type: domain.recordType, name: domain.recordName, value: domain.recordValue }
							]}
						/>
					{/if}
				</div>
			{/each}
		</SettingsList>
	</SectionCard>

	<SectionCard title="Sign-in page">
		{#snippet actions()}
			{#if overview?.loginUrl}
				<Button
					variant="ghost"
					size="sm"
					shape="capsule"
					iconRight={ExternalLink}
					href={overview.loginUrl}
					target="_blank"
					rel="noopener"
				>
					Preview
				</Button>
			{/if}
		{/snippet}
		<SettingsList>
			<SettingRow label="Logo" for="{uid}-logo" wide>
				<Input
					id="{uid}-logo"
					type="url"
					bind:value={logoUrl}
					placeholder="https://acme.com/logo.svg"
				/>
			</SettingRow>
			<SettingRow label="Heading" for="{uid}-welcome" wide>
				<Input
					id="{uid}-welcome"
					bind:value={welcomeText}
					placeholder={`Sign in to ${organization?.name ?? ''}`}
				/>
			</SettingRow>
			<SettingRow label="Subheading" for="{uid}-tagline" wide>
				<Input id="{uid}-tagline" bind:value={tagline} placeholder="Use your work account" />
			</SettingRow>
			<div>
				<div class="color">
					<ColorField
						label="Accent"
						value={primaryColor || DEFAULT_LOGIN_ACCENT}
						onchange={(v) => (primaryColor = v)}
					/>
				</div>
			</div>
			<div>
				<div class="color">
					<ColorField
						label="Background"
						value={bgColor || DEFAULT_LOGIN_BG}
						onchange={(v) => (bgColor = v)}
					/>
				</div>
			</div>
		</SettingsList>
		<div class="save">
			<FormActions>
				<Button
					variant="ghost"
					disabled={!brandingDirty || savingBranding}
					onclick={discardBranding}
				>
					Discard
				</Button>
				<Button
					variant="primary"
					loading={savingBranding}
					disabled={!brandingDirty}
					onclick={saveBranding}
				>
					Save
				</Button>
			</FormActions>
		</div>
	</SectionCard>

	{#if isOwner && baseDomain}
		<SectionCard title="Vanity address">
			<SettingsList>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						saveSubdomain();
					}}
				>
					<SettingRow
						label="Subdomain"
						for="{uid}-subdomain"
						hint="Visitors are sent to your sign-in page"
						wide
					>
						<span class="inline">
							<span class="grow">
								<Input
									id="{uid}-subdomain"
									bind:value={subdomain}
									placeholder="acme"
									suffix=".{baseDomain}"
									autocomplete="off"
									spellcheck={false}
								/>
							</span>
							<Button type="submit" loading={savingSubdomain}>Save</Button>
						</span>
					</SettingRow>
				</form>
			</SettingsList>
		</SectionCard>
	{/if}
{/if}

{#if overview}
	<SsoProviderModal
		bind:open={showProviderModal}
		presets={overview.presets}
		editing={editingProvider}
		saving={savingProvider}
		error={providerError}
		onSave={saveProvider}
		onIconUpload={uploadIcon}
		onIconRemove={removeIcon}
		onClose={() => {
			editingProvider = null;
			providerError = null;
		}}
	/>
{/if}

<ConfirmModal
	bind:open={showDeleteModal}
	title="Remove this connection?"
	description="Members who sign in through it lose this option immediately. Their accounts and memberships don't change."
	confirmLabel="Remove connection"
	onconfirm={deleteProvider}
	oncancel={() => {
		providerToDelete = null;
	}}
/>

<style>
	.skeleton-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.notice {
		margin-bottom: var(--space-4);
	}
	.notice-row {
		min-height: 0;
	}
	.address {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
		max-width: 30rem;
	}
	.mono {
		min-width: 0;
		margin-right: 0.25rem;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		color: var(--text-default);
	}
	.icons {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.ok {
		color: var(--status-success);
	}
	.bad {
		color: var(--status-error);
	}
	.line {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
	}
	.quiet {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.inline {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.grow {
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
	}
	.domain {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.status {
		display: flex;
		width: 5.5rem;
	}
	.color {
		margin: -0.625rem -0.75rem;
	}
	.save {
		margin-top: var(--space-4);
	}
</style>

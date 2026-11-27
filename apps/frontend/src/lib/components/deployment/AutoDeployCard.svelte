<script lang="ts">
	import { ExternalLink, Eye } from 'lucide-svelte';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { statusMeta as dotMeta } from '$lib/components/ui/status';
	import { fetchWebhookSecret } from '$lib/components/user-settings/git-connections';
	import {
		Alert,
		Button,
		Disclosure,
		FormActions,
		Input,
		SectionCard,
		Spinner,
		StatusBadge,
		statusMeta,
		Textarea,
		ToggleRow,
		ActionRow
	} from '$lib/components/ui';
	import SettingsList from '$lib/components/ui/SettingsList.svelte';
	import SettingRow from '$lib/components/ui/SettingRow.svelte';
	import type { AutoDeployStatus, GitHubDeploymentRecord } from '$lib/types/deployment';

	let {
		deployment,
		autoDeployStatus,
		autoDeployLoading,
		autoDeployBranch = $bindable(''),
		autoDeployPaths = $bindable(''),
		savingAutoDeployPaths,
		onSaveAutoDeployPaths,
		enablingAutoDeploy,
		disablingAutoDeploy,
		githubDeployments,
		githubAppInstallUrl,
		loadingAppInstallUrl,
		onEnableAutoDeploy,
		onDisableAutoDeploy,
		onOpenGitHubAppInstall
	}: {
		deployment: any;
		autoDeployStatus: AutoDeployStatus | null;
		autoDeployLoading: boolean;
		autoDeployBranch: string;
		autoDeployPaths: string;
		savingAutoDeployPaths: boolean;
		onSaveAutoDeployPaths: () => void | Promise<void>;
		enablingAutoDeploy: boolean;
		disablingAutoDeploy: boolean;
		githubDeployments: GitHubDeploymentRecord[];
		githubAppInstallUrl: string | null;
		loadingAppInstallUrl: boolean;
		onEnableAutoDeploy: () => void | Promise<void>;
		onDisableAutoDeploy: () => void | Promise<void>;
		onOpenGitHubAppInstall: () => void;
	} = $props();

	const uid = $props.id();

	function lines(value: string) {
		return value
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
			.join('\n');
	}

	const enabled = $derived(!!autoDeployStatus?.enabled);
	const savedPaths = $derived(lines((autoDeployStatus?.paths ?? []).join('\n')));
	const savedBranch = $derived(autoDeployStatus?.branch ?? deployment.githubBranch ?? '');
	const pathsDirty = $derived(lines(autoDeployPaths ?? '') !== savedPaths);
	const branchDirty = $derived(enabled && autoDeployBranch.trim() !== savedBranch);
	const dirty = $derived(pathsDirty || branchDirty);
	const needsApp = $derived(!enabled && autoDeployStatus?.appInstalled === false);
	const provider = $derived(autoDeployStatus?.provider ?? null);
	const problem = $derived.by(() => {
		if (autoDeployLoading || !enabled) return null;
		if (provider) return provider.hookPresent === true ? null : 'hook';
		if (autoDeployStatus?.appInstalled === false) return 'app';
		if (autoDeployStatus?.linked === false) return 'unlinked';
		return null;
	});

	let pending = $state<boolean | null>(null);
	const switchedOn = $derived(pending ?? enabled);

	async function setEnabled(next: boolean) {
		pending = next;
		try {
			await (next ? onEnableAutoDeploy() : onDisableAutoDeploy());
		} finally {
			pending = null;
		}
	}

	function discard() {
		autoDeployPaths = (autoDeployStatus?.paths ?? []).join('\n');
		autoDeployBranch = savedBranch;
	}

	function save() {
		if (branchDirty) return onEnableAutoDeploy();
		return onSaveAutoDeployPaths();
	}

	let hookSecret = $state<string | null>(null);
	async function revealHookSecret() {
		if (!provider) return;
		try {
			hookSecret = await fetchWebhookSecret(provider.id);
		} catch {
			hookSecret = null;
		}
	}

	function ghDot(status: string) {
		if (status === 'success') return dotMeta('success', 'Success');
		if (status === 'failure' || status === 'error') return dotMeta('error', 'Failed');
		if (status === 'in_progress') return dotMeta('progress', 'In progress', true);
		return dotMeta('neutral', status);
	}
</script>

<SectionCard title="Auto-deploy">
	<div class="ad-body">
		{#if problem}
			<div class="ad-alert">
				{#if problem === 'app'}
					<Alert tone="error" title="GitHub App can't see this repository">
						Pushes won't deploy until the App is installed on it.
						{#snippet actions()}
							<Button
								size="sm"
								variant="secondary"
								icon={ExternalLink}
								loading={loadingAppInstallUrl}
								disabled={!githubAppInstallUrl}
								onclick={onOpenGitHubAppInstall}>Configure</Button
							>
						{/snippet}
					</Alert>
				{:else if problem === 'unlinked'}
					<Alert tone="warning" title="Auto-deploy is on but not connected">
						Pushes don't reach this app. Reconnect to fix this. Orchard keeps the branch and watch
						paths.
						{#snippet actions()}
							<Button
								size="sm"
								variant="secondary"
								loading={enablingAutoDeploy}
								disabled={!autoDeployBranch}
								onclick={onEnableAutoDeploy}>Reconnect</Button
							>
						{/snippet}
					</Alert>
				{:else if problem === 'hook' && provider}
					<Alert
						tone="warning"
						title={provider.hookPresent === false
							? `No webhook on ${provider.host} yet`
							: provider.canRegister
								? `Couldn't check the webhook on ${provider.host}`
								: `Add the webhook on ${provider.host}`}
					>
						{provider.canRegister
							? `Reconnect to register it with ${provider.name}, or add it by hand for push events.`
							: 'Paste the URL and secret into the repository webhook settings for push events.'}
						<div class="ad-hook">
							<span class="ad-hook-field">
								<code>{provider.webhookUrl}</code>
								<CopyButton value={provider.webhookUrl} label="Copy webhook URL" />
							</span>
							{#if provider.ownedByMe}
								{#if hookSecret}
									<span class="ad-hook-field">
										<code>{hookSecret}</code>
										<CopyButton value={hookSecret} label="Copy webhook secret" />
									</span>
								{:else}
									<Button size="sm" variant="ghost" icon={Eye} onclick={revealHookSecret}
										>Show secret</Button
									>
								{/if}
							{:else}
								<span class="ad-hook-note">Whoever linked {provider.name}.</span>
							{/if}
						</div>
						{#snippet actions()}
							{#if provider.canRegister}
								<Button
									size="sm"
									variant="secondary"
									loading={enablingAutoDeploy}
									disabled={!autoDeployBranch}
									onclick={onEnableAutoDeploy}>Reconnect</Button
								>
							{/if}
						{/snippet}
					</Alert>
				{/if}
			</div>
		{/if}

		<SettingsList>
			{#if autoDeployLoading}
				<div class="ad-loading"><Spinner size={16} label="Loading auto-deploy" /></div>
			{:else if needsApp}
				<ActionRow label="Deploy on push" hint="Needs the GitHub App on this repository">
					<Button
						size="sm"
						variant="secondary"
						icon={ExternalLink}
						loading={loadingAppInstallUrl}
						disabled={!githubAppInstallUrl}
						onclick={onOpenGitHubAppInstall}>Install GitHub App</Button
					>
				</ActionRow>
			{:else}
				<ToggleRow
					label="Deploy on push"
					disabled={enablingAutoDeploy || disablingAutoDeploy || !autoDeployBranch.trim()}
					bind:checked={() => switchedOn, setEnabled}
				/>
			{/if}
			<SettingRow label="Branch" for="{uid}-branch" wide>
				<Input
					id="{uid}-branch"
					bind:value={autoDeployBranch}
					placeholder={deployment.githubBranch || 'main'}
					mono
				/>
			</SettingRow>
			<SettingRow
				label="Watch paths"
				for="{uid}-paths"
				stack
				hint="One glob per line. Start a line with ! to ignore matches. If empty, every push builds."
			>
				<Textarea
					id="{uid}-paths"
					rows={3}
					mono
					placeholder={'apps/web/**\npackages/ui/**\n!**/*.md'}
					bind:value={autoDeployPaths}
				/>
			</SettingRow>
			{#if enabled && provider?.hookPresent === true}
				<SettingRow label="Webhook">
					<StatusBadge meta={statusMeta('success', `Registered on ${provider.host}`)} />
				</SettingRow>
			{/if}
			{#if githubDeployments.length > 0}
				<Disclosure title="Recent deployments" note={String(githubDeployments.length)}>
					<ul class="ad-runs">
						{#each githubDeployments.slice(0, 5) as run (run.id)}
							<li class="ad-run">
								<StatusDot meta={ghDot(run.status)} size={8} />
								<code class="ad-sha">{run.commitSha.substring(0, 7)}</code>
								<span class="ad-ref" title={run.ref}>{run.ref}</span>
								<span class="ad-date">{new Date(run.createdAt).toLocaleDateString()}</span>
								{#if run.logUrl}
									<a
										class="ad-link"
										href={run.logUrl}
										target="_blank"
										rel="noopener noreferrer"
										aria-label="Open on GitHub"><ExternalLink size={14} /></a
									>
								{/if}
							</li>
						{/each}
					</ul>
				</Disclosure>
			{/if}
		</SettingsList>

		<FormActions hint={enabled ? undefined : 'Used when you turn it on.'}>
			<Button
				variant="ghost"
				disabled={!enabled || !dirty || savingAutoDeployPaths || enablingAutoDeploy}
				onclick={discard}>Discard</Button
			>
			<Button
				variant="primary"
				loading={savingAutoDeployPaths || (enablingAutoDeploy && enabled)}
				disabled={!enabled || !dirty || !autoDeployBranch.trim()}
				onclick={save}>Save</Button
			>
		</FormActions>
	</div>
</SectionCard>

<style>
	.ad-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.ad-alert {
		margin-bottom: var(--space-3);
	}
	.ad-loading {
		display: flex;
		align-items: center;
		color: var(--text-faint);
	}
	.ad-hook {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.ad-hook-field {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		max-width: 100%;
		min-width: 0;
	}
	.ad-hook-field code {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		color: var(--text-default);
	}
	.ad-hook-note {
		font-size: var(--text-caption);
		color: var(--text-muted);
	}
	.ad-runs {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ad-run {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2rem;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
	}
	.ad-sha {
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		color: var(--text-default);
	}
	.ad-ref {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-muted);
	}
	.ad-date {
		margin-left: auto;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.ad-link {
		display: inline-flex;
		color: var(--text-muted);
	}
	.ad-link:hover {
		color: var(--text-default);
	}
</style>

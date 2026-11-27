<script lang="ts">
	import { tick } from 'svelte';
	import { KeyRound, Plus, Trash2 } from 'lucide-svelte';
	import {
		Button,
		Field,
		Input,
		List,
		ListRow,
		Modal,
		ModalIntro,
		SectionCard,
		SettingRow,
		SettingsList,
		Skeleton,
		ToneTile
	} from '$lib/components/ui';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';

	type ScimToken = {
		id: string;
		name: string;
		lastUsedAt: string | null;
		expiresAt: string | null;
		createdAt: string;
	};

	let {
		isOwner,
		scimLoading,
		scimBaseUrl,
		scimTokens = [],
		scimNewName = $bindable(''),
		scimCreating,
		scimRevokingId,
		scimCreatedToken,
		onCreateToken,
		onRevokeToken,
		onDismissCreatedToken,
		description = 'Sync members from your identity provider'
	}: {
		isOwner: boolean;
		scimLoading: boolean;
		scimBaseUrl: string;
		scimTokens: ScimToken[];
		scimNewName: string;
		scimCreating: boolean;
		scimRevokingId: string | null;
		scimCreatedToken: { name: string; token: string } | null;
		onCreateToken: () => void;
		onRevokeToken: (id: string) => void;
		onDismissCreatedToken: () => void;
		description?: string;
	} = $props();

	const uid = $props.id();

	let creating = $state(false);

	const sheetOpen = $derived(creating || !!scimCreatedToken);

	function shortDate(value: string) {
		return new Date(value).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function tokenDetail(token: ScimToken) {
		return [
			`Created ${shortDate(token.createdAt)}`,
			token.lastUsedAt ? `last used ${shortDate(token.lastUsedAt)}` : 'never used',
			token.expiresAt ? `expires ${shortDate(token.expiresAt)}` : null
		]
			.filter(Boolean)
			.join(' · ');
	}

	function openCreate() {
		scimNewName = '';
		creating = true;
	}

	function close() {
		creating = false;
		if (scimCreatedToken) onDismissCreatedToken();
	}

	function submit() {
		if (!scimNewName.trim() || scimCreating) return;
		onCreateToken();
	}

	function focusOnOpen(el: HTMLInputElement) {
		void tick().then(() => el.focus());
	}
</script>

{#if !isOwner}
	<SectionCard title="SCIM provisioning">
		<p class="quiet">Only the organization owner can manage SCIM provisioning.</p>
	</SectionCard>
{:else}
	<SectionCard title="SCIM provisioning" {description}>
		<SettingsList>
			<SettingRow
				label="Endpoint"
				hint="Paste it with a token below into your identity provider's SCIM 2.0 connector"
			>
				{#if scimLoading}
					<Skeleton width="16rem" height="0.875rem" />
				{:else}
					<span class="address">
						<code class="mono" title={scimBaseUrl}>{scimBaseUrl}</code>
						<CopyButton value={scimBaseUrl} label="Copy SCIM endpoint" />
					</span>
				{/if}
			</SettingRow>
		</SettingsList>
	</SectionCard>

	<SectionCard title="Tokens">
		{#snippet actions()}
			<Button size="sm" shape="capsule" icon={Plus} onclick={openCreate}>New token</Button>
		{/snippet}
		{#if scimLoading}
			<div class="placeholder">
				<Skeleton height="2.5rem" />
				<Skeleton height="2.5rem" />
			</div>
		{:else if scimTokens.length === 0}
			<p class="quiet">Generate a token to connect your identity provider.</p>
		{:else}
			<List inset={false} label="SCIM tokens">
				{#each scimTokens as token (token.id)}
					{#snippet revoke()}
						<Button
							variant="ghost"
							size="sm"
							icon={Trash2}
							label="Revoke {token.name}"
							loading={scimRevokingId === token.id}
							disabled={scimRevokingId !== null}
							onclick={() => onRevokeToken(token.id)}
						/>
					{/snippet}
					<ListRow flush presence title={token.name} subtitle={tokenDetail(token)} actions={revoke}>
						{#snippet leading()}<ToneTile size={32}><KeyRound size={16} /></ToneTile>{/snippet}
					</ListRow>
				{/each}
			</List>
		{/if}
	</SectionCard>

	<Modal
		bind:open={() => sheetOpen, (v) => !v && close()}
		size={scimCreatedToken ? 'md' : 'sm'}
		closable={false}
		dismissable={!scimCreatedToken}
		labelledby="{uid}-title"
	>
		{#if scimCreatedToken}
			<div class="form">
				<ModalIntro
					id="{uid}-title"
					icon={KeyRound}
					tone="success"
					solid
					title={`${scimCreatedToken.name} is ready`}
					description="Copy the token now. It isn't shown again."
				/>
				{#snippet copy()}<CopyButton
						value={scimCreatedToken?.token ?? ''}
						label="Copy token"
					/>{/snippet}
				<Field label="Token" for="{uid}-token">
					<Input id="{uid}-token" value={scimCreatedToken.token} readonly mono suffix={copy} />
				</Field>
			</div>
		{:else}
			<form
				class="form"
				onsubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<ModalIntro id="{uid}-title" icon={KeyRound} tone="accent" title="New SCIM token" />
				<Field label="Name" for="{uid}-name">
					<Input
						id="{uid}-name"
						bind:value={scimNewName}
						placeholder="Okta production"
						autocomplete="off"
						{@attach focusOnOpen}
					/>
				</Field>
			</form>
		{/if}
		{#snippet footer()}
			{#if scimCreatedToken}
				<Button variant="primary" shape="capsule" onclick={close}>Done</Button>
			{:else}
				<Button variant="ghost" shape="capsule" disabled={scimCreating} onclick={close}
					>Cancel</Button
				>
				<Button
					variant="primary"
					shape="capsule"
					loading={scimCreating}
					disabled={!scimNewName.trim()}
					onclick={submit}
				>
					Generate token
				</Button>
			{/if}
		{/snippet}
	</Modal>
{/if}

<style>
	.quiet {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
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
	.form,
	.placeholder {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.placeholder {
		gap: 0.5rem;
	}
</style>

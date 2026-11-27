<script lang="ts">
	import { Pencil } from 'lucide-svelte';
	import { Avatar as AvatarBuilder } from 'melt/builders';
	import { AvatarEdit, Button, Field, Input, Modal, Textarea } from '$lib/components/ui';
	import ResourceHeader from '$lib/components/patterns/ResourceHeader.svelte';

	interface Organization {
		id: string;
		name: string;
		slug: string;
		description?: string;
		avatarUrl?: string;
		plan?: string;
		members?: unknown[];
	}

	let {
		organization,
		organizationSlug,
		currentUserRole,
		canEditOrg,
		pendingInvites = 0,
		isEditing = $bindable(false),
		editingName = $bindable(''),
		editingDescription = $bindable(''),
		updating,
		uploadingAvatar,
		deletingAvatar,
		onStartEditing,
		onCancelEditing,
		onSave,
		onUploadAvatar,
		onDeleteAvatar
	}: {
		organization: Organization;
		organizationSlug: string;
		currentUserRole: string | null;
		canEditOrg: boolean;
		pendingInvites?: number;
		isEditing: boolean;
		editingName: string;
		editingDescription: string;
		updating: boolean;
		uploadingAvatar: boolean;
		deletingAvatar: boolean;
		onStartEditing: () => void;
		onCancelEditing: () => void;
		onSave: () => void;
		onUploadAvatar: (event: Event) => void;
		onDeleteAvatar: () => void;
	} = $props();

	function formatRole(role: string) {
		return role.charAt(0).toUpperCase() + role.slice(1);
	}

	const orgAvatar = new AvatarBuilder({
		src: () => organization?.avatarUrl,
		delayMs: 120
	});

	const memberCount = $derived(organization.members?.length ?? 0);
</script>

<ResourceHeader title={organization.name}>
	{#snippet leading()}
		<AvatarEdit
			label="Change organization logo"
			editable={canEditOrg}
			busy={uploadingAvatar || deletingAvatar}
			removable={!!organization.avatarUrl}
			onchange={onUploadAvatar}
			onremove={onDeleteAvatar}
		>
			<img {...orgAvatar.image} alt={organization.name} class="logo" />
			<span {...orgAvatar.fallback} class="letter">{organization.name[0]}</span>
		</AvatarEdit>
	{/snippet}
	{#snippet actions()}
		{#if canEditOrg}
			<Button variant="secondary" icon={Pencil} onclick={onStartEditing}>Edit</Button>
		{/if}
	{/snippet}
	{#snippet facts()}
		<span class="mono">{organization.slug}</span>
		{#if organization.description}<span>{organization.description}</span>{/if}
		<span>{formatRole(currentUserRole || 'member')}</span>
		{#if organization.plan}<span>{formatRole(organization.plan)} plan</span>{/if}
		<a href={`/${organizationSlug}/settings?tab=members`}
			>{memberCount} member{memberCount === 1 ? '' : 's'}</a
		>
		{#if pendingInvites > 0}
			<a href={`/${organizationSlug}/settings?tab=members`}
				>{pendingInvites} pending invite{pendingInvites === 1 ? '' : 's'}</a
			>
		{/if}
	{/snippet}
</ResourceHeader>

<Modal bind:open={isEditing} size="sm" title="Edit organization" onclose={onCancelEditing}>
	<div class="form">
		<Field label="Name" for="oh-org-name">
			<Input id="oh-org-name" name="name" bind:value={editingName} />
		</Field>
		<Field label="Description" for="oh-org-desc">
			<Textarea id="oh-org-desc" name="description" rows={2} bind:value={editingDescription} />
		</Field>
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={onCancelEditing}>Cancel</Button>
		<Button variant="primary" onclick={onSave} loading={updating}>Save</Button>
	{/snippet}
</Modal>

<style>
	.logo,
	.letter {
		grid-area: 1 / 1;
		object-fit: cover;
	}
	.letter {
		display: grid;
		place-items: center;
		font-size: var(--text-title-2);
		font-weight: var(--weight-semibold);
		color: var(--text-muted);
	}
	.mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
	}
	a {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--border-default);
		text-underline-offset: 2px;
	}
	a:hover {
		color: var(--text-default);
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>

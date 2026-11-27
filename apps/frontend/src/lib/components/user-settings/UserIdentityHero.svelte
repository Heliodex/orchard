<script lang="ts">
	import { Eye, EyeOff, Pencil } from 'lucide-svelte';
	import { gaze } from '@blobatar/svelte/gaze';
	import 'blobatar/gaze.css';
	import { decorativeMotion } from '$lib/utils/motion.svelte';
	import { effectiveAnimation } from '$lib/stores';
	import { Avatar, AvatarEdit, Button, Field, Input, Modal } from '$lib/components/ui';
	import ResourceHeader from '$lib/components/patterns/ResourceHeader.svelte';

	interface UserData {
		id?: string;
		firstName?: string;
		lastName?: string;
		name?: string;
		username?: string;
		email?: string;
		imageUrl?: string;
	}

	let {
		user,
		displayEmail,
		emailRevealed = $bindable(false),
		isEditing = $bindable(false),
		editFirstName = $bindable(''),
		editLastName = $bindable(''),
		editUsername = $bindable(''),
		saving,
		uploadingAvatar,
		deletingAvatar,
		onStartEditing,
		onCancelEditing,
		onSave,
		onUploadAvatar,
		onDeleteAvatar,
		passkeyCount = null,
		sessionCount = null,
		githubLinked = false
	}: {
		user: UserData | null;
		displayEmail: string;
		emailRevealed: boolean;
		isEditing: boolean;
		editFirstName: string;
		editLastName: string;
		editUsername: string;
		saving: boolean;
		uploadingAvatar: boolean;
		deletingAvatar: boolean;
		onStartEditing: () => void;
		onCancelEditing: () => void;
		onSave: () => void;
		onUploadAvatar: (event: Event) => void;
		onDeleteAvatar: () => void;
		passkeyCount?: number | null;
		sessionCount?: number | null;
		githubLinked?: boolean;
	} = $props();

	const displayName = $derived(
		[user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
			user?.name ||
			user?.username ||
			'You'
	);

	const chips = $derived(
		[
			passkeyCount !== null && {
				id: 'passkeys',
				href: '/user/settings?tab=security',
				valueFirst: true,
				value: String(passkeyCount),
				label: `passkey${passkeyCount === 1 ? '' : 's'}`
			},
			sessionCount !== null && {
				id: 'sessions',
				href: '/user/settings?tab=security',
				valueFirst: true,
				value: String(sessionCount),
				label: `device${sessionCount === 1 ? '' : 's'}`
			},
			{
				id: 'github',
				href: '/user/settings?tab=connections',
				valueFirst: false,
				label: 'GitHub',
				value: githubLinked ? 'Connected' : 'Not connected'
			}
		].filter(Boolean) as {
			id: string;
			href: string;
			valueFirst: boolean;
			value: string;
			label: string;
		}[]
	);

	// The one big blobatar the page is about, so it gets the layer that only
	// earns its place at this size: on a 32px row the excursion is a fraction of
	// a pixel, here it is 3% of a 72px face.
	//
	// Held in a const rather than called inline, because the expression would
	// re-run whenever the state it reads changes and a rebuilt driver starts
	// with the eyes back at centre - the face would snap home every time
	// something near it moved.
	const eyes = gaze({ travel: 3 });

	// `rest` rather than `null`: both stop the tracking, but `null` hands the
	// blobatar back to its idle glance, and idle motion is exactly what this
	// tier asked us to stop. `rest` is a face deliberately not looking.
	$effect(() => {
		void $effectiveAnimation;
		eyes.lookAt(decorativeMotion() ? 'pointer' : 'rest');
	});

	const busy = $derived(saving || uploadingAvatar || deletingAvatar);
</script>

<ResourceHeader title={displayName}>
	{#snippet leading()}
		<AvatarEdit
			label="Change profile photo"
			busy={uploadingAvatar || deletingAvatar}
			removable={!!user?.imageUrl}
			onchange={onUploadAvatar}
			onremove={onDeleteAvatar}
		>
			<Avatar {user} alive="always" {eyes} mood={busy ? 'thinking' : 'idle'} alt={displayName} />
		</AvatarEdit>
	{/snippet}
	{#snippet actions()}
		<Button variant="secondary" icon={Pencil} onclick={onStartEditing}>Edit</Button>
	{/snippet}
	{#snippet facts()}
		{#if user?.username}<span class="mono" title={user.username}>{user.username}</span>{/if}
		<span class="email">
			<span class="email-text" title={displayEmail}>{displayEmail}</span>
			<Button
				variant="ghost"
				size="sm"
				shape="capsule"
				icon={emailRevealed ? EyeOff : Eye}
				label={emailRevealed ? 'Hide email' : 'Show email'}
				onclick={() => (emailRevealed = !emailRevealed)}
			/>
		</span>
		{#each chips as chip (chip.id)}
			<a href={chip.href}
				>{#if chip.valueFirst}{chip.value} {chip.label}{:else}{chip.label}
					{chip.value.toLowerCase()}{/if}</a
			>
		{/each}
	{/snippet}
</ResourceHeader>

<Modal bind:open={isEditing} size="sm" title="Edit profile" onclose={onCancelEditing}>
	<div class="uh-form">
		<div class="uh-form-row">
			<Field label="First name" for="uh-first-name">
				<Input id="uh-first-name" name="firstName" bind:value={editFirstName} />
			</Field>
			<Field label="Last name" for="uh-last-name">
				<Input id="uh-last-name" name="lastName" bind:value={editLastName} />
			</Field>
		</div>
		<Field label="Username" for="uh-username" hint="Used in URLs and mentions">
			<Input id="uh-username" name="username" bind:value={editUsername} />
		</Field>
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={onCancelEditing}>Cancel</Button>
		<Button variant="primary" onclick={onSave} loading={saving}>Save</Button>
	{/snippet}
</Modal>

<style>
	.mono {
		max-width: 100%;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
	}
	.email {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
		max-width: 100%;
	}
	.email-text {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
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
	.uh-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.uh-form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
</style>

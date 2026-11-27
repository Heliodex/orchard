<script lang="ts">
	import type { Snippet } from 'svelte';
	import { AlertTriangle, Trash2 } from 'lucide-svelte';
	import { Modal, ModalIntro, Button, Input } from '$lib/components/ui';

	interface Props {
		open: boolean;
		title: string;
		description: string;
		html?: boolean;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		confirmText?: string | null;
		onconfirm: () => void;
		oncancel: () => void;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		description,
		html = false,
		confirmLabel = 'Delete',
		cancelLabel = 'Cancel',
		danger = true,
		confirmText = null,
		onconfirm,
		oncancel,
		children = undefined
	}: Props = $props();

	const uid = $props.id();

	let typed = $state('');
	let wasOpen = false;

	$effect(() => {
		if (open && !wasOpen) typed = '';
		wasOpen = open;
	});

	const confirmReady = $derived(!confirmText || typed.trim() === confirmText.trim());

	function handleCancel() {
		open = false;
		oncancel?.();
	}

	function handleConfirm() {
		if (!confirmReady) return;
		open = false;
		onconfirm?.();
	}
</script>

<Modal
	bind:open
	size="sm"
	closable={false}
	dismissable
	labelledby="{uid}-title"
	onclose={() => oncancel?.()}
>
	<div class="confirm">
		<ModalIntro
			id="{uid}-title"
			icon={danger ? Trash2 : AlertTriangle}
			tone={danger ? 'error' : 'warning'}
			{title}
		>
			{#if html}
				<p>{@html description}</p>
			{:else}
				<p>{description}</p>
			{/if}
		</ModalIntro>
		{#if children}{@render children()}{/if}
		{#if confirmText}
			<form
				class="type"
				onsubmit={(e) => {
					e.preventDefault();
					handleConfirm();
				}}
			>
				<label class="type-label" for="{uid}-confirm">
					Type <code class="type-code">{confirmText}</code> to confirm
				</label>
				<Input
					id="{uid}-confirm"
					bind:value={typed}
					placeholder={confirmText}
					autocomplete="off"
					spellcheck={false}
				/>
			</form>
		{/if}
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={handleCancel}>{cancelLabel}</Button>
		<Button
			variant={danger ? 'danger' : 'primary'}
			disabled={!confirmReady}
			onclick={handleConfirm}
		>
			{confirmLabel}
		</Button>
	{/snippet}
</Modal>

<style>
	.confirm {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.type {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.type-label {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.type-code {
		padding: 0.0625rem 0.3125rem;
		border-radius: calc(0.3125rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-active);
		color: var(--text-default);
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { isSignedIn, isSuperAdmin, showOnboarding, telemetry, toasts, user } from '$lib/stores';
	import { Modal, Button } from '$lib/components/ui';
	import {
		TELEMETRY_PITCH,
		TELEMETRY_SENT,
		TELEMETRY_NEVER,
		TELEMETRY_DOCS_URL
	} from '$lib/telemetry';
	import TelemetryPayload from './TelemetryPayload.svelte';

	const quietRoutes = ['/setup', '/invite', '/oauth', '/sso', '/cli', '/mcp', '/auth/protect'];

	let mounted = $state(false);
	let open = $state(false);
	let saving = $state<boolean | null>(null);
	let showPayload = $state(false);
	let presented = false;

	onMount(() => {
		mounted = true;
	});

	$effect(() => {
		if (!mounted || presented || !$isSignedIn || !$isSuperAdmin || $showOnboarding) return;
		if ($user?.setupCompleted === false) return;
		if (quietRoutes.some((route) => $page.url.pathname.startsWith(route))) return;
		void telemetry.ensure();
		if (!$telemetry?.needsAnswer) return;
		presented = true;
		open = true;
	});

	async function answer(enabled: boolean) {
		if (saving !== null) return;
		saving = enabled;
		try {
			await telemetry.answer(enabled);
			open = false;
			toasts.add({
				title: enabled ? 'Thanks for sharing' : 'Nothing is shared',
				description: 'Change this in Instance admin, under Configuration.',
				color: 'success'
			});
		} catch (e) {
			toasts.add({
				title: e instanceof Error ? e.message : "Couldn't save your choice",
				color: 'error'
			});
		} finally {
			saving = null;
		}
	}
</script>

{#snippet footer()}
	<div class="tp-footer">
		<Button variant="secondary" disabled={saving !== null} onclick={() => answer(false)}>
			Don't share
		</Button>
		<Button variant="primary" loading={saving === true} onclick={() => answer(true)}>
			Share anonymous reports
		</Button>
	</div>
{/snippet}

<Modal bind:open size="md" align="viewport" closable={false} dismissable={false} {footer}>
	<div class="tp">
		<div class="tp-head">
			<h2 class="tp-title">Help improve Orchard</h2>
			<p class="tp-summary">{TELEMETRY_PITCH}</p>
		</div>

		<ul class="tp-list">
			{#each TELEMETRY_SENT as item (item)}
				<li>{item}</li>
			{/each}
		</ul>

		<p class="tp-never">
			{TELEMETRY_NEVER}
			<a class="tp-never-link" href={TELEMETRY_DOCS_URL} target="_blank" rel="noreferrer"
				>See what is sent</a
			>
		</p>

		<button class="tp-peek" onclick={() => (showPayload = !showPayload)}>
			{showPayload ? 'Hide the report' : 'See the exact report'}
		</button>
		{#if showPayload}
			<TelemetryPayload class="tp-payload" />
		{/if}

		<p class="tp-admin">
			Only instance admins see this. Change this in Instance admin, under Configuration.
		</p>
	</div>
</Modal>

<style>
	.tp-head {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.tp-title {
		font-size: var(--text-title-2);
		font-weight: 650;
		letter-spacing: -0.011em;
		line-height: 1.15;
		color: var(--text-default);
	}
	.tp-summary {
		font-size: var(--text-footnote);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.tp-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 1.25rem 0 0;
		padding-left: 1.1rem;
		list-style: disc;
		font-size: var(--text-footnote);
		line-height: 1.45;
		color: var(--text-muted);
	}
	.tp-list li::marker {
		color: var(--accent);
	}

	.tp-never {
		margin-top: 1rem;
		padding: 0.75rem 0.875rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-default);
		background: var(--bg-sunken);
		font-size: var(--text-caption);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.tp-peek {
		margin-top: 0.875rem;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-caption);
		font-weight: 500;
		color: var(--text-link);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.tp :global(.tp-payload) {
		max-height: 10rem;
		margin-top: 0.625rem;
		padding: 0.75rem 0.875rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-default);
		background: var(--bg-sunken);
		color: var(--text-default);
	}

	.tp-admin {
		margin-top: 1rem;
		font-size: var(--text-caption);
		color: var(--text-faint);
	}

	.tp-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		width: 100%;
		padding-top: 1rem;
	}
	.tp-never-link {
		color: var(--text-link);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>

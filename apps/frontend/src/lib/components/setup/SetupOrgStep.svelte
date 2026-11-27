<script lang="ts">
	import { Button, Field, Input } from '$lib/components/ui';
	import { Pending } from './pending.svelte';
	import { onMount } from 'svelte';
	import { animate } from 'motion';
	import { apiFetch, organizations, toasts } from '$lib/stores';
	import { transition } from '$lib/utils/motion.svelte';

	let {
		onDone,
		onSkip
	}: { onDone: () => Promise<void> | void; onSkip: () => Promise<void> | void } = $props();

	type Org = { id: string; name: string; slug: string };

	const uid = $props.id();
	const skipping = new Pending();

	let org = $state<Org | null>(null);
	let name = $state('');
	let saving = $state(false);
	let slugEl = $state<HTMLElement | null>(null);

	const slug = $derived(
		(name || '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+/, '')
			.replace(/-+$/, '')
			.slice(0, 60) ||
			(org?.slug ?? 'your-org')
	);
	const dirty = $derived(!!org && name.trim().length > 0 && name.trim() !== org.name);
	const host = $derived(typeof window === 'undefined' ? '' : window.location.host);

	$effect(() => {
		void slug;
		if (slugEl) animate(slugEl, { scale: [0.9, 1] }, transition('bouncy'));
	});

	onMount(async () => {
		const response = await apiFetch('/apiv1/organizations/user');
		if (!response.ok) return;
		const list = await response.json();
		org = Array.isArray(list) ? (list[0] ?? null) : null;
		name = org?.name ?? '';
	});

	async function save() {
		if (!org || saving) return;
		saving = true;
		try {
			const response = await apiFetch(`/apiv1/admin/organizations/${org.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim() })
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body?.message || "Couldn't rename the organization");
			}
			const refreshed = await apiFetch('/apiv1/organizations/user');
			if (refreshed.ok) organizations.set(await refreshed.json());
			await onDone();
		} catch (e) {
			toasts.add({
				title: e instanceof Error ? e.message : "Couldn't rename the organization",
				color: 'error'
			});
		} finally {
			saving = false;
		}
	}
</script>

<section class="setup-step">
	<h2>Name your organization</h2>
	<p>Orchard created one for you. Rename it, or keep this name.</p>

	<div class="setup-body setup-fields">
		<Field label="Organization name" for="{uid}-name">
			<Input id="{uid}-name" size="lg" bind:value={name} placeholder={org?.name ?? ''} />
		</Field>
		<p class="setup-slug">
			<span class="scheme">https://</span>{host}/<b bind:this={slugEl}>{slug}</b>
		</p>
	</div>

	<div class="setup-acts">
		<Button
			variant="primary"
			size="lg"
			shape="capsule"
			loading={saving}
			disabled={!dirty || skipping.active}
			onclick={save}
		>
			Save
		</Button>
		<Button
			variant="ghost"
			size="lg"
			shape="capsule"
			loading={skipping.active}
			disabled={saving}
			onclick={() => skipping.run(onSkip)}
		>
			Keep it
		</Button>
	</div>
</section>

<style>
	.setup-slug {
		font-variant-ligatures: none;
		max-width: none;
		margin-top: 0.65rem;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: 0.75rem;
		color: var(--setup-ink-soft);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.setup-slug .scheme {
		color: var(--setup-ink-faint);
	}

	.setup-slug b {
		display: inline-block;
		color: var(--setup-crimson);
		font-weight: 400;
	}
</style>

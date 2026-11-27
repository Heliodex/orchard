<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiFetch, selectedOrganization, toasts, uploadsEnabled } from '$lib/stores';
	import {
		Github,
		Container,
		Database,
		ArrowRight,
		Image as ImageIcon,
		ImagePlus
	} from 'lucide-svelte';
	import { springHover, motionStagger, springPop } from '$lib/utils/motion.svelte';
	import { Button } from '$lib/components/ui';

	const orgSlug = $derived($page.params.orgSlug);
	const selectedOrgId = $derived($selectedOrganization?.id ?? '');

	const ICON_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
	const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

	let name = $state('');
	let submitting = $state(false);
	let nameInput = $state<HTMLInputElement | null>(null);

	let iconInput = $state<HTMLInputElement | null>(null);
	let bannerInput = $state<HTMLInputElement | null>(null);
	let iconFile = $state<File | null>(null);
	let bannerFile = $state<File | null>(null);
	let iconPreview = $state('');
	let bannerPreview = $state('');

	const glowSrc = $derived(bannerPreview || iconPreview);

	type ResourceType = 'github' | 'image' | 'database';
	let selected = $state<ResourceType | null>(null);
	const resources: Array<{
		id: ResourceType;
		label: string;
		desc: string;
		icon: typeof Github;
		color: string;
	}> = [
		{
			id: 'github',
			label: 'GitHub repository',
			desc: 'Build from a repo',
			icon: Github,
			color: '#6e5494'
		},
		{
			id: 'image',
			label: 'Docker image',
			desc: 'Deploy a container',
			icon: Container,
			color: '#2496ed'
		},
		{
			id: 'database',
			label: 'Database',
			desc: 'Managed Postgres',
			icon: Database,
			color: '#f59e0b'
		}
	];

	onMount(() => nameInput?.focus());

	function pickFile(e: Event, types: string[], maxMb: number, set: (f: File, url: string) => void) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!types.includes(file.type)) {
			toasts.add({
				title: 'Invalid file type',
				description: 'Use JPEG, PNG, GIF or WebP',
				color: 'error'
			});
			input.value = '';
			return;
		}
		if (file.size > maxMb * 1024 * 1024) {
			toasts.add({ title: 'File too large', description: `Max ${maxMb}MB`, color: 'error' });
			input.value = '';
			return;
		}
		set(file, URL.createObjectURL(file));
	}

	async function uploadAsset(projectId: string, file: File, path: 'icon' | 'background-image') {
		const fd = new FormData();
		fd.append('file', file);
		const res = await apiFetch(`/apiv1/projects/${projectId}/${path}`, {
			method: 'POST',
			body: fd
		});
		if (!res.ok) throw new Error();
	}

	async function submit() {
		const trimmed = name.trim();
		if (!trimmed || submitting) return;
		submitting = true;
		try {
			const res = await apiFetch('/apiv1/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: trimmed, organizationId: selectedOrgId })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.message || "Couldn't create project");
			}
			const proj = await res.json();
			try {
				if (iconFile) await uploadAsset(proj.id, iconFile, 'icon');
				if (bannerFile) await uploadAsset(proj.id, bannerFile, 'background-image');
			} catch {
				toasts.add({ title: 'Project created, but an image upload failed', color: 'error' });
			}
			const base = `/${orgSlug}/projects/${proj.slug}`;
			if (selected === 'github') goto(`${base}/deployments/new?source=github`);
			else if (selected === 'image') goto(`${base}/deployments/new?source=image`);
			else if (selected === 'database') goto(`${base}/databases/new`);
			else goto(base);
		} catch (e) {
			toasts.add({
				title: e instanceof Error ? e.message : "Couldn't create project",
				color: 'error'
			});
			submitting = false;
		}
	}
</script>

<div class="np-page">
	{#if glowSrc}
		{#key glowSrc}
			<div class="np-glow" aria-hidden="true">
				<div
					class="np-glow-layer np-glow-layer--1"
					style="background-image: url({JSON.stringify(glowSrc)});"
				></div>
				<div
					class="np-glow-layer np-glow-layer--2"
					style="background-image: url({JSON.stringify(glowSrc)});"
				></div>
				<div
					class="np-glow-layer np-glow-layer--3"
					style="background-image: url({JSON.stringify(glowSrc)});"
				></div>
				<div class="np-glow-fade"></div>
			</div>
		{/key}
	{/if}
	<form
		class="np-form"
		class:np-form--glass={glowSrc}
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
	>
		<div class="np-head" {@attach motionStagger({ index: 0, from: { y: 14 } })}>
			<button
				type="button"
				class="np-banner"
				class:np-banner--set={bannerPreview}
				style={bannerPreview ? `background-image: url(${bannerPreview})` : ''}
				disabled={!$uploadsEnabled}
				onclick={() => bannerInput?.click()}
				{@attach springPop(() => !!bannerPreview)}
			>
				{#if !bannerPreview && $uploadsEnabled}
					<ImageIcon size={15} />
					<span>Add a banner</span>
				{/if}
			</button>
			<div class="np-id">
				<button
					type="button"
					class="np-icon-edit"
					disabled={!$uploadsEnabled}
					onclick={() => iconInput?.click()}
					{@attach springPop(() => !!iconPreview)}
				>
					{#if iconPreview}
						<img src={iconPreview} alt="" />
					{:else}
						<ImagePlus size={20} />
					{/if}
				</button>
				<input
					bind:this={nameInput}
					bind:value={name}
					class="np-name"
					placeholder="Project name"
					autocomplete="off"
					spellcheck="false"
				/>
			</div>
		</div>

		<input
			bind:this={bannerInput}
			type="file"
			accept="image/jpeg,image/png,image/webp"
			hidden
			onchange={(e) =>
				pickFile(e, BANNER_TYPES, 8, (f, url) => {
					bannerFile = f;
					bannerPreview = url;
				})}
		/>
		<input
			bind:this={iconInput}
			type="file"
			accept="image/jpeg,image/png,image/gif,image/webp"
			hidden
			onchange={(e) =>
				pickFile(e, ICON_TYPES, 2, (f, url) => {
					iconFile = f;
					iconPreview = url;
				})}
		/>

		<div class="np-starter">
			<span class="np-starter-label" {@attach motionStagger({ index: 1, from: { y: 10 } })}
				>Start with</span
			>
			<div class="np-grid">
				{#each resources as r, i (r.id)}
					{@const Icon = r.icon}
					<button
						type="button"
						class="np-card"
						class:np-card--on={selected === r.id}
						onclick={() => (selected = selected === r.id ? null : r.id)}
						{@attach motionStagger({ index: 2 + i, from: { y: 12 } })}
						{@attach springHover({ lift: -2 })}
					>
						<div
							class="np-cicon"
							style="background: color-mix(in srgb, {r.color} 12%, transparent);"
							{@attach springPop(() => selected === r.id)}
						>
							<Icon size={17} style="color: {r.color}" />
						</div>
						<span class="np-clabel">{r.label}</span>
						<span class="np-cdesc">{r.desc}</span>
					</button>
				{/each}
			</div>
		</div>

		<Button
			variant="primary"
			type="submit"
			class="np-submit"
			disabled={!name.trim() || submitting}
			loading={submitting}
			{@attach motionStagger({ index: 5, from: { y: 10 } })}
			{@attach springHover({ lift: -1 })}
		>
			{#if !submitting}
				{selected ? 'Continue' : 'Create project'} <ArrowRight size={16} />
			{/if}
		</Button>
	</form>
</div>

<style>
	.np-page {
		position: relative;
		min-height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3.5rem 2.5rem;
		overflow: hidden;
	}

	.np-glow {
		position: absolute;
		inset: -10%;
		pointer-events: none;
		overflow: hidden;
		z-index: 0;
		transform-origin: 50% 50%;
		animation: np-glow-in 1100ms cubic-bezier(0.34, 1.32, 0.5, 1) both;
		contain: layout style paint;
	}
	@keyframes np-glow-in {
		0% {
			opacity: 0;
			transform: scale(0.72);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.np-glow-layer {
		position: absolute;
		inset: -40%;
		background-size: cover;
		background-position: center;
		filter: blur(100px) saturate(1.55);
		will-change: transform;
		transform-origin: 50% 50%;
		contain: strict;
	}
	.np-glow-layer--1 {
		transform: scale(2) rotate(0deg);
		animation: np-spin-a 32s linear infinite;
		opacity: 0.5;
	}
	.np-glow-layer--2 {
		transform: scale(2.5) translate(8%, -6%) rotate(70deg);
		animation: np-spin-b 48s linear infinite;
		opacity: 0.3;
	}
	.np-glow-layer--3 {
		transform: scale(3) translate(-10%, 9%) rotate(140deg);
		animation: np-spin-c 64s linear infinite;
		opacity: 0.22;
	}
	.np-glow-fade {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(72% 68% at 50% 50%, rgba(0, 0, 0, 0) 0%, var(--center-channel-bg) 84%),
			linear-gradient(
				180deg,
				var(--center-channel-bg) 0%,
				rgba(0, 0, 0, 0) 18%,
				rgba(0, 0, 0, 0) 82%,
				var(--center-channel-bg) 100%
			);
	}
	@keyframes np-spin-a {
		from {
			transform: scale(2) rotate(0deg);
		}
		to {
			transform: scale(2) rotate(360deg);
		}
	}
	@keyframes np-spin-b {
		from {
			transform: scale(2.5) translate(8%, -6%) rotate(70deg);
		}
		to {
			transform: scale(2.5) translate(8%, -6%) rotate(430deg);
		}
	}
	@keyframes np-spin-c {
		from {
			transform: scale(3) translate(-10%, 9%) rotate(140deg);
		}
		to {
			transform: scale(3) translate(-10%, 9%) rotate(-220deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.np-glow-layer--1,
		.np-glow-layer--2,
		.np-glow-layer--3 {
			animation: none;
		}
	}

	.np-form {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 32rem;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
		padding: 1.5rem;
		border-radius: var(--radius-xl);
		border: 1px solid transparent;
		transition:
			background var(--dur-base) ease,
			backdrop-filter var(--dur-base) ease,
			border-color var(--dur-base) ease,
			box-shadow var(--dur-base) ease;
	}

	.np-form--glass {
		background: color-mix(in srgb, var(--center-channel-bg) 60%, transparent);
		backdrop-filter: blur(22px) saturate(1.4);
		-webkit-backdrop-filter: blur(22px) saturate(1.4);
		border-color: color-mix(in srgb, var(--center-channel-color) 12%, transparent);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.12),
			inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent);
	}

	.np-form--glass::before {
		content: '';
		position: absolute;
		top: 0;
		left: 12%;
		right: 12%;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, #fff 70%, transparent),
			transparent
		);
		pointer-events: none;
	}

	:global(.dark) .np-form--glass {
		background: color-mix(in srgb, var(--center-channel-bg) 55%, transparent);
		border-color: color-mix(in srgb, #fff 10%, transparent);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.35),
			inset 0 1px 0 color-mix(in srgb, #fff 8%, transparent);
	}

	:global(.dark) .np-form--glass::before {
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, #fff 18%, transparent),
			transparent
		);
	}

	.np-head {
		display: flex;
		flex-direction: column;
	}

	.np-banner {
		width: 100%;
		height: 7rem;
		border-radius: var(--radius-md);
		border: 1px dashed var(--surface-border);
		background: color-mix(in srgb, var(--center-channel-color) 4%, transparent);
		background-size: cover;
		background-position: center;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: var(--surface-muted);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color var(--dur-fast),
			color var(--dur-fast);
	}

	.np-banner:hover {
		border-color: var(--sidebar-text-active-border);
		color: var(--center-channel-color);
	}

	.np-banner--set {
		border-style: solid;
	}

	.np-id {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		margin: -1.75rem 0 0 1.25rem;
		padding-right: 1.25rem;
	}

	.np-icon-edit {
		flex-shrink: 0;
		width: 4rem;
		height: 4rem;
		border-radius: var(--radius-xl);
		border: 3px solid var(--center-channel-bg);
		background: color-mix(in srgb, var(--center-channel-color) 6%, var(--center-channel-bg));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--surface-muted);
		cursor: pointer;
		overflow: hidden;
		transition: color var(--dur-fast);
	}

	.np-icon-edit:hover {
		color: var(--center-channel-color);
	}

	.np-icon-edit img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.np-name {
		flex: 1;
		min-width: 0;
		align-self: flex-end;
		border: none;
		border-bottom: 2px solid var(--surface-border);
		background: transparent;
		color: var(--center-channel-color);
		font-size: var(--text-title-2);
		line-height: var(--lh-title-2);
		font-weight: 700;
		letter-spacing: -0.011em;
		padding: 0.35rem 0.25rem;
		transition: border-color var(--dur-fast) ease;
	}

	.np-name::placeholder {
		color: var(--surface-muted);
		opacity: 0.55;
	}

	.np-name:focus {
		outline: none;
		border-bottom-color: var(--button-bg);
	}

	.np-starter {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.np-starter-label {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
		letter-spacing: 0.06em;
		color: var(--surface-muted);
	}

	.np-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.np-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.875rem;
		border-radius: var(--radius-md);
		text-align: left;
		border: 1px solid var(--surface-border);
		background: var(--center-channel-bg);
		cursor: pointer;
		transition:
			border-color var(--dur-fast),
			box-shadow var(--dur-fast);
	}

	.np-card:hover {
		border-color: var(--sidebar-text-active-border);
	}

	.np-card--on {
		border-color: var(--sidebar-text-active-border);
		box-shadow: 0 0 0 1px var(--sidebar-text-active-border);
	}

	.np-cicon {
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.np-clabel {
		font-size: var(--text-caption);
		font-weight: 600;
		color: var(--center-channel-color);
		line-height: 1.2;
	}

	.np-cdesc {
		font-size: var(--text-micro);
		color: var(--surface-muted);
		line-height: 1.2;
	}

	.np-submit {
		align-self: flex-end;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	@media (max-width: 540px) {
		.np-grid {
			grid-template-columns: 1fr;
		}
	}
	:global(html.reduce-transparency) .np-form--glass {
		background: var(--bg-app);
	}
</style>

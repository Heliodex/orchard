<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiFetch, toasts } from '$lib/stores';
	import { ArrowLeft } from 'lucide-svelte';
	import { Progress } from 'melt/builders';
	import { Button, Field, Input } from '$lib/components/ui';
	import { cubicOut } from 'svelte/easing';
	import NumberFlow from '@number-flow/svelte';

	interface Workspace {
		id: string;
		name: string;
		slug: string;
		organization?: {
			slug: string;
		};
	}

	let workspace = $state<Workspace | null>(null);
	let loading = $state(true);
	let submitting = $state(false);
	let showingProgress = $state(false);
	let error = $state<string | null>(null);
	let formError = $state<string | null>(null);

	const PROGRESS_DURATION = 3000;
	let progressValue = $state(0);
	let progressAnimationFrame: number | null = null;
	const progress = new Progress();
	const value = $derived(Math.round(progressValue));

	function scaleConvert(value: number, from: [number, number], to: [number, number]) {
		const [minA, maxA] = from;
		const [minB, maxB] = to;
		return ((value - minA) / (maxA - minA)) * (maxB - minB) + minB;
	}

	function clamp(min: number, value: number, max: number) {
		return Math.min(Math.max(value, min), max);
	}

	function cancelProgressAnimation() {
		if (progressAnimationFrame) {
			cancelAnimationFrame(progressAnimationFrame);
			progressAnimationFrame = null;
		}
	}

	function startProgressAnimation() {
		if (typeof window === 'undefined') return;
		cancelProgressAnimation();
		progressValue = 0;

		const start = performance.now();

		const tick = (now: number) => {
			const elapsed = Math.min((now - start) / PROGRESS_DURATION, 1);
			progressValue = Math.min(100, cubicOut(elapsed) * 100);

			if (elapsed < 1 && showingProgress) {
				progressAnimationFrame = requestAnimationFrame(tick);
			} else {
				progressAnimationFrame = null;
			}
		};

		progressAnimationFrame = requestAnimationFrame(tick);
	}

	$effect(() => {
		if (typeof window === 'undefined') return;

		if (showingProgress) {
			startProgressAnimation();
		} else {
			cancelProgressAnimation();
			progressValue = 0;
		}

		return () => {
			cancelProgressAnimation();
		};
	});

	$effect(() => {
		progress.value = progressValue;
	});

	const dark = {
		h: 34,
		maxS: 81.01,
		s: () => Math.min(scaleConvert(value, [0, 60], [0, dark.maxS]), dark.maxS),
		minL: 65.1,
		l: () => clamp(dark.minL, scaleConvert(value, [0, 80], [100, dark.minL]), 100)
	};

	const darkClr = $derived(`hsl(${dark.h}, ${dark.s()}%, ${dark.l()}%)`);

	const light = {
		h: 34,
		maxS: 81.01,
		s: () => Math.min(scaleConvert(value, [0, 60], [0, light.maxS]), light.maxS),
		maxL: 65.1,
		l: () => clamp(40, scaleConvert(value, [0, 80], [0, light.maxL]), light.maxL)
	};

	const lightClr = $derived(`hsl(${light.h}, ${light.s()}%, ${light.l()}%)`);

	const clrClasses = 'text-[var(--light)] dark:text-[var(--dark)]';
	const bgClasses = 'bg-[var(--light)] dark:bg-[var(--dark)]';
	const clrStyle = $derived(`--light: ${lightClr}; --dark: ${darkClr};`);

	let name = $state('');
	let slug = $state('');
	let repositoryUrl = $state('');
	let description = $state('');
	let autoSlug = $state(true);

	const workspaceSlug = $derived($page.params.wsSlug);
	const orgSlug = $derived($page.params.orgSlug);

	// Auto-generate slug from name
	$effect(() => {
		if (autoSlug && name) {
			slug = name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');
		}
	});

	function handleSlugInput() {
		autoSlug = false;
	}

	async function fetchWorkspace() {
		loading = true;
		error = null;

		try {
			const response = await apiFetch(`/apiv1/workspaces/slug/${workspaceSlug}`);
			if (!response.ok) {
				throw new Error("Couldn't load workspace");
			}
			workspace = await response.json();
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't load workspace";
		} finally {
			loading = false;
		}
	}

	async function submit() {
		if (!workspace) {
			formError = 'Workspace not loaded';
			return;
		}

		if (!name.trim()) {
			formError = 'Enter a project name';
			return;
		}

		if (!slug.trim()) {
			formError = 'Enter a project slug';
			return;
		}

		submitting = true;
		showingProgress = true;
		formError = null;

		const fakeDelay = new Promise((resolve) => setTimeout(resolve, 3000));

		try {
			const response = await apiFetch('/apiv1/projects', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: name.trim(),
					slug: slug.trim(),
					description: description.trim() || undefined,
					repositoryUrl: repositoryUrl.trim() || undefined,
					workspaceId: workspace.id
				})
			});

			const data = await response.json().catch(() => ({}));

			if (!response.ok) {
				await fakeDelay;
				throw new Error(data.message || "Couldn't create project");
			}

			await fakeDelay;
			const project = data;

			toasts.add({
				title: 'Project created',
				description: `${project.name} is ready`,
				color: 'success'
			});

			goto(`/${orgSlug}/workspaces/${workspaceSlug}/projects/${project.slug}`);
		} catch (e) {
			await fakeDelay;
			formError = e instanceof Error ? e.message : "Couldn't create project";
			showingProgress = false;
		} finally {
			submitting = false;
		}
	}

	onMount(() => {
		fetchWorkspace();
	});
</script>

<div class="relative min-h-full">
	<div class="p-6">
		<button
			onclick={() => window.history.back()}
			class="mb-6 inline-flex items-center gap-2 text-sm cursor-pointer"
			style="color: var(--surface-muted);"
			onmouseenter={(e) => (e.currentTarget.style.color = 'var(--center-channel-color)')}
			onmouseleave={(e) => (e.currentTarget.style.color = 'var(--surface-muted)')}
		>
			<ArrowLeft class="h-4 w-4" />
			Back to workspace
		</button>

		{#if error}
			<div class="alert alert-error mb-6">{error}</div>
		{/if}

		{#if loading}
			<div class="mx-auto max-w-2xl space-y-6">
				<div
					class="rounded-3xl border p-6 shadow-sm"
					style="background-color: var(--surface-bg); border-color: var(--surface-border);"
				>
					<div class="skeleton" style="width: 3rem; height: 0.75rem; margin-bottom: 0.5rem;"></div>
					<div class="skeleton" style="width: 10rem; height: 1.5rem; margin-bottom: 0.5rem;"></div>
					<div class="skeleton" style="width: 14rem; height: 0.875rem;"></div>
				</div>
				<div class="card">
					<div class="card-body">
						<div style="display: flex; flex-direction: column; gap: 1.5rem;">
							{#each [1, 2, 3] as n (n)}
								<div>
									<div
										class="skeleton"
										style="width: 6rem; height: 0.875rem; margin-bottom: 0.5rem;"
									></div>
									<div
										class="skeleton"
										style="width: 100%; height: 2.5rem; border-radius: var(--radius-md);"
									></div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{:else if workspace}
			<div class="mx-auto max-w-2xl space-y-6">
				<div
					class="rounded-3xl border p-6 shadow-sm"
					style="background-color: var(--surface-bg); border-color: var(--surface-border); color: var(--center-channel-color);"
				>
					<p class="text-xs uppercase type-caps tracking-wide" style="color: var(--surface-muted);">
						Create
					</p>
					<h1 class="mt-1 text-2xl font-bold" style="color: var(--center-channel-color);">
						New project
					</h1>
					<p class="mt-2 text-sm" style="color: var(--surface-muted);">
						Create a new project in {workspace.name}
					</p>
				</div>

				{#if formError}
					<div class="alert alert-error">{formError}</div>
				{/if}

				<div class="card">
					<div class="card-body">
						<div class="relative">
							<div class={['space-y-6', showingProgress ? 'opacity-0' : '']}>
								<Field label="Project name" for="name">
									<Input id="name" bind:value={name} placeholder="My Project" />
								</Field>

								<Field label="Project slug" for="slug" hint="Used in URLs and the namespace name">
									<Input
										id="slug"
										bind:value={slug}
										oninput={handleSlugInput}
										placeholder="my-project"
										class="type-ident"
									/>
								</Field>

								<Field label="Repository URL (optional)" for="repositoryUrl">
									<Input
										id="repositoryUrl"
										bind:value={repositoryUrl}
										placeholder="https://github.com/org/repo"
										class="type-ident"
									/>
								</Field>

								<Field label="Description (optional)" for="description">
									<textarea
										id="description"
										bind:value={description}
										placeholder="A brief description of this project"
										rows="3"
										class="input"></textarea>
								</Field>

								{#if slug && workspace.organization}
									<div
										class="rounded-2xl border p-4"
										style="background-color: var(--control-bg); border-color: var(--surface-border); color: var(--center-channel-color);"
									>
										<p class="text-sm font-medium" style="color: var(--center-channel-color);">
											Namespace preview
										</p>
										<code
											class="mt-1 block text-sm font-sans type-ident"
											style="color: var(--link-color);"
										>
											{workspace.organization.slug}-{workspace.slug}-{slug}
										</code>
									</div>
								{/if}

								<div
									class="flex items-center justify-end gap-3 pt-4 border-t"
									style="border-color: var(--surface-border);"
								>
									<Button variant="secondary" href="/{orgSlug}/workspaces/{workspaceSlug}">
										Cancel
									</Button>
									<Button variant="primary" onclick={submit} loading={submitting}>
										Create project
									</Button>
								</div>
							</div>

							{#if showingProgress}
								<div
									class="absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
									style="background-color: var(--center-channel-bg);"
								>
									<div class="flex flex-col items-center gap-2" style={clrStyle}>
										<span
											class="origin-bottom font-semibold"
											style={`color: var(--link-color); scale: ${scaleConvert(value, [0, 100], [1, 2])};`}
										>
											<NumberFlow {value} suffix="%" />
										</span>
										<div
											{...progress.root}
											class="relative w-[300px] overflow-hidden rounded-full"
											style="background-color: var(--surface-border);"
											style:height={`${scaleConvert(value, [0, 100], [8, 24])}px`}
										>
											<div
												{...progress.progress}
												class="h-full rounded-full"
												style={`width: ${progressValue}%; transition: width var(--dur-fast) linear; background-color: var(--link-color);`}
											></div>
										</div>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

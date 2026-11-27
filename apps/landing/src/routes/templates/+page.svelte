<script lang="ts">
	import { ArrowUpRight, GitPullRequest, Search } from 'lucide-svelte';
	import Logo from '$lib/components/Logo.svelte';
	import WaveEdge from '$lib/components/WaveEdge.svelte';
	import Closing from '$lib/components/Closing.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import TemplatePreview from '$lib/components/TemplatePreview.svelte';
	import CopyChip from '$lib/components/CopyChip.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import { links } from '$lib/links';
	import { hover, reveal } from '$lib/motion.svelte';
	import { search } from '$lib/search';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	let category = $state<string | null>(null);

	const categories = $derived(
		[...new Set(data.templates.map((t) => t.category).filter(Boolean))].sort() as string[]
	);

	const shown = $derived.by(() => {
		const pool = data.templates.filter((t) => !category || t.category === category);
		return search(pool, query);
	});

	const authors = $derived(new Set(data.templates.map((t) => t.author).filter(Boolean)).size);
	const STEPS = [
		{
			title: 'Write it',
			body: 'Add <code>registry/templates/&lt;name&gt;.yaml</code> and set <code>metadata.author</code> to your GitHub login. A <code>.md</code> readme and a <code>.png</code> preview next to it are optional.'
		},
		{
			title: 'Validate it',
			body: 'Run the validator, then deploy it on a real instance once.'
		},
		{
			title: 'Open a pull request',
			body: 'Commit as <code>feat(templates): add &lt;name&gt;</code>. CI validates, a merge publishes. Released versions never change, so bump the version to ship an edit.'
		}
	];

	const SUBMIT = [
		{ kind: 'cmd', text: 'ls registry/templates' },
		{ kind: 'dim', text: 'ghost.yaml  ghost.md' },
		{ kind: 'cmd', text: 'go run -C apps/registry . validate -templates ../../registry/templates' },
		{ kind: 'ok', text: 'ghost  1.0.0  registry/templates/ghost.yaml' },
		{ kind: 'cmd', text: 'git commit -am "feat(templates): add ghost"' },
		{ kind: 'cmd', text: 'gh pr create --fill' },
		{ kind: 'ok', text: 'https://github.com/hackclub/orchard/pull/812' }
	] as const;

	const PATHS = [
		{ label: 'Catalogue', path: '/templates/index.json' },
		{ label: 'Template', path: '/templates/<name>/index.json' },
		{ label: 'Version', path: '/templates/<name>/<version>/template.yaml' },
		{ label: 'Latest', path: '/templates/<name>/latest/template.yaml' }
	];

	const fetchLines = $derived([
		{
			kind: 'cmd',
			text: `curl -s ${data.registry}/templates/index.json | jq -r '.templates[].name'`
		},
		...data.templates.slice(0, 6).map((t) => ({ kind: 'dim', text: t.name }) as const),
		{
			kind: 'cmd',
			text: `curl -sL ${data.registry}/templates/${data.templates[0]?.name ?? 'ghost'}/latest/template.yaml`
		},
		{ kind: 'dim', text: 'apiVersion: leaf/v1' },
		{ kind: 'dim', text: 'kind: Template' },
		{ kind: 'dim', text: 'metadata:' },
		{ kind: 'dim', text: `  name: ${data.templates[0]?.name ?? 'ghost'}` }
	] as const);
</script>

<Seo
	title="Templates · Orchard"
	description="One-click stacks for Orchard, built in and contributed by the community. Deploy a blog, a database, a whole app with its pieces wired together."
/>

<header class="relative isolate overflow-hidden bg-crimson text-white">
	<div class="shell pt-8">
		<nav class="flex items-center justify-between gap-4" aria-label="Main">
			<a
				href="/"
				aria-label="Orchard home"
				class="rounded-sm focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-cream"
			>
				<Logo />
			</a>
			<a href={links.install} class="pill pill-sm">Install Orchard</a>
		</nav>

		<div
			class="mx-auto flex max-w-[860px] flex-col items-center pt-[clamp(4rem,11vh,7rem)] pb-[clamp(7rem,15vh,9.5rem)] text-center"
		>
			<p class="title-in eyebrow">
				{data.templates.length} templates{authors ? ` · ${authors} contributors` : ''}
			</p>
			<h1 class="title-in title mt-6">templates</h1>
			<div class="title-in mt-10 flex flex-wrap justify-center gap-3" style:animation-delay="0.3s">
				<a href="#gallery" class="pill pill-sm">Browse the gallery</a>
				<a href="#submit" class="ghost-button">
					<GitPullRequest size={16} aria-hidden="true" /> Submit yours
				</a>
			</div>
		</div>
	</div>
	<WaveEdge fill="#ffdfe3" class="absolute inset-x-0 bottom-0" />
</header>

<main>
	<section
		id="gallery"
		class="shell scroll-mt-6 pt-[clamp(3rem,6vw,80px)] pb-[clamp(2rem,4vw,50px)]"
		aria-labelledby="gallery-title"
	>
		<h2 id="gallery-title" class="sr-only">Gallery</h2>

		<div {@attach reveal()} class="toolbar">
			<label class="search">
				<Search size={18} aria-hidden="true" />
				<input
					type="search"
					bind:value={query}
					placeholder="Search templates"
					aria-label="Search templates"
				/>
			</label>
			{#if categories.length}
				<div class="chips" role="group" aria-label="Filter by category">
					<button
						type="button"
						class="chip"
						class:on={category === null}
						onclick={() => (category = null)}
					>
						all
					</button>
					{#each categories as c (c)}
						<button
							type="button"
							class="chip"
							class:on={category === c}
							onclick={() => (category = category === c ? null : c)}
						>
							{c}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		{#if data.error}
			<p {@attach reveal()} class="empty">The registry did not answer. Try again in a minute.</p>
		{:else if !shown.length}
			<p {@attach reveal()} class="empty">
				{data.templates.length ? 'No matches.' : 'Nothing published yet.'}
			</p>
		{:else}
			<ul class="gallery mt-8">
				{#each shown as t (t.name)}
					<li>
						<a href="/templates/{t.name}" {@attach hover()} class="card">
							<TemplatePreview
								name={t.name}
								displayName={t.displayName}
								author={t.author ?? t.addedBy?.login ?? t.addedBy?.name}
								version={t.version}
								resources={t.resources ?? []}
								description={t.description}
								icon={t.iconUrl ? `${data.registry}/${t.iconUrl}` : undefined}
								href="/templates/{t.name}"
								summary
							/>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section id="submit" class="scroll-mt-24 py-[clamp(4rem,8vw,120px)]">
		<div class="shell grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
			<div class="lg:col-span-5">
				<h2 {@attach reveal()} class="h2">Submit a template</h2>
				<ol class="mt-7 flex flex-col">
					{#each STEPS as step, i (step.title)}
						<li {@attach reveal({ index: i + 2 })} class="row">
							<h3 class="font-semibold text-crimson-deep">{step.title}</h3>
							<p class="mt-1 max-w-[52ch] text-pretty text-crimson-deep">
								{@html step.body}
							</p>
						</li>
					{/each}
				</ol>
				<div {@attach reveal({ index: 5 })} class="mt-6 flex flex-wrap items-center gap-3">
					<a
						href={links.submitTemplate}
						{@attach hover()}
						class="pill-solid px-5 py-3 font-semibold"
					>
						Read the contributor guide <ArrowUpRight size={18} strokeWidth={2} aria-hidden="true" />
					</a>
					<a href={links.templateReference} class="textlink">
						Template reference <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
					</a>
				</div>
			</div>
			<div {@attach reveal({ index: 2, y: 24 })} class="lg:col-span-7">
				<Terminal cwd="~/orchard" lines={SUBMIT} />
			</div>
		</div>
	</section>

	<section id="api" class="scroll-mt-24 pt-[clamp(1rem,3vw,40px)] pb-[clamp(5rem,9vw,140px)]">
		<div class="shell grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
			<div {@attach reveal({ y: 24 })} class="order-2 lg:order-1 lg:col-span-7">
				<Terminal cwd="~" lines={fetchLines} />
			</div>
			<div class="order-1 lg:order-2 lg:col-span-5">
				<h2 {@attach reveal()} class="h2">Registry</h2>
				<ul class="mt-7 flex flex-col">
					{#each PATHS as p, i (p.label)}
						<li {@attach reveal({ index: i + 2 })} class="row">
							<h3 class="font-semibold text-crimson-deep">{p.label}</h3>
							<p class="mt-1 font-mono text-[0.85rem] break-all text-crimson-deep">
								{data.registry}{p.path}
							</p>
						</li>
					{/each}
				</ul>
				<div {@attach reveal({ index: 6 })} class="mt-6 flex flex-wrap items-center gap-3">
					<CopyChip
						text="TEMPLATE_REGISTRY_URL={data.registry}"
						label="Copy the self-host setting"
						class="chip-white"
					/>
					<span class="text-crimson-deep">For self-hosted instances.</span>
				</div>
			</div>
		</div>
	</section>
</main>

<div class="bg-crimson pt-[46px]">
	<hr class="h-1 border-0 bg-blush" />
	<Closing />
	<hr class="h-1 border-0 bg-blush" />
	<Footer />
</div>

<style>
	.title {
		font-size: clamp(4.5rem, 13vw, 10.5rem);
		line-height: 0.9;
		font-weight: 800;
		letter-spacing: -0.019em;
	}

	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		letter-spacing: 0.02em;
		opacity: 0.85;
	}

	.title-in {
		animation: title-in 1.1s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.title.title-in {
		animation-name: title-focus;
		animation-duration: 1.4s;
		animation-delay: 0.1s;
	}

	@keyframes title-in {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}

	@keyframes title-focus {
		from {
			opacity: 0;
			letter-spacing: 0.06em;
			filter: blur(10px);
		}
	}

	.ghost-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 8px;
		padding: 10px 14px;
		font-size: 1rem;
		color: #fff;
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.4);
		transition: background-color 0.18s ease;
	}

	.ghost-button:hover {
		background: rgb(255 255 255 / 0.12);
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.25rem;
		color: var(--color-crimson-deep);
	}

	.search {
		display: flex;
		flex: 1 1 260px;
		align-items: center;
		gap: 0.6rem;
		border-radius: 12px;
		padding: 0.7rem 1rem;
		background: rgb(255 255 255 / 0.62);
		box-shadow: inset 0 0 0 1px rgb(195 16 38 / 0.12);
	}

	.search:focus-within {
		background: #fff;
		box-shadow: inset 0 0 0 2px var(--color-crimson-deep);
	}

	.search input {
		flex: 1;
		min-width: 0;
		background: transparent;
		font-size: 1rem;
		outline: none;
	}

	.search input::placeholder {
		color: rgb(195 16 38 / 0.5);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip {
		border-radius: 999px;
		padding: 0.4rem 0.85rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		background: rgb(255 255 255 / 0.5);
		box-shadow: inset 0 0 0 1px rgb(195 16 38 / 0.12);
		transition:
			background-color 0.18s ease,
			color 0.18s ease;
	}

	.chip:hover {
		background: #fff;
	}

	.chip.on {
		background: var(--color-crimson-deep);
		color: #fff;
	}

	.chip:focus-visible {
		outline: 2px solid var(--color-crimson-deep);
		outline-offset: 2px;
	}

	.empty {
		margin-top: 3rem;
		text-align: center;
		font-size: 1.1rem;
		color: var(--color-crimson-deep);
	}

	.gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
		gap: 1rem;
	}

	.card {
		display: block;
		height: 100%;
		border-radius: 14px;
	}

	.card:focus-visible {
		outline: 2px solid var(--color-crimson-deep);
		outline-offset: 4px;
	}

	.h2 {
		font-size: clamp(2rem, 3.6vw, 3rem);
		line-height: 1.08;
		font-weight: 700;
		letter-spacing: -0.011em;
		text-wrap: balance;
		color: var(--color-crimson-deep);
	}

	.row {
		border-top: 2px solid rgb(195 16 38 / 0.15);
		padding-block: 1rem;
	}

	.row :global(code) {
		font-family: var(--font-mono);
		font-size: 0.88em;
	}

	.textlink {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		border-radius: 8px;
		padding: 0.625rem 0.5rem;
		font-weight: 600;
		color: var(--color-crimson-deep);
		text-decoration: underline;
		text-decoration-color: rgb(195 16 38 / 0.4);
		text-underline-offset: 4px;
	}

	.textlink:hover {
		text-decoration-color: var(--color-crimson-deep);
	}

	:global(.chip-white) {
		background: #fff;
		color: var(--color-crimson-deep);
		box-shadow: 0 0 0 1px rgb(249 68 90 / 0.15);
	}

	:global(.chip-white:hover) {
		background: rgb(255 255 255 / 0.7);
	}
</style>

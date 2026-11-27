<script lang="ts">
	import { ArrowUpRight, Hammer, Search } from 'lucide-svelte';
	import Logo from '$lib/components/Logo.svelte';
	import WaveEdge from '$lib/components/WaveEdge.svelte';
	import Closing from '$lib/components/Closing.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import TemplatePreview from '$lib/components/TemplatePreview.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import { links } from '$lib/links';
	import { hover, reveal } from '$lib/motion.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');

	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return data.grafts;
		return data.grafts.filter((g) =>
			`${g.id} ${g.name} ${g.description} ${g.publisher}`.toLowerCase().includes(q)
		);
	});

	const example = $derived(data.grafts[0]?.id ?? 'announcements');

	const INSTALL_STEPS = [
		{
			title: 'Pick one you trust',
			body: 'A graft runs inside Orchard with the same access Orchard has, including your database and cluster. Install what you would be happy to run as Orchard itself.'
		},
		{
			title: 'Add it',
			body: 'Run <code>orchardctl graft add &lt;id&gt;</code> on your Orchard host. It checks the signature, the Orchard version and the database changes before anything moves.'
		},
		{
			title: 'Roll it out',
			body: 'Pass <code>--apply</code> and Orchard restarts the same way an upgrade does, with no downtime. GitOps setups put the same entry in their Helm values.'
		}
	];

	const installLines = $derived([
		{ kind: 'cmd', text: `sudo orchardctl graft add ${example} --apply` },
		{
			kind: 'dim',
			text: `Install ${data.grafts[0]?.name ?? 'Announcements'} ${data.grafts[0]?.latest ?? '0.1.0'}`
		},
		{ kind: 'dim', text: '  Only install grafts you trust.' },
		{ kind: 'dim', text: '  Signed by Orchard.' },
		{ kind: 'dim', text: '  asks for:  db, audit' },
		{ kind: 'dim', text: '  database:  1 migrations rehearsed (ok)' },
		{ kind: 'cmd', text: 'Install? [y/N] y' },
		{ kind: 'ok', text: 'deployment "server" successfully rolled out' }
	] as const);

	const BUILD_STEPS = [
		{
			title: 'Scaffold it',
			body: 'A graft is a NestJS module for the API, a Svelte island for the UI and plain SQL for its own database schema.'
		},
		{
			title: 'Run it against your Orchard',
			body: '<code>graft dev</code> rebuilds on save into a folder your local Orchard loads.'
		},
		{
			title: 'Pack and sign it',
			body: '<code>graft pack</code> hashes every file, signs the list, and prints the Helm entry to install it.'
		}
	];

	const BUILD = [
		{ kind: 'cmd', text: 'graft init snippets && cd snippets' },
		{ kind: 'dim', text: 'created snippets: run graft dev inside it' },
		{ kind: 'cmd', text: 'graft dev' },
		{ kind: 'ok', text: 'graft dev: rebuilt snippets' },
		{ kind: 'cmd', text: 'graft pack --key ~/.config/graft/key.pem' },
		{ kind: 'ok', text: 'packed snippets-0.1.0.graft (48 KiB, signed)' },
		{ kind: 'dim', text: 'digest sha256:5b23...521c' }
	] as const;
</script>

<Seo
	title="Extension Marketplace · Orchard"
	description="Grafts are Orchard's extensions. Add pages, APIs and integrations to your Orchard instance, installed with one command and rolled out like an upgrade."
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
				Grafts are Orchard's extensions · {data.grafts.length}
				{data.grafts.length === 1 ? 'graft' : 'grafts'}
			</p>
			<h1 class="title-in title mt-6">extensions</h1>
			<div class="title-in mt-10 flex flex-wrap justify-center gap-3" style:animation-delay="0.3s">
				<a href="#marketplace" class="pill pill-sm">Browse the marketplace</a>
				<a href="#build" class="ghost-button">
					<Hammer size={16} aria-hidden="true" /> Build a graft
				</a>
			</div>
		</div>
	</div>
	<WaveEdge fill="#ffdfe3" class="absolute inset-x-0 bottom-0" />
</header>

<main>
	<section
		id="marketplace"
		class="shell scroll-mt-6 pt-[clamp(3rem,6vw,80px)] pb-[clamp(2rem,4vw,50px)]"
		aria-labelledby="marketplace-title"
	>
		<h2 id="marketplace-title" class="sr-only">Extension Marketplace</h2>

		<div {@attach reveal()} class="toolbar">
			<label class="search">
				<Search size={18} aria-hidden="true" />
				<input
					type="search"
					bind:value={query}
					placeholder="Search grafts"
					aria-label="Search grafts"
				/>
			</label>
		</div>

		{#if data.error}
			<p {@attach reveal()} class="empty">The marketplace did not answer. Try again in a minute.</p>
		{:else if !shown.length}
			<p {@attach reveal()} class="empty">
				{data.grafts.length ? 'No matches.' : 'Nothing published yet.'}
			</p>
		{:else}
			<ul class="gallery mt-8">
				{#each shown as g (g.id)}
					<li>
						<a href="/extensions/{g.id}" {@attach hover()} class="card">
							<TemplatePreview
								name={g.id}
								displayName={g.name}
								author={g.publisher}
								version={g.latest}
								resources={[]}
								description={g.description}
								icon={g.icon ? `${data.registry}/${g.icon}` : undefined}
								href="/extensions/{g.id}"
								badge={g.tier === 'community' ? 'Community' : 'Official'}
								summary
							/>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section id="install" class="scroll-mt-24 py-[clamp(4rem,8vw,120px)]">
		<div class="shell grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
			<div class="lg:col-span-5">
				<h2 {@attach reveal()} class="h2">Install a graft</h2>
				<ol class="mt-7 flex flex-col">
					{#each INSTALL_STEPS as step, i (step.title)}
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
						href={links.graftsInstall}
						{@attach hover()}
						class="pill-solid px-5 py-3 font-semibold"
					>
						Read the install guide <ArrowUpRight size={18} strokeWidth={2} aria-hidden="true" />
					</a>
				</div>
			</div>
			<div {@attach reveal({ index: 2, y: 24 })} class="lg:col-span-7">
				<Terminal cwd="orchard-host" lines={installLines} />
			</div>
		</div>
	</section>

	<section id="build" class="scroll-mt-24 pt-[clamp(1rem,3vw,40px)] pb-[clamp(5rem,9vw,140px)]">
		<div class="shell grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
			<div {@attach reveal({ y: 24 })} class="order-2 lg:order-1 lg:col-span-7">
				<Terminal cwd="~/code" lines={BUILD} />
			</div>
			<div class="order-1 lg:order-2 lg:col-span-5">
				<h2 {@attach reveal()} class="h2">Build a graft</h2>
				<ol class="mt-7 flex flex-col">
					{#each BUILD_STEPS as step, i (step.title)}
						<li {@attach reveal({ index: i + 2 })} class="row">
							<h3 class="font-semibold text-crimson-deep">{step.title}</h3>
							<p class="mt-1 max-w-[52ch] text-pretty text-crimson-deep">
								{@html step.body}
							</p>
						</li>
					{/each}
				</ol>
				<div {@attach reveal({ index: 5 })} class="mt-6 flex flex-wrap items-center gap-3">
					<a href={links.graftsBuild} {@attach hover()} class="pill-solid px-5 py-3 font-semibold">
						Read the quickstart <ArrowUpRight size={18} strokeWidth={2} aria-hidden="true" />
					</a>
					<a href={links.graftsOverview} class="textlink">
						How grafts work <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
					</a>
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
</style>

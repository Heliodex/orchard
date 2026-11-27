<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import WaveEdge from '$lib/components/WaveEdge.svelte';
	import Closing from '$lib/components/Closing.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import CompareTable from '$lib/components/CompareTable.svelte';
	import { CHECKED, GLANCE, SECTIONS, VERSIONS } from '$lib/compare';
	import { links } from '$lib/links';

	const slug = (title: string) => title.toLowerCase().replace(/[^a-z]+/g, '-');
</script>

<Seo
	title="Compare self-hosted PaaS platforms (2026) · Orchard"
	description="Compare open-source, self-hosted platforms as a service (PaaS) feature by feature: Postgres backups and failover, network isolation, single sign-on, quotas and more, with a source for every answer."
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
			class="mx-auto flex max-w-[860px] flex-col items-center pt-[clamp(3rem,9vh,6rem)] pb-[clamp(6rem,13vh,8.5rem)] text-center"
		>
			<h1 class="title">compare</h1>
		</div>
	</div>
	<WaveEdge fill="#ffdfe3" class="absolute inset-x-0 bottom-0" />
</header>

<main>
	<section class="shell pt-[clamp(3rem,6vw,80px)]" aria-labelledby="start">
		<h2 id="start" class="heading">Start from a repo</h2>
		<p class="lead">
			Point Orchard at a repository. It finds each app inside, works out the framework, the commands
			and the port, and gives the app an HTTPS URL. The dashboard is simple enough for your first
			deploy, or you can ask an AI agent to do the whole thing.
		</p>
	</section>

	<section class="shell" aria-label="Summary">
		<CompareTable rows={GLANCE} caption="Self-hosted platforms compared" />
	</section>

	{#each SECTIONS as section (section.title)}
		<section class="shell pt-[clamp(3rem,6vw,72px)]" aria-labelledby={slug(section.title)}>
			<h2 id={slug(section.title)} class="heading">{section.title}</h2>
			<p class="lead">{section.lead}</p>
			<CompareTable rows={section.rows} caption={section.title} />
		</section>
	{/each}

	<section class="shell pt-10 pb-[clamp(4rem,8vw,120px)]">
		<div class="note">
			<p>
				Checked in {CHECKED} against {VERSIONS}, and the current Dokku release. Each answer links to
				its source. A dash means the project's documentation does not mention the feature.
			</p>
			<p>
				Something out of date? <a class="link" href={links.issues}>Open an issue</a> and we will fix
				it. Or <a class="link" href={links.install}>install Orchard</a> and try it.
			</p>
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
		font-size: clamp(4rem, 12vw, 9rem);
		line-height: 0.9;
		font-weight: 800;
		letter-spacing: -0.019em;
	}

	.heading {
		margin-bottom: 0.5rem;
		font-size: clamp(1.5rem, 2.4vw, 2rem);
		line-height: 1.2;
		font-weight: 700;
		color: var(--color-crimson-deep);
	}

	.lead {
		max-width: 680px;
		margin-bottom: 1.25rem;
		font-size: 1.05rem;
		line-height: 1.5;
		color: var(--color-crimson-deep);
		text-wrap: pretty;
	}

	.note {
		display: grid;
		gap: 0.5rem;
		max-width: 760px;
		font-size: 0.9rem;
		line-height: 1.5;
		color: rgb(195 16 38 / 0.75);
	}

	.link {
		font-weight: 600;
		text-decoration: underline;
		text-decoration-color: rgb(195 16 38 / 0.35);
		text-underline-offset: 3px;
	}

	.link:hover {
		text-decoration-color: currentColor;
	}
</style>

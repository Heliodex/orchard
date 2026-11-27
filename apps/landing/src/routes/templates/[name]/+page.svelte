<script lang="ts">
	import { ArrowLeft, ArrowUpRight } from 'lucide-svelte';
	import Logo from '$lib/components/Logo.svelte';
	import WaveEdge from '$lib/components/WaveEdge.svelte';
	import Closing from '$lib/components/Closing.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import TemplatePreview from '$lib/components/TemplatePreview.svelte';
	import CopyChip from '$lib/components/CopyChip.svelte';
	import TemplateForm from '$lib/components/TemplateForm.svelte';
	import { links } from '$lib/links';
	import { hover, reveal } from '$lib/motion.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const t = $derived(data.template);
	const yamlUrl = $derived(`${data.registry}/${data.latest.files['template.yaml'].path}`);
	const latestUrl = $derived(`${data.registry}/templates/${t.name}/latest/template.yaml`);
	const preview = $derived(data.latest.files['preview.png']?.path);
	const iconPath = $derived(
		Object.entries(data.latest.files).find(([k]) => k.startsWith('icon.'))?.[1].path
	);
	const iconUrl = $derived(iconPath ? `${data.registry}/${iconPath}` : undefined);
	const who = $derived(
		t.author ? { login: t.author, name: t.author } : (data.index.addedBy ?? null)
	);

	function day(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function defaultText(value: unknown) {
		if (value === undefined || value === null || value === '') return '';
		return typeof value === 'string' ? value : JSON.stringify(value);
	}
</script>

<Seo
	title="{t.displayName} · Templates · Orchard"
	description={t.description ?? `Deploy ${t.displayName} on Orchard.`}
	image={preview ? `${data.registry}/${preview}` : undefined}
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

		<div class="mx-auto max-w-[1100px] pt-[clamp(3rem,8vh,5.5rem)] pb-[clamp(6rem,13vh,8.5rem)]">
			<a href={links.templates} class="back title-in">
				<ArrowLeft size={16} aria-hidden="true" /> All templates
			</a>
			<div class="title-in mt-6 flex items-center gap-4" style:animation-delay="0.1s">
				{#if iconUrl}
					<img
						src={iconUrl}
						alt=""
						width="56"
						height="56"
						class="mark"
						loading="eager"
						decoding="async"
					/>
				{/if}
				<h1 class="title">{t.displayName}</h1>
			</div>
			{#if t.description}
				<p class="title-in lead mt-5" style:animation-delay="0.2s">{t.description}</p>
			{/if}
			<div class="title-in facts mt-6" style:animation-delay="0.25s">
				{#if who}
					<a
						href={who.login ? `https://github.com/${who.login}` : undefined}
						class="fact fact-link"
					>
						{#if who.login}
							<img
								src="https://github.com/{who.login}.png?size=48"
								alt=""
								width="22"
								height="22"
								loading="lazy"
								decoding="async"
							/>
						{/if}
						Added by {who.login ?? who.name}{data.index.addedAt
							? `, ${day(data.index.addedAt)}`
							: ''}
					</a>
				{/if}
				<span class="fact">v{t.version}</span>
				{#if t.license}
					<span class="fact">{t.license}</span>
				{/if}
				{#if t.category}
					<span class="fact">{t.category}</span>
				{/if}
				{#each t.tags as tag (tag)}
					<span class="fact fact-tag">#{tag}</span>
				{/each}
			</div>
			<div class="title-in mt-8 flex flex-wrap gap-3" style:animation-delay="0.3s">
				<a href={yamlUrl} {@attach hover()} class="pill pill-sm">Open the YAML</a>
				{#if t.homepage}
					<a href={t.homepage} class="ghost-button">
						Project site <ArrowUpRight size={16} aria-hidden="true" />
					</a>
				{/if}
				{#if data.index.source}
					<a href={data.index.source} class="ghost-button">
						View source <ArrowUpRight size={16} aria-hidden="true" />
					</a>
				{/if}
			</div>
		</div>
	</div>
	<WaveEdge fill="#ffdfe3" class="absolute inset-x-0 bottom-0" />
</header>

{#snippet head(id: string, title: string)}
	<h2 {id} class="h2">{title}</h2>
{/snippet}

<main class="shell pt-[clamp(3rem,6vw,80px)] pb-[clamp(5rem,9vw,140px)]">
	<div class="layout">
		<div class="column">
			<section {@attach reveal()} class="sec" aria-labelledby="resources-title">
				{@render head('resources-title', 'Resources')}
				<TemplatePreview
					name={t.name}
					displayName={t.displayName}
					author={who?.login ?? who?.name}
					version={t.version}
					resources={t.resources}
					icon={iconUrl}
					compact
				/>
				{#if preview}
					<img
						src="{data.registry}/{preview}"
						alt="Preview of {t.displayName}"
						class="preview"
						loading="lazy"
						decoding="async"
					/>
				{/if}
			</section>

			{#if t.parameters.length}
				<section {@attach reveal({ index: 1 })} class="sec" aria-labelledby="params-title">
					{@render head('params-title', 'Parameters')}
					<TemplateForm displayName={t.displayName} parameters={t.parameters} />
				</section>
			{/if}

			{#if data.readme}
				<section {@attach reveal({ index: 1 })} class="sec" aria-labelledby="readme-title">
					{@render head('readme-title', 'README')}
					<div class="prose">{@html data.readme}</div>
				</section>
			{/if}

			<section {@attach reveal({ index: 1 })} class="sec" aria-labelledby="yaml-title">
				{@render head('yaml-title', 'YAML')}
				<div class="term">
					<div class="term-bar">
						<span>{t.name}.yaml</span>
						<span>v{t.version}</span>
					</div>
					<pre class="term-body"><code>{data.yaml}</code></pre>
				</div>
			</section>
		</div>

		<aside class="column">
			<section {@attach reveal({ index: 1 })} class="sec" aria-labelledby="deploy-title">
				{@render head('deploy-title', 'Deploy')}
				<ol class="steps">
					<li>Open a project, choose <strong>New</strong>, then <strong>Templates</strong>.</li>
					<li>Pick <strong>{t.displayName}</strong> and deploy.</li>
				</ol>
				<CopyChip text="orchard template deploy" label="Copy the command" class="chip-white" />
			</section>

			<section {@attach reveal({ index: 2 })} class="sec" aria-labelledby="fetch-title">
				{@render head('fetch-title', 'Fetch')}
				<div class="flex flex-col gap-2">
					<CopyChip text={latestUrl} label="Copy the latest URL" class="chip-white" />
					<CopyChip text={yamlUrl} label="Copy the versioned URL" class="chip-white" />
				</div>
				<p class="text-[0.95rem] text-crimson-deep">
					<code class="mono">latest</code> resolves to the newest version.
				</p>
				<p class="mono break-all">sha256 {data.latest.files['template.yaml'].sha256}</p>
			</section>

			<section {@attach reveal({ index: 3 })} class="sec" aria-labelledby="versions-title">
				{@render head('versions-title', 'Versions')}
				<ul class="flex flex-col">
					{#each data.index.versions as v (v.version)}
						<li class="row flex justify-between gap-4">
							<a href="{data.registry}/{v.files['template.yaml'].path}" class="vlink"
								>v{v.version}</a
							>
							<span class="mono">{day(v.publishedAt)}</span>
						</li>
					{/each}
				</ul>
			</section>
		</aside>
	</div>
</main>

<div class="bg-crimson pt-[46px]">
	<hr class="h-1 border-0 bg-blush" />
	<Closing />
	<hr class="h-1 border-0 bg-blush" />
	<Footer />
</div>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		opacity: 0.85;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.mark {
		flex-shrink: 0;
		width: 56px;
		height: 56px;
		border-radius: 14px;
		object-fit: contain;
	}

	.title {
		font-size: clamp(2.4rem, 6vw, 4.5rem);
		line-height: 1;
		font-weight: 800;
		letter-spacing: -0.017em;
		text-wrap: balance;
	}

	.lead {
		max-width: 680px;
		font-size: clamp(1.05rem, 1.7vw, 1.3rem);
		line-height: 1.5;
		text-wrap: pretty;
		opacity: 0.92;
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.fact {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border-radius: 999px;
		padding: 0.3rem 0.75rem;
		background: rgb(255 255 255 / 0.14);
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.3);
	}

	.fact img {
		border-radius: 999px;
	}

	.fact-link:hover {
		background: rgb(255 255 255 / 0.28);
	}

	.fact-tag {
		background: transparent;
	}

	.title-in {
		animation: title-in 1.1s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes title-in {
		from {
			opacity: 0;
			transform: translateY(12px);
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

	.layout {
		display: grid;
		gap: 1rem;
		margin-inline: auto;
		max-width: 1100px;
	}

	@media (min-width: 960px) {
		.layout {
			grid-template-columns: minmax(0, 7fr) minmax(280px, 5fr);
			align-items: start;
		}
	}

	.column {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 1rem;
	}

	.sec {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.85rem;
		border-radius: 1.25rem;
		padding: 1.25rem;
		background: rgb(255 255 255 / 0.62);
		box-shadow: inset 0 0 0 1px rgb(195 16 38 / 0.12);
	}

	.h2 {
		font-size: clamp(1.35rem, 2vw, 1.6rem);
		line-height: 1.1;
		font-weight: 700;
		letter-spacing: -0.011em;
		color: var(--color-crimson-deep);
	}

	.preview {
		width: 100%;
		border-radius: 1rem;
		border: 4px solid var(--color-crimson);
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-left: 1.25rem;
		list-style: decimal;
		color: var(--color-crimson-deep);
	}

	.row {
		padding-block: 0.4rem;
	}

	.row + .row {
		border-top: 1px solid rgb(195 16 38 / 0.12);
	}

	.mono {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--color-crimson-deep);
	}

	.vlink {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--color-crimson-deep);
		text-decoration: underline;
		text-decoration-color: rgb(195 16 38 / 0.4);
		text-underline-offset: 4px;
	}

	.vlink:hover {
		text-decoration-color: var(--color-crimson-deep);
	}

	:global(.chip-white) {
		max-width: 100%;
		background: #fff;
		color: var(--color-crimson-deep);
		box-shadow: 0 0 0 1px rgb(249 68 90 / 0.15);
	}

	:global(.chip-white:hover) {
		background: rgb(255 255 255 / 0.7);
	}

	.term {
		overflow: hidden;
		border: 4px solid var(--color-crimson);
		border-radius: 1rem;
		background: var(--color-night-900);
		box-shadow: 0 40px 80px -40px rgb(120 0 20 / 0.55);
	}

	.term-bar {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid var(--color-night-700);
		padding: 0.75rem 1rem;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-night-300);
	}

	.term-body {
		overflow-x: auto;
		padding: 1.5rem;
		font-family: var(--font-mono);
		font-size: clamp(12px, 1.1vw, 13.5px);
		line-height: 1.7;
		color: var(--color-night-100);
	}

	.prose {
		font-size: 1rem;
		line-height: 1.6;
		color: var(--color-crimson-deep);
	}

	.prose :global(h1),
	.prose :global(h2),
	.prose :global(h3) {
		margin-top: 1.25em;
		font-weight: 700;
		line-height: 1.25;
		color: var(--color-crimson-deep);
	}

	.prose :global(h1) {
		font-size: 1.3rem;
	}

	.prose :global(h2) {
		font-size: 1.15rem;
	}

	.prose :global(h3) {
		font-size: 1.02rem;
	}

	.prose :global(p),
	.prose :global(ul),
	.prose :global(ol),
	.prose :global(pre),
	.prose :global(blockquote) {
		margin-top: 0.8em;
	}

	.prose :global(ul) {
		padding-left: 1.25rem;
		list-style: disc;
	}

	.prose :global(ol) {
		padding-left: 1.25rem;
		list-style: decimal;
	}

	.prose :global(a) {
		color: var(--color-crimson-deep);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.prose :global(code) {
		border-radius: 4px;
		padding: 0.1em 0.35em;
		background: rgb(255 255 255 / 0.6);
		font-family: var(--font-mono);
		font-size: 0.85em;
	}

	.prose :global(pre) {
		overflow-x: auto;
		border-radius: 12px;
		padding: 1rem;
		background: var(--color-night-900);
		color: var(--color-night-100);
	}

	.prose :global(pre code) {
		padding: 0;
		background: transparent;
		color: inherit;
	}

	.prose :global(img) {
		max-width: 100%;
		border-radius: 12px;
	}

	.prose :global(blockquote) {
		padding-left: 1rem;
		opacity: 0.85;
	}

	.prose :global(table) {
		margin-top: 0.8em;
		width: 100%;
		border-collapse: collapse;
		font-size: 0.92rem;
	}

	.prose :global(th),
	.prose :global(td) {
		padding: 0.4rem 0.6rem;
		text-align: left;
		border-bottom: 2px solid rgb(249 68 90 / 0.15);
	}
</style>

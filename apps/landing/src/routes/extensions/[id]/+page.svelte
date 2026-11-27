<script lang="ts">
	import { ArrowLeft, ArrowUpRight } from 'lucide-svelte';
	import Logo from '$lib/components/Logo.svelte';
	import WaveEdge from '$lib/components/WaveEdge.svelte';
	import Closing from '$lib/components/Closing.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import CopyChip from '$lib/components/CopyChip.svelte';
	import { links } from '$lib/links';
	import { hover, reveal } from '$lib/motion.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const m = $derived(data.manifest);
	const homepage = $derived(
		typeof m.homepage === 'string' && /^https:\/\//i.test(m.homepage) ? m.homepage : null
	);
	const community = $derived(data.tier === 'community');
	const v = $derived(data.latest);
	const caps = $derived(new Set(v.capabilities ?? m.capabilities ?? []));
	const schema = $derived(`ext_${m.id.replaceAll('-', '_')}`);
	const install = $derived(`sudo orchardctl graft add ${m.id}`);
	const helm = $derived(
		`grafts:\n  - id: ${m.id}\n    version: ${v.version}\n    digest: ${v.digest}`
	);

	function list(words: string[]) {
		if (words.length <= 1) return words.join('');
		return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
	}

	const asks = $derived.by(() => {
		const rows: { title: string; body: string }[] = [];
		const screens = m.ui?.screens ?? [];
		if (screens.length) {
			rows.push({
				title: screens.length === 1 ? 'A page in Orchard' : `${screens.length} pages in Orchard`,
				body: `At ${list(screens.map((s) => s.path))}.`
			});
		}
		const reads = Object.entries(m.database?.coreReads ?? {});
		if (caps.has('db')) {
			rows.push({
				title: 'Its own database tables',
				body: `Kept in the ${schema} schema.${reads.length ? ` Reads ${list(reads.map(([t, c]) => `${t} (${c.join(', ')})`))} from Orchard.` : ''}${m.database?.adopts?.length ? ` Takes over ${list(m.database.adopts)}, which older Orchard versions kept in their own schema.` : ''}`
			});
		}
		const kube = [
			caps.has('kube.apply') && 'creates and changes Kubernetes resources',
			caps.has('kube.informers') && 'watches the cluster',
			caps.has('kube.exec') && 'runs commands inside pods'
		].filter(Boolean) as string[];
		if (kube.length) rows.push({ title: 'Your cluster', body: `It ${list(kube)}.` });
		const net = [
			caps.has('http.upgrade') && 'opens websockets',
			caps.has('http.hostRouting') && 'serves its own hostnames'
		].filter(Boolean) as string[];
		if (net.length) rows.push({ title: 'Network', body: `It ${list(net)}.` });
		const features: [string, string][] = [
			['users.read', "people's names and emails"],
			['projects.read', 'apps and environments'],
			['projects.write', 'changes to apps and environments'],
			['github', 'GitHub'],
			['notifications', 'notifications'],
			['audit', 'the audit log'],
			['secrets', 'secret encryption'],
			['events', 'live updates'],
			['settings', 'instance settings'],
			['flags', 'feature flags'],
			['mcp', 'tools for AI agents'],
			['metrics', 'metrics'],
			['rateLimit', 'rate limits'],
			['storage', 'file uploads']
		];
		const used = features.filter(([cap]) => caps.has(cap)).map(([, label]) => label);
		if (used.length) rows.push({ title: 'Orchard features', body: `Uses ${list(used)}.` });
		const open = m.public?.routes ?? [];
		rows.push({
			title: open.length ? 'Open to anyone' : 'Behind sign-in',
			body: open.length
				? `${list(open)} answer without signing in.`
				: 'Every route it adds needs a signed-in user.'
		});
		return rows;
	});

	function day(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<Seo
	title="{m.name} · Extensions · Orchard"
	description={m.description ?? `${m.name}, a graft for Orchard.`}
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
			<a href={links.extensions} class="back title-in">
				<ArrowLeft size={16} aria-hidden="true" /> All extensions
			</a>
			<h1 class="title title-in mt-6" style:animation-delay="0.1s">{m.name}</h1>
			{#if m.description}
				<p class="title-in lead mt-5" style:animation-delay="0.2s">{m.description}</p>
			{/if}
			<div class="title-in facts mt-6" style:animation-delay="0.25s">
				{#if community}
					<span class="fact fact-tier">Community · by {data.publisher}</span>
				{:else}
					<span class="fact fact-tier">Official</span>
					<span class="fact">by {m.publisher}</span>
				{/if}
				<span class="fact">v{v.version}</span>
				{#if m.engines?.platform}
					<span class="fact">Orchard {m.engines.platform}</span>
				{/if}
			</div>
			{#if community}
				<p class="title-in note mt-6" style:animation-delay="0.28s">
					<strong>Not made by Orchard.</strong> Published by {data.publisher}{#if data.repo}&nbsp;(github.com/{data.repo}){/if}.
					It runs inside your Orchard with no sandbox. It can read your secrets and database, sign
					in as any user, and change the apps on your cluster. Orchard checked it when it was
					listed, but does not review its updates. Only install it if you would give {data.publisher}
					full control of your server.
				</p>
			{/if}
			{#if homepage || data.repo}
				<div class="title-in mt-8 flex flex-wrap gap-3" style:animation-delay="0.3s">
					{#if data.repo}
						<a href="https://github.com/{data.repo}" class="ghost-button">
							Source on GitHub <ArrowUpRight size={16} aria-hidden="true" />
						</a>
					{/if}
					{#if homepage && homepage !== `https://github.com/${data.repo}`}
						<a href={homepage} class="ghost-button">
							Project site <ArrowUpRight size={16} aria-hidden="true" />
						</a>
					{/if}
				</div>
			{/if}
		</div>
	</div>
	<WaveEdge fill="#ffdfe3" class="absolute inset-x-0 bottom-0" />
</header>

<main class="shell pt-[clamp(3rem,6vw,80px)] pb-[clamp(5rem,9vw,140px)]">
	<div class="layout">
		<div class="column">
			<section {@attach reveal()} class="sec" aria-labelledby="asks-title">
				<h2 id="asks-title" class="h2">What it gets</h2>
				<ul class="flex flex-col">
					{#each asks as row (row.title)}
						<li class="row">
							<h3 class="font-semibold text-crimson-deep">{row.title}</h3>
							<p class="mt-1 text-pretty text-crimson-deep">{row.body}</p>
						</li>
					{/each}
					<li class="row">
						<h3 class="font-semibold text-crimson-deep">Everything Orchard can reach</h3>
						<p class="mt-1 text-pretty text-crimson-deep">
							A graft runs inside Orchard with the same access Orchard has. The list above is what
							it says it needs, not a sandbox. Install it if you trust {community
								? data.publisher
								: m.publisher}.
						</p>
					</li>
				</ul>
			</section>

			{#if data.readme}
				<section {@attach reveal({ index: 1 })} class="sec" aria-labelledby="readme-title">
					<h2 id="readme-title" class="h2">README</h2>
					<div class="prose">{@html data.readme}</div>
				</section>
			{/if}
		</div>

		<aside class="column">
			<section {@attach reveal({ index: 1 })} class="sec" aria-labelledby="install-title">
				<h2 id="install-title" class="h2">Install</h2>
				<p class="text-crimson-deep">On your Orchard host:</p>
				<CopyChip text={install} label="Copy the install command" class="chip-white" />
				<p class="text-crimson-deep">Or in your Helm values:</p>
				<div class="term">
					<pre class="term-body"><code>{helm}</code></pre>
				</div>
				<a href={links.graftsInstall} class="textlink">
					Install guide <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
				</a>
			</section>

			<section {@attach reveal({ index: 2 })} class="sec" aria-labelledby="versions-title">
				<h2 id="versions-title" class="h2">Versions</h2>
				<ul class="flex flex-col">
					{#each data.index.versions as version (version.version)}
						<li class="row flex justify-between gap-4">
							<a href={version.url} {@attach hover()} class="vlink">v{version.version}</a>
							<span class="mono">{day(version.publishedAt)}</span>
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

	.fact-tier {
		background: #fff;
		color: var(--color-crimson-deep);
		font-weight: 700;
	}

	.note {
		max-width: 680px;
		font-size: 0.95rem;
		line-height: 1.5;
		text-wrap: pretty;
		opacity: 0.92;
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

	.textlink {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-weight: 600;
		color: var(--color-crimson-deep);
		text-decoration: underline;
		text-decoration-color: rgb(195 16 38 / 0.4);
		text-underline-offset: 4px;
	}

	:global(.chip-white) {
		background: #fff;
		color: var(--color-crimson-deep);
		box-shadow: 0 0 0 1px rgb(249 68 90 / 0.15);
	}
</style>

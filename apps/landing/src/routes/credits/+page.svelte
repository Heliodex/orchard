<script lang="ts">
	import { ArrowUpRight, FileText, Search } from 'lucide-svelte';
	import Logo from '$lib/components/Logo.svelte';
	import WaveEdge from '$lib/components/WaveEdge.svelte';
	import CreditPill from '$lib/components/CreditPill.svelte';
	import Closing from '$lib/components/Closing.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import credits from '$lib/credits.generated.json';
	import { links } from '$lib/links';
	import { hover, reveal } from '$lib/motion.svelte';
	import type { PageProps } from './$types';

	type Pkg = (typeof credits.packages)[number];
	type Family = 'MIT' | 'Apache' | 'ISC' | 'BSD' | 'Other';

	let { data }: PageProps = $props();

	const FAMILIES: Family[] = ['MIT', 'Apache', 'ISC', 'BSD', 'Other'];
	const PREVIEW = 40;

	const TYPEFACES = [
		{
			name: 'Allo',
			by: 'Josh Puckett, from Inter by Rasmus Andersson',
			role: 'The default typeface',
			url: 'https://allo.joshpuckett.me'
		},
		{
			name: 'Plus Jakarta Sans',
			by: 'Tokotype',
			role: 'The logotype, and a typeface you can choose',
			url: 'https://github.com/tokotype/PlusJakartaSans'
		},
		{
			name: 'Space Mono',
			by: 'Colophon Foundry',
			role: 'Code and numbers',
			url: 'https://github.com/googlefonts/spacemono'
		},
		{
			name: 'JetBrains Mono',
			by: 'JetBrains',
			role: 'Mono reading option',
			url: 'https://github.com/JetBrains/JetBrainsMono'
		},
		{
			name: 'Source Serif 4',
			by: 'Adobe',
			role: 'Serif reading option',
			url: 'https://github.com/adobe-fonts/source-serif'
		},
		{
			name: 'Atkinson Hyperlegible Next',
			by: 'the Braille Institute',
			role: 'Low-vision reading option',
			url: 'https://github.com/googlefonts/atkinson-hyperlegible-next'
		},
		{
			name: 'OpenDyslexic',
			by: 'Abbie Gonzalez',
			role: 'Dyslexia-friendly option',
			url: 'https://opendyslexic.org'
		}
	];

	const ARTWORK = [
		{
			name: 'Hack Club',
			what: 'Flag, Orpheus and event photos',
			license: '© Hack Club',
			url: 'https://hackclub.com/brand/'
		},
		{ name: 'Lucide', what: 'Icons', license: 'ISC', url: 'https://lucide.dev' },
		{ name: 'Devicon', what: 'Technology logos', license: 'MIT', url: 'https://devicon.dev' },
		{
			name: 'Blobatar',
			what: 'Default avatars',
			license: 'MIT',
			url: 'https://github.com/Alain00/blobatar'
		}
	];

	const DRIVES = [
		{ name: 'Kubernetes', license: 'Apache-2.0', url: 'https://kubernetes.io' },
		{ name: 'k3s', license: 'Apache-2.0', url: 'https://k3s.io' },
		{ name: 'Helm', license: 'Apache-2.0', url: 'https://helm.sh' },
		{ name: 'BuildKit', license: 'Apache-2.0', url: 'https://github.com/moby/buildkit' },
		{ name: 'Railpack', license: 'MIT', url: 'https://github.com/railwayapp/railpack' },
		{ name: 'Kata Containers', license: 'Apache-2.0', url: 'https://katacontainers.io' },
		{ name: 'CloudNativePG', license: 'Apache-2.0', url: 'https://cloudnative-pg.io' },
		{ name: 'PostgreSQL', license: 'PostgreSQL', url: 'https://www.postgresql.org' },
		{ name: 'pgBackRest', license: 'MIT', url: 'https://pgbackrest.org' },
		{ name: 'cert-manager', license: 'Apache-2.0', url: 'https://cert-manager.io' },
		{ name: 'Traefik', license: 'MIT', url: 'https://traefik.io' },
		{
			name: 'HAProxy Ingress',
			license: 'Apache-2.0',
			url: 'https://github.com/haproxytech/kubernetes-ingress'
		},
		{ name: 'Harbor', license: 'Apache-2.0', url: 'https://goharbor.io' },
		{ name: 'zot', license: 'Apache-2.0', url: 'https://zotregistry.dev' },
		{ name: 'VersityGW', license: 'Apache-2.0', url: 'https://github.com/versity/versitygw' },
		{ name: 'Trivy', license: 'Apache-2.0', url: 'https://trivy.dev' },
		{ name: 'VictoriaMetrics', license: 'Apache-2.0', url: 'https://victoriametrics.com' },
		{
			name: 'VictoriaLogs',
			license: 'Apache-2.0',
			url: 'https://victoriametrics.com/products/victorialogs/'
		},
		{ name: 'Vector', license: 'MPL-2.0', url: 'https://vector.dev' },
		{ name: 'gVisor', license: 'Apache-2.0', url: 'https://gvisor.dev' },
		{ name: 'Firecracker', license: 'Apache-2.0', url: 'https://firecracker-microvm.github.io' },
		{
			name: 'cloudflared',
			license: 'Apache-2.0',
			url: 'https://github.com/cloudflare/cloudflared'
		},
		{ name: 'Tailscale', license: 'BSD-3-Clause', url: 'https://tailscale.com' },
		{
			name: 'crane',
			license: 'Apache-2.0',
			url: 'https://github.com/google/go-containerregistry'
		},
		{ name: 'Caddy', license: 'Apache-2.0', url: 'https://caddyserver.com' },
		{
			name: 'agent-sandbox',
			license: 'Apache-2.0',
			url: 'https://github.com/kubernetes-sigs/agent-sandbox'
		}
	];

	const KIND: Record<string, string> = {
		font: 'Typeface',
		asset: 'Artwork',
		code: 'Ported code'
	};

	const names = Object.fromEntries(credits.components.map((c) => [c.id, c.name]));
	const total = credits.packages.length;
	const CREATOR = { role: 'Created by', login: 'LeafdTK', name: 'Leafd' };
	const DESIGNER = { role: 'Website designed by', login: 'techpixel', name: 'Manitej Boorgu' };
	const creator = CREATOR.login.toLowerCase();
	const contributors = $derived(
		data.people.filter((person) => person.login.toLowerCase() !== creator)
	);

	function avatarOf(login: string) {
		const person = data.people.find((entry) => entry.login.toLowerCase() === login.toLowerCase());
		return person?.avatar ?? `https://github.com/${login}.png?size=128`;
	}

	let view = $state('all');
	let query = $state('');
	let family = $state<Family | null>(null);
	let expanded = $state(false);

	function familyOf(license: string): Family {
		if (/^MIT\b/.test(license)) return 'MIT';
		if (license.startsWith('Apache')) return 'Apache';
		if (/^ISC\b/.test(license)) return 'ISC';
		if (license.startsWith('BSD')) return 'BSD';
		return 'Other';
	}

	function matchesQuery(pkg: Pkg, q: string) {
		return (
			pkg.name.toLowerCase().includes(q) ||
			pkg.license.toLowerCase().includes(q) ||
			pkg.by.some((holder) => holder.toLowerCase().includes(q))
		);
	}

	const scoped = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return credits.packages.filter(
			(pkg) => (view === 'all' || pkg.in.includes(view)) && (!q || matchesQuery(pkg, q))
		);
	});

	const spectrum = $derived(
		FAMILIES.map((id) => ({
			id,
			count: scoped.filter((pkg) => familyOf(pkg.license) === id).length
		})).filter((entry) => entry.count > 0)
	);

	const matches = $derived(
		family ? scoped.filter((pkg) => familyOf(pkg.license) === family) : scoped
	);
	const picked = $derived(matches.filter((pkg) => pkg.direct));
	const along = $derived(matches.filter((pkg) => !pkg.direct));
	const searching = $derived(query.trim().length > 0);
	const shownAlong = $derived(expanded || searching ? along : along.slice(0, PREVIEW));

	function versionText(versions: string[]) {
		if (versions.length <= 3) return versions.join(', ');
		return `${versions.slice(0, 2).join(', ')} +${versions.length - 2}`;
	}

	function choose(id: string) {
		view = id;
		family = null;
		expanded = false;
	}
</script>

<Seo
	title="Credits · Orchard"
	description="The people, typefaces, artwork and open-source packages behind Orchard."
/>

{#snippet row(pkg: Pkg)}
	<li class="tr">
		<div class="min-w-0">
			<a href={pkg.url} target="_blank" rel="noopener" class="pkg-name">{pkg.name}</a>
			{#if view === 'all'}
				<p class="mt-1 flex flex-wrap gap-1">
					{#each pkg.in as id (id)}
						<span class="ship">{names[id]}</span>
					{/each}
				</p>
			{/if}
		</div>
		<span class="td-version">
			{pkg.versions.length ? versionText(pkg.versions) : (KIND[pkg.eco] ?? pkg.eco)}
		</span>
		<span class="td-license">
			<span class="license">
				<span class="license-dot family-{familyOf(pkg.license)}" aria-hidden="true"></span>
				{pkg.license}
			</span>
		</span>
		<span class="td-by">{pkg.by.length ? `© ${pkg.by.join('; ')}` : ''}</span>
	</li>
{/snippet}

{#snippet lead(credit: { role: string; login: string; name: string })}
	<a href="https://github.com/{credit.login}" {@attach hover()} class="lead">
		<span class="lead-role">{credit.role}</span>
		<span class="flex items-center gap-4">
			<img
				src={avatarOf(credit.login)}
				alt=""
				width="64"
				height="64"
				loading="lazy"
				decoding="async"
				class="avatar avatar-lg"
			/>
			<span class="min-w-0">
				<span class="block truncate text-[22px] leading-tight font-bold">{credit.name}</span>
				<span class="block truncate font-mono text-[12px]">@{credit.login}</span>
			</span>
		</span>
	</a>
{/snippet}

{#snippet table(title: string, rows: Pkg[], count: number)}
	<article class="table-card">
		<h3 class="table-head group-title">{title} <span class="count">{count}</span></h3>
		<div class="tr tr-head" aria-hidden="true">
			<span>Package</span>
			<span>Version</span>
			<span>License</span>
			<span>Copyright</span>
		</div>
		<ul>
			{#each rows as pkg (`${pkg.eco}:${pkg.name}:${pkg.license}`)}
				{@render row(pkg)}
			{/each}
		</ul>
	</article>
{/snippet}

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
			<div class="title-in">
				<CreditPill explain="/#hackclub" class="inline-flex items-center" />
			</div>
			<h1 class="title-in title mt-6">credits</h1>
			<div class="title-in mt-10 flex flex-wrap justify-center gap-3" style:animation-delay="0.3s">
				<a href="#packages" class="pill pill-sm">Browse the packages</a>
				<a href={links.notices} class="ghost-button">
					<FileText size={16} aria-hidden="true" /> Third-party notices
				</a>
			</div>
		</div>
	</div>
	<WaveEdge fill="#ffdfe3" class="absolute inset-x-0 bottom-0" />
</header>

<main>
	<section
		id="people"
		class="shell scroll-mt-6 pt-[clamp(4rem,8vw,110px)] pb-[clamp(2rem,4vw,50px)]"
		aria-labelledby="contributors-title"
	>
		<div {@attach reveal()} class="leads">
			{@render lead(CREATOR)}
		</div>

		<h2
			id="contributors-title"
			{@attach reveal()}
			class="section-title mt-[clamp(3.5rem,7vw,90px)] text-crimson-deep"
		>
			Contributors
		</h2>
		<ul {@attach reveal({ index: 1 })} class="people mt-8">
			{#each contributors as person (person.login)}
				<li>
					<a href="https://github.com/{person.login}" {@attach hover()} class="person">
						<img
							src={person.avatar}
							alt=""
							width="56"
							height="56"
							loading="lazy"
							decoding="async"
							class="avatar"
						/>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-[17px] font-semibold">{person.name}</span>
							<span class="block truncate font-mono text-[12px]">@{person.login}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>

	<section
		id="website"
		class="shell scroll-mt-6 py-[clamp(1.5rem,3vw,40px)]"
		aria-label="Website design"
	>
		<div {@attach reveal()} class="leads">
			{@render lead(DESIGNER)}
		</div>
	</section>

	<section
		id="built-with"
		class="shell scroll-mt-6 py-[clamp(2rem,4vw,50px)]"
		aria-labelledby="built-title"
	>
		<h2 id="built-title" {@attach reveal()} class="section-title text-crimson-deep">Built with</h2>

		<div class="mt-10 grid gap-4 lg:grid-cols-2">
			<article {@attach reveal()} class="panel">
				<header class="flex items-center justify-between gap-3">
					<h3 class="panel-title">Typefaces</h3>
					<span class="license">
						<span class="license-dot family-Other" aria-hidden="true"></span>
						OFL-1.1
					</span>
				</header>
				<ul class="list">
					{#each TYPEFACES as face (face.name)}
						<li class="item">
							<span class="min-w-0">
								<a href={face.url} class="item-name">{face.name}</a>
								<span class="item-meta">by {face.by}</span>
							</span>
							<span class="item-role">{face.role}</span>
						</li>
					{/each}
				</ul>
			</article>

			<div class="flex flex-col gap-4">
				<article {@attach reveal({ index: 1 })} class="panel">
					<h3 class="panel-title">Artwork</h3>
					<ul class="list">
						{#each ARTWORK as art (art.name)}
							<li class="item">
								<span class="min-w-0">
									<a href={art.url} class="item-name">{art.name}</a>
									<span class="item-meta">{art.what}</span>
								</span>
								<span class="license">
									<span class="license-dot family-{familyOf(art.license)}" aria-hidden="true"
									></span>
									{art.license}
								</span>
							</li>
						{/each}
					</ul>
				</article>

				<article {@attach reveal({ index: 2 })} class="panel">
					<h3 class="panel-title">Framework detection</h3>
					<ul class="list">
						<li class="item">
							<span class="min-w-0">
								<a href="https://github.com/railwayapp/railpack" class="item-name">Railpack</a>
								<span class="item-meta">by Railway</span>
							</span>
							<span class="license">
								<span class="license-dot family-MIT" aria-hidden="true"></span>
								MIT
							</span>
						</li>
					</ul>
				</article>
			</div>

			<article {@attach reveal()} class="panel lg:col-span-2">
				<h3 class="panel-title">Runs on</h3>
				<ul class="drives">
					{#each DRIVES as project (project.name)}
						<li class="drive">
							<a href={project.url} class="item-name">{project.name}</a>
							<span class="license">
								<span class="license-dot family-{familyOf(project.license)}" aria-hidden="true"
								></span>
								{project.license}
							</span>
						</li>
					{/each}
				</ul>
			</article>
		</div>
	</section>

	<section
		id="packages"
		class="shell scroll-mt-2 pt-[clamp(2rem,4vw,50px)] pb-[clamp(3rem,6vw,90px)]"
		aria-labelledby="packages-title"
	>
		<h2 id="packages-title" {@attach reveal()} class="section-title text-crimson-deep">
			Every package
		</h2>

		<div class="toolbar mt-8">
			<div class="tabs" role="group" aria-label="Show packages from">
				<button
					type="button"
					class="tab"
					aria-pressed={view === 'all'}
					onclick={() => choose('all')}
				>
					Everything <span class="count">{total}</span>
				</button>
				{#each credits.components as part (part.id)}
					<button
						type="button"
						class="tab"
						aria-pressed={view === part.id}
						onclick={() => choose(part.id)}
					>
						{part.name} <span class="count">{part.count}</span>
					</button>
				{/each}
			</div>
			<div class="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div class="flex flex-wrap gap-2" role="group" aria-label="Filter by license">
					{#each spectrum as entry (entry.id)}
						<button
							type="button"
							class="legend"
							aria-pressed={family === entry.id}
							onclick={() => (family = family === entry.id ? null : entry.id)}
						>
							<span class="license-dot family-{entry.id}" aria-hidden="true"></span>
							{entry.id}
							<span class="count">{entry.count}</span>
						</button>
					{/each}
				</div>
				<label class="search">
					<Search size={16} aria-hidden="true" class="shrink-0" />
					<span class="sr-only">Search packages</span>
					<input
						type="search"
						placeholder="Search names, licenses, authors"
						bind:value={query}
						autocomplete="off"
						spellcheck="false"
					/>
				</label>
			</div>
			<div class="spectrum mt-4" aria-hidden="true">
				{#each spectrum as entry (entry.id)}
					<span
						class="segment family-{entry.id}"
						class:dim={family !== null && family !== entry.id}
						style:flex-grow={entry.count}
					></span>
				{/each}
			</div>
		</div>

		{#if !matches.length}
			<p class="mt-14 text-center text-lg text-crimson-deep">
				Nothing matches “{query.trim()}”. Try a package name, a license or a copyright holder.
			</p>
		{:else}
			<div class="mt-8 flex flex-col gap-6">
				{#if picked.length}
					{@render table('Direct dependencies', picked, picked.length)}
				{/if}
				{#if along.length}
					<div>
						{@render table('Indirect dependencies', shownAlong, along.length)}
						{#if shownAlong.length < along.length}
							<div class="mt-6 flex justify-center">
								<button
									type="button"
									class="pill-solid px-5 py-3"
									onclick={() => (expanded = true)}
								>
									Show all {along.length}
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</section>

	<section
		id="license"
		class="shell scroll-mt-6 pt-[clamp(1rem,3vw,40px)] pb-[clamp(5rem,9vw,140px)]"
	>
		<div {@attach reveal()} class="license-card">
			<div class="max-w-[640px]">
				<h2 class="text-[clamp(1.6rem,2.6vw,2.1rem)] leading-tight font-semibold">License</h2>
				<p class="mt-4 text-[17px] leading-relaxed">
					Orchard is licensed under the GNU Affero General Public License v3.0. If you run a
					modified version for other people over a network, you have to offer them its source.
				</p>
			</div>
			<div class="flex flex-col gap-3 sm:flex-row lg:flex-col">
				<a href={links.license} {@attach hover()} class="pill-solid px-5 py-3 text-[17px]">
					Read the AGPL <ArrowUpRight size={18} aria-hidden="true" />
				</a>
				<a
					href={links.notices}
					{@attach hover()}
					class="pill px-5 py-3 text-[17px] ring-1 ring-crimson/20"
				>
					<FileText size={18} aria-hidden="true" /> Third-party notices
				</a>
				<a href={links.issues} class="mt-1 text-center text-sm underline underline-offset-4">
					Missing a credit? Open an issue
				</a>
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

	.ghost-button:focus-visible {
		outline: 3px solid var(--color-cream);
		outline-offset: 3px;
	}

	.people {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
		margin-inline: auto;
		max-width: 1100px;
	}

	.people > li {
		width: min(100%, 262px);
	}

	.person {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		border-radius: 1rem;
		padding: 0.85rem 1rem;
		background: rgb(255 255 255 / 0.62);
		color: var(--color-crimson-deep);
		box-shadow: inset 0 0 0 1px rgb(195 16 38 / 0.12);
		transition: background-color 0.18s ease;
	}

	.person:hover {
		background: #fff;
	}

	.person:focus-visible,
	.item-name:focus-visible,
	.pkg-name:focus-visible {
		outline: 2px solid var(--color-crimson-deep);
		outline-offset: 3px;
		border-radius: 6px;
	}

	.leads {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1rem;
	}

	.leads > .lead {
		width: min(100%, 340px);
	}

	.lead {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		border-radius: 1.25rem;
		padding: 1.25rem 1.4rem;
		background: #fff;
		color: var(--color-crimson-deep);
		box-shadow:
			inset 0 0 0 1px rgb(195 16 38 / 0.12),
			0 18px 40px -30px rgb(120 0 20 / 0.5);
	}

	.lead:focus-visible {
		outline: 2px solid var(--color-crimson-deep);
		outline-offset: 3px;
	}

	.lead-role {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.avatar.avatar-lg {
		width: 60px;
		height: 60px;
	}

	.avatar {
		flex-shrink: 0;
		width: 48px;
		height: 48px;
		border-radius: 999px;
		background: var(--color-blush-strong);
		box-shadow: 0 0 0 2px #fff;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border-radius: 1.25rem;
		padding: clamp(1.25rem, 2.5vw, 1.75rem);
		background: rgb(255 255 255 / 0.62);
		color: var(--color-crimson-deep);
		box-shadow: inset 0 0 0 1px rgb(195 16 38 / 0.12);
	}

	.panel-title {
		font-size: 1.3rem;
		font-weight: 700;
	}

	.list {
		display: flex;
		flex-direction: column;
	}

	.item {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem 0;
		border-top: 1px solid rgb(195 16 38 / 0.12);
	}

	.item-name {
		font-weight: 700;
		text-decoration: underline;
		text-decoration-color: transparent;
		text-underline-offset: 3px;
		transition: text-decoration-color 0.2s ease;
	}

	.item-name:hover {
		text-decoration-color: currentColor;
	}

	.item-meta {
		margin-left: 0.5rem;
		font-size: 0.9rem;
	}

	.item-role {
		flex-shrink: 0;
		font-size: 0.85rem;
		text-align: right;
	}

	.drives {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
		column-gap: 1.75rem;
	}

	.drive {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0;
		border-top: 1px solid rgb(195 16 38 / 0.12);
	}

	.license {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.4rem;
		border-radius: 6px;
		padding: 0.1rem 0.5rem;
		background: rgb(255 255 255 / 0.75);
		font-family: var(--font-mono);
		font-size: 11px;
		white-space: nowrap;
		box-shadow: inset 0 0 0 1px rgb(195 16 38 / 0.14);
	}

	.license-dot {
		flex-shrink: 0;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 999px;
	}

	.toolbar {
		padding-block: 0.75rem;
	}

	@media (min-width: 768px) {
		.toolbar {
			position: sticky;
			top: 0;
			z-index: 20;
			margin-inline: -0.75rem;
			padding-inline: 0.75rem;
			background: color-mix(in srgb, var(--color-blush) 90%, transparent);
			backdrop-filter: blur(10px);
		}
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		scrollbar-width: none;
		margin-inline: -0.25rem;
		padding: 0.25rem;
	}

	@media (min-width: 768px) {
		.tabs {
			flex-wrap: wrap;
			overflow: visible;
		}
	}

	.tab,
	.legend {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.45rem;
		border-radius: 999px;
		padding: 0.45rem 0.9rem;
		background: rgb(255 255 255 / 0.55);
		color: var(--color-crimson-deep);
		font-size: 0.95rem;
		font-weight: 600;
		white-space: nowrap;
		box-shadow: inset 0 0 0 1px rgb(195 16 38 / 0.14);
		transition:
			background-color 0.18s ease,
			color 0.18s ease;
	}

	.tab:hover,
	.legend:hover {
		background: #fff;
	}

	.tab[aria-pressed='true'],
	.legend[aria-pressed='true'] {
		background: var(--color-crimson-deep);
		color: #fff;
		box-shadow: none;
	}

	.tab:focus-visible,
	.legend:focus-visible {
		outline: 2px solid var(--color-crimson-deep);
		outline-offset: 2px;
	}

	.count {
		font-family: var(--font-mono);
		font-size: 0.78em;
		font-weight: 400;
		opacity: 0.8;
	}

	.search {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.55rem;
		border-radius: 10px;
		padding: 0.6rem 0.9rem;
		background: rgb(255 255 255 / 0.75);
		color: var(--color-crimson-deep);
		box-shadow: inset 0 0 0 1px rgb(195 16 38 / 0.18);
	}

	.search:focus-within {
		box-shadow: inset 0 0 0 2px var(--color-crimson-deep);
	}

	.search input {
		width: 100%;
		min-width: 0;
		background: transparent;
		font-size: 1rem;
		outline: none;
	}

	.search input::placeholder {
		color: rgb(195 16 38 / 0.6);
	}

	@media (min-width: 768px) {
		.search {
			width: 320px;
		}
	}

	.spectrum {
		display: flex;
		gap: 3px;
		height: 8px;
		overflow: hidden;
		border-radius: 999px;
	}

	.segment {
		flex-basis: 0;
		min-width: 6px;
		transition:
			opacity 0.25s ease,
			flex-grow 0.5s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.segment.dim {
		opacity: 0.2;
	}

	.family-MIT {
		background: var(--color-crimson);
	}

	.family-Apache {
		background: var(--color-crimson-deep);
	}

	.family-ISC {
		background: var(--color-rose);
	}

	.family-BSD {
		background: #7c0d1c;
	}

	.family-Other {
		background: repeating-linear-gradient(
			-45deg,
			var(--color-crimson-deep) 0 1.5px,
			#fff 1.5px 4.5px
		);
	}

	.table-card {
		overflow: hidden;
		border-radius: 1.25rem;
		background: rgb(255 255 255 / 0.62);
		color: var(--color-crimson-deep);
		box-shadow: inset 0 0 0 1px rgb(195 16 38 / 0.12);
	}

	.table-head {
		padding: 1.25rem 1.25rem 1rem;
	}

	.group-title {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		font-size: 1.3rem;
		font-weight: 700;
	}

	.tr {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas:
			'name license'
			'version version'
			'by by';
		column-gap: 1rem;
		row-gap: 0.2rem;
		align-items: baseline;
		padding: 0.7rem 1.25rem;
		border-top: 1px solid rgb(195 16 38 / 0.1);
	}

	.tr > :nth-child(1) {
		grid-area: name;
	}

	.tr > :nth-child(2) {
		grid-area: version;
	}

	.tr > :nth-child(3) {
		grid-area: license;
	}

	.tr > :nth-child(4) {
		grid-area: by;
	}

	.tr:not(.tr-head):hover {
		background: rgb(255 255 255 / 0.55);
	}

	.tr-head {
		display: none;
		padding-block: 0.55rem;
		background: rgb(195 16 38 / 0.05);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	@media (min-width: 900px) {
		.tr {
			grid-template-columns: minmax(0, 2.1fr) minmax(0, 1fr) minmax(0, 1.25fr) minmax(0, 2.6fr);
			grid-template-areas: 'name version license by';
		}

		.tr-head {
			display: grid;
		}
	}

	.pkg-name {
		overflow-wrap: anywhere;
		font-weight: 700;
		text-decoration: underline;
		text-decoration-color: transparent;
		text-underline-offset: 3px;
		transition: text-decoration-color 0.2s ease;
	}

	.pkg-name:hover {
		text-decoration-color: currentColor;
	}

	.ship {
		border-radius: 999px;
		padding: 0.05rem 0.45rem;
		background: rgb(195 16 38 / 0.07);
		font-size: 10.5px;
		font-weight: 600;
	}

	.td-version {
		font-family: var(--font-mono);
		font-size: 12px;
		overflow-wrap: anywhere;
	}

	.td-by {
		font-size: 13px;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	.license-card {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		justify-content: space-between;
		border-radius: 1.5rem;
		padding: clamp(1.75rem, 4vw, 3rem);
		background: rgb(255 255 255 / 0.62);
		color: var(--color-crimson-deep);
		box-shadow: inset 0 0 0 1px rgb(249 68 90 / 0.12);
	}

	@media (min-width: 1024px) {
		.license-card {
			flex-direction: row;
			align-items: center;
		}
	}

	@media (max-width: 520px) {
		.item {
			flex-direction: column;
			gap: 0.2rem;
		}

		.item-role {
			text-align: left;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.title-in,
		.title.title-in {
			animation: none;
		}

		.segment {
			transition: none;
		}
	}
</style>

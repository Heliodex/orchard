<script lang="ts">
	import { fade } from 'svelte/transition';
	import SpinMark from './SpinMark.svelte';
	import HackClubFlag from './HackClubFlag.svelte';
	import { links } from '$lib/links';

	const PAGES = [
		{ href: links.readme, label: 'About' },
		{ href: links.license, label: 'License' },
		{ href: links.templates, label: 'Templates' },
		{ href: links.extensions, label: 'Extensions' },
		{ href: links.selfHostedPaas, label: 'Self-hosted PaaS' },
		{ href: links.compare, label: 'Compare' },
		{ href: links.credits, label: 'Credits' },
		{ href: links.docs, label: 'Resource Center' },
		{ href: links.changelog, label: 'Changelog' },
		{ href: links.security, label: 'Security' }
	];

	const HACK_CLUB = [
		{ href: links.conduct, label: 'Code of Conduct' },
		{ href: links.privacy, label: 'Privacy & Terms' },
		{ href: links.imprint, label: 'Imprint' }
	];

	const year = new Date().getFullYear();

	let secret = $state(false);
</script>

<footer class="flex min-h-[340px] text-base text-white">
	<div class="w-[80px] shrink-0 border-r-4 border-blush pt-6 pl-4 sm:w-[136px]">
		<SpinMark bind:secret class="size-12 sm:size-24" />
	</div>
	<div class="min-w-0 pt-8 pr-6 pb-12 pl-4">
		<div class="leading-8">
			<p class="relative">
				{#key secret}
					<span class="block" in:fade={{ duration: 260 }}>
						{#if secret}
							Made with <span class="heart">&lt;3</span> and a little centrifugal force.
						{:else}
							Made with <span class="heart">&lt;3</span> by
							<a class="link" href={links.author}>Leafd</a>.
						{/if}
					</span>
				{/key}
			</p>
			<p>
				A <a class="flag" href={links.hackclub} aria-label="Hack Club"
					><HackClubFlag class="h-[26px] w-auto" /></a
				>
				project.
			</p>
		</div>
		<div class="mt-16 flex flex-wrap gap-x-16 gap-y-5">
			<ul class="flex flex-col">
				{#each PAGES as page (page.label)}
					<li><a class="link" href={page.href}>{page.label}</a></li>
				{/each}
			</ul>
			<ul class="flex flex-col">
				{#each HACK_CLUB as page (page.label)}
					<li><a class="link" href={page.href}>{page.label}</a></li>
				{/each}
			</ul>
		</div>
		<a class="link mt-[20px] inline-block" href={links.github}>Github</a>
		<p class="mt-12 text-sm text-pretty">
			© {year} Hack Club. Registered under The Hack Foundation, a 501(c)(3) nonprofit
			<span class="whitespace-nowrap">(EIN: 81-2908499)</span>.
		</p>
	</div>
</footer>

<style>
	.heart {
		font-family: var(--font-mono);
		font-weight: 700;
		letter-spacing: -0.022em;
	}

	.link {
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: color 0.2s ease;
	}

	.link:hover {
		color: var(--color-blush);
	}

	.flag {
		display: inline-flex;
		vertical-align: middle;
		color: #fff;
		transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.flag:hover {
		transform: rotate(-6deg) scale(1.06);
	}

	.flag:focus-visible,
	.link:focus-visible {
		outline: 2px solid var(--color-cream);
		outline-offset: 2px;
		border-radius: 2px;
	}
</style>

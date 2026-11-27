<script lang="ts">
	import { onMount } from 'svelte';
	import RoundWave from './RoundWave.svelte';
	import { animate, stagger } from 'motion';
	import { Github } from 'lucide-svelte';
	import Logo from './Logo.svelte';
	import HeroMark from './HeroMark.svelte';
	import PromptCopy from './PromptCopy.svelte';
	import WaveEdge from './WaveEdge.svelte';
	import ScrollChip from './ScrollChip.svelte';
	import CreditPill from './CreditPill.svelte';
	import { links } from '$lib/links';
	import { transition } from '$lib/motion.svelte';
	import { finishIntro, introMode } from '$lib/intro';

	let root = $state<HTMLElement | null>(null);
	let box = $state<{ size: number; left: number; top: number } | null>(null);
	let stretch = $state(0);

	function placeMark() {
		const hero = root;
		if (!hero) return;
		const frame = hero.getBoundingClientRect();
		const width = hero.clientWidth;
		const height = hero.offsetHeight;
		let right = 0;
		let bottom = 0;
		for (const node of hero.querySelectorAll('[data-line], [data-measure]')) {
			const range = document.createRange();
			range.selectNodeContents(node);
			const rect =
				node.getAttribute('data-measure') === 'box'
					? (node.firstElementChild ?? node).getBoundingClientRect()
					: range.getBoundingClientRect();
			right = Math.max(right, rect.right - frame.left);
			bottom = Math.max(bottom, rect.bottom - frame.top);
		}
		if (width < 768) {
			const size = Math.min(width * 0.86, 420);
			const top = bottom + 40;
			box = { size, left: width - size * 0.8, top };
			stretch = Math.ceil(top + size * 0.8 + 90);
			return;
		}
		stretch = 0;
		const gap = 44;
		const room = width - (right + gap);
		const size = Math.min(813, Math.max(540, room / 0.84));
		const scale = size / 813;
		box = {
			size,
			left: Math.max(right + gap, width + 130 * scale - size),
			top: height + 69 * scale - size
		};
	}

	onMount(() => {
		const hero = root;
		if (hero) {
			placeMark();
			document.fonts.ready.then(placeMark);
			const ro = new ResizeObserver(() => placeMark());
			ro.observe(hero);
			const late = setTimeout(placeMark, 1600);
			const stopWatching = () => {
				ro.disconnect();
				clearTimeout(late);
			};
			const cascade = startCascade();
			return () => {
				stopWatching();
				cascade?.();
			};
		}
	});

	function startCascade() {
		const el = root;
		const mode = introMode();
		if (!el || !mode) return;
		const all = (selector: string) => Array.from(el.querySelectorAll<HTMLElement>(selector));

		animate(
			all('[data-bloom-band]'),
			{ opacity: [0, 1], scale: [0.82, 1], rotate: [-10, 0] },
			{ type: 'spring', visualDuration: 0.7, bounce: 0.2, delay: 0.12 }
		);
		animate(
			all('[data-bloom-petal]'),
			{ opacity: [0, 1], scale: [0, 1] },
			{ ...transition('bouncy'), delay: stagger(0.1, { startDelay: 0.55 }) }
		).finished.then(finishIntro);
	}
</script>

<header
	id="hero"
	bind:this={root}
	class="relative isolate flex min-h-[clamp(640px,100svh,940px)] flex-col overflow-hidden bg-crimson pb-[90px] text-white"
	style:min-height={stretch ? `${stretch}px` : undefined}
>
	<div
		class="pointer-events-none absolute -z-10 {box
			? ''
			: 'invisible -right-[130px] -bottom-[69px] w-[813px] max-w-[130%]'}"
		style:width={box ? `${box.size}px` : undefined}
		style:left={box ? `${box.left}px` : undefined}
		style:top={box ? `${box.top}px` : undefined}
	>
		<HeroMark class="w-full" />
	</div>

	<div class="shell flex w-full flex-1 flex-col pt-8">
		<nav class="relative flex items-center justify-between gap-4" aria-label="Main">
			<a
				href="/"
				aria-label="Orchard home"
				data-intro-hide
				data-cascade="nav"
				class="rounded-sm focus-visible:outline-3 focus-visible:outline-cream focus-visible:outline-offset-4"
			>
				<Logo />
			</a>
			<CreditPill
				explain="#hackclub"
				data-intro-hide
				data-cascade="nav"
				class="absolute left-1/2 inline-flex -translate-x-1/2 items-center max-lg:hidden"
			/>
			<div class="flex items-center gap-2" data-intro-hide data-cascade="nav">
				<a
					href={links.github}
					aria-label="Orchard on GitHub"
					title="Orchard on GitHub"
					class="gh inline-flex size-11 items-center justify-center rounded-lg text-white"
				>
					<Github size={20} strokeWidth={2} aria-hidden="true" />
				</a>
				<a href={links.install} class="pill pill-sm">Install Orchard</a>
			</div>
		</nav>
		<CreditPill
			explain="#hackclub"
			data-intro-hide
			data-cascade="nav"
			class="mt-5 inline-flex items-center justify-center self-center text-center lg:hidden"
		/>

		<div class="my-auto pt-10 pb-20 max-md:my-0">
			<h1
				aria-label="Your own cloud in one command"
				class="text-[clamp(2.5rem,5.2vw,4rem)] leading-[1.26] font-medium"
			>
				<span class="block overflow-hidden" aria-hidden="true">
					<span data-line data-intro-hide class="block" style="--intro-delay: 0.05s">
						Your <span class="font-extrabold"><RoundWave text="own" playAfter={1400} /></span> cloud
					</span>
				</span>
				<span class="block overflow-hidden" aria-hidden="true">
					<span data-line data-intro-hide class="block" style="--intro-delay: 0.14s">
						in <em class="pr-[0.04em] font-extrabold">one</em> command
					</span>
				</span>
			</h1>

			<p
				data-intro-hide
				data-cascade="rise"
				style="--intro-delay: 0.28s"
				data-measure
				class="mt-2 max-w-[728px] text-[clamp(1.5rem,2.2vw,2rem)] text-balance text-cream"
			>
				Turn a Linux box into a private hosting platform.
			</p>

			<div
				data-intro-hide
				data-cascade="cta"
				data-measure="box"
				class="mt-7"
				style="--intro-delay: 0.36s"
			>
				<PromptCopy />
			</div>
		</div>
	</div>

	<div class="absolute inset-x-0 bottom-0 h-[90px]">
		<WaveEdge fill="#ffdfe3" />
		<div class="h-[55px] bg-blush"></div>
		<div
			data-intro-hide
			data-cascade="rise"
			class="absolute -top-[17px] left-1/2 -translate-x-1/2"
			style="--intro-delay: 0.38s"
		>
			<ScrollChip />
		</div>
	</div>
</header>

<style>
	.gh {
		background: rgb(195 16 38 / 0.35);
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.16);
		transition: background-color 0.18s ease;
	}

	.gh:hover {
		background: var(--color-crimson-deep);
	}

	.gh:focus-visible {
		outline: 3px solid var(--color-cream);
		outline-offset: 3px;
	}
</style>

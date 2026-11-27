<script lang="ts">
	import { onMount } from 'svelte';

	let { text, playAfter = 0 }: { text: string; playAfter?: number } = $props();

	const letters = $derived([...text]);
	let playing = $state(false);

	onMount(() => {
		if (!playAfter || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const start = setTimeout(() => (playing = true), playAfter);
		const stop = setTimeout(() => (playing = false), playAfter + 700);
		return () => {
			clearTimeout(start);
			clearTimeout(stop);
		};
	});
</script>

<span class="wave" class:playing style:--n={letters.length}
	>{#each letters as letter, i (i)}<span class="letter" style:--i={i}>{letter}</span>{/each}</span
>

<style>
	.letter {
		white-space: pre;
		font-variation-settings: 'ROND' 100;
		transition: font-variation-settings 0.5s cubic-bezier(0.2, 0, 0, 1);
		transition-delay: calc((var(--n) - 1 - var(--i)) * 40ms);
	}

	.wave:hover .letter,
	.wave.playing .letter {
		font-variation-settings: 'ROND' 0;
		transition-delay: calc(var(--i) * 40ms);
	}

	@media (prefers-reduced-motion: reduce) {
		.letter {
			transition: none;
		}

		.wave:hover .letter {
			font-variation-settings: 'ROND' 100;
		}
	}
</style>

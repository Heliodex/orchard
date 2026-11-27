<script lang="ts">
	import { decorativeMotion, fade } from '$lib/utils/motion.svelte';

	let { value, label = undefined }: { value: string; label?: string } = $props();

	const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
	const chars = $derived([...value].reverse());

	function blurOnChange(get: () => string) {
		return (el: Element) => {
			let last = get();
			$effect(() => {
				const next = get();
				if (next === last) return;
				last = next;
				if (!decorativeMotion()) return;
				(el as HTMLElement).animate([{ filter: 'blur(2px)' }, { filter: 'blur(0)' }], fade('long'));
			});
		};
	}
</script>

<span class="roll" aria-label={label ?? value} role="img">
	{#each chars as ch, i (i)}
		{#if ch >= '0' && ch <= '9'}
			<span class="slot" aria-hidden="true" style:order={-i}>
				<span class="strip" style:--n={+ch} style:--i={i} {@attach blurOnChange(() => ch)}>
					{#each DIGITS as d (d)}<span class="digit">{d}</span>{/each}
				</span>
			</span>
		{:else}
			<span class="glyph" aria-hidden="true" style:order={-i}>{ch}</span>
		{/if}
	{/each}
</span>

<style>
	.roll {
		display: inline-flex;
		height: 1.2em;
		line-height: 1.2em;
		vertical-align: -0.04em;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
	}
	.slot {
		display: inline-block;
		height: 1.2em;
		overflow: hidden;
		mask-image: linear-gradient(transparent, black 22%, black 78%, transparent);
	}
	.strip {
		display: flex;
		flex-direction: column;
		transform: translateY(calc(var(--n) * -1.2em));
		transition: transform var(--spring-pop-duration) var(--spring-pop);
		transition-delay: calc(var(--i) * 35ms * var(--tempo));
	}
	.digit {
		display: block;
		height: 1.2em;
		text-align: center;
	}
	.glyph {
		white-space: pre;
	}
</style>

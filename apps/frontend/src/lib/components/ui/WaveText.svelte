<script lang="ts">
	let {
		text,
		class: className = '',
		rest = 'friendly',
		peak = 'round'
	}: {
		text: string;
		class?: string;
		rest?: 'sharp' | 'friendly' | 'round';
		peak?: 'sharp' | 'friendly' | 'round';
	} = $props();

	const letters = $derived([...text]);
</script>

<span
	class="wave {className}"
	style:--n={letters.length}
	style:--wave-rest="var(--font-rond-{rest})"
	style:--wave-peak="var(--font-rond-{peak})"
	><span class="sr-only">{text}</span>{#each letters as letter, i (i)}<span
			class="letter"
			aria-hidden="true"
			style:--i={i}>{letter}</span
		>{/each}</span
>

<style>
	.letter {
		white-space: pre;
		font-variation-settings: 'ROND' var(--wave-rest);
		transition: font-variation-settings var(--spring-smooth-duration) var(--spring-smooth);
		transition-delay: calc((var(--n) - 1 - var(--i)) * var(--font-wave-stride));
	}

	.wave:hover .letter {
		font-variation-settings: 'ROND' var(--wave-peak);
		transition-delay: calc(var(--i) * var(--font-wave-stride));
	}

	:global(html.motion-reduce) .letter {
		transition: none;
	}

	:global(html.motion-reduce) .wave:hover .letter {
		font-variation-settings: 'ROND' var(--wave-rest);
	}
</style>

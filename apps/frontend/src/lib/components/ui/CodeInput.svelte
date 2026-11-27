<script lang="ts">
	import { shake } from '$lib/utils/motion.svelte';

	let {
		value = $bindable(''),
		length = 6,
		error = false,
		disabled = false,
		id = undefined,
		label = 'Verification code',
		autofocus = false,
		oncomplete = undefined
	}: {
		value?: string;
		length?: number;
		error?: boolean;
		disabled?: boolean;
		id?: string;
		label?: string;
		autofocus?: boolean;
		oncomplete?: (code: string) => void;
	} = $props();

	let root = $state<HTMLElement>();
	let input = $state<HTMLInputElement>();
	let focused = $state(false);

	const digits = $derived(Array.from({ length }, (_, i) => value[i] ?? ''));
	const caret = $derived(Math.min(value.length, length - 1));
	const half = $derived(length % 2 === 0 ? length / 2 : -1);

	function sanitize(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const next = el.value.replace(/\D/g, '').slice(0, length);
		if (next !== el.value) el.value = next;
		value = next;
		if (next.length === length) oncomplete?.(next);
	}

	$effect(() => {
		if (error && root) {
			shake(root);
			input?.select();
		}
	});

	$effect(() => {
		if (autofocus) input?.focus();
	});
</script>

<div class="code" class:code--error={error} class:code--focused={focused} bind:this={root}>
	<input
		bind:this={input}
		{id}
		{disabled}
		class="native"
		type="text"
		inputmode="numeric"
		autocomplete="one-time-code"
		pattern="[0-9]*"
		maxlength={length}
		aria-label={label}
		aria-invalid={error || undefined}
		spellcheck="false"
		{value}
		oninput={sanitize}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
	/>
	<div class="cells" aria-hidden="true">
		{#each digits as d, i (i)}
			<span
				class="cell"
				class:cell--filled={d !== ''}
				class:cell--caret={focused && i === caret && value.length < length}
				class:cell--active={focused && i === caret}
				class:cell--split={i === half - 1}
			>
				{#key d}<span class="digit">{d}</span>{/key}
			</span>
		{/each}
	</div>
</div>

<style>
	.code {
		position: relative;
		width: 100%;
	}
	.native {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: transparent;
		caret-color: transparent;
		font-size: 1px;
		letter-spacing: 0;
		cursor: text;
		outline: none;
		opacity: 0.001;
	}
	.native::selection {
		background: transparent;
	}
	.cells {
		display: flex;
		gap: 0.375rem;
	}
	.cell {
		position: relative;
		display: grid;
		flex: 1;
		place-items: center;
		height: 3rem;
		min-width: 0;
		border-radius: calc(0.75rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		box-shadow: inset 0 0 0 0.5px color-mix(in oklab, var(--neutral-10) 6%, transparent);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-title-3);
		font-weight: var(--weight-medium);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		color: var(--text-default);
		transition:
			box-shadow var(--fade-in) var(--curve-out),
			background-color var(--fade-in) var(--curve-out);
	}
	.cell--split {
		margin-right: 0.5rem;
	}
	.code:hover .cell:not(.cell--active) {
		background: color-mix(in oklab, var(--neutral-10) 8%, transparent);
	}
	.cell--active {
		background: var(--bg-surface);
		box-shadow:
			inset 0 0 0 1px var(--accent-solid),
			0 0 0 3.5px color-mix(in oklab, var(--accent-solid) 22%, transparent);
	}
	.cell--caret::after {
		content: '';
		position: absolute;
		width: 1.5px;
		height: 1.25rem;
		border-radius: 1px;
		background: var(--accent-solid);
		animation: caret 1.1s steps(1) infinite;
	}
	.digit {
		display: block;
		animation: digit-in var(--spring-pop-duration) var(--spring-pop);
	}
	.code--error .cell {
		background: color-mix(in oklab, var(--red-solid) 7%, transparent);
		box-shadow: inset 0 0 0 1px var(--red-6);
		color: var(--red-9);
	}
	.code--error .cell--active {
		box-shadow:
			inset 0 0 0 1px var(--red-solid),
			0 0 0 3.5px color-mix(in oklab, var(--red-solid) 22%, transparent);
	}
	.native:disabled + .cells {
		opacity: 0.5;
	}
	@keyframes caret {
		50% {
			opacity: 0;
		}
	}
	@keyframes digit-in {
		from {
			opacity: 0;
			transform: translateY(0.25rem) scale(0.8);
		}
	}
</style>

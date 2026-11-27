<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Icon } from './types';

	let {
		value = $bindable(''),
		element = $bindable(null),
		error = false,
		icon = undefined,
		size = 'md',
		shape = 'rounded',
		suffix = undefined,
		mono = false,
		width = 'full',
		class: className = '',
		...rest
	}: {
		value?: string | number | null;
		element?: HTMLInputElement | null;
		error?: boolean;
		icon?: Icon;
		size?: 'lg' | 'md' | 'sm';
		shape?: 'rounded' | 'capsule';
		suffix?: string | Snippet;
		mono?: boolean;
		width?: 'full' | 'short';
		class?: string;
		[key: string]: unknown;
	} = $props();

	let suffixWidth = $state(0);
</script>

{#if icon || suffix}
	{@const Leading = icon}
	<span class="wrap {className}" class:wrap--short={width === 'short'}>
		{#if Leading}<span class="lead" aria-hidden="true"><Leading size={15} /></span>{/if}
		<input
			class="control control--{size} control--{shape}"
			class:control--lead={!!icon}
			class:control--suffix={!!suffix}
			class:control--mono={mono}
			class:control--error={error}
			aria-invalid={error || undefined}
			style:padding-right={suffix && suffixWidth
				? `max(3rem, calc(${suffixWidth}px + 1rem))`
				: undefined}
			bind:value
			bind:this={element}
			{...rest}
		/>
		{#if suffix}
			<span class="suffix" bind:offsetWidth={suffixWidth}>
				{#if typeof suffix === 'string'}{suffix}{:else}{@render suffix()}{/if}
			</span>
		{/if}
	</span>
{:else}
	<input
		class="control control--{size} control--{shape} {className}"
		class:control--short={width === 'short'}
		class:control--mono={mono}
		class:control--error={error}
		aria-invalid={error || undefined}
		bind:value
		bind:this={element}
		{...rest}
	/>
{/if}

<style>
	.wrap {
		position: relative;
		display: block;
		min-width: 0;
	}
	.lead {
		position: absolute;
		top: 50%;
		left: 0.75rem;
		display: flex;
		color: var(--text-muted);
		transform: translateY(-50%);
		pointer-events: none;
	}
	.control {
		display: block;
		width: 100%;
		min-width: 0;
		height: 2rem;
		padding: 0 0.6875rem;
		border: none;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		box-shadow: inset 0 0 0 0.5px color-mix(in oklab, var(--neutral-10) 6%, transparent);
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		transition:
			box-shadow var(--dur-fast) ease,
			background-color var(--dur-fast) ease;
	}
	.control--capsule {
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
	}
	.control--sm {
		height: 1.75rem;
		border-radius: calc(0.5rem * var(--corner-scale));
		corner-shape: var(--corner);
		font-size: var(--text-callout);
	}
	.control--sm.control--capsule {
		border-radius: calc(0.5rem * var(--corner-scale));
		corner-shape: var(--corner);
	}
	.control--lg {
		height: 2.25rem;
		padding: 0 0.75rem;
		border-radius: calc(0.625rem * var(--corner-scale));
		corner-shape: var(--corner);
		font-size: var(--text-headline);
	}
	.wrap--short,
	.control--short {
		max-width: 12rem;
	}
	.control--mono {
		font-family: var(--font-mono);
		font-size: var(--text-callout);
	}
	.suffix {
		position: absolute;
		top: 50%;
		right: 0.625rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--text-muted);
		font-size: var(--text-callout);
		transform: translateY(-50%);
	}
	.control--suffix {
		padding-right: 3rem;
	}
	.control--lead {
		padding-left: 2.125rem;
	}
	.control::placeholder {
		color: var(--text-muted);
	}
	.control:hover:not(:disabled):not(:focus) {
		background: color-mix(in oklab, var(--neutral-10) 8%, transparent);
	}
	.control:focus {
		outline: none;
		background: var(--bg-surface);
		box-shadow:
			inset 0 0 0 1px var(--accent-solid),
			0 0 0 3.5px color-mix(in oklab, var(--accent-solid) 22%, transparent);
	}
	.control--error,
	.control--error:hover:not(:focus) {
		background: color-mix(in oklab, var(--red-solid) 7%, transparent);
		box-shadow: inset 0 0 0 1px var(--red-6);
	}
	.control--error:focus {
		box-shadow:
			inset 0 0 0 1px var(--red-solid),
			0 0 0 3.5px color-mix(in oklab, var(--red-solid) 22%, transparent);
	}
	.control:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>

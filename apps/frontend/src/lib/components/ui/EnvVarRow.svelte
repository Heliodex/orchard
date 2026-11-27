<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Eye, EyeOff, Pencil } from 'lucide-svelte';
	import CopyButton from './CopyButton.svelte';

	let {
		name,
		value,
		secret = true,
		revealed = $bindable(false),
		onedit = undefined,
		badge = undefined,
		actions = undefined
	}: {
		name: string;
		value: string;
		secret?: boolean;
		revealed?: boolean;
		onedit?: () => void;
		badge?: Snippet;
		actions?: Snippet;
	} = $props();

	const masked = $derived(secret && !revealed);
	const empty = $derived(value === '');
</script>

<div class="env" role="listitem">
	<div class="key">
		<code class="name" title={name}>{name}</code>
		{#if badge}{@render badge()}{/if}
	</div>
	<div class="val" class:val--masked={masked}>
		{#if empty}
			<span class="layer layer--empty">Empty</span>
		{:else if secret}
			<span class="layer layer--dots" aria-hidden={!masked}>••••••••••••••••</span>
			<code class="layer layer--value" aria-hidden={masked} title={revealed ? value : undefined}
				>{value}</code
			>
		{:else}
			<code class="layer layer--value" title={value}>{value}</code>
		{/if}
	</div>
	<div class="tools">
		{#if secret && !empty}
			<button
				type="button"
				class="tool"
				aria-label={revealed ? `Hide ${name}` : `Reveal ${name}`}
				aria-pressed={revealed}
				onclick={() => (revealed = !revealed)}
			>
				<span class="swap" class:swap--on={revealed}>
					<span class="icon icon--show"><Eye size={14} /></span>
					<span class="icon icon--hide"><EyeOff size={14} /></span>
				</span>
			</button>
		{/if}
		<CopyButton {value} label="Copy {name}" />
		{#if onedit}
			<button type="button" class="tool" aria-label="Edit {name}" onclick={onedit}>
				<Pencil size={14} />
			</button>
		{/if}
		{#if actions}{@render actions()}{/if}
	</div>
</div>

<style>
	.env {
		display: grid;
		grid-template-columns: minmax(8rem, 2fr) minmax(0, 3fr) minmax(7.5rem, max-content);
		align-items: center;
		gap: 1rem;
		min-height: 2.75rem;
		padding: 0.375rem 0.5rem 0.375rem 1rem;
		transition: background-color var(--dur-fast) ease;
	}
	.env:not(:first-child) {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.env:hover {
		background: var(--bg-hover);
	}
	.key {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.name {
		display: block;
		min-width: 0;
		overflow-x: clip;
		padding-block: 0.3em;
		margin-block: -0.3em;
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-callout);
		line-height: var(--lh-body);
		font-weight: var(--weight-medium);
		color: var(--text-default);
		white-space: nowrap;
		text-overflow: ellipsis;
		text-box: trim-both cap alphabetic;
	}
	.val {
		display: grid;
		align-items: center;
		min-width: 0;
	}
	.layer {
		grid-area: 1 / 1;
		display: block;
		min-width: 0;
		overflow-x: clip;
		padding-block: 0.3em;
		margin-block: -0.3em;
		font-family: var(--font-mono);
		font-size: var(--text-callout);
		line-height: var(--lh-body);
		white-space: nowrap;
		text-overflow: ellipsis;
		text-box: trim-both cap alphabetic;
		transition:
			opacity var(--fade-in) var(--curve-out),
			transform var(--spring-glide-duration) var(--spring-glide);
	}
	.layer--value {
		color: var(--text-muted);
	}
	.layer--dots {
		color: var(--text-faint);
		letter-spacing: 0.08em;
		user-select: none;
		opacity: 0;
		transform: translateY(0.25rem);
	}
	.layer--empty {
		font-family: inherit;
		font-style: italic;
		color: var(--text-faint);
	}
	.val--masked .layer--dots {
		opacity: 1;
		transform: none;
	}
	.val--masked .layer--value {
		opacity: 0;
		transform: translateY(-0.25rem);
		user-select: none;
	}
	.tools {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.125rem;
	}
	.tool {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: none;
		border-radius: calc(0.375rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}
	.tool:hover {
		background: var(--bg-active);
		color: var(--text-default);
	}
	.env :global(.copy:hover) {
		background: var(--bg-active);
	}
	.swap {
		display: grid;
	}
	.icon {
		grid-area: 1 / 1;
		display: flex;
		transition:
			opacity var(--fade-in) var(--curve-out),
			transform var(--spring-pop-duration) var(--spring-pop);
	}
	.icon--hide {
		opacity: 0;
		transform: scale(0.6);
	}
	.swap--on .icon--show {
		opacity: 0;
		transform: scale(0.6);
	}
	.swap--on .icon--hide {
		opacity: 1;
		transform: none;
	}
</style>

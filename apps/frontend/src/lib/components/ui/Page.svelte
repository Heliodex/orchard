<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		hero = undefined,
		header = undefined,
		description = undefined,
		width = 'default',
		eyebrow = undefined,
		meta = undefined,
		actions = undefined,
		tools = undefined,
		aside = undefined,
		footer = undefined,
		children
	}: {
		title: string;
		hero?: Snippet;
		header?: Snippet;
		description?: string;
		width?: 'narrow' | 'default' | 'wide';
		eyebrow?: Snippet;
		meta?: Snippet;
		actions?: Snippet;
		tools?: Snippet;
		aside?: Snippet;
		footer?: Snippet;
		children: Snippet;
	} = $props();
</script>

{#if hero}{@render hero()}{/if}
<div class="frame frame--{width}" class:frame--hero={!!hero}>
	{#if header}
		<div class="custom-head" class:head--split={!!aside}>{@render header()}</div>
	{:else if !hero}
		<header class="head" class:head--split={!!aside}>
			<div class="heading-row">
				<div class="heading">
					{#if eyebrow}<div class="eyebrow">{@render eyebrow()}</div>{/if}
					<h1 class="title">{title}</h1>
					{#if description}<p class="desc">{description}</p>{/if}
					{#if meta}<div class="meta">{@render meta()}</div>{/if}
				</div>
				{#if tools}<div class="tools">{@render tools()}</div>{/if}
			</div>
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	{#if aside}
		<div class="split">
			<div class="main">{@render children()}</div>
			<aside class="aside">{@render aside()}</aside>
		</div>
	{:else}
		<div class="main">{@render children()}</div>
	{/if}
	{#if footer}
		<footer class="footer"><div class="footer-bar">{@render footer()}</div></footer>
	{/if}
</div>

<style>
	.custom-head {
		margin-bottom: 2rem;
	}
	.footer {
		position: sticky;
		bottom: 0;
		z-index: var(--z-sticky);
		margin: 1.5rem -1rem -2rem;
		padding: 0.75rem 1rem 1rem;
	}
	.footer::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, var(--bg-app) 55%, transparent);
		pointer-events: none;
	}
	.footer-bar {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.frame {
		--aside-w: 18rem;
		width: 100%;
		margin: 0 auto;
		padding: 2rem 2rem 4rem;
	}
	.frame--hero {
		padding-top: 0;
	}
	.frame--narrow {
		max-width: calc(var(--page-narrow) + 4rem);
	}
	.frame--default {
		max-width: calc(var(--page-default) + 4rem);
	}
	.frame--wide {
		max-width: calc(var(--page-wide) + 4rem);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.head--split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--aside-w);
		gap: 2rem;
	}
	.head--split .actions {
		justify-content: flex-end;
	}
	.head--split .actions > :global(:first-child:not(:last-child)) {
		flex: 1;
		min-width: 0;
	}
	.heading-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-width: 0;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}
	.heading {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}
	.eyebrow {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.title {
		font-size: var(--text-display);
		line-height: var(--lh-display);
		font-weight: var(--weight-semibold);
		letter-spacing: -0.013em;
		color: var(--text-default);
		overflow-wrap: anywhere;
	}
	.desc {
		max-width: 65ch;
		text-wrap: pretty;
		font-size: var(--text-headline);
		line-height: 1.375rem;
		color: var(--text-muted);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		min-width: 0;
		margin-top: 0.5rem;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}
	.main {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		min-width: 0;
	}
	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--aside-w);
		gap: 2rem;
		align-items: start;
	}
	.aside {
		position: sticky;
		top: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		min-width: 0;
	}
	@media (max-width: 1024px) {
		.split {
			grid-template-columns: minmax(0, 1fr);
		}
		.head--split {
			display: flex;
		}
		.aside {
			position: static;
		}
	}
	@media (max-width: 640px) {
		.frame {
			padding: 1.5rem 1rem 3rem;
		}
		.head {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>

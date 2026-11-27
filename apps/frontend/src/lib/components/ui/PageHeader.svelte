<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ArrowLeft } from 'lucide-svelte';
	import type { StatusMeta } from './status';
	import StatusBadge from './StatusBadge.svelte';

	let {
		back = undefined,
		icon = undefined,
		title,
		mono = false,
		status = undefined,
		meta = undefined,
		actions = undefined,
		children = undefined
	}: {
		back?: { label: string; href?: string; onclick?: () => void };
		icon?: Snippet;
		title: string;
		mono?: boolean;
		status?: StatusMeta;
		meta?: Snippet;
		actions?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<header class="ph">
	{#if back}
		{#if back.href}
			<a class="ph-back" href={back.href}><ArrowLeft size={14} />{back.label}</a>
		{:else}
			<button type="button" class="ph-back" onclick={back.onclick}>
				<ArrowLeft size={14} />{back.label}
			</button>
		{/if}
	{/if}
	<div class="ph-row">
		{#if icon}<span class="ph-icon">{@render icon()}</span>{/if}
		<h1 class="ph-title" class:ph-title--mono={mono}>{title}</h1>
		{#if status}<StatusBadge meta={status} />{/if}
		<div class="ph-spacer"></div>
		{#if actions}<div class="ph-actions">{@render actions()}</div>{/if}
	</div>
	{#if meta}<div class="ph-meta">{@render meta()}</div>{/if}
	{#if children}{@render children()}{/if}
</header>

<style>
	.ph {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.ph-back {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
		margin-bottom: 0.5rem;
		align-self: flex-start;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		transition: color var(--dur-fast) ease;
	}

	.ph-back:hover {
		color: var(--text-default);
	}

	.ph-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.ph-icon {
		display: inline-flex;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.ph-title {
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--text-default);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ph-title--mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-headline);
		line-height: var(--lh-headline);
	}

	.ph-spacer {
		flex: 1;
	}

	.ph-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.ph-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
		min-width: 0;
	}
</style>

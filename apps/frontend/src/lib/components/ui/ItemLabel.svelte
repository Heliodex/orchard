<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		detail = undefined,
		leading = undefined,
		mono = false
	}: {
		title: string;
		detail?: string | null;
		leading?: Snippet;
		mono?: boolean;
	} = $props();
</script>

<span class="item">
	{#if leading}<span class="lead">{@render leading()}</span>{/if}
	<span class="text">
		<span class="title" class:title--mono={mono} {title}>{title}</span>
		{#if detail}<span class="detail" title={detail}>{detail}</span>{/if}
	</span>
</span>

<style>
	.item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		padding-block: 0.625rem;
	}
	.lead {
		display: inline-flex;
		flex-shrink: 0;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}
	.title,
	.detail {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.title {
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.title--mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
	}
	.detail {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
</style>

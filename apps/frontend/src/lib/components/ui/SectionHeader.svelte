<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		count = undefined,
		description = undefined,
		flush = false,
		actions = undefined
	}: {
		title: string;
		count?: number;
		description?: string;
		flush?: boolean;
		actions?: Snippet;
	} = $props();
</script>

<div class="ui-section-header" class:ui-section-header--flush={flush}>
	<div class="ui-section-header-text">
		<h2 class="ui-section-header-title">
			{title}
			{#if count !== undefined}
				<span class="ui-section-header-count">{count}</span>
			{/if}
		</h2>
		{#if description}
			<p class="ui-section-header-desc">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="ui-section-header-actions">{@render actions()}</div>
	{/if}
</div>

<style>
	.ui-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: 2rem;
		margin-bottom: var(--space-3);
	}
	.ui-section-header--flush {
		margin-bottom: 0;
	}
	.ui-section-header-text {
		min-width: 0;
	}
	.ui-section-header-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
		font-weight: 600;
		letter-spacing: var(--track-headline);
		color: var(--text-default);
	}
	.ui-section-header-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.5rem;
		border-radius: var(--radius-pill);
		background-color: var(--fill-soft);
		color: var(--text-muted);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.ui-section-header-desc {
		margin: 0.125rem 0 0;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
	}
	.ui-section-header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}
</style>

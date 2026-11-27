<script lang="ts">
	import type { Snippet } from 'svelte';
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';
	import SettingsRail from '$lib/components/ui/SettingsRail.svelte';
	import { scrollFade } from '$lib/utils/scroll-fade';

	type RailGroup = { label: string; items: { id: string; label: string; href: string }[] };

	let {
		crumbs,
		groups,
		activeId,
		label,
		header,
		footer = undefined,
		children
	}: {
		crumbs: { label: string; href?: string }[];
		groups: RailGroup[];
		activeId: string;
		label: string;
		header: Snippet;
		footer?: Snippet;
		children: Snippet;
	} = $props();
</script>

<div class="settings-shell">
	<Breadcrumbs {crumbs} />
	{@render header()}
	<div class="settings-grid">
		<div class="settings-rail" {@attach scrollFade()}>
			<SettingsRail {groups} {activeId} {label} />
		</div>
		<div class="settings-stack" {@attach scrollFade()}>
			{@render children()}
			{#if footer}<div class="settings-foot">{@render footer()}</div>{/if}
		</div>
	</div>
</div>

<style>
	.settings-shell {
		--section-r: var(--radius-widget);
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		max-width: 100rem;
		margin: 0 auto;
		padding: 1.5rem;
	}
	.settings-grid {
		display: grid;
		grid-template-columns: 12rem minmax(0, 1fr);
		gap: var(--space-6);
		align-items: start;
	}
	.settings-stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}
	.settings-foot {
		display: flex;
		justify-content: center;
		padding-top: var(--space-4);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.settings-rail {
		min-width: 0;
	}
	@media (min-width: 64.0625rem) and (min-height: 32rem) {
		.settings-shell {
			height: 100%;
			min-height: 0;
		}
		.settings-grid {
			flex: 1 1 auto;
			align-items: stretch;
			min-height: 0;
		}
		.settings-rail,
		.settings-stack {
			--fade-top: 0;
			--fade-bottom: 0;
			--fade-size: 3.5rem;
			min-height: 0;
			overflow-y: auto;
			overscroll-behavior-y: contain;
			scrollbar-width: thin;
			mask-image: linear-gradient(
				to bottom,
				rgb(0 0 0 / calc(1 - var(--fade-top))) 0,
				rgb(0 0 0) calc(var(--fade-size) * var(--fade-top)),
				rgb(0 0 0) calc(100% - var(--fade-size) * var(--fade-bottom)),
				rgb(0 0 0 / calc(1 - var(--fade-bottom))) 100%
			);
		}
		.settings-rail :global(.ui-rail) {
			position: static;
		}
		.settings-stack {
			margin: -0.5rem;
			padding: 0.5rem;
		}
		.settings-stack > :global(*) {
			flex-shrink: 0;
		}
	}
	@media (max-width: 64rem) {
		.settings-grid {
			grid-template-columns: 1fr;
			gap: var(--space-4);
		}
	}
</style>

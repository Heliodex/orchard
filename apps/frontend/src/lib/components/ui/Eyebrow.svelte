<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		class: klass = '',
		children
	}: {
		class?: string;
		children: Snippet;
	} = $props();
</script>

<span class="ui-eyebrow {klass}">{@render children()}</span>

<style>
	.ui-eyebrow {
		display: inline-block;
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
		color: var(--text-faint);
	}
</style>

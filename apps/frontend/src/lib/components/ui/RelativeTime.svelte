<script lang="ts">
	import { elapsedSince } from '$lib/utils/clock.svelte';

	let { date }: { date: string | number | Date | null | undefined } = $props();

	const at = $derived(date == null ? null : new Date(date));

	const label = $derived.by(() => {
		if (!at || Number.isNaN(at.getTime())) return '';
		const s = Math.floor(elapsedSince(at.getTime()) / 1000);
		if (s < 60) return 'just now';
		const m = Math.floor(s / 60);
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		const d = Math.floor(h / 24);
		if (d < 30) return `${d}d ago`;
		return at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	});

	const full = $derived(
		at && !Number.isNaN(at.getTime())
			? at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
			: ''
	);
</script>

{#if label}<time class="rt" datetime={at?.toISOString()} title={full}>{label}</time>{/if}

<style>
	.rt {
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
	}
</style>

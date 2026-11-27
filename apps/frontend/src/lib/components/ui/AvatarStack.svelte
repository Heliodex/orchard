<script lang="ts">
	import Avatar from './Avatar.svelte';
	import type { AvatarUser, Mood } from '$lib/avatar';

	interface Person {
		user?: AvatarUser | null;
		seed?: string;
		name?: string;
		mood?: Mood;
	}

	let {
		people,
		size = 24,
		max = 4,
		label = undefined
	}: {
		people: Person[];
		size?: number;
		max?: number;
		label?: string;
	} = $props();

	const shown = $derived(people.length > max ? people.slice(0, max - 1) : people);
	const rest = $derived(people.length - shown.length);
	const names = $derived(
		people
			.map((p) => p.name ?? p.user?.name ?? p.user?.username ?? p.seed)
			.filter(Boolean)
			.join(', ')
	);
</script>

<div
	class="stack"
	style:--size="{size}px"
	role="group"
	aria-label={label ?? `${people.length} people`}
	title={names || undefined}
>
	{#each shown as person, i (person.user?.id ?? person.seed ?? i)}
		<span class="slot" style:--i={i} style:z-index={shown.length - i + 1}>
			<Avatar
				user={person.user}
				seed={person.seed}
				mood={person.mood}
				{size}
				alt={person.name ?? ''}
				style="width:{size}px;height:{size}px"
			/>
		</span>
	{/each}
	{#if rest > 0}
		<span class="slot more" style:--i={shown.length} aria-label="{rest} more">
			<span class="more-label">+{rest}</span>
		</span>
	{/if}
</div>

<style>
	.stack {
		--overlap: calc(var(--size) * -0.28);
		--gap: 2px;
		display: inline-flex;
		align-items: center;
		padding-left: calc(var(--overlap) * -1);
	}
	.slot {
		position: relative;
		display: grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
		margin-left: var(--overlap);
		border-radius: calc(26% * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow: 0 0 0 var(--gap) var(--bg-surface);
		transition: transform var(--spring-glide-duration) var(--spring-glide);
	}
	.stack:hover .slot {
		transform: translateX(calc(var(--i) * var(--size) * 0.12));
	}
	.more {
		background: var(--bg-active);
		color: var(--text-muted);
		font-size: max(0.625rem, calc(var(--size) * 0.4));
		font-weight: var(--weight-medium);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		letter-spacing: -0.011em;
	}
	.more-label {
		display: block;
		line-height: 1;
		text-box: trim-both cap alphabetic;
	}
</style>

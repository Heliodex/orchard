<script lang="ts" module>
	import type { Icon } from './types';

	export interface CommandItem {
		id: string;
		label: string;
		icon?: Icon;
		hint?: string;
		shortcut?: string[];
	}

	export interface CommandGroup {
		label: string;
		items: CommandItem[];
	}
</script>

<script lang="ts">
	import { Search } from 'lucide-svelte';
	import Kbd from './Kbd.svelte';

	let {
		groups,
		query = $bindable(''),
		placeholder = 'Search apps, domains and commands',
		onselect = undefined
	}: {
		groups: CommandGroup[];
		query?: string;
		placeholder?: string;
		onselect?: (id: string) => void;
	} = $props();

	const uid = $props.id();

	let active = $state(0);

	const visible = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return groups;
		return groups
			.map((g) => ({
				...g,
				items: g.items.filter(
					(i) => i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q)
				)
			}))
			.filter((g) => g.items.length > 0);
	});

	const flat = $derived(visible.flatMap((g) => g.items));

	$effect(() => {
		if (active >= flat.length) active = Math.max(0, flat.length - 1);
	});

	function itemId(id: string) {
		return `${uid}-${id}`;
	}

	function reveal() {
		const item = flat[active];
		if (item) document.getElementById(itemId(item.id))?.scrollIntoView({ block: 'nearest' });
	}

	function onkeydown(e: KeyboardEvent) {
		if (flat.length === 0) return;
		if (e.key === 'ArrowDown') active = (active + 1) % flat.length;
		else if (e.key === 'ArrowUp') active = (active - 1 + flat.length) % flat.length;
		else if (e.key === 'Enter') onselect?.(flat[active].id);
		else return;
		e.preventDefault();
		reveal();
	}
</script>

<div class="command">
	<div class="search">
		<span class="search-icon" aria-hidden="true"><Search size={16} /></span>
		<input
			class="field"
			type="text"
			role="combobox"
			aria-expanded="true"
			aria-controls="{uid}-list"
			aria-activedescendant={flat[active] ? itemId(flat[active].id) : undefined}
			aria-label={placeholder}
			{placeholder}
			autocomplete="off"
			spellcheck={false}
			bind:value={query}
			oninput={() => (active = 0)}
			{onkeydown}
		/>
		<Kbd keys="esc" />
	</div>
	<div class="list" id="{uid}-list" role="listbox" aria-label="Results">
		{#each visible as group (group.label)}
			<div class="group" role="group" aria-label={group.label}>
				<div class="group-label" aria-hidden="true">{group.label}</div>
				{#each group.items as item (item.id)}
					{@const index = flat.indexOf(item)}
					<div
						id={itemId(item.id)}
						class="item"
						class:item--active={index === active}
						role="option"
						tabindex="-1"
						aria-selected={index === active}
						onpointermove={() => (active = index)}
						onclick={() => onselect?.(item.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter') onselect?.(item.id);
						}}
					>
						{#if item.icon}
							{@const Glyph = item.icon}
							<span class="item-icon" aria-hidden="true"><Glyph size={16} /></span>
						{/if}
						<span class="item-label">{item.label}</span>
						{#if item.hint}<span class="item-hint">{item.hint}</span>{/if}
						{#if item.shortcut}<span class="item-keys"><Kbd keys={item.shortcut} /></span>{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="empty">No results for “{query.trim()}”</p>
		{/each}
	</div>
	<div class="foot">
		<span class="hint"><Kbd keys={['↑', '↓']} /><span class="hint-text">Move</span></span>
		<span class="hint"><Kbd keys="↵" /><span class="hint-text">Open</span></span>
		<span class="hint hint--end"
			><Kbd keys={['⌘', 'K']} /><span class="hint-text">Toggle</span></span
		>
	</div>
</div>

<style>
	.command {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 40rem;
		border-radius: calc(var(--radius-panel) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--material-glass-bg);
		backdrop-filter: var(--material-glass-filter);
		box-shadow: var(--shadow-overlay);
		color: var(--text-default);
		overflow: hidden;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 3.25rem;
		padding: 0 1rem;
		box-shadow: inset 0 -1px 0 color-mix(in oklab, var(--neutral-10) 8%, transparent);
	}
	.search-icon {
		display: flex;
		flex-shrink: 0;
		color: var(--text-muted);
	}
	.field {
		flex: 1;
		min-width: 0;
		height: 100%;
		border: none;
		background: transparent;
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-headline);
		outline: none;
	}
	.field::placeholder {
		color: var(--text-faint);
	}
	.list {
		max-height: 22rem;
		padding: var(--float-pad);
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
	}
	.group + .group {
		margin-top: 0.5rem;
	}
	.group-label {
		padding: 0.5rem 0.5rem 0.625rem;
		color: var(--text-faint);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: var(--weight-medium);
		text-box: trim-both cap alphabetic;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 2.5rem;
		padding: 0 0.75rem;
		border-radius: var(--float-item-r);
		corner-shape: var(--corner);
		cursor: pointer;
		user-select: none;
	}
	.item--active {
		background: var(--float-hover);
	}
	.item-icon {
		display: flex;
		flex-shrink: 0;
		color: var(--text-muted);
	}
	.item--active .item-icon {
		color: var(--text-default);
	}
	.item-label,
	.item-hint {
		display: block;
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.item-label {
		flex-shrink: 0;
		max-width: 60%;
		font-size: var(--text-body);
	}
	.item-hint {
		flex: 1;
		color: var(--text-faint);
		font-size: var(--text-callout);
	}
	.item-keys {
		display: flex;
		flex-shrink: 0;
		margin-left: auto;
	}
	.empty {
		padding: 2rem 1rem;
		color: var(--text-muted);
		font-size: var(--text-callout);
		text-align: center;
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.625rem 1rem;
		box-shadow: inset 0 1px 0 color-mix(in oklab, var(--neutral-10) 8%, transparent);
	}
	.hint {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
	.hint--end {
		margin-left: auto;
	}
	.hint-text {
		color: var(--text-faint);
		font-size: var(--text-caption);
		text-box: trim-both cap alphabetic;
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Icon } from './types';

	interface Option {
		value: string;
		label: string;
		description?: string;
		meta?: string;
		icon?: Icon;
		disabled?: boolean;
	}

	let {
		options,
		value = $bindable(''),
		label,
		name = undefined,
		variant = 'list',
		columns = undefined,
		disabled = false,
		onchange = undefined,
		extra = undefined
	}: {
		options: readonly Option[];
		value?: string;
		label: string;
		name?: string;
		variant?: 'list' | 'cards';
		columns?: number;
		disabled?: boolean;
		onchange?: (value: string) => void;
		extra?: Snippet<[Option]>;
	} = $props();

	const uid = $props.id();
	const groupName = $derived(name ?? `radio-${uid}`);
	const cols = $derived(columns ?? Math.min(options.length, 3));

	function select(next: string) {
		value = next;
		onchange?.(next);
	}
</script>

<div
	class="choices choices--{variant}"
	style:--cols={variant === 'cards' ? cols : undefined}
	role="radiogroup"
	aria-label={label}
	aria-disabled={disabled || undefined}
>
	{#each options as opt (opt.value)}
		{@const off = disabled || !!opt.disabled}
		{@const id = `${groupName}-${opt.value}`}
		<label class="opt" class:opt--off={off} class:opt--on={value === opt.value} for={id}>
			<input
				{id}
				type="radio"
				class="native"
				name={groupName}
				value={opt.value}
				checked={value === opt.value}
				disabled={off}
				aria-describedby={opt.description ? `${id}-desc` : undefined}
				onchange={() => select(opt.value)}
			/>
			{#if variant === 'cards'}
				<span class="card-head">
					{#if opt.icon}
						{@const Glyph = opt.icon}
						<span class="glyph"><Glyph size={16} aria-hidden="true" /></span>
					{/if}
					<span class="title">{opt.label}</span>
					<span class="dot" aria-hidden="true"></span>
				</span>
				{#if opt.meta}<span class="meta">{opt.meta}</span>{/if}
				{#if opt.description}<span class="desc" id="{id}-desc">{opt.description}</span>{/if}
				{#if extra}<span class="extra">{@render extra(opt)}</span>{/if}
			{:else}
				<span class="dot" aria-hidden="true"></span>
				<span class="title">{opt.label}</span>
				{#if opt.meta}<span class="meta">{opt.meta}</span>{/if}
				{#if opt.description}<span class="desc" id="{id}-desc">{opt.description}</span>{/if}
			{/if}
		</label>
	{/each}
</div>

<style>
	.choices--list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.choices--cards {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 0.75rem;
	}
	.native {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		opacity: 0;
		pointer-events: none;
	}
	.opt {
		position: relative;
		min-width: 0;
		cursor: pointer;
		user-select: none;
	}
	.opt--off {
		cursor: not-allowed;
	}

	.choices--list .opt {
		display: grid;
		grid-template-columns: 1rem minmax(0, 1fr) auto;
		align-items: center;
		column-gap: 0.5rem;
		row-gap: 0.3125rem;
	}
	.choices--list .desc {
		grid-column: 2 / -1;
	}

	.dot {
		position: relative;
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: var(--bg-raised);
		box-shadow:
			inset 0 0 0 1px var(--border-strong),
			0 1px 1px color-mix(in oklab, var(--neutral-10) 4%, transparent);
		transition:
			background-color var(--dur-fast) ease,
			box-shadow var(--dur-fast) ease,
			transform var(--spring-press-duration) var(--spring-press);
	}
	.dot::after {
		content: '';
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 50%;
		background: var(--text-on-accent);
		opacity: 0;
		transform: scale(0.2);
		transition:
			opacity var(--fade-in) var(--curve-out),
			transform var(--spring-pop-duration) var(--spring-pop);
	}
	.opt:hover:not(.opt--off, .opt--on) .dot {
		box-shadow:
			inset 0 0 0 1px var(--neutral-6),
			0 1px 1px color-mix(in oklab, var(--neutral-10) 4%, transparent);
	}
	.opt:active:not(.opt--off) .dot {
		transform: scale(0.9);
	}
	.opt--on .dot {
		background: var(--accent);
		box-shadow:
			inset 0 0 0 0.5px color-mix(in oklab, var(--accent-10) 30%, transparent),
			inset 0 1px 0 color-mix(in oklab, var(--accent-contrast) 18%, transparent),
			0 1px 2px color-mix(in oklab, var(--accent-10) 24%, transparent);
	}
	.opt--on .dot::after {
		opacity: 1;
		transform: none;
	}
	.native:focus-visible ~ .dot,
	.native:focus-visible ~ .card-head .dot {
		box-shadow:
			inset 0 0 0 1px var(--accent),
			0 0 0 3px var(--focus-ring);
	}
	.opt--off .dot {
		opacity: 0.4;
	}

	.title {
		display: block;
		min-width: 0;
		overflow-x: clip;
		padding-block: 0.3em;
		margin-block: -0.3em;
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: var(--weight-medium);
		color: var(--text-default);
		white-space: nowrap;
		text-overflow: ellipsis;
		text-box: trim-both cap alphabetic;
	}
	.choices--list .title {
		font-weight: var(--weight-regular);
	}
	.meta {
		display: block;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
	}
	.desc {
		display: block;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
		text-box: trim-both cap alphabetic;
	}
	.opt--off .title,
	.opt--off .meta,
	.opt--off .desc {
		color: var(--text-faint);
	}

	.choices--cards .opt {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.875rem 1rem 1rem;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-raised);
		box-shadow: var(--shadow-raised);
		transition: transform var(--spring-press-duration) var(--spring-press);
	}
	.choices--cards .opt::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: var(--bg-hover);
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--dur-fast) ease;
	}
	.choices--cards .opt::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow:
			inset 0 0 0 1.5px var(--accent),
			0 0 0 3px color-mix(in oklab, var(--accent-7) 14%, transparent);
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--dur-fast) ease;
	}
	.choices--cards .opt:hover:not(.opt--off, .opt--on)::before {
		opacity: 1;
	}
	.choices--cards .opt--on::after {
		opacity: 1;
	}
	.choices--cards .opt:active:not(.opt--off) {
		transform: scale(0.985);
	}
	.choices--cards .opt--off {
		background: var(--bg-sunken);
	}
	.choices--cards .opt > :not(.native) {
		position: relative;
	}
	.card-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		height: 1rem;
	}
	.card-head .title {
		flex: 1;
	}
	.glyph {
		display: flex;
		flex-shrink: 0;
		color: var(--text-muted);
	}
	.opt--on .glyph {
		color: var(--accent);
	}
	.choices--cards .meta {
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.choices--cards .desc {
		margin-top: 0.125rem;
	}
	.extra {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.25rem;
	}
</style>

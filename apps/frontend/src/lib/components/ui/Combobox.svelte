<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { Combobox } from 'melt/builders';
	import { Check, ChevronsUpDown, CornerDownLeft, Search, X } from 'lucide-svelte';
	import type { DropdownOption } from './dropdown';
	import type { Icon } from './types';
	import Spinner from './Spinner.svelte';
	import { overlayMotion } from '$lib/utils/motion.svelte';

	const CREATE = '__ui-combobox-create__';

	let {
		value = $bindable(''),
		query = $bindable(''),
		options,
		placeholder = 'Search',
		label = undefined,
		ariaLabelledby = undefined,
		icon = Search,
		disabled = false,
		loading = false,
		size = 'md',
		empty = 'No matches',
		creatable = false,
		createLabel = (q: string) => `Use “${q}”`,
		trailing = undefined,
		leading = undefined,
		class: className = '',
		onchange = undefined,
		oncreate = undefined,
		onclear = undefined
	}: {
		value?: string;
		query?: string;
		options: DropdownOption[];
		placeholder?: string;
		label?: string;
		ariaLabelledby?: string;
		icon?: Icon;
		disabled?: boolean;
		loading?: boolean;
		size?: 'md' | 'lg';
		empty?: string | Snippet<[string]>;
		creatable?: boolean;
		createLabel?: (query: string) => string;
		trailing?: Snippet<[DropdownOption]>;
		leading?: Snippet<[DropdownOption]>;
		class?: string;
		onchange?: (value: string) => void;
		oncreate?: (query: string) => void;
		onclear?: () => void;
	} = $props();

	const combo = new Combobox<string>({
		value: () => value || undefined,
		onValueChange: (next) => {
			if (next === CREATE) return;
			value = next ?? '';
			if (!value && onclear) onclear();
			else onchange?.(value);
		},
		inputValue: () => query,
		onInputValueChange: (next) => {
			query = next;
		},
		floatingConfig: {
			computePosition: { placement: 'bottom-start' },
			offset: { mainAxis: 6 }
		}
	});

	const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? '');

	$effect(() => {
		const text = selectedLabel;
		const open = combo.open;
		untrack(() => {
			if (open) return;
			if (!text && creatable) return;
			if (combo.inputValue !== text) combo.inputValue = text;
		});
	});

	const typed = $derived(combo.touched ? combo.inputValue.trim() : '');
	const needle = $derived(typed.toLowerCase());
	const filtered = $derived(
		needle
			? options.filter(
					(o) =>
						o.label.toLowerCase().includes(needle) ||
						o.value.toLowerCase().includes(needle) ||
						o.description?.toLowerCase().includes(needle)
				)
			: options
	);
	const createText = $derived(query.trim());
	const showCreate = $derived(
		creatable && !!createText && !options.some((o) => o.value === createText)
	);
	const clearable = $derived(!!onclear && !!(value || query) && !loading && !disabled);

	function create() {
		const text = createText;
		combo.open = false;
		oncreate?.(text);
	}
</script>

<div
	class="field field--{size} {className}"
	class:field--open={combo.open}
	class:field--disabled={disabled}
>
	{#if icon}
		{@const Lead = icon}
		<span class="lead" aria-hidden="true"><Lead size={size === 'lg' ? 16 : 14} /></span>
	{/if}
	<input
		{...combo.input}
		class="control"
		class:control--bare={!icon}
		{placeholder}
		{disabled}
		aria-label={label}
		aria-labelledby={ariaLabelledby}
		aria-busy={loading || undefined}
		autocomplete="off"
		spellcheck={false}
	/>
	{#if loading}
		<span class="end end--static" aria-hidden="true"><Spinner size={13} /></span>
	{:else if clearable}
		<button type="button" class="end" aria-label="Clear" onclick={() => onclear?.()}>
			<X size={14} />
		</button>
	{:else}
		<button
			{...combo.trigger}
			type="button"
			class="end"
			tabindex="-1"
			aria-label="Show options"
			{disabled}
		>
			<ChevronsUpDown size={14} />
		</button>
	{/if}
</div>

<div
	{...combo.content}
	class="ui-popover ui-popover--menu"
	{@attach overlayMotion(() => combo.open, { origin: 'center top' })}
>
	{#if showCreate}
		<div {...combo.getOption(CREATE, createLabel(createText), create)} class="ui-dropdown-option">
			{#if value}<span class="ui-dropdown-check" aria-hidden="true"></span>{/if}
			<span class="ui-dropdown-icon"><CornerDownLeft size={16} /></span>
			<span class="ui-dropdown-option-main">
				<span class="ui-dropdown-text">{createLabel(createText)}</span>
			</span>
		</div>
	{/if}
	{#each filtered as option (option.value)}
		<div
			{...combo.getOption(option.value, option.label)}
			class="ui-dropdown-option"
			class:ui-dropdown-option--rich={!!option.description}
			class:ui-dropdown-option--selected={combo.isSelected(option.value)}
		>
			{#if value}
				<span class="ui-dropdown-check" aria-hidden="true">
					{#if combo.isSelected(option.value)}<Check size={16} strokeWidth={2.25} />{/if}
				</span>
			{/if}
			{#if leading}
				<span class="ui-dropdown-icon">{@render leading(option)}</span>
			{:else if option.icon}
				{@const Glyph = option.icon}
				<span class="ui-dropdown-icon"><Glyph size={16} /></span>
			{/if}
			<span class="ui-dropdown-option-main">
				<span class="ui-dropdown-text">
					{#if option.mono}<code class="ui-dropdown-mono">{option.label}</code
						>{:else}{option.label}{/if}
				</span>
				{#if option.description}
					<span class="ui-dropdown-option-desc">{option.description}</span>
				{/if}
			</span>
			{#if trailing}<span class="trail">{@render trailing(option)}</span>{/if}
		</div>
	{:else}
		{#if !showCreate}
			<div class="ui-dropdown-empty" role="presentation">
				{#if typeof empty === 'string'}
					<span class="empty-text"
						>{empty}{#if typed}&nbsp;for “{typed}”{/if}</span
					>
				{:else}
					{@render empty(typed)}
				{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.field {
		position: relative;
		display: block;
		min-width: 0;
	}
	.lead {
		position: absolute;
		top: 50%;
		left: 0.625rem;
		display: flex;
		color: var(--text-faint);
		transform: translateY(-50%);
		pointer-events: none;
	}
	.control {
		display: block;
		width: 100%;
		min-width: 0;
		height: 2rem;
		padding: 0 2rem 0 2rem;
		border: none;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-raised);
		box-shadow: inset 0 0 0 1px var(--border-default);
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		transition:
			box-shadow var(--fade-in) var(--curve-out),
			background-color var(--fade-in) var(--curve-out);
	}
	.field--lg .control {
		height: 2.75rem;
		padding-left: 2.375rem;
		font-size: var(--text-body);
	}
	.field--lg .lead {
		left: 0.8125rem;
	}
	.field--lg .control {
		padding-right: 2.75rem;
	}
	.field--lg .end {
		right: 0.5rem;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: calc((var(--radius-control) - 0.375rem) * var(--corner-scale));
	}
	.field--lg .control--bare {
		padding-left: 0.875rem;
	}
	.control--bare {
		padding-left: 0.6875rem;
	}
	.control::placeholder {
		color: var(--text-faint);
	}
	.control:hover:not(:disabled) {
		box-shadow: inset 0 0 0 1px var(--border-strong);
	}
	.control:focus {
		outline: none;
		box-shadow:
			inset 0 0 0 1px var(--accent),
			0 0 0 3px var(--focus-ring);
	}
	.end {
		position: absolute;
		top: 50%;
		right: 0.25rem;
		translate: 0 -50%;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border: none;
		border-radius: calc((var(--radius-control) - 0.25rem) * var(--corner-scale));
		corner-shape: var(--corner);
		background: transparent;
		color: var(--text-faint);
		cursor: pointer;
		transition:
			background-color var(--fade-in) var(--curve-out),
			color var(--fade-in) var(--curve-out);
	}
	.end--static {
		cursor: default;
		pointer-events: none;
	}
	.end:hover:not(:disabled):not(.end--static),
	.field--open .end:not(.end--static) {
		background: color-mix(in oklab, var(--neutral-10) 7%, transparent);
		color: var(--text-default);
	}
	.end:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}
	.trail {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
	}
	.field--disabled {
		opacity: 0.5;
	}
	.field--disabled .control,
	.field--disabled .end {
		cursor: not-allowed;
	}
	.empty-text {
		display: block;
		text-box: trim-both cap alphabetic;
	}
</style>

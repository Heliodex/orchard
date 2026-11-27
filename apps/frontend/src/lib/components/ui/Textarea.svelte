<script lang="ts">
	let {
		value = $bindable(''),
		rows = 3,
		autoGrow = false,
		maxRows = 12,
		error = false,
		mono = false,
		maxlength = undefined,
		counter = false,
		size = 'md',
		class: className = '',
		...rest
	}: {
		value?: string | null;
		rows?: number;
		autoGrow?: boolean;
		maxRows?: number;
		error?: boolean;
		mono?: boolean;
		maxlength?: number;
		counter?: boolean;
		size?: 'md' | 'lg';
		class?: string;
		[key: string]: unknown;
	} = $props();

	let el = $state<HTMLTextAreaElement | null>(null);
	const length = $derived((value ?? '').length);
	const near = $derived(maxlength != null && length >= maxlength * 0.9);

	function fit() {
		if (!el || !autoGrow || !el.getClientRects().length) return;
		const style = getComputedStyle(el);
		const line = parseFloat(style.lineHeight) || 20;
		const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
		const cap = line * maxRows + pad;
		el.style.height = 'auto';
		const next = Math.min(el.scrollHeight, cap);
		el.style.height = `${next}px`;
		el.style.overflowY = el.scrollHeight > cap ? 'auto' : 'hidden';
	}

	$effect(() => {
		void value;
		fit();
	});
</script>

<span class="wrap {className}" class:wrap--counter={counter && maxlength != null}>
	<textarea
		bind:this={el}
		bind:value
		{rows}
		{maxlength}
		class="area area--{size}"
		class:area--error={error}
		class:area--mono={mono}
		class:area--grow={autoGrow}
		aria-invalid={error || undefined}
		{...rest}></textarea>
	{#if counter && maxlength != null}
		<span class="count" class:count--near={near} aria-hidden="true">{length}/{maxlength}</span>
	{/if}
</span>

<style>
	.wrap {
		position: relative;
		display: block;
		min-width: 0;
	}
	.area {
		display: block;
		width: 100%;
		min-width: 0;
		min-height: 2rem;
		padding: 0.375rem 0.6875rem;
		border: none;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--neutral-10) 6%, transparent);
		box-shadow: inset 0 0 0 0.5px color-mix(in oklab, var(--neutral-10) 6%, transparent);
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		line-height: var(--lh-body);
		resize: vertical;
		transition:
			box-shadow var(--dur-fast) ease,
			background-color var(--dur-fast) ease;
	}
	.area--lg {
		min-height: 2.25rem;
		padding: 0.4375rem 0.75rem;
		border-radius: calc(0.625rem * var(--corner-scale));
		font-size: var(--text-headline);
	}
	.area--grow {
		resize: none;
		overflow-y: hidden;
	}
	.area--mono {
		font-family: var(--font-mono);
		font-size: var(--text-callout);
		line-height: var(--lh-body);
	}
	.wrap--counter .area {
		padding-bottom: 1.5rem;
	}
	.area::placeholder {
		color: var(--text-muted);
	}
	.area:hover:not(:disabled):not(:focus) {
		background: color-mix(in oklab, var(--neutral-10) 8%, transparent);
	}
	.area:focus {
		outline: none;
		background: var(--bg-surface);
		box-shadow:
			inset 0 0 0 1px var(--accent-solid),
			0 0 0 3.5px color-mix(in oklab, var(--accent-solid) 22%, transparent);
	}
	.area--error,
	.area--error:hover:not(:focus) {
		background: color-mix(in oklab, var(--red-solid) 7%, transparent);
		box-shadow: inset 0 0 0 1px var(--red-6);
	}
	.area--error:focus {
		box-shadow:
			inset 0 0 0 1px var(--red-solid),
			0 0 0 3.5px color-mix(in oklab, var(--red-solid) 22%, transparent);
	}
	.area:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		resize: none;
	}
	.count {
		position: absolute;
		right: 0.625rem;
		bottom: 0.5rem;
		font-size: var(--text-caption);
		line-height: 1;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		pointer-events: none;
		text-box: trim-both cap alphabetic;
	}
	.count--near {
		color: var(--status-warning);
	}
</style>

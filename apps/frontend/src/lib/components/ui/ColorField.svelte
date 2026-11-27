<script lang="ts">
	import { Check, Copy } from 'lucide-svelte';

	let {
		label,
		description = '',
		value,
		onchange
	}: {
		label: string;
		description?: string;
		value: string;
		onchange: (value: string) => void;
	} = $props();

	let draft = $state('');
	let editing = $state(false);
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;
	let pickerRef = $state<HTMLInputElement | undefined>(undefined);

	const shown = $derived(editing ? draft : value);
	const valid = $derived(/^#[0-9a-fA-F]{6}$/.test(shown));

	function normalize(raw: string) {
		const t = raw.trim().replace(/^#?/, '');
		if (/^[0-9a-fA-F]{3}$/.test(t)) {
			return `#${t[0]}${t[0]}${t[1]}${t[1]}${t[2]}${t[2]}`.toLowerCase();
		}
		if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`;
		return null;
	}

	function commit() {
		const next = normalize(draft);
		editing = false;
		if (next && next !== value) onchange(next);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			(e.currentTarget as HTMLInputElement).blur();
		} else if (e.key === 'Escape') {
			editing = false;
			(e.currentTarget as HTMLInputElement).blur();
		}
	}

	async function copy() {
		await navigator.clipboard.writeText(value);
		copied = true;
		if (copyTimer) clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = false), 1600);
	}
</script>

<div class="cf-root">
	<button
		type="button"
		class="cf-swatch"
		style="--cf-color: {value}"
		onclick={() => pickerRef?.click()}
		aria-label="Pick {label}"
	>
		<input
			bind:this={pickerRef}
			class="cf-picker"
			type="color"
			{value}
			tabindex="-1"
			aria-hidden="true"
			oninput={(e) => onchange(e.currentTarget.value)}
		/>
	</button>

	<div class="cf-text">
		<span class="cf-label">{label}</span>
		{#if description}
			<span class="cf-desc">{description}</span>
		{/if}
	</div>

	<div class="cf-value">
		<input
			class="cf-hex"
			class:cf-hex--invalid={editing && !valid}
			type="text"
			spellcheck="false"
			autocomplete="off"
			aria-label="{label} hex value"
			value={shown}
			oninput={(e) => {
				editing = true;
				draft = e.currentTarget.value;
				if (/^#[0-9a-fA-F]{6}$/.test(draft) && draft.toLowerCase() !== value.toLowerCase()) {
					onchange(draft.toLowerCase());
				}
			}}
			onfocus={() => {
				editing = true;
				draft = value;
			}}
			onblur={commit}
			onkeydown={onKeydown}
		/>
		<button type="button" class="cf-copy" onclick={copy} aria-label="Copy {label} hex value">
			{#if copied}
				<Check class="h-3.5 w-3.5" />
			{:else}
				<Copy class="h-3.5 w-3.5" />
			{/if}
		</button>
	</div>
</div>

<style>
	.cf-root {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0.625rem var(--space-3);
		border-radius: calc(var(--radius-md) * var(--corner-scale));
		corner-shape: var(--corner);
		transition: background-color var(--dur-fast);
	}
	.cf-root:hover {
		background-color: var(--fill-quiet);
	}
	.cf-swatch {
		position: relative;
		width: 2.25rem;
		height: 2.25rem;
		flex-shrink: 0;
		border-radius: calc(var(--radius-sm) * var(--corner-scale));
		corner-shape: var(--corner);
		border: none;
		padding: 0;
		cursor: pointer;
		background-color: var(--cf-color);
		box-shadow:
			inset 0 0 0 1px var(--rule-strong),
			var(--elev-1);
	}
	.cf-swatch:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.cf-picker {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		border: none;
		padding: 0;
		pointer-events: none;
	}
	.cf-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.cf-label {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		font-weight: 600;
		letter-spacing: var(--track-body);
		color: var(--text-default);
	}
	.cf-desc {
		font-size: var(--text-footnote);
		color: var(--text-muted);
		line-height: 1.4;
	}
	.cf-value {
		display: flex;
		align-items: center;
		gap: 0.125rem;
		flex-shrink: 0;
	}
	.cf-hex {
		width: 5.5rem;
		padding: 0.25rem var(--space-2);
		border-radius: calc(var(--radius-xs) * var(--corner-scale));
		corner-shape: var(--corner);
		border: 1px solid transparent;
		background-color: transparent;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
		text-align: right;
		transition:
			border-color var(--dur-fast),
			background-color var(--dur-fast),
			color var(--dur-fast);
	}
	.cf-hex:hover {
		border-color: var(--border-default);
	}
	.cf-hex:focus {
		outline: none;
		border-color: var(--accent);
		background-color: var(--bg-surface);
		color: var(--text-default);
		text-align: left;
	}
	.cf-hex--invalid:focus {
		border-color: var(--status-error);
		color: var(--status-error);
	}
	.cf-copy {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: calc(var(--radius-xs) * var(--corner-scale));
		corner-shape: var(--corner);
		border: none;
		background: none;
		color: var(--text-faint);
		cursor: pointer;
		transition:
			color var(--dur-fast),
			background-color var(--dur-fast);
	}
	.cf-copy:hover {
		color: var(--text-default);
		background-color: var(--fill-soft);
	}
	@media (max-width: 640px) {
		.cf-hex {
			width: 4.75rem;
		}
	}
</style>

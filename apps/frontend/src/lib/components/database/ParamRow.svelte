<script lang="ts">
	import { Alert, Dropdown, Input } from '$lib/components/ui';
	import SettingRow from '$lib/components/ui/SettingRow.svelte';
	import type { ParamMeta } from './types';

	let {
		param,
		value,
		invalid = false,
		drift = undefined,
		advisory = undefined,
		onchange
	}: {
		param: ParamMeta;
		value: string;
		invalid?: boolean;
		drift?: string | null;
		advisory?: string;
		onchange: (value: string) => void;
	} = $props();

	const uid = $props.id();
	const id = $derived(`${uid}-${param.key}`);

	const unitMatch = $derived(param.label.match(/\s*\(([^)]+)\)\s*$/));
	const unit = $derived(unitMatch?.[1]);
	const title = $derived.by(() => {
		const bare = unitMatch ? param.label.slice(0, unitMatch.index) : param.label;
		return bare.replace(/(?<=[\s-])([A-Z])(?=[a-z])/g, (c) => c.toLowerCase());
	});

	const offValue = $derived(param.help.match(/(-?\d+) disables/)?.[1]);

	const defaultNote = $derived.by(() => {
		if (param.autoSized) return 'Automatic by default';
		if (offValue !== undefined && param.defaultValue === offValue) {
			return `Default ${param.defaultValue} (off)`;
		}
		return `Default ${param.defaultValue}`;
	});

	const hasDrift = $derived(drift !== undefined);

	const read = (e: Event) => (e.currentTarget as HTMLInputElement).value;
</script>

<div class="param">
	<SettingRow label={title} for={id}>
		{#snippet hint()}
			<span class="meta">
				<span class="guc">{param.key}</span>
				<span>{defaultNote}</span>
				{#if param.requiresRestart}<span>Needs a restart</span>{/if}
			</span>
			{#if hasDrift}
				<span class="drift">
					{#if drift == null}
						Running the default, changed outside Orchard
					{:else}
						Running <span class="drift-value">{drift}</span>, changed outside Orchard
					{/if}
				</span>
			{/if}
		{/snippet}
		<div class="control">
			{#if param.kind === 'string' && param.enum}
				<Dropdown
					{id}
					{value}
					mono
					options={param.enum.map((opt) => ({ value: opt, label: opt }))}
					onchange={(v) => onchange(v)}
				/>
			{:else}
				<Input
					{id}
					{value}
					mono
					error={invalid}
					suffix={unit}
					inputmode={param.kind === 'int' ? 'numeric' : undefined}
					autocomplete="off"
					spellcheck={false}
					placeholder={param.autoSized ? 'Automatic' : param.defaultValue}
					oninput={(e: Event) => onchange(read(e))}
				/>
			{/if}
		</div>
	</SettingRow>
	{#if advisory}
		<Alert tone="warning">{advisory}</Alert>
	{/if}
</div>

<style>
	.param {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-2);
		color: var(--text-faint);
	}
	.meta > * + *::before {
		content: '·';
		margin-right: var(--space-2);
	}
	.guc {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		color: var(--text-muted);
	}
	.drift {
		display: block;
		color: var(--status-warning);
	}
	.drift-value {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
	}
	.control {
		width: 11rem;
	}
</style>

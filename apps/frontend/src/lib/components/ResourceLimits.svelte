<script lang="ts">
	import ResourcePicker from '$lib/components/ResourcePicker.svelte';
	import { Button, FormActions, SectionCard } from '$lib/components/ui';
	import { presence } from '$lib/utils/transitions';
	import { instanceFeatures, isSuperAdmin } from '$lib/stores';
	import { formatCpu as fmtCpuPreset, formatMemory as fmtMemoryPreset } from '$lib/presets';

	let {
		entity,
		resourceCpuMilli = $bindable<number | null>(),
		resourceMemoryBytes = $bindable<number | null>(),
		orgDefaultCpuMilli,
		orgDefaultMemoryBytes,
		effectiveCpuLimit = null,
		effectiveMemLimit = null,
		resourcesDirty = $bindable<boolean>(),
		savingResources,
		currentCpuUsage = null,
		currentMemUsage = null,
		onSaveResources
	}: {
		entity: any;
		resourceCpuMilli: number | null;
		resourceMemoryBytes: number | null;
		orgDefaultCpuMilli: number | null;
		orgDefaultMemoryBytes: number | null;
		effectiveCpuLimit?: number | null;
		effectiveMemLimit?: number | null;
		resourcesDirty: boolean;
		savingResources: boolean;
		currentCpuUsage?: number | null;
		currentMemUsage?: number | null;
		onSaveResources: () => void;
	} = $props();

	const currentLabel = $derived.by(() => {
		if ($instanceFeatures.resourceLimits === 'off') return 'No limits';
		if (resourceCpuMilli === 0 && resourceMemoryBytes === 0) return 'Unlimited';
		if (resourceCpuMilli != null && resourceMemoryBytes != null)
			return `${fmtCpuPreset(resourceCpuMilli)} · ${fmtMemoryPreset(resourceMemoryBytes)}`;
		return 'Organization default';
	});
</script>

<SectionCard title="CPU and memory">
	{#snippet actions()}
		<span class="current">{currentLabel}</span>
	{/snippet}
	<ResourcePicker
		bind:cpuMilli={resourceCpuMilli}
		bind:memoryBytes={resourceMemoryBytes}
		kind="database"
		defaultCpuMilli={orgDefaultCpuMilli}
		defaultMemoryBytes={orgDefaultMemoryBytes}
		showUnlimited={$isSuperAdmin}
		{currentCpuUsage}
		{currentMemUsage}
		maxCpuMilli={effectiveCpuLimit}
		maxMemoryBytes={effectiveMemLimit}
		onchange={() => {
			resourcesDirty = true;
		}}
	/>
	{#if $instanceFeatures.resourceLimits !== 'off' && (resourcesDirty || savingResources)}
		<div class="save" in:presence out:presence>
			<FormActions hint="Instances restart one at a time">
				<Button
					variant="ghost"
					disabled={savingResources}
					onclick={() => {
						resourceCpuMilli = entity?.cpuRequestMilli ?? null;
						resourceMemoryBytes =
							entity?.memoryRequestBytes != null ? Number(entity.memoryRequestBytes) : null;
						resourcesDirty = false;
					}}>Discard</Button
				>
				<Button variant="primary" loading={savingResources} onclick={onSaveResources}>Save</Button>
			</FormActions>
		</div>
	{/if}
</SectionCard>

<style>
	.current {
		font-size: var(--text-footnote);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.save {
		margin-top: var(--space-4);
	}
</style>

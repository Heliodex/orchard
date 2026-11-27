<script lang="ts">
	import { HardDrive, Plus } from 'lucide-svelte';
	import {
		Button,
		EmptyState,
		FormActions,
		Input,
		RowList,
		SectionCard,
		Swap,
		Switch
	} from '$lib/components/ui';

	import type { VolumeObservation } from '$lib/types/deployment';

	interface VolumeEntry extends VolumeObservation {
		name: string;
		type: 'pvc' | 'hostPath' | 'emptyDir';
		mountPath: string;
		pvcName?: string;
		storageSize?: string;
		hostPath?: string;
		readOnly: boolean;
	}

	type ObservedTone = 'ok' | 'busy' | 'bad';

	function observed(volume: VolumeEntry): { text: string; tone: ObservedTone } | null {
		if (!volume.observedAt && !volume.phase) return null;
		if (volume.phase === 'Missing') {
			return { text: 'Not found. Orchard creates it on the next deploy.', tone: 'bad' };
		}
		if (volume.resizeState === 'failed') {
			return {
				text: `Resize to ${volume.storageSize} failed${volume.resizeMessage ? `: ${volume.resizeMessage}` : ''}`,
				tone: 'bad'
			};
		}
		if (volume.resizeState === 'pendingRestart') {
			return {
				text: `${volume.observedCapacity ?? 'Current size'} provisioned. Grows to ${volume.storageSize} once the app restarts.`,
				tone: 'busy'
			};
		}
		if (volume.resizeState === 'resizing') {
			return {
				text: `Resizing ${volume.observedCapacity ? `from ${volume.observedCapacity} ` : ''}to ${volume.storageSize}`,
				tone: 'busy'
			};
		}
		if (volume.phase === 'Pending') {
			return { text: 'Waiting for storage to be provisioned', tone: 'busy' };
		}
		if (volume.phase === 'Lost') {
			return { text: 'The volume was lost', tone: 'bad' };
		}
		if (volume.observedCapacity) {
			return { text: `${volume.observedCapacity} provisioned`, tone: 'ok' };
		}
		return null;
	}

	let {
		volumes = $bindable<VolumeEntry[]>(),
		isEditing = $bindable(false),
		savingVolumes,
		onSave
	}: {
		volumes: VolumeEntry[];
		isEditing?: boolean;
		savingVolumes: boolean;
		onSave: () => void;
	} = $props();

	const COLUMNS = [
		{ label: 'Name', width: 'minmax(0, 1fr)' },
		{ label: 'Mount path', width: 'minmax(0, 1.618fr)' },
		{ label: 'Size', width: '6rem' },
		{ label: 'Read-only', width: '4.5rem' }
	] as const;

	const keys = new WeakMap<object, number>();
	let nextKey = 0;
	function keyOf(volume: VolumeEntry) {
		let k = keys.get(volume);
		if (k === undefined) {
			k = nextKey++;
			keys.set(volume, k);
		}
		return k;
	}

	let saved: VolumeEntry[] = [];
	$effect(() => {
		if (!isEditing) saved = $state.snapshot(volumes) as VolumeEntry[];
	});

	const notes = $derived(
		volumes
			.map((volume) => ({ volume, seen: observed(volume) }))
			.filter((n) => n.seen && n.seen.tone !== 'ok')
	);

	function addVolume() {
		isEditing = true;
		volumes = [
			...volumes,
			{ name: '', type: 'pvc', mountPath: '', pvcName: '', storageSize: '1Gi', readOnly: false }
		];
	}

	function removeVolume(index: number) {
		isEditing = true;
		volumes = volumes.filter((_, i) => i !== index);
	}

	function discard() {
		volumes = structuredClone(saved);
		isEditing = false;
	}

	function handleSave() {
		isEditing = false;
		onSave();
	}
</script>

<SectionCard title="Volumes">
	<div class="vt-body" oninput={() => (isEditing = true)}>
		<Swap key={volumes.length === 0}>
			{#if volumes.length === 0}
				<EmptyState title="No volumes">
					{#snippet icon()}<HardDrive size={18} />{/snippet}
					<Button variant="secondary" icon={Plus} onclick={addVolume}>Add volume</Button>
				</EmptyState>
			{:else}
				<RowList
					label="Volumes"
					items={volumes}
					key={keyOf}
					columns={[...COLUMNS]}
					addLabel="Add volume"
					onadd={addVolume}
					onremove={removeVolume}
					removeLabel={(v) => `Remove ${v.pvcName || 'volume'}`}
				>
					{#snippet row(volume)}
						<Input bind:value={volume.pvcName} placeholder="data" aria-label="Volume name" />
						<Input bind:value={volume.mountPath} placeholder="/data" mono aria-label="Mount path" />
						<Input bind:value={volume.storageSize} placeholder="1Gi" aria-label="Size" />
						<span class="vt-switch">
							<Switch
								bind:checked={volume.readOnly}
								label="Read-only"
								onchange={() => (isEditing = true)}
							/>
						</span>
					{/snippet}
				</RowList>
				{#if notes.length > 0}
					<ul class="vt-notes">
						{#each notes as note (keyOf(note.volume))}
							<li class="vt-note vt-note--{note.seen?.tone}">
								<code>{note.volume.pvcName || note.volume.name}</code>
								{note.seen?.text}
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</Swap>
		{#if volumes.length > 0 || isEditing}
			<FormActions hint="Saving restarts your app. With volumes, updates stop the app first.">
				<Button variant="ghost" disabled={!isEditing || savingVolumes} onclick={discard}
					>Discard</Button
				>
				<Button variant="primary" loading={savingVolumes} disabled={!isEditing} onclick={handleSave}
					>Save</Button
				>
			</FormActions>
		{/if}
	</div>
</SectionCard>

<style>
	.vt-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.vt-switch {
		display: flex;
		align-items: center;
	}
	.vt-notes {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: var(--space-3) 0 0;
		padding: 0;
		list-style: none;
	}
	.vt-note {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.vt-note code {
		margin-right: var(--space-1);
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		color: var(--text-default);
	}
	.vt-note--bad {
		color: var(--status-error);
	}
	.vt-note--busy {
		color: var(--status-warning);
	}
</style>

<script lang="ts">
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { Button, SectionCard, StatusDot, Stepper, podStatus } from '$lib/components/ui';
	import List from '$lib/components/ui/List.svelte';
	import ListRow from '$lib/components/ui/ListRow.svelte';
	import SettingRow from '$lib/components/ui/SettingRow.svelte';
	import SettingsList from '$lib/components/ui/SettingsList.svelte';
	import type { StatusMeta } from '$lib/components/ui/status';
	import type { DatabaseDetail } from './types';

	type Pod = NonNullable<DatabaseDetail['pods']>[number];

	let {
		database,
		replicas = $bindable(1),
		replicasDirty = $bindable(false),
		saving,
		onScale
	}: {
		database: DatabaseDetail | null;
		replicas: number;
		replicasDirty: boolean;
		saving: boolean;
		onScale: () => void;
	} = $props();

	let confirmOpen = $state(false);

	const max = $derived(Math.max(1, database?.maxReplicas ?? 5));
	const current = $derived(Math.max(1, database?.replicas ?? 1));

	const primary = $derived(
		database?.liveStatus?.currentPrimary ??
			database?.pods?.find((p) => p.role === 'primary')?.name ??
			null
	);

	function serial(name: string): number {
		const match = name.match(/-(\d+)$/);
		return match ? Number(match[1]) : 0;
	}

	function meta(pod: Pod): StatusMeta {
		const containers = pod.containers ?? [];
		if (containers.length > 0 && containers.every((c) => c.ready)) return podStatus('ready');
		if (pod.status?.toLowerCase() === 'running') return podStatus('starting');
		return podStatus(pod.status);
	}

	const rows = $derived(
		[...(database?.pods ?? [])]
			.map((pod) => ({ pod, isPrimary: pod.name === primary, meta: meta(pod) }))
			.sort(
				(a, b) =>
					Number(b.isPrimary) - Number(a.isPrimary) || serial(a.pod.name) - serial(b.pod.name)
			)
	);

	const retiring = $derived(
		rows
			.filter((r) => !r.isPrimary)
			.map((r) => r.pod.name)
			.sort((a, b) => serial(b) - serial(a))
			.slice(0, Math.max(0, current - replicas))
	);

	function standbys(n: number): string {
		return `${n} ${n === 1 ? 'standby' : 'standbys'}`;
	}

	const removal = $derived.by(() => {
		const k = current - replicas;
		const who = retiring.length === k ? retiring.join(', ') : standbys(k);
		return `${who} and ${k === 1 ? 'its volume' : 'their volumes'} are deleted.`;
	});

	function mark(next: number) {
		replicasDirty = Number.isFinite(next) && next >= 1 && next !== current;
	}

	const topology = $derived(replicas > 1 ? `1 primary, ${standbys(replicas - 1)}` : '1 primary');

	const hint = $derived.by(() => {
		const added = replicas - current;
		if (replicasDirty && added > 0)
			return `${added === 1 ? 'The new standby copies' : `The ${added} new standbys copy`} the primary before serving and ${added === 1 ? 'counts' : 'count'} against your quota.`;
		if (replicasDirty && added < 0) return removal;
		if (replicas === 1) return 'Nothing takes over if it fails.';
		return `${replicas === 2 ? 'The standby serves' : 'Standbys serve'} reads and ${replicas === 2 ? 'takes' : 'take'} over if the primary fails.`;
	});

	function commit() {
		if (replicas < current) confirmOpen = true;
		else onScale();
	}
</script>

<SectionCard title="Instances">
	<SettingsList label="Instances">
		<SettingRow label={topology} for="database-instances" {hint}>
			<span class="commit" class:commit--on={replicasDirty} aria-hidden={!replicasDirty}>
				<Button
					variant={replicas < current ? 'danger' : 'primary'}
					size="sm"
					disabled={!replicasDirty || saving}
					loading={saving}
					onclick={commit}>Scale to {replicas}</Button
				>
			</span>
			<span
				class="count"
				oninput={(e: Event) => mark(Number((e.target as HTMLInputElement).value))}
			>
				<Stepper
					id="database-instances"
					label="Instances"
					size="sm"
					shape="capsule"
					min={1}
					{max}
					disabled={saving}
					bind:value={replicas}
					onchange={mark}
				/>
			</span>
		</SettingRow>

		{#if rows.length}
			<List label="Running instances" inset={false}>
				{#each rows as row (row.pod.name)}
					<ListRow title={row.isPrimary ? 'Primary' : 'Standby'} subtitle={row.pod.name} flush>
						{#snippet leading()}<StatusDot meta={row.meta} label={row.meta.label} />{/snippet}
						{#snippet trailing()}<span class="state">{row.meta.label}</span>{/snippet}
					</ListRow>
				{/each}
			</List>
		{/if}
	</SettingsList>
</SectionCard>

<ConfirmModal
	bind:open={confirmOpen}
	title="Scale down to {replicas}?"
	description={`${removal} The primary keeps running.`}
	confirmLabel="Scale to {replicas}"
	onconfirm={onScale}
	oncancel={() => {}}
/>

<style>
	.state {
		font-size: var(--text-footnote);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.count {
		display: inline-flex;
	}
	.commit {
		display: inline-flex;
		visibility: hidden;
		opacity: 0;
		transition:
			opacity var(--fade-out) var(--curve-in),
			visibility 0s var(--fade-out);
	}
	.commit--on {
		visibility: visible;
		opacity: 1;
		transition:
			opacity var(--fade-in) var(--curve-out),
			visibility 0s;
	}
</style>

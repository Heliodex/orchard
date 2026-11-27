<script lang="ts">
	import { Copy, RotateCcw } from 'lucide-svelte';
	import { apiFetch } from '$lib/stores';
	import {
		Alert,
		Button,
		Dropdown,
		Field,
		FieldGrid,
		Input,
		Modal,
		ModalIntro,
		SegmentedControl,
		Swap
	} from '$lib/components/ui';
	import RadioGroup from '$lib/components/ui/RadioGroup.svelte';
	import { EnvironmentSwitcher } from '$lib/components/environment';
	import { formatWhen } from './BackupFormat';
	import { checkpointTitle, errorMessage, fromLocalInput, toLocalInput } from './recovery';
	import type { DatabaseDetail, DatabaseOperation, RecoveryInfo, RecoveryTarget } from './types';

	type Mode = 'in_place' | 'fork';
	type PointKind = 'latest' | 'backup' | 'checkpoint' | 'time';

	let {
		open = $bindable(false),
		database,
		recovery,
		initialMode = 'in_place',
		initialTarget = null,
		onstarted
	}: {
		open?: boolean;
		database: DatabaseDetail;
		recovery: RecoveryInfo | null;
		initialMode?: Mode;
		initialTarget?: RecoveryTarget | null;
		onstarted: (op: DatabaseOperation, mode: Mode) => void;
	} = $props();

	const uid = $props.id();

	let mode = $state<Mode>('in_place');
	let pointKind = $state<PointKind>('latest');
	let backupId = $state('');
	let checkpointId = $state('');
	let time = $state('');
	let name = $state('');
	let environmentId = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let idempotencyKey = '';
	let wasOpen = false;

	const backups = $derived(
		[...(recovery?.backups ?? [])]
			.filter((b) => b.completedAt)
			.sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!))
	);
	const checkpoints = $derived((recovery?.checkpoints ?? []).filter((c) => c.status === 'durable'));

	$effect(() => {
		const isOpen = open;
		if (isOpen && !wasOpen) {
			mode = initialMode;
			const t = initialTarget;
			pointKind =
				t?.type === 'backup'
					? 'backup'
					: t?.type === 'checkpoint'
						? 'checkpoint'
						: t?.type === 'time'
							? 'time'
							: 'latest';
			backupId = t?.type === 'backup' ? t.backupId : (backups[0]?.id ?? '');
			checkpointId = t?.type === 'checkpoint' ? t.checkpointId : (checkpoints[0]?.id ?? '');
			time = toLocalInput(t?.type === 'time' ? t.time : (recovery?.latest ?? null));
			name = `${database.name}-copy`;
			environmentId = database.environmentId ?? '';
			error = null;
			idempotencyKey = crypto.randomUUID();
		}
		wasOpen = isOpen;
	});

	const minTime = $derived(toLocalInput(recovery?.earliest));
	const maxTime = $derived(toLocalInput(recovery?.latest ?? new Date().toISOString()));
	const timeIso = $derived(fromLocalInput(time));
	const timeOutside = $derived.by(() => {
		if (!timeIso) return true;
		const t = Date.parse(timeIso);
		const lo = recovery?.earliest ? Date.parse(recovery.earliest) : -Infinity;
		const hi = recovery?.latest ? Date.parse(recovery.latest) + 60_000 : Date.now() + 60_000;
		return t < lo || t > hi;
	});

	const pointOptions = $derived([
		{ value: 'latest', label: mode === 'fork' ? 'Now' : 'Latest' },
		{ value: 'backup', label: 'A backup', disabled: backups.length === 0 },
		{ value: 'checkpoint', label: 'A checkpoint', disabled: checkpoints.length === 0 },
		{ value: 'time', label: 'A time', disabled: !recovery?.earliest }
	]);

	const modeOptions = [
		{
			value: 'in_place',
			label: 'Replace this database',
			description:
				'Orchard takes a checkpoint first and keeps the current copy for 24 hours, so you can undo.'
		},
		{
			value: 'fork',
			label: 'Copy into a new database',
			description: 'This database keeps running as it is.'
		}
	];

	const backupOptions = $derived(
		backups.map((b) => ({
			value: b.id,
			label: formatWhen(b.completedAt),
			description: b.type === 'manual' ? 'Manual' : 'Scheduled'
		}))
	);
	const checkpointOptions = $derived(
		checkpoints.map((c) => ({
			value: c.id,
			label: checkpointTitle(c),
			description: formatWhen(c.createdAt)
		}))
	);

	const pointText = $derived.by(() => {
		if (pointKind === 'latest') return mode === 'fork' ? 'right now' : 'its latest point';
		if (pointKind === 'backup') {
			const b = backups.find((x) => x.id === backupId);
			return b ? `the ${formatWhen(b.completedAt)} backup` : 'that backup';
		}
		if (pointKind === 'checkpoint') {
			const c = checkpoints.find((x) => x.id === checkpointId);
			return c ? formatWhen(c.createdAt) : 'that checkpoint';
		}
		return timeIso ? formatWhen(timeIso) : 'that time';
	});

	const ready = $derived(
		(pointKind !== 'backup' || !!backupId) &&
			(pointKind !== 'checkpoint' || !!checkpointId) &&
			(pointKind !== 'time' || !timeOutside) &&
			(mode !== 'fork' || !!name.trim())
	);

	function body() {
		const point: Record<string, string> =
			pointKind === 'backup'
				? { backupId }
				: pointKind === 'checkpoint'
					? { checkpointId }
					: pointKind === 'time'
						? { at: timeIso! }
						: { at: mode === 'fork' ? 'now' : 'latest' };
		if (mode === 'in_place') return { ...point, mode: 'in_place' };
		return {
			...point,
			name: name.trim(),
			...(environmentId ? { environmentId } : {})
		};
	}

	async function submit() {
		if (!ready || submitting) return;
		submitting = true;
		error = null;
		try {
			const path = mode === 'fork' ? 'fork' : 'restore';
			const res = await apiFetch(`/apiv1/databases/${database.id}/${path}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
				body: JSON.stringify(body())
			});
			if (!res.ok) throw new Error(await errorMessage(res, "Couldn't start"));
			const op = (await res.json()) as DatabaseOperation;
			open = false;
			onstarted(op, mode);
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't start";
		} finally {
			submitting = false;
		}
	}
</script>

<Modal bind:open size="md" closable={false} dismissable labelledby="{uid}-title">
	<form
		class="sheet"
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
	>
		<ModalIntro
			id="{uid}-title"
			icon={mode === 'fork' ? Copy : RotateCcw}
			tone="accent"
			title={mode === 'fork' ? `Copy ${database.name}` : `Restore ${database.name}`}
		/>

		<div class="group">
			<span class="label" id="{uid}-point">Point</span>
			<SegmentedControl
				label="Point to restore to"
				options={pointOptions}
				bind:value={pointKind}
				grow
			/>
			<Swap key={pointKind}>
				{#if pointKind === 'backup'}
					<Dropdown size="lg" ariaLabel="Backup" bind:value={backupId} options={backupOptions} />
				{:else if pointKind === 'checkpoint'}
					<Dropdown
						size="lg"
						ariaLabel="Checkpoint"
						bind:value={checkpointId}
						options={checkpointOptions}
					/>
				{:else if pointKind === 'time'}
					<Field
						for="{uid}-time"
						error={time && timeOutside ? 'Pick a time inside the recovery window' : null}
						hint={recovery?.earliest
							? `Any second from ${formatWhen(recovery.earliest)} to now`
							: undefined}
					>
						<Input
							id="{uid}-time"
							type="datetime-local"
							step="1"
							min={minTime}
							max={maxTime}
							bind:value={time}
						/>
					</Field>
				{:else}
					<p class="note">
						{mode === 'fork'
							? 'A live copy of the data as it is right now.'
							: 'Everything that reached the backup store, usually all but the last few minutes.'}
					</p>
				{/if}
			</Swap>
		</div>

		<div class="group">
			<span class="label">Where</span>
			<RadioGroup
				label="Where to restore"
				options={modeOptions}
				bind:value={() => mode, (v) => (mode = v as Mode)}
			/>
			{#if mode === 'fork'}
				<div class="fork-fields">
					<FieldGrid>
						<Field label="Name" for="{uid}-name">
							<Input id="{uid}-name" bind:value={name} autocomplete="off" spellcheck={false} />
						</Field>
						<Field label="Environment">
							{#if database.project?.id}
								<EnvironmentSwitcher
									projectId={database.project.id}
									bind:selectedEnvId={environmentId}
									block
								/>
							{/if}
						</Field>
					</FieldGrid>
				</div>
			{/if}
		</div>

		{#if error}<Alert tone="error">{error}</Alert>{/if}

		<p class="consequence">
			{#if mode === 'fork'}
				{name.trim() || 'The copy'} starts from {pointText}.
			{:else}
				{database.name} goes back to {pointText}. Apps reconnect on their own.
			{/if}
		</p>
	</form>
	{#snippet footer()}
		<Button variant="ghost" disabled={submitting} onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" loading={submitting} disabled={!ready} onclick={submit}>
			{mode === 'fork' ? 'Create copy' : 'Restore'}
		</Button>
	{/snippet}
</Modal>

<style>
	.sheet {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.fork-fields {
		margin-top: 0.5rem;
	}
	.label {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.note,
	.consequence {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.consequence {
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
</style>

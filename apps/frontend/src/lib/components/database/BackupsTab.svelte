<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		Archive,
		Copy,
		DatabaseZap,
		Ellipsis,
		EyeOff,
		Flag,
		FlaskConical,
		HardDrive,
		Plus,
		RotateCcw,
		Undo2,
		X
	} from 'lucide-svelte';
	import {
		apiFetch,
		backupsOnThisServer,
		isSuperAdmin,
		selectedOrganization,
		toasts
	} from '$lib/stores';
	import {
		Button,
		Dropdown,
		EmptyState,
		Input,
		List,
		ListRow,
		Menu,
		MenuItem,
		SectionTitle,
		SettingRow,
		SettingsList,
		Skeleton,
		StatusDot,
		statusMeta
	} from '$lib/components/ui';
	import type { StatusMeta } from '$lib/components/ui';
	import Widget from '$lib/components/ui/Widget.svelte';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { presence } from '$lib/utils/transitions';
	import { backupKind, backupSize, describeCron, formatWhen } from './BackupFormat';
	import RestoreSheet from './RestoreSheet.svelte';
	import CheckpointModal from './CheckpointModal.svelte';
	import {
		CHECKPOINT_KIND,
		KIND_ICON,
		checkpointDetail,
		checkpointStatus,
		checkpointTitle,
		copyName,
		duration,
		errorMessage,
		opActive,
		opStatus,
		opSteps,
		opTitle,
		pointLabel,
		stepLabel,
		undoable
	} from './recovery';
	import type {
		DatabaseDetail,
		Backup,
		SchedulePreset,
		DatabaseCheckpoint,
		DatabaseOperation,
		RecoveryInfo,
		RecoveryTarget
	} from './types';

	let {
		database,
		orgSlug,
		backups,
		backupsLoading,
		creatingBackup,
		restoringBackupId,
		schedulePreset = $bindable(),
		scheduleCustomCron = $bindable(),
		scheduleCron,
		scheduleLoaded,
		scheduleSaving,
		maxBackups,
		schedulePresets,
		onCreateBackup,
		onRestoreBackup,
		onRestoreConfirmed = undefined,
		onSaveSchedule,
		onRecoveryChanged = undefined,
		formatBytes
	}: {
		database: DatabaseDetail;
		orgSlug: string;
		backups: Backup[];
		backupsLoading: boolean;
		creatingBackup: boolean;
		restoringBackupId: string | null;
		schedulePreset: string;
		scheduleCustomCron: string;
		scheduleCron: string;
		scheduleLoaded: boolean;
		scheduleSaving: boolean;
		maxBackups: number;
		schedulePresets: SchedulePreset[];
		onCreateBackup: () => void;
		onRestoreBackup: (backup: Backup) => void;
		onRestoreConfirmed?: (backup: Backup) => void;
		onSaveSchedule: () => void | Promise<void>;
		onRecoveryChanged?: () => void;
		formatBytes: (bytes: number | null) => string;
		formatDate: (s: string) => string;
	} = $props();

	type Part = { text: string; at?: string | null; relative?: boolean };
	type Protection = { meta: StatusMeta; title: string; parts: Part[]; detail?: string | null };

	const canManageOrg = $derived(
		$selectedOrganization?.myRole === 'owner' || $selectedOrganization?.myRole === 'admin'
	);

	const available = $derived(database.mode === 'cnpg' && !!database.backupsEnabled);

	const sorted = $derived(
		[...backups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
	);
	const completed = $derived(sorted.filter((b) => b.status === 'completed'));
	const inFlight = $derived(sorted.some((b) => b.status === 'running' || b.status === 'pending'));

	const activeCron = $derived(scheduleLoaded ? scheduleCron : (database.backupScheduleCron ?? ''));
	const activePresetId = $derived.by(() => {
		if (!activeCron) return 'none';
		return schedulePresets.find((p) => p.cron && p.cron === activeCron)?.id ?? 'custom';
	});
	const activeMeaning = $derived(
		activeCron ? (describeCron(activeCron) ?? activeCron) : 'Off, back up by hand'
	);

	const scheduleOptions = $derived([
		{ value: 'none', label: 'Off' },
		...schedulePresets.map((p) => ({
			value: p.id,
			label: p.id === 'custom' ? 'Custom schedule' : p.label
		}))
	]);

	const customDraft = $derived(scheduleCustomCron.trim());
	const customMeaning = $derived(describeCron(customDraft));
	const customChanged = $derived(!!customDraft && customDraft !== activeCron);

	const protection = $derived.by((): Protection => {
		const live = database.liveStatus;
		const archiving = live?.archiving ?? null;
		const lastGood =
			live?.lastSuccessfulBackup ?? completed[0]?.completedAt ?? completed[0]?.createdAt ?? null;
		const since = live?.firstRecoverabilityPoint ?? null;
		const lastPart: Part[] = lastGood
			? [{ text: 'last backup', at: lastGood, relative: true }]
			: [];

		if (archiving && !archiving.ok) {
			return {
				meta: statusMeta('error', 'Backups are failing'),
				title: 'Backups are failing',
				parts: [
					...(archiving.since ? [{ text: 'since', at: archiving.since }] : []),
					...(lastGood ? [{ text: 'last good backup', at: lastGood, relative: true }] : [])
				],
				detail: archiving.message
			};
		}
		if (completed.length === 0) {
			if (inFlight)
				return {
					meta: statusMeta('progress', 'First backup running', true),
					title: 'First backup running',
					parts: [{ text: 'nothing to restore from until it finishes' }]
				};
			return {
				meta: statusMeta('warning', 'Not protected'),
				title: 'Not protected',
				parts: [{ text: 'there is no backup to restore from yet' }]
			};
		}
		if (sorted[0]?.status === 'failed') {
			return {
				meta: statusMeta('warning', 'Last backup failed'),
				title: 'Last backup failed',
				parts: lastGood ? [{ text: 'last good backup', at: lastGood, relative: true }] : []
			};
		}
		if (!activeCron) {
			return {
				meta: statusMeta('warning', 'No schedule'),
				title: 'No schedule',
				parts: [...lastPart, { text: 'nothing newer is backed up until you back up again' }]
			};
		}
		return {
			meta: statusMeta('success', 'Protected'),
			title: 'Protected',
			parts: [...(since ? [{ text: 'recoverable back to', at: since }] : []), ...lastPart]
		};
	});

	type Point =
		| { kind: 'backup'; key: string; t: number; backup: Backup }
		| { kind: 'checkpoint'; key: string; t: number; checkpoint: DatabaseCheckpoint };

	const points = $derived(
		[
			...sorted.map((backup): Point => ({
				kind: 'backup',
				key: `b:${backup.id}`,
				t: Date.parse(backup.completedAt ?? backup.createdAt),
				backup
			})),
			...checkpoints.map((checkpoint): Point => ({
				kind: 'checkpoint',
				key: `c:${checkpoint.id}`,
				t: Date.parse(checkpoint.createdAt),
				checkpoint
			}))
		].sort((a, b) => b.t - a.t)
	);
	const keptLabel = $derived(
		completed.length >= maxBackups
			? `${completed.length} of ${maxBackups} backups kept · the next one replaces the oldest`
			: `${completed.length} of ${maxBackups} backups kept`
	);

	function rowMeta(status: string): StatusMeta {
		if (status === 'completed') return statusMeta('success', 'Completed');
		if (status === 'failed') return statusMeta('error', 'Failed');
		if (status === 'pending') return statusMeta('info', 'Queued');
		return statusMeta('progress', 'Running', true);
	}

	let confirmOff = $state(false);
	let restoreTarget = $state<Backup | null>(null);
	let confirmRestore = $state(false);

	async function save() {
		await onSaveSchedule();
		if (schedulePreset !== 'custom' && schedulePreset !== activePresetId) {
			schedulePreset = activePresetId;
		}
	}

	function pickSchedule(value: string) {
		if (value === 'custom') {
			if (!scheduleCustomCron.trim()) scheduleCustomCron = activeCron || '0 3 * * *';
			return;
		}
		if (value === activePresetId) return;
		if (value === 'none') {
			confirmOff = true;
			return;
		}
		save();
	}

	function applyCustom() {
		if (!customChanged || scheduleSaving) return;
		save();
	}

	function requestRestore(backup: Backup) {
		if (recoveryLoaded) {
			openSheet('in_place', { type: 'backup', backupId: backup.id });
			return;
		}
		if (!onRestoreConfirmed) {
			onRestoreBackup(backup);
			return;
		}
		restoreTarget = backup;
		confirmRestore = true;
	}

	const restoreWhen = $derived(
		restoreTarget ? formatWhen(restoreTarget.completedAt ?? restoreTarget.createdAt) : ''
	);

	let recovery = $state<RecoveryInfo | null>(null);
	let operations = $state<DatabaseOperation[]>([]);
	let recoveryLoaded = $state(false);
	let sheetOpen = $state(false);
	let sheetMode = $state<'in_place' | 'fork'>('in_place');
	let sheetTarget = $state<RecoveryTarget | null>(null);
	let checkpointOpen = $state(false);
	let checkpointSaving = $state(false);
	let testing = $state(false);
	let busyOp = $state<string | null>(null);
	let undoTarget = $state<DatabaseOperation | null>(null);
	let confirmUndo = $state(false);
	let alive = true;
	const watching = new Set<string>();
	const startedHere = new Set<string>();

	onDestroy(() => {
		alive = false;
	});

	const recoveryBackups = $derived(recovery?.backups ?? []);
	const checkpoints = $derived(recovery?.checkpoints ?? []);
	const restoreTests = $derived(
		[...(recovery?.restoreTests ?? [])].sort(
			(a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
		)
	);
	const testRunning = $derived(restoreTests.some(opActive));
	const lastTest = $derived(restoreTests.find((t) => !opActive(t)) ?? null);
	const shownOps = $derived.by(() => {
		const list = operations.filter((o) => o.kind !== 'drill');
		const active = list.filter(opActive);
		const recent = list
			.filter((o) => !opActive(o))
			.filter(
				(o) => undoable(o) || Date.now() - Date.parse(o.finishedAt ?? o.createdAt) < 3 * 864e5
			)
			.slice(0, 3);
		return [...active, ...recent];
	});

	async function loadRecovery() {
		const id = database.id;
		try {
			const [r, o] = await Promise.all([
				apiFetch(`/apiv1/databases/${id}/recovery`),
				apiFetch(`/apiv1/databases/${id}/operations`)
			]);
			if (!alive || id !== database.id) return;
			if (r.ok) recovery = await r.json();
			if (o.ok) operations = await o.json();
		} catch {
			return;
		} finally {
			recoveryLoaded = true;
		}
		for (const op of [...operations, ...(recovery?.restoreTests ?? [])]) {
			if (opActive(op)) watch(op.id);
		}
	}

	let backupSig = '';
	$effect(() => {
		const sig = `${database.id}:${backups.map((b) => b.id + b.status).join(',')}`;
		if (!available || sig === backupSig) return;
		backupSig = sig;
		untrack(loadRecovery);
	});

	function upsert(op: DatabaseOperation) {
		if (op.kind === 'drill' && recovery) {
			const tests = recovery.restoreTests.filter((t) => t.id !== op.id);
			recovery.restoreTests = [op, ...tests];
			return;
		}
		const i = operations.findIndex((o) => o.id === op.id);
		operations = i === -1 ? [op, ...operations] : operations.map((o) => (o.id === op.id ? op : o));
	}

	function announce(op: DatabaseOperation) {
		if (!startedHere.has(op.id)) return;
		startedHere.delete(op.id);
		if (op.status === 'failed') {
			if (op.error === 'Canceled') return;
			toasts.add({
				title:
					op.kind === 'drill'
						? 'Restore test failed'
						: op.kind === 'upgrade'
							? 'Upgrade failed'
							: 'Restore failed',
				description: op.error ?? undefined,
				color: 'error',
				position: 'top-center'
			});
			return;
		}
		if (op.kind === 'upgrade') {
			toasts.add({
				title: opTitle(op, recoveryBackups, checkpoints).replace('Upgrade to', 'Upgraded to'),
				color: 'success',
				position: 'top-center'
			});
			return;
		}
		if (op.kind === 'drill') {
			const ms = op.result?.recoveryMs;
			toasts.add({
				title: op.result?.verdict?.passed === false ? 'Restore test failed' : 'Restore test passed',
				description: ms ? `Recovered in ${duration(ms)}` : undefined,
				color: op.result?.verdict?.passed === false ? 'error' : 'success',
				position: 'top-center'
			});
		} else if (op.mode === 'fork' || op.kind === 'fork') {
			toasts.add({
				title: `${copyName(op)} is ready`,
				color: 'success',
				position: 'top-center',
				action: op.targetDatabaseId
					? { label: 'Open', onClick: () => goto(`/${orgSlug}/databases/${op.targetDatabaseId}`) }
					: undefined
			});
		} else {
			toasts.add({ title: 'Restore finished', color: 'success', position: 'top-center' });
		}
	}

	async function watch(opId: string) {
		if (watching.has(opId)) return;
		watching.add(opId);
		try {
			while (alive) {
				const began = Date.now();
				const res = await apiFetch(`/apiv1/database-operations/${opId}?wait=1`);
				if (!res.ok || !alive) break;
				const op = (await res.json()) as DatabaseOperation;
				upsert(op);
				if (!opActive(op)) {
					announce(op);
					await loadRecovery();
					onRecoveryChanged?.();
					break;
				}
				const spent = Date.now() - began;
				if (spent < 1000) await new Promise((r) => setTimeout(r, 1000 - spent));
			}
		} catch {
			return;
		} finally {
			watching.delete(opId);
		}
	}

	function openSheet(mode: 'in_place' | 'fork', target: RecoveryTarget | null = null) {
		sheetMode = mode;
		sheetTarget = target;
		sheetOpen = true;
	}

	function started(op: DatabaseOperation, mode: 'in_place' | 'fork') {
		startedHere.add(op.id);
		upsert(op);
		if (mode === 'fork') {
			toasts.add({
				title: 'Copy started',
				description: `${copyName(op)} appears in the project while it restores.`,
				color: 'success',
				action: op.targetDatabaseId
					? { label: 'Open', onClick: () => goto(`/${orgSlug}/databases/${op.targetDatabaseId}`) }
					: undefined
			});
		} else {
			toasts.add({
				title: 'Restore started',
				description: `A checkpoint of ${database.name} was taken first.`,
				color: 'success'
			});
		}
		void loadRecovery();
		watch(op.id);
		onRecoveryChanged?.();
	}

	async function takeCheckpoint(label: string) {
		checkpointSaving = true;
		try {
			const res = await apiFetch(`/apiv1/databases/${database.id}/checkpoints`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(label ? { label } : {})
			});
			if (!res.ok) throw new Error(await errorMessage(res, "Couldn't take a checkpoint"));
			checkpointOpen = false;
			toasts.add({ title: 'Checkpoint taken', description: label || undefined, color: 'success' });
			await loadRecovery();
			setTimeout(() => alive && loadRecovery(), 10_000);
		} catch (e) {
			toasts.add({
				title: "Couldn't take a checkpoint",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			checkpointSaving = false;
		}
	}

	async function hideCheckpoint(c: DatabaseCheckpoint) {
		try {
			const res = await apiFetch(`/apiv1/checkpoints/${c.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error(await errorMessage(res, "Couldn't hide it"));
			if (recovery) recovery.checkpoints = recovery.checkpoints.filter((x) => x.id !== c.id);
		} catch (e) {
			toasts.add({
				title: "Couldn't hide the checkpoint",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		}
	}

	async function startTest() {
		testing = true;
		try {
			const res = await apiFetch(`/apiv1/databases/${database.id}/restore-tests`, {
				method: 'POST'
			});
			if (!res.ok) throw new Error(await errorMessage(res, "Couldn't start a restore test"));
			const op = (await res.json()) as DatabaseOperation;
			startedHere.add(op.id);
			upsert(op);
			watch(op.id);
		} catch (e) {
			toasts.add({
				title: "Couldn't start a restore test",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			testing = false;
		}
	}

	async function opAction(op: DatabaseOperation, action: 'cancel' | 'undo') {
		busyOp = op.id;
		try {
			const res = await apiFetch(`/apiv1/database-operations/${op.id}/${action}`, {
				method: 'POST'
			});
			if (!res.ok)
				throw new Error(
					await errorMessage(res, action === 'undo' ? "Couldn't undo" : "Couldn't cancel")
				);
			upsert((await res.json()) as DatabaseOperation);
			toasts.add({
				title: action === 'undo' ? 'Restore undone' : 'Canceled',
				description:
					action === 'undo'
						? `${database.name} is back to the copy from before the restore.`
						: undefined,
				color: 'success'
			});
			await loadRecovery();
			onRecoveryChanged?.();
		} catch (e) {
			toasts.add({
				title: action === 'undo' ? "Couldn't undo" : "Couldn't cancel",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			busyOp = null;
		}
	}
</script>

<div class="backups">
	{#if database.mode !== 'cnpg'}
		<Widget>
			<EmptyState
				title="Backups need a dedicated database"
				description="Only dedicated Postgres databases are backed up. Create one in this project and move your data over."
			>
				{#snippet icon()}<DatabaseZap size={18} />{/snippet}
				{#if database.project?.slug}
					<Button href={`/${orgSlug}/projects/${database.project.slug}/databases/new`}>
						New database
					</Button>
				{/if}
			</EmptyState>
		</Widget>
	{:else if !database.backupsEnabled}
		<Widget>
			<EmptyState
				title="Backups need storage"
				description={canManageOrg
					? 'Add a backup bucket for this organization to turn on backups and restores.'
					: 'An organization admin needs to add a backup bucket before this database can be backed up.'}
			>
				{#snippet icon()}<HardDrive size={18} />{/snippet}
				{#if canManageOrg}
					<Button href={`/${orgSlug}/settings?tab=backups`}>Set up backup storage</Button>
				{/if}
			</EmptyState>
		</Widget>
	{/if}

	{#if available && $backupsOnThisServer}
		<p class="on-this-server">
			Backups are on this server. If you lose the server, you lose the backups.
			{#if $isSuperAdmin}<a href="/admin/instance#storage">Add S3 storage</a>{/if}
		</p>
	{/if}

	{#if available && database.keepsLocalBackups}
		<p class="on-this-server">
			This database still backs up to this server, because it was created before S3 storage was
			added. To move its backups to S3,
			<a
				href="https://docs.orchard.hackclub.com/operate/storage/"
				target="_blank"
				rel="noopener noreferrer">create a copy of it</a
			>.
		</p>
	{/if}

	{#if available}
		<Widget>
			<SettingsList label="Protection">
				<div class="summary">
					<div class="summary-text">
						<p class="line">
							<span class="dot"
								><StatusDot meta={protection.meta} label={protection.meta.label} /></span
							>
							<span class="state" class:state--bad={protection.meta.kind === 'error'}
								>{protection.title}</span
							>
							{#each protection.parts as part, i (i)}
								<span class="sep" aria-hidden="true">·</span>
								<span class="part"
									>{part.text}{#if part.at}{' '}{#if part.relative}<RelativeTime
												date={part.at}
											/>{:else}<time datetime={part.at}>{formatWhen(part.at)}</time>{/if}{/if}</span
								>
							{/each}
						</p>
						{#if protection.detail}
							<p class="detail" title={protection.detail}>{protection.detail}</p>
						{/if}
						{#if recoveryLoaded && completed.length > 0}
							{@render testedLine()}
						{/if}
					</div>
					<div class="summary-actions">
						<Menu placement="bottom-end">
							{#snippet trigger(props)}
								<Button {...props} size="sm" icon={Plus} disabled={!recoveryLoaded}>
									Save a point
								</Button>
							{/snippet}
							<MenuItem
								icon={Flag}
								description="Instant. Names this moment"
								disabled={completed.length === 0}
								onclick={() => (checkpointOpen = true)}
							>
								Checkpoint
							</MenuItem>
							<MenuItem
								icon={Archive}
								description="A full copy. Takes a few minutes"
								disabled={creatingBackup || inFlight}
								onclick={onCreateBackup}
							>
								Backup
							</MenuItem>
						</Menu>
						<Button
							variant="primary"
							size="sm"
							icon={RotateCcw}
							disabled={!recoveryLoaded || completed.length === 0}
							onclick={() => openSheet('in_place')}
						>
							Restore
						</Button>
					</div>
				</div>

				<SettingRow
					label="Schedule"
					hint={schedulePreset === 'custom'
						? (customMeaning ?? 'minute hour day month weekday, in UTC')
						: activeMeaning}
					for={schedulePreset === 'custom' ? 'backup-schedule-cron' : 'backup-schedule-preset'}
				>
					<div class="schedule">
						{#if schedulePreset === 'custom'}
							<form
								class="cron"
								in:presence
								onsubmit={(e) => {
									e.preventDefault();
									applyCustom();
								}}
							>
								<Input
									id="backup-schedule-cron"
									mono
									placeholder="0 3 * * *"
									autocomplete="off"
									spellcheck={false}
									bind:value={scheduleCustomCron}
									disabled={scheduleSaving}
								/>
								{#if customChanged || scheduleSaving}
									<Button type="submit" size="sm" variant="primary" loading={scheduleSaving}
										>Apply</Button
									>
								{/if}
							</form>
						{/if}
						<div class="picker">
							<Dropdown
								id="backup-schedule-preset"
								bind:value={schedulePreset}
								options={scheduleOptions}
								disabled={scheduleSaving || !scheduleLoaded}
								loading={scheduleSaving || !scheduleLoaded}
								placement="bottom-end"
								onchange={pickSchedule}
							/>
						</div>
					</div>
				</SettingRow>
			</SettingsList>
		</Widget>

		{#if shownOps.length > 0}
			<section class="history" aria-label="Operations">
				<SectionTitle title="Operations" size="md" />
				<List label="Operations">
					{#each shownOps as op (op.id)}
						{@const meta = opStatus(op)}
						{@const canUndo = undoable(op)}
						<ListRow
							presence
							pinned={opActive(op) || canUndo}
							title={opTitle(op, recoveryBackups, checkpoints)}
						>
							{#snippet leading()}
								<span class="row-dot"
									><StatusDot
										{meta}
										label={meta.label}
										steps={opActive(op) ? opSteps(op) : undefined}
									/></span
								>
							{/snippet}
							{#snippet subtitle()}
								{#if opActive(op)}
									<span>{stepLabel(op)}</span>
									{#if op.result?.progress}
										<span class="sep" aria-hidden="true">·</span>
										<span class="error" title={op.result.progress}>{op.result.progress}</span>
									{/if}
									<span class="sep" aria-hidden="true">·</span>
									<span>started <RelativeTime date={op.startedAt ?? op.createdAt} /></span>
								{:else if op.status === 'failed'}
									<span class:failed={op.error !== 'Canceled'}>{meta.label}</span>
									{#if op.error && op.error !== 'Canceled'}
										<span class="sep" aria-hidden="true">·</span>
										<span class="error" title={op.error}>{op.error}</span>
									{/if}
									<span class="sep" aria-hidden="true">·</span>
									<RelativeTime date={op.finishedAt ?? op.createdAt} />
								{:else}
									<span>Finished <RelativeTime date={op.finishedAt ?? op.createdAt} /></span>
									{#if canUndo && op.result?.retired}
										<span class="sep" aria-hidden="true">·</span>
										<span>previous copy kept until {formatWhen(op.result.retired.retireAfter)}</span
										>
									{/if}
								{/if}
							{/snippet}
							{#snippet actions()}
								{#if opActive(op) && (op.kind !== 'upgrade' || op.phase === 'queued' || op.phase.startsWith('rehearsal'))}
									<Button
										size="sm"
										variant="ghost"
										icon={X}
										loading={busyOp === op.id}
										onclick={() => opAction(op, 'cancel')}
									>
										Cancel
									</Button>
								{:else if canUndo}
									<Button
										size="sm"
										icon={Undo2}
										loading={busyOp === op.id}
										onclick={() => {
											undoTarget = op;
											confirmUndo = true;
										}}
									>
										Undo
									</Button>
								{:else if op.status === 'succeeded' && op.targetDatabaseId && op.targetDatabaseId !== database.id}
									<Button size="sm" href={`/${orgSlug}/databases/${op.targetDatabaseId}`}>
										Open
									</Button>
								{/if}
							{/snippet}
						</ListRow>
					{/each}
				</List>
			</section>
		{/if}

		<section class="history" aria-label="Restore points">
			<SectionTitle title="Restore points" size="md" count={points.length || undefined}>
				{#snippet actions()}
					{#if completed.length > 0}<span class="kept">{keptLabel}</span>{/if}
				{/snippet}
			</SectionTitle>

			{#if backupsLoading && points.length === 0}
				<List label="Loading restore points">
					{#each [0, 1, 2] as i (i)}
						<div class="skeleton-row">
							<Skeleton width="0.5rem" height="0.5rem" rounded="999px" />
							<div class="skeleton-text">
								<Skeleton width="9rem" height="0.75rem" />
								<Skeleton width="6rem" height="0.625rem" />
							</div>
							<Skeleton width="3.5rem" height="0.75rem" />
						</div>
					{/each}
				</List>
			{:else if points.length === 0}
				<Widget>
					<EmptyState
						title="No backups yet"
						description={activeCron
							? `The first one runs on schedule: ${(describeCron(activeCron) ?? activeCron).toLowerCase()}.`
							: 'Save a backup now, or pick a schedule above.'}
					>
						{#snippet icon()}<Archive size={18} />{/snippet}
					</EmptyState>
				</Widget>
			{:else}
				<List label="Restore points">
					{#each points as p (p.key)}
						{#if p.kind === 'checkpoint'}
							{@const c = p.checkpoint}
							{@const meta = checkpointStatus(c)}
							{@const Icon = KIND_ICON[c.kind]}
							<ListRow presence title={checkpointTitle(c)}>
								{#snippet leading()}
									<span class="row-dot"><StatusDot {meta} label={meta.label} /></span>
								{/snippet}
								{#snippet subtitle()}
									<span class="kind"
										><Icon size={12} aria-hidden="true" />{CHECKPOINT_KIND[c.kind]}</span
									>
									{#if c.status !== 'durable'}
										<span class="sep" aria-hidden="true">·</span>
										<span class:failed={c.status === 'failed'}>{meta.label}</span>
									{/if}
									<span class="sep" aria-hidden="true">·</span>
									<span>{formatWhen(c.createdAt)}</span>
									{#if checkpointDetail(c)}
										<span class="sep" aria-hidden="true">·</span>
										<span class="slug" title={c.detail}>{checkpointDetail(c)}</span>
									{/if}
									{#if c.status === 'failed' && c.error}
										<span class="sep" aria-hidden="true">·</span>
										<span class="error" title={c.error}>{c.error}</span>
									{/if}
								{/snippet}
								{#snippet trailing()}
									<RelativeTime date={c.createdAt} />
								{/snippet}
								{#snippet actions()}
									{#if c.status === 'durable'}
										<Button
											size="sm"
											icon={RotateCcw}
											onclick={() =>
												openSheet('in_place', { type: 'checkpoint', checkpointId: c.id })}
										>
											Restore
										</Button>
									{/if}
									<Menu placement="bottom-end">
										{#snippet trigger(props)}
											<Button {...props} size="sm" variant="ghost" icon={Ellipsis} label="More" />
										{/snippet}
										{#if c.status === 'durable'}
											<MenuItem
												icon={Copy}
												onclick={() =>
													openSheet('fork', { type: 'checkpoint', checkpointId: c.id })}
											>
												Copy to a new database
											</MenuItem>
										{/if}
										<MenuItem icon={EyeOff} onclick={() => hideCheckpoint(c)}>Hide</MenuItem>
									</Menu>
								{/snippet}
							</ListRow>
						{:else}
							{@const backup = p.backup}
							{@const meta = rowMeta(backup.status)}
							{@const kind = backupKind(backup)}
							{@const size = backupSize(backup)}
							<ListRow
								presence
								pinned={restoringBackupId === backup.id}
								title={kind ? `${kind} backup` : 'Backup'}
							>
								{#snippet leading()}
									<span class="row-dot"><StatusDot {meta} label={meta.label} /></span>
								{/snippet}
								{#snippet subtitle()}
									<span class="kind"><Archive size={12} aria-hidden="true" />Backup</span>
									{#if backup.status === 'failed'}
										<span class="sep" aria-hidden="true">·</span>
										<span class="failed">Failed</span>
										{#if backup.errorMessage}
											<span class="sep" aria-hidden="true">·</span>
											<span class="error" title={backup.errorMessage}>{backup.errorMessage}</span>
										{/if}
									{:else}
										{#if backup.status !== 'completed'}
											<span class="sep" aria-hidden="true">·</span>
											<span>{meta.label}</span>
										{/if}
										<span class="sep" aria-hidden="true">·</span>
										<span>{formatWhen(backup.completedAt ?? backup.createdAt)}</span>
										{#if size}
											<span class="sep" aria-hidden="true">·</span>
											<span>{formatBytes(size)}</span>
										{/if}
									{/if}
								{/snippet}
								{#snippet trailing()}
									<RelativeTime date={backup.completedAt ?? backup.createdAt} />
								{/snippet}
								{#snippet actions()}
									{#if backup.status === 'completed'}
										<Button
											size="sm"
											icon={RotateCcw}
											onclick={() => requestRestore(backup)}
											loading={restoringBackupId === backup.id}
											disabled={!!restoringBackupId && restoringBackupId !== backup.id}
										>
											Restore
										</Button>
										{#if recoveryLoaded}
											<Menu placement="bottom-end">
												{#snippet trigger(props)}
													<Button
														{...props}
														size="sm"
														variant="ghost"
														icon={Ellipsis}
														label="More"
													/>
												{/snippet}
												<MenuItem
													icon={Copy}
													onclick={() => openSheet('fork', { type: 'backup', backupId: backup.id })}
												>
													Copy to a new database
												</MenuItem>
											</Menu>
										{/if}
									{/if}
								{/snippet}
							</ListRow>
						{/if}
					{/each}
				</List>
			{/if}
		</section>

		{#if recoveryLoaded && completed.length > 0}
			<section class="history" aria-label="Restore tests">
				<SectionTitle title="Restore tests" size="md">
					{#snippet actions()}
						<Button
							size="sm"
							icon={FlaskConical}
							loading={testing}
							disabled={testRunning}
							onclick={startTest}
						>
							Test this backup
						</Button>
					{/snippet}
				</SectionTitle>
				{#if restoreTests.length === 0}
					<Widget>
						<EmptyState
							title="Never tested"
							description="A test restores the latest backup into a throwaway copy, checks every table and deletes it."
						>
							{#snippet icon()}<FlaskConical size={18} />{/snippet}
						</EmptyState>
					</Widget>
				{:else}
					<List label="Restore tests">
						{#each restoreTests.slice(0, 5) as t (t.id)}
							{@const passed = t.status === 'succeeded' && t.result?.verdict?.passed !== false}
							{@const meta = opActive(t)
								? opStatus(t)
								: passed
									? statusMeta('success', 'Passed')
									: statusMeta('error', 'Failed')}
							<ListRow presence title={formatWhen(t.createdAt)}>
								{#snippet leading()}
									<span class="row-dot"
										><StatusDot
											{meta}
											label={meta.label}
											steps={opActive(t) ? opSteps(t) : undefined}
										/></span
									>
								{/snippet}
								{#snippet subtitle()}
									{#if opActive(t)}
										<span>{stepLabel(t)}</span>
									{:else if passed}
										<span>Passed</span>
										{#if t.result?.verdict?.tablesChecked}
											<span class="sep" aria-hidden="true">·</span>
											<span>{t.result.verdict.tablesChecked} tables checked</span>
										{/if}
										{#if t.result?.recoveryMs}
											<span class="sep" aria-hidden="true">·</span>
											<span>recovered in {duration(t.result.recoveryMs)}</span>
										{/if}
									{:else}
										{@const reason = t.error ?? t.result?.verdict?.reasons?.[0]}
										<span class="failed">Failed</span>
										{#if reason}
											<span class="sep" aria-hidden="true">·</span>
											<span class="error" title={reason}>{reason}</span>
										{/if}
									{/if}
								{/snippet}
								{#snippet trailing()}
									<RelativeTime date={t.finishedAt ?? t.createdAt} />
								{/snippet}
							</ListRow>
						{/each}
					</List>
				{/if}
			</section>
		{/if}
	{/if}
</div>

{#snippet testedLine()}
	<p class="tested">
		{#if testRunning}
			<StatusDot meta={statusMeta('progress', 'Restore test running', true)} />
			<span>Restore test running</span>
		{:else if lastTest && lastTest.status === 'succeeded' && lastTest.result?.verdict?.passed !== false}
			<FlaskConical size={13} aria-hidden="true" />
			<span
				>Restore tested <RelativeTime
					date={lastTest.finishedAt ?? lastTest.createdAt}
				/>{#if lastTest.result?.recoveryMs}, took {duration(lastTest.result.recoveryMs)}{/if}</span
			>
		{:else if lastTest}
			<StatusDot meta={statusMeta('error', 'Restore test failed')} />
			<span class="failed">Restore test failed</span>
			<span class="error" title={lastTest.error ?? ''}
				><RelativeTime date={lastTest.finishedAt ?? lastTest.createdAt} />{lastTest.error
					? `, ${lastTest.error.charAt(0).toLowerCase()}${lastTest.error.slice(1)}`
					: ''}</span
			>
		{:else}
			<FlaskConical size={13} aria-hidden="true" />
			<span>Never restore tested</span>
		{/if}
	</p>
{/snippet}

<RestoreSheet
	bind:open={sheetOpen}
	{database}
	{recovery}
	initialMode={sheetMode}
	initialTarget={sheetTarget}
	onstarted={started}
/>

<CheckpointModal bind:open={checkpointOpen} saving={checkpointSaving} onsave={takeCheckpoint} />

<ConfirmModal
	bind:open={confirmUndo}
	danger={false}
	title="Undo this restore?"
	description={`${database.name} swaps back to the copy from before the restore to ${undoTarget ? pointLabel(undoTarget.target, recoveryBackups, checkpoints) : 'that point'}. Anything written since then moves aside.`}
	confirmLabel="Undo restore"
	onconfirm={() => {
		if (undoTarget) opAction(undoTarget, 'undo');
	}}
	oncancel={() => (undoTarget = null)}
/>

<ConfirmModal
	bind:open={confirmOff}
	danger={false}
	title="Turn off scheduled backups?"
	description="Archiving stops too, so nothing written after the last backup can be restored. Backing up by hand turns it back on."
	confirmLabel="Turn off"
	onconfirm={() => save()}
	oncancel={() => (schedulePreset = activePresetId)}
/>

{#if onRestoreConfirmed}
	<ConfirmModal
		bind:open={confirmRestore}
		danger={false}
		title={`Restore the ${restoreWhen} backup?`}
		description={`${database.name} goes back to how it was at ${restoreWhen}. Anything written since then is lost. Apps reconnect on their own.`}
		confirmLabel="Restore"
		onconfirm={() => {
			if (restoreTarget) onRestoreConfirmed?.(restoreTarget);
		}}
		oncancel={() => (restoreTarget = null)}
	/>
{/if}

<style>
	.on-this-server {
		font-size: var(--text-callout);
		color: var(--text-muted);
	}
	.on-this-server a {
		color: var(--text-link);
	}
	.backups {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		min-width: 0;
	}
	.summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-width: 0;
	}
	.summary-actions {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.5rem;
	}
	.kind {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
	}
	.tested {
		display: flex;
		padding-left: 1.5rem;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.summary-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}
	.line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		column-gap: 0.375rem;
		row-gap: 0.125rem;
		min-width: 0;
		font-size: var(--text-body);
		line-height: var(--lh-body);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.dot,
	.row-dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
	}
	.dot {
		margin-right: 0.25rem;
	}
	.state {
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.state--bad {
		font-weight: var(--weight-semibold);
		color: var(--status-error);
	}
	.sep {
		color: var(--text-faint);
	}
	.detail {
		padding-left: 1.5rem;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		color: var(--text-muted);
	}
	.schedule {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.picker {
		width: 12rem;
	}
	.cron {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 12rem;
	}
	.cron > :global(:first-child) {
		flex: 1 1 auto;
		min-width: 0;
	}
	.history {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.kept {
		font-size: var(--text-callout);
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.failed {
		font-weight: var(--weight-semibold);
		color: var(--status-error);
	}
	.error,
	.slug {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.slug {
		font-family: var(--font-mono);
		font-size: var(--text-caption);
	}
	.skeleton-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 3.25rem;
		padding: 0.625rem 1rem;
	}
	.skeleton-row + .skeleton-row {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.skeleton-text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.375rem;
	}
</style>

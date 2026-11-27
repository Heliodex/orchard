<script lang="ts">
	import Notifier from '$lib/components/patterns/Notifier.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { activity } from '$lib/stores/activity';
	import { toasts } from '$lib/stores/toast';
	import DevBar from '../../DevBar.svelte';

	const ICONS = [
		'https://assets.orchard.my/project-icons/0619ec20-62fc-44e0-9f97-17bb4a5da550.png',
		'https://assets.orchard.my/project-icons/cbaa0fa9-462f-4ed5-a201-329af4792120.png',
		'https://assets.orchard.my/project-icons/f01ab01c-3801-488b-8ad1-256d707f935d.gif'
	];

	const LADDER = [
		{ id: 'queue', label: 'Queued' },
		{ id: 'schedule', label: 'Scheduling' },
		{ id: 'clone', label: 'Cloning' },
		{ id: 'build', label: 'Building' },
		{ id: 'push', label: 'Pushing' },
		{ id: 'rollout', label: 'Rolling out' }
	];

	const APPS = [
		{ app: 'api', project: 'orchard', message: 'fix rate limit on build logs', detail: 'main' },
		{ app: 'web', project: 'grove', message: 'swap the hero for the island', detail: 'design' },
		{ app: 'worker', project: 'harbor', message: 'bump buildkit to 0.19', detail: 'deps' }
	];

	let log = $state('');
	let slot = 0;

	function startBuild() {
		const base = APPS[slot % APPS.length];
		activity.start({
			...base,
			projectIcon: ICONS[slot % ICONS.length],
			phase: LADDER[0].label,
			phaseId: LADDER[0].id,
			progress: 0.04
		});
		slot += 1;
	}

	const running = () => $activity.find((a) => a.status === 'running');

	function advance() {
		const a = running();
		if (!a) return;
		const i = LADDER.findIndex((s) => s.id === a.phaseId);
		const next = LADDER[i + 1];
		if (!next) return;
		activity.update(a.id, {
			phase: next.label,
			phaseId: next.id,
			progress: (i + 2) / LADDER.length
		});
	}

	function succeed() {
		const a = running();
		if (a) activity.finish(a.id, 'success');
	}

	function fail() {
		const a = running();
		if (a) activity.finish(a.id, 'error', 'npm ci exited with code 1');
	}

	const wait = (ms: number, ok = true) =>
		new Promise<void>((resolve, reject) => setTimeout(() => (ok ? resolve() : reject()), ms));

	function promiseToast(ok: boolean) {
		toasts
			.promise(wait(2400, ok), {
				loading: 'Saving variables',
				success: 'Variables saved',
				error: 'Could not save variables'
			})
			.catch(() => {});
	}

	function promiseActivity() {
		activity
			.fromPromise(wait(3200), {
				app: 'Backup',
				project: 'orchard',
				projectIcon: ICONS[0],
				phase: 'Exporting',
				phaseId: 'build',
				success: 'Backup exported'
			})
			.catch(() => {});
	}

	function clearAll() {
		activity.clear();
		toasts.clear();
	}
</script>

<Notifier takeOverToasts onOpen={(id) => (log = `Opened ${id}`)} />

<div class="lab">
	<section class="slot">
		<h1 class="label">Activity</h1>
		<div class="controls">
			<Button variant="primary" onclick={startBuild}>Start a build</Button>
			<Button onclick={startBuild}>Add another build</Button>
			<Button onclick={advance}>Advance phase</Button>
			<Button onclick={succeed}>Succeed</Button>
			<Button onclick={fail}>Fail</Button>
			<Button onclick={promiseActivity}>Activity from promise</Button>
		</div>
	</section>
	<section class="slot">
		<h2 class="label">Toasts</h2>
		<div class="controls">
			<Button onclick={() => toasts.add({ title: 'Changes saved', color: 'success' })}
				>toast.success</Button
			>
			<Button onclick={() => toasts.add({ title: 'Deploy failed', color: 'error' })}
				>toast.error</Button
			>
			<Button onclick={() => toasts.add({ title: 'Domain verified', color: 'info' })}
				>toast.info</Button
			>
			<Button
				onclick={() =>
					toasts.add({
						title: 'Replica restarted',
						color: 'warning',
						description: 'web-7f9c crashed twice in five minutes and was restarted.',
						action: { label: 'View logs', onClick: () => (log = 'View logs') }
					})}>toast with details</Button
			>
			<Button onclick={() => promiseToast(true)}>toast.promise</Button>
			<Button onclick={() => promiseToast(false)}>toast.promise, rejects</Button>
		</div>
	</section>
	<section class="slot">
		<div class="controls">
			<Button variant="ghost" onclick={clearAll}>Clear everything</Button>
		</div>
		<p class="note">
			{$activity.length} active, {$toasts.length} toasts{log ? `, ${log}` : ''}
		</p>
	</section>
</div>

<DevBar />

<style>
	.lab {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		max-width: var(--page-wide);
		margin: 0 auto;
		padding: 20rem 2rem 6rem;
	}
	.slot {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.label {
		color: var(--text-muted);
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.note {
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
</style>

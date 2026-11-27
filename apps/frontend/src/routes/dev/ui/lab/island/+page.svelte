<script lang="ts">
	import { onMount } from 'svelte';
	import LiveIsland, { type IslandActivity } from '$lib/components/patterns/LiveIsland.svelte';
	import Button from '$lib/components/ui/Button.svelte';
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

	let activities = $state<IslandActivity[]>([]);
	let log = $state('');
	let seq = 0;

	function make(slot: number): IslandActivity {
		const base = APPS[slot % APPS.length];
		seq += 1;
		return {
			id: `b${seq}`,
			...base,
			projectIcon: ICONS[slot % ICONS.length],
			phase: LADDER[0].label,
			phaseId: LADDER[0].id,
			progress: 0.04,
			status: 'running',
			phases: [{ id: LADDER[0].id, label: LADDER[0].label, ms: 1200, live: true }]
		};
	}

	function start() {
		activities = [make(0)];
	}

	function addSecond() {
		activities.push(make(activities.length));
	}

	const firstRunning = () => activities.find((a) => a.status === 'running');

	function advance() {
		const a = firstRunning();
		if (!a) return;
		const i = LADDER.findIndex((s) => s.id === a.phaseId);
		const next = LADDER[i + 1];
		if (!next) return;
		const phases = (a.phases ?? []).map((p) => ({ ...p, live: false }));
		phases.push({ id: next.id, label: next.label, ms: 1500, live: true });
		a.phases = phases;
		a.phase = next.label;
		a.phaseId = next.id;
		a.progress = (i + 2) / LADDER.length;
	}

	function succeed() {
		const a = firstRunning();
		if (!a) return;
		a.phases = (a.phases ?? []).map((p) => ({ ...p, live: false }));
		a.progress = 1;
		a.status = 'success';
	}

	function fail() {
		const a = firstRunning();
		if (!a) return;
		a.phases = (a.phases ?? []).map((p) => ({ ...p, live: false }));
		a.status = 'error';
		a.message = 'npm ci exited with code 1';
	}

	function clear() {
		activities = [];
	}

	onMount(() => {
		const id = setInterval(() => {
			for (const a of activities) {
				const live = a.status === 'running' ? a.phases?.find((p) => p.live) : undefined;
				if (live) live.ms += 1000;
			}
		}, 1000);
		return () => clearInterval(id);
	});
</script>

<LiveIsland
	{activities}
	onDismiss={(id) => {
		activities = activities.filter((a) => a.id !== id);
		log = `Dismissed ${id}`;
	}}
	onOpen={(id) => (log = `Opened ${id}`)}
/>

<div class="lab">
	<section class="slot">
		<h1 class="label">Live island</h1>
		<div class="controls">
			<Button variant="primary" onclick={start}>Start a build</Button>
			<Button onclick={addSecond}>Add a second build</Button>
			<Button onclick={advance}>Advance phase</Button>
			<Button onclick={succeed}>Succeed</Button>
			<Button onclick={fail}>Fail</Button>
			<Button variant="ghost" onclick={clear}>Clear</Button>
		</div>
		<p class="note">{activities.length} active{log ? `, ${log}` : ''}</p>
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
		padding: 16rem 2rem 6rem;
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

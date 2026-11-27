<script lang="ts">
	import { RotateCcw, Shuffle } from 'lucide-svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import List from '$lib/components/ui/List.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import Metric from '$lib/components/ui/Metric.svelte';
	import EntityRow from '$lib/components/patterns/EntityRow.svelte';
	import Progress from '$lib/components/ui/Progress.svelte';
	import Ring from '$lib/components/ui/Ring.svelte';
	import StepRail from '$lib/components/ui/StepRail.svelte';
	import type { RailStep } from '$lib/components/ui/steprail';
	import { PROJECTS } from '../fixtures';

	let upload = $state(38);
	let cpu = $state(42);
	let memory = $state(92);
	let disk = $state(18);

	function shuffle() {
		upload = Math.round(Math.random() * 100);
		cpu = Math.round(Math.random() * 100);
		memory = Math.round(Math.random() * 100);
		disk = Math.round(Math.random() * 100);
	}

	const PLAN: Omit<RailStep, 'status'>[] = [
		{ id: 'clone', label: 'Clone repository', detail: 'github.com/hackclub/site at 4f2a9c1' },
		{ id: 'restore', label: 'Restore build cache', detail: '1.2 GB from fsn1' },
		{ id: 'install', label: 'Install dependencies', detail: 'pnpm install --frozen-lockfile' },
		{ id: 'build', label: 'Build', detail: 'pnpm build' },
		{ id: 'push', label: 'Push image', detail: 'registry.orchard.my/hackclub-site/web' },
		{ id: 'rollout', label: 'Roll out', detail: '2 replicas, blue green' }
	];
	const TAKES = [1800, 2400, 4200, 6100, 2900, 3600];

	let active = $state(2);
	let elapsed = $state(1200);
	let timer: ReturnType<typeof setInterval> | undefined;

	function run() {
		clearInterval(timer);
		timer = setInterval(() => {
			if (active >= PLAN.length) {
				clearInterval(timer);
				return;
			}
			elapsed += 100;
			if (elapsed >= TAKES[active]) {
				active += 1;
				elapsed = 0;
			}
		}, 100);
	}

	function restart() {
		active = 0;
		elapsed = 0;
		run();
	}

	$effect(() => {
		run();
		return () => clearInterval(timer);
	});

	const live = $derived<RailStep[]>(
		PLAN.map((s, i) => ({
			...s,
			status: i < active ? 'done' : i === active ? 'running' : 'queued',
			durationMs: i < active ? TAKES[i] : i === active ? elapsed : null
		}))
	);
	const total = $derived(live.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / 1000);

	const FAILED: RailStep[] = [
		{ id: 'clone', label: 'Clone repository', status: 'done', durationMs: 1640 },
		{
			id: 'cache',
			label: 'Restore build cache',
			status: 'skipped',
			detail: 'No cache for this branch yet'
		},
		{ id: 'install', label: 'Install dependencies', status: 'done', durationMs: 38_400 },
		{
			id: 'build',
			label: 'Build',
			status: 'failed',
			durationMs: 12_300,
			detail: 'Type error in src/routes/+page.svelte:42'
		},
		{ id: 'push', label: 'Push image', status: 'queued' },
		{ id: 'rollout', label: 'Roll out', status: 'queued' }
	];

	let loaded = $state('loading');
</script>

<div class="flex flex-col gap-6">
	<div class="grid grid-cols-2 gap-6">
		<SectionCard
			title="Progress bars"
			description="Determinate springs to the value; unknown sweeps."
		>
			{#snippet actions()}
				<Button size="sm" icon={Shuffle} onclick={shuffle}>Shuffle</Button>
			{/snippet}
			<div class="flex flex-col gap-6">
				<Progress label="Uploading build context" value={upload} showValue />
				<Progress
					label="Restoring backup"
					detail="1.4 of 3.8 GB"
					value={37}
					size="lg"
					tone="neutral"
				/>
				<Progress label="Waiting for a builder" />
				<div class="flex flex-col gap-3">
					<Progress label="Small" labelHidden value={upload} size="sm" />
					<Progress label="Success" labelHidden value={100} tone="success" />
					<Progress label="Warning" labelHidden value={82} tone="warning" />
					<Progress label="Error" labelHidden value={97} tone="error" size="lg" />
				</div>
			</div>
		</SectionCard>

		<SectionCard title="Rings" description="Gauges for usage, with the value in the middle.">
			{#snippet actions()}
				<Button size="sm" icon={Shuffle} onclick={shuffle}>Shuffle</Button>
			{/snippet}
			<div class="flex flex-col gap-6">
				<div class="grid grid-cols-3 gap-4">
					<Ring value={cpu} tone="auto" label="CPU" detail="{(cpu / 100).toFixed(2)} of 1 core" />
					<Ring
						value={memory}
						tone="auto"
						label="Memory"
						detail="{Math.round(memory * 5.12)} of 512 MB"
					/>
					<Ring value={disk} tone="auto" label="Disk" detail="{(disk / 10).toFixed(1)} of 10 GB" />
				</div>
				<div class="flex items-center gap-6">
					<Ring value={cpu} size={24} />
					<Ring value={cpu} size={32} />
					<Ring value={cpu} size={48} />
					<Ring value={cpu} size={64} />
					<Ring value={memory} size={80} tone="auto" />
					<Ring value={64} size={48} tone="neutral" />
				</div>
			</div>
		</SectionCard>
	</div>

	<div class="grid grid-cols-2 gap-6">
		<SectionCard title="Build #482" description="feat: sponsor tiers on the landing page">
			{#snippet actions()}
				<span class="text-callout text-muted tabular-nums rond-data">{total.toFixed(1)}s</span>
				<Button size="sm" variant="ghost" icon={RotateCcw} label="Run again" onclick={restart} />
			{/snippet}
			<StepRail steps={live} />
		</SectionCard>
		<SectionCard title="Build #481" description="fix: navbar overflow on mobile">
			{#snippet actions()}
				<Badge tone="error">Failed</Badge>
			{/snippet}
			<StepRail steps={FAILED} />
		</SectionCard>
	</div>

	<SectionCard title="Skeletons" description="Same shape as what is loading. One calm shimmer.">
		{#snippet actions()}
			<SegmentedControl
				size="sm"
				label="State"
				bind:value={loaded}
				options={[
					{ value: 'loading', label: 'Loading' },
					{ value: 'loaded', label: 'Loaded' }
				]}
			/>
		{/snippet}
		<div class="grid grid-cols-2 gap-6">
			<List>
				{#if loaded === 'loading'}
					{#each [0, 1, 2] as i (i)}
						<div class="flex h-13 items-center gap-3 px-4 {i ? 'border-t border-edge' : ''}">
							<Skeleton width="2rem" height="2rem" rounded="0.5rem" />
							<div class="flex flex-1 flex-col gap-2">
								<Skeleton width={['40%', '28%', '34%'][i]} height="0.75rem" rounded="0.25rem" />
								<Skeleton width={['64%', '52%', '70%'][i]} height="0.625rem" rounded="0.25rem" />
							</div>
							<Skeleton width="2.5rem" height="0.625rem" rounded="0.25rem" />
						</div>
					{/each}
				{:else}
					{#each PROJECTS[0].entities as e (e.name)}
						<EntityRow {...e} href="#progress" />
					{/each}
				{/if}
			</List>
			<div class="grid grid-cols-2 gap-3">
				{#if loaded === 'loading'}
					{#each [0, 1] as i (i)}
						<Card>
							<div class="flex flex-col gap-3">
								<Skeleton width="3rem" height="0.75rem" rounded="0.25rem" />
								<Skeleton width="5rem" height="1.25rem" rounded="0.375rem" />
								<Skeleton width="4rem" height="0.625rem" rounded="0.25rem" />
							</div>
						</Card>
					{/each}
				{:else}
					<Card><Metric label="CPU" value="0.42" unit="cores" detail="of 1 core" /></Card>
					<Card
						><Metric
							label="Memory"
							value="471"
							unit="MB"
							detail="92% of 512 MB"
							tone="warning"
						/></Card
					>
				{/if}
			</div>
		</div>
	</SectionCard>

	<SectionCard title="Spinners" description="Inline loading. Inherits the text colour.">
		<div class="flex items-center gap-8">
			{#each [12, 14, 16, 20, 24, 32] as s (s)}
				<span class="flex flex-col items-center gap-2 text-muted">
					<Spinner size={s} />
					<span class="text-caption text-faint tabular-nums rond-data">{s}</span>
				</span>
			{/each}
			<span class="flex items-center gap-2 text-callout text-muted"
				><Spinner size={14} /> Deploying</span
			>
			<span class="text-accent"><Spinner size={16} label="Loading" /></span>
			<Button loading>Saving</Button>
		</div>
	</SectionCard>
</div>

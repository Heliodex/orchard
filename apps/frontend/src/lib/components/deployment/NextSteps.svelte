<script lang="ts">
	import { X, Zap, Globe, Gauge, Bell, HeartPulse, Terminal } from 'lucide-svelte';
	import { apiFetch } from '$lib/stores';
	import { dismissedSteps, dismissStep, dismissAllSteps } from '$lib/stores/checklist';
	import { Button, List, ListRow, PopoverPanel, ToneTile } from '$lib/components/ui';
	import Ring from '$lib/components/ui/Ring.svelte';
	import CliModal from '$lib/components/CliModal.svelte';

	let {
		deploymentId,
		ready = false,
		onGoToTab,
		onGoToSettings
	}: {
		deploymentId: string;
		ready?: boolean;
		onGoToTab?: (tab: string) => void;
		onGoToSettings?: (section: string) => void;
	} = $props();

	type Step = { id: string; applicable: boolean; done: boolean };

	const COPY: Record<
		string,
		{
			title: string;
			hint: string;
			icon: typeof Zap;
			tab?: string;
			settings?: string;
		}
	> = {
		'auto-deploy': {
			title: 'Deploy on push',
			hint: 'Build on every push',
			icon: Zap,
			settings: 'source'
		},
		domain: {
			title: 'Add your domain',
			hint: 'Certificate included',
			icon: Globe,
			tab: 'network'
		},
		resources: {
			title: 'Set CPU and memory',
			hint: 'Using the organization default',
			icon: Gauge,
			settings: 'resources'
		},
		notifications: {
			title: 'Get alerted',
			hint: 'Slack, Discord, webhook, email',
			icon: Bell,
			settings: 'notifications'
		},
		'health-check': {
			title: 'Add a health check',
			hint: 'So a bad deploy never rolls out',
			icon: HeartPulse,
			settings: 'health'
		},
		cli: {
			title: 'Use the terminal',
			hint: 'Deploy, logs and scale',
			icon: Terminal
		}
	};

	let steps = $state<Step[]>([]);
	let dismissed = $state<string[]>([]);
	let cliOpen = $state(false);
	let fetchedFor = '';

	const visible = $derived(
		steps.filter((s) => s.applicable && !s.done && !dismissed.includes(s.id) && COPY[s.id])
	);
	const applicable = $derived(steps.filter((s) => s.applicable && COPY[s.id]));
	const total = $derived(applicable.length);
	const done = $derived(total - visible.length);

	$effect(() => {
		if (!ready || !deploymentId || fetchedFor === deploymentId) return;
		fetchedFor = deploymentId;
		dismissed = dismissedSteps(deploymentId);
		void load(deploymentId);
	});

	async function load(id: string) {
		try {
			const res = await apiFetch(`/apiv1/deployments/${id}/next-steps`);
			if (!res.ok) return;
			const data = await res.json();
			steps = data.steps ?? [];
		} catch {
			/* a nudge, not a feature */
		}
	}

	function act(step: Step) {
		const copy = COPY[step.id];
		if (step.id === 'cli') {
			cliOpen = true;
			return;
		}
		if (copy.settings) onGoToSettings?.(copy.settings);
		else if (copy.tab) onGoToTab?.(copy.tab);
	}

	function hide(stepId: string) {
		dismissStep(deploymentId, stepId, stepId === 'cli');
		dismissed = [...dismissed, stepId];
	}

	function hideAll() {
		const ids = visible.map((s) => s.id);
		dismissAllSteps(deploymentId, ids);
		if (ids.includes('cli')) dismissStep(deploymentId, 'cli', true);
		dismissed = [...dismissed, ...ids];
	}
</script>

{#if visible.length > 0}
	<PopoverPanel placement="bottom-end" class="ns">
		{#snippet trigger(attrs)}
			<Button {...attrs} variant="ghost" aria-label="Set up, {visible.length} left">
				{#snippet leading()}
					<Ring
						value={done}
						max={total}
						size={16}
						thickness={2.5}
						tone="success"
						showValue={false}
					/>
				{/snippet}
				Set up <span class="ns-count">{visible.length}</span>
			</Button>
		{/snippet}
		{#snippet children({ close })}
			<div class="ns-head">
				<span class="ns-heading">Finish setting up</span>
				<Button variant="ghost" size="sm" onclick={hideAll}>Dismiss all</Button>
			</div>
			<List inset={false} label="Setup steps">
				{#each visible as step (step.id)}
					{@const copy = COPY[step.id]}
					<ListRow
						title={copy.title}
						subtitle={copy.hint}
						presence
						onclick={() => {
							close();
							act(step);
						}}
					>
						{#snippet leading()}
							<ToneTile tone="neutral" size={32}><copy.icon size={16} /></ToneTile>
						{/snippet}
						{#snippet actions()}
							<Button
								variant="ghost"
								size="sm"
								icon={X}
								label="Dismiss {copy.title}"
								onclick={() => hide(step.id)}
							/>
						{/snippet}
					</ListRow>
				{/each}
			</List>
		{/snippet}
	</PopoverPanel>
{/if}

<CliModal bind:open={cliOpen} />

<style>
	:global(.ns) {
		width: 22rem;
		padding: 0.5rem 0 0.25rem;
	}
	.ns-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem 0.5rem 1rem;
	}
	.ns-heading {
		font-size: var(--text-headline);
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.ns-count {
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
</style>

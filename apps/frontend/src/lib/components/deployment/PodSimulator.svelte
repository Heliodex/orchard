<script lang="ts">
	import { FlaskConical } from 'lucide-svelte';
	import { apiFetch, toasts } from '$lib/stores';
	import { Button, PopoverPanel, Select } from '$lib/components/ui';

	let {
		deploymentId,
		podLabel,
		onchange
	}: {
		deploymentId: string;
		podLabel: (name: string) => string;
		onchange: () => void;
	} = $props();

	const LABELS: Record<string, { label: string; description: string }> = {
		healthy: { label: 'Healthy', description: 'Running and ready' },
		'crash-loop': { label: 'Crash loop', description: 'Exits with code 1, CrashLoopBackOff' },
		'out-of-memory': { label: 'Out of memory', description: 'OOMKilled, exit 137' },
		'image-pull': { label: 'Image pull fails', description: 'ImagePullBackOff, manifest unknown' },
		'missing-secret': { label: 'Missing secret', description: 'CreateContainerConfigError' },
		unschedulable: { label: 'Unschedulable', description: 'Pending, insufficient memory' },
		'not-ready': { label: 'Failing readiness', description: 'Readiness probe returns 503' },
		terminating: { label: 'Terminating', description: 'Being shut down' },
		evicted: { label: 'Evicted', description: 'Node ran low on memory, replaced' },
		liveness: { label: 'Liveness kill', description: 'Liveness probe fails, exit 137' },
		'sidecar-crash': { label: 'Sidecar crash', description: 'The proxy container crash loops' },
		'init-crash': { label: 'Init crash', description: 'The migrate step fails before start' },
		'node-lost': { label: 'Node lost', description: 'Its node stopped reporting' }
	};

	let pods = $state<{ name: string; scenario: string }[]>([]);
	let options = $state<{ value: string; label: string }[]>([]);

	async function load() {
		const res = await apiFetch(`/apiv1/__mock/deployments/${deploymentId}/pods`);
		if (!res.ok) return;
		const body = await res.json();
		pods = body.pods;
		options = (body.options as string[]).map((value) => ({
			value,
			label: LABELS[value] ? `${LABELS[value].label} · ${LABELS[value].description}` : value
		}));
	}

	let outcome = $state('healthy');

	async function rollout(body: Record<string, unknown>) {
		const res = await apiFetch(`/apiv1/__mock/deployments/${deploymentId}/rollout`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) toasts.add({ title: 'Simulation failed', color: 'error' });
		onchange();
	}

	async function apply(scenario: string, index?: number) {
		const res = await apiFetch(`/apiv1/__mock/deployments/${deploymentId}/pods`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(index === undefined ? { scenario } : { scenario, index })
		});
		if (!res.ok) {
			toasts.add({ title: 'Simulation failed', color: 'error' });
			return;
		}
		await load();
		onchange();
	}

	const allSame = $derived(
		pods.length > 0 && pods.every((p) => p.scenario === pods[0].scenario) ? pods[0].scenario : ''
	);
</script>

<PopoverPanel placement="top-end" class="sim">
	{#snippet trigger(attrs)}
		<Button
			{...attrs}
			variant="ghost"
			size="sm"
			icon={FlaskConical}
			label="Simulate pod states"
			onclick={(e: MouseEvent) => {
				load();
				(attrs as { onclick?: (e: Event) => void }).onclick?.(e);
			}}
		/>
	{/snippet}
	{#snippet children()}
		<div class="head">
			<span class="title">Simulate pod states</span>
			<span class="note">Mock data only</span>
		</div>
		<div class="grid">
			<span class="name name--all">All pods</span>
			<Select
				size="sm"
				value={allSame}
				aria-label="All pods"
				onchange={(e: Event) => apply((e.currentTarget as HTMLSelectElement).value)}
			>
				{#if !allSame}<option value="" disabled>Mixed</option>{/if}
				{#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
			</Select>
			{#each pods as pod, i (pod.name)}
				<span class="name">{podLabel(pod.name)}</span>
				<Select
					size="sm"
					value={pod.scenario}
					aria-label="State of {podLabel(pod.name)}"
					onchange={(e: Event) => apply((e.currentTarget as HTMLSelectElement).value, i)}
				>
					{#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
				</Select>
			{/each}
		</div>
		<div class="head head--sub">
			<span class="title">Simulate a deploy</span>
		</div>
		<div class="grid">
			<span class="name name--all">New version</span>
			<Select size="sm" bind:value={outcome} aria-label="What the new version does">
				{#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
			</Select>
		</div>
		<div class="foot">
			<Button variant="ghost" size="sm" onclick={() => rollout({ cancel: true })}>End deploy</Button
			>
			<Button variant="ghost" size="sm" onclick={() => rollout({ outcome, twice: true })}
				>Deploy twice</Button
			>
			<Button variant="secondary" size="sm" onclick={() => rollout({ outcome })}>Deploy</Button>
		</div>
		<div class="foot">
			<Button variant="ghost" size="sm" onclick={() => apply('healthy')}>Reset pods</Button>
		</div>
	{/snippet}
</PopoverPanel>

<style>
	:global(.sim) {
		width: 24rem;
		padding: 0.75rem;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0 0.25rem 0.75rem;
	}
	.title {
		font-size: var(--text-headline);
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.note {
		font-size: var(--text-caption);
		color: var(--text-faint);
	}
	.grid {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr);
		align-items: center;
		gap: 0.5rem 0.75rem;
		padding: 0 0.25rem;
	}
	.name {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
		color: var(--text-muted);
	}
	.name--all {
		font-family: inherit;
		color: var(--text-default);
	}
	.head--sub {
		padding-top: 1rem;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
		gap: 0.25rem;
		padding-top: 0.75rem;
	}
</style>

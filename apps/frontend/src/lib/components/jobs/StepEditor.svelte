<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import { Field, Input, Dropdown, TabBar } from '$lib/components/ui';
	import { springRotate } from '$lib/utils/motion.svelte';
	import type { JobStepDraft } from '$lib/types/jobs';
	import ScriptEditor from './ScriptEditor.svelte';
	import EnvVarsEditor from './EnvVarsEditor.svelte';

	let {
		step = $bindable(),
		index,
		deployments = []
	}: {
		step: JobStepDraft;
		index: number;
		deployments?: Array<{ id: string; name: string }>;
	} = $props();

	let advancedOpen = $state(false);

	const typeTabs = [
		{ id: 'script', label: 'Script' },
		{ id: 'app', label: 'App command' },
		{ id: 'image', label: 'Custom image' }
	];
</script>

<div class="job-step-editor">
	<Field label="Step name" for="step-{index}-name">
		<Input id="step-{index}-name" placeholder="Step {index + 1}" bind:value={step.name} />
	</Field>

	<div class="job-step-type-switch">
		<TabBar tabs={typeTabs} bind:value={step.type} />
	</div>

	{#if step.type === 'script'}
		<ScriptEditor
			bind:script={step.script}
			bind:runtime={step.scriptRuntime}
			idPrefix="step-{index}"
		/>
	{:else if step.type === 'app'}
		<div class="grid gap-3 md:grid-cols-2">
			<Field label="App" for="step-{index}-deployment">
				<Dropdown
					id="step-{index}-deployment"
					bind:value={step.deploymentId}
					placeholder="Select an app…"
					options={deployments.map((d) => ({ value: d.id, label: d.name }))}
				/>
			</Field>
			<Field label="Command" for="step-{index}-command">
				<Input
					id="step-{index}-command"
					class="font-mono text-sm"
					placeholder="rails db:cleanup"
					bind:value={step.command}
				/>
			</Field>
		</div>
	{:else}
		<div class="grid gap-3 md:grid-cols-2">
			<Field label="Image" for="step-{index}-image">
				<Input
					id="step-{index}-image"
					class="type-ident text-sm"
					placeholder="ghcr.io/acme/tool:latest"
					bind:value={step.image}
				/>
			</Field>
			<Field label="Command" for="step-{index}-command">
				<Input
					id="step-{index}-command"
					class="font-mono text-sm"
					placeholder="image entrypoint"
					bind:value={step.command}
				/>
			</Field>
		</div>
	{/if}

	<div class="job-step-env">
		<p class="job-step-section-label">
			{step.type === 'app' ? 'Environment overrides' : 'Environment variables'}
		</p>
		<EnvVarsEditor bind:envVars={step.envVars} />
	</div>

	<button
		type="button"
		class="job-step-advanced-toggle"
		onclick={() => (advancedOpen = !advancedOpen)}
	>
		<span class="inline-flex" {@attach springRotate(() => advancedOpen, { rest: 0, on: 180 })}>
			<ChevronDown size={13} />
		</span>
		Advanced
	</button>
	{#if advancedOpen}
		<div class="grid gap-3 md:grid-cols-3">
			<Field label="Timeout (seconds)" for="step-{index}-timeout">
				<Input
					id="step-{index}-timeout"
					type="number"
					min="30"
					max="21600"
					bind:value={step.timeoutSeconds}
				/>
			</Field>
			<Field label="Retries" for="step-{index}-retries">
				<Input id="step-{index}-retries" type="number" min="0" max="3" bind:value={step.retries} />
			</Field>
			<Field label="CPU (millicores)" for="step-{index}-cpu">
				<Input
					id="step-{index}-cpu"
					type="number"
					min="50"
					max="8000"
					placeholder="project default"
					bind:value={step.cpuRequestMilli}
				/>
			</Field>
		</div>
	{/if}
</div>

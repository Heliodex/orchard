<script lang="ts">
	import { Box, Cpu, Globe, Layers, Rocket, Server, Sparkles, Users } from 'lucide-svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Dropdown from '$lib/components/ui/Dropdown.svelte';
	import ToggleRow from '$lib/components/ui/ToggleRow.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import RadioGroup from '$lib/components/ui/RadioGroup.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import Stepper from '$lib/components/ui/Stepper.svelte';

	let envs = $state([
		{ id: 'production', label: 'Production', on: true },
		{ id: 'preview', label: 'Preview', on: true },
		{ id: 'development', label: 'Development', on: false }
	]);
	const allEnvs = $derived(envs.every((e) => e.on));
	const someEnvs = $derived(envs.some((e) => e.on));

	let migrate = $state(true);
	let strategy = $state('dockerfile');
	let plan = $state('pro');
	let region = $state('fsn1');

	let notes = $state('');
	let grow = $state(
		'Runs the Next.js app behind the edge proxy.\nCron jobs live in the worker deployment.'
	);
	let headers = $state('X-Frame-Options DENY\nContent-Security-Policy default-src');

	let replicasSlider = $state(3);
	let cpu = $state(1);
	let memory = $state(1024);
	let replicas = $state(2);
	let instances = $state(1);
	let workers = $state(8);

	let appName = $state('hackclub-site');
	let domain = $state('hackclub.com');
	let formRegion = $state('fsn1');
	let size = $state('medium');
	let formReplicas = $state(2);
	let buildCmd = $state('pnpm build');
	let description = $state('Marketing site and sponsor pages for Hack Club.');
	let autoDeploy = $state(true);
	let failAlerts = $state(true);
	let saving = $state(false);

	function save() {
		saving = true;
		setTimeout(() => (saving = false), 1400);
	}
</script>

<div class="flex flex-col gap-6">
	<div class="grid grid-cols-2 gap-6">
		<SectionCard title="Checkboxes" description="For picking any number of things in a list.">
			<div class="flex flex-col gap-6">
				<div class="flex flex-col gap-3">
					<Checkbox
						label="All environments"
						checked={allEnvs}
						indeterminate={someEnvs && !allEnvs}
						onchange={(c) => envs.forEach((e) => (e.on = c))}
					/>
					<div class="flex flex-col gap-3 pl-6">
						{#each envs as env (env.id)}
							<Checkbox label={env.label} bind:checked={env.on} />
						{/each}
					</div>
				</div>
				<div class="flex flex-col gap-4">
					<Checkbox
						label="Run migrations before deploy"
						hint="Runs prisma migrate deploy in a one-off pod first."
						bind:checked={migrate}
					/>
					<Checkbox
						label="Require approval for production"
						hint="Available on the Team plan."
						disabled
					/>
					<Checkbox label="Keep build cache" checked disabled />
				</div>
			</div>
		</SectionCard>

		<SectionCard title="Radio list" description="One of many, when each choice needs a sentence.">
			<RadioGroup
				label="Build strategy"
				bind:value={strategy}
				options={[
					{
						value: 'dockerfile',
						label: 'Dockerfile',
						description: 'Builds the Dockerfile at the root of your repo.'
					},
					{
						value: 'nixpacks',
						label: 'Detect automatically',
						description: 'Works out the language and start command for you.'
					},
					{
						value: 'static',
						label: 'Static site',
						description: 'Serves the output folder from the edge. No server.'
					},
					{
						value: 'image',
						label: 'Prebuilt image',
						description: 'Connect a registry first to deploy an image.',
						disabled: true
					}
				]}
			/>
		</SectionCard>
	</div>

	<SectionCard title="Radio cards" description="For choices people compare: plans, regions, sizes.">
		<div class="flex flex-col gap-6">
			<RadioGroup
				label="Plan"
				variant="cards"
				bind:value={plan}
				options={[
					{
						value: 'hobby',
						label: 'Hobby',
						meta: 'Free',
						icon: Sparkles,
						description: 'One app, sleeps after 30 minutes idle.'
					},
					{
						value: 'pro',
						label: 'Pro',
						meta: '$12 per month',
						icon: Rocket,
						description: 'Always on, custom domains and preview deploys.'
					},
					{
						value: 'team',
						label: 'Team',
						meta: '$40 per month',
						icon: Users,
						description: 'Shared projects, approvals and audit logs.'
					}
				]}
			/>
			<RadioGroup
				label="Region"
				variant="cards"
				columns={4}
				bind:value={region}
				options={[
					{ value: 'fsn1', label: 'Falkenstein', icon: Globe, description: 'fsn1, 12 ms away' },
					{ value: 'hel1', label: 'Helsinki', icon: Globe, description: 'hel1, 31 ms away' },
					{ value: 'ash', label: 'Ashburn', icon: Globe, description: 'ash, 94 ms away' },
					{
						value: 'sin',
						label: 'Singapore',
						icon: Globe,
						description: 'Coming soon',
						disabled: true
					}
				]}
			/>
		</div>
	</SectionCard>

	<div class="grid grid-cols-2 gap-6">
		<SectionCard title="Text areas" description="Matches Input. Can grow with its content.">
			<div class="flex flex-col gap-4">
				<Field label="Release notes" for="ta-notes">
					<Textarea id="ta-notes" bind:value={notes} placeholder="What changed in this deploy?" />
				</Field>
				<Field label="Description" hint="Grows as you type, up to 6 lines." for="ta-grow">
					<Textarea
						id="ta-grow"
						bind:value={grow}
						rows={2}
						autoGrow
						maxRows={6}
						maxlength={280}
						counter
					/>
				</Field>
				<Field label="Response headers" error="Each header needs a name and a value." for="ta-err">
					<Textarea id="ta-err" bind:value={headers} rows={2} mono error />
				</Field>
				<Field label="Build arguments" hint="Managed by the template." for="ta-off">
					<Textarea id="ta-off" value="NODE_ENV=production" rows={2} mono disabled />
				</Field>
			</div>
		</SectionCard>

		<SectionCard
			title="Sliders and steppers"
			description="Drag, click the track, or use arrow keys."
		>
			<div class="flex flex-col gap-6">
				<Field label="Replicas">
					<div class="flex items-center gap-4">
						<Slider label="Replicas" bind:value={replicasSlider} min={1} max={8} ticks />
						<span
							class="min-w-16 shrink-0 text-right text-body whitespace-nowrap text-muted tabular-nums rond-data"
							>{replicasSlider} of 8</span
						>
					</div>
				</Field>
				<Field label="CPU">
					<div class="flex items-center gap-4">
						<Slider label="CPU" bind:value={cpu} min={0.25} max={4} step={0.25} />
						<span
							class="min-w-16 shrink-0 text-right text-body whitespace-nowrap text-muted tabular-nums rond-data"
							>{cpu.toFixed(2)} vCPU</span
						>
					</div>
				</Field>
				<Field label="Memory" hint="Locked while a deploy is running.">
					<div class="flex items-center gap-4">
						<Slider label="Memory" bind:value={memory} min={256} max={4096} step={256} disabled />
						<span
							class="min-w-16 shrink-0 text-right text-body whitespace-nowrap text-faint tabular-nums rond-data"
							>{memory} MB</span
						>
					</div>
				</Field>
				<div class="grid grid-cols-2 gap-x-6 gap-y-4">
					<Field label="Instances">
						<div><Stepper bind:value={replicas} min={1} max={10} label="Instances" /></div>
					</Field>
					<Field label="Workers" hint="Hold a button to count fast.">
						<div>
							<Stepper bind:value={workers} min={1} max={64} label="Workers" suffix="threads" />
						</div>
					</Field>
					<Field label="At the minimum">
						<div><Stepper bind:value={instances} min={1} max={5} label="Read replicas" /></div>
					</Field>
					<Field label="Disabled">
						<div><Stepper value={3} disabled label="Shards" /></div>
					</Field>
				</div>
			</div>
		</SectionCard>
	</div>

	<SectionCard
		title="Deployment settings"
		description="A real form, composed only from kit pieces."
		class="max-w-3xl"
	>
		<div class="flex flex-col gap-6">
			<div class="grid grid-cols-2 gap-x-6 gap-y-4">
				<Field label="App name" hint="Lowercase letters, numbers and dashes." for="f-name">
					<Input id="f-name" bind:value={appName} />
				</Field>
				<Field
					label="Custom domain"
					error="That domain is already used by another app."
					for="f-dom"
				>
					<Input id="f-dom" bind:value={domain} error />
				</Field>
				<Field label="Region" for="f-region">
					<Dropdown
						id="f-region"
						bind:value={formRegion}
						options={[
							{ value: 'fsn1', label: 'Falkenstein (fsn1)' },
							{ value: 'hel1', label: 'Helsinki (hel1)' },
							{ value: 'ash', label: 'Ashburn (ash)' }
						]}
					/>
				</Field>
				<Field label="Replicas" hint="Each replica gets its own CPU and memory." for="f-rep">
					<div>
						<Stepper id="f-rep" bind:value={formReplicas} min={1} max={20} label="Replicas" />
					</div>
				</Field>
			</div>

			<Field label="Instance size">
				<RadioGroup
					label="Instance size"
					variant="cards"
					columns={4}
					bind:value={size}
					options={[
						{
							value: 'small',
							label: 'Small',
							icon: Box,
							meta: '$5',
							description: '0.5 vCPU, 512 MB'
						},
						{
							value: 'medium',
							label: 'Medium',
							icon: Cpu,
							meta: '$10',
							description: '1 vCPU, 1 GB'
						},
						{
							value: 'large',
							label: 'Large',
							icon: Server,
							meta: '$40',
							description: '2 vCPU, 4 GB'
						},
						{
							value: 'xl',
							label: 'Extra large',
							icon: Layers,
							meta: '$120',
							description: 'Team plan only',
							disabled: true
						}
					]}
				/>
			</Field>

			<div class="grid grid-cols-2 gap-x-6 gap-y-4">
				<Field label="Build command" for="f-build">
					<Input id="f-build" class="font-mono" bind:value={buildCmd} />
				</Field>
				<Field label="Start command" hint="Set by your Dockerfile." for="f-start">
					<Input id="f-start" class="font-mono" value="node server.js" disabled />
				</Field>
			</div>

			<Field label="Description" for="f-desc">
				<Textarea id="f-desc" bind:value={description} rows={2} autoGrow maxlength={280} counter />
			</Field>

			<div class="flex flex-col gap-4 border-t border-edge pt-6">
				<ToggleRow
					label="Deploy on push"
					hint="Every push to main builds and ships."
					bind:checked={autoDeploy}
				/>
				<ToggleRow label="Preview deployments" hint="Available on the Pro plan." disabled />
				<Checkbox
					label="Email me when a deploy fails"
					hint="Sent to alex@example.test."
					bind:checked={failAlerts}
				/>
			</div>
		</div>
		{#snippet footer()}
			<span class="mr-auto flex items-center gap-2 text-caption text-muted">
				<Badge tone="warning">1 error</Badge>
				Fix the domain to save
			</span>
			<Button>Discard</Button>
			<Button variant="primary" loading={saving} onclick={save}>Save changes</Button>
		{/snippet}
	</SectionCard>
</div>

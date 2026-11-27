<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { apiFetch, toasts, buildBasePath } from '$lib/stores';
	import {
		LayoutTemplate,
		Plus,
		Trash2,
		Code,
		SlidersHorizontal,
		ChevronDown,
		ChevronUp
	} from 'lucide-svelte';
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';
	import { Button, Dropdown, Field, Input } from '$lib/components/ui';

	type ParamType = 'string' | 'number' | 'boolean' | 'select';
	type ResourceType = 'deployment' | 'database' | 'ingress';

	interface Param {
		name: string;
		displayName: string;
		description: string;
		type: ParamType;
		default: string;
		required: boolean;
		placeholder: string;
		validationPattern: string;
		validationMessage: string;
		validationMin: string;
		validationMax: string;
		options: { label: string; value: string }[];
	}

	interface EnvVar {
		key: string;
		value: string;
	}

	interface Port {
		name: string;
		containerPort: number;
		servicePort: number;
		protocol: string;
	}

	interface Route {
		path: string;
		serviceName: string;
		servicePort: number;
	}

	interface Resource {
		name: string;
		type: ResourceType;
		expanded: boolean;
		// database
		dbName: string;
		// deployment
		image: string;
		replicas: string;
		ports: Port[];
		env: EnvVar[];
		// ingress
		host: string;
		tlsEnabled: boolean;
		routes: Route[];
	}

	const orgSlug = $derived($page.params.orgSlug ?? '');
	const projectSlug = $derived($page.params.projectSlug ?? '');
	const wsSlug = $derived($page.params.wsSlug);
	const basePath = $derived(buildBasePath({ orgSlug, projectSlug, wsSlug }));

	let mode = $state<'visual' | 'yaml'>('visual');
	let saving = $state(false);
	let error = $state<string | null>(null);

	let metaName = $state('my-template');
	let metaDisplayName = $state('My Template');
	let metaDescription = $state('');
	let metaIcon = $state('');
	let metaVersion = $state('1.0.0');
	let metaCategory = $state('');
	let metaTags = $state('');

	let parameters = $state<Param[]>([]);
	let resources = $state<Resource[]>([]);

	let yamlContent = $state(exampleYaml());

	function exampleYaml(): string {
		return `apiVersion: leaf/v1
kind: Template
metadata:
  name: my-template
  displayName: My Template
  description: A custom template
  icon: server
  version: "1.0.0"
  category: backend
  tags: ["custom"]

parameters:
  - name: app-name
    displayName: App Name
    description: Name for the application
    type: string
    default: my-app
    required: true
    validation:
      pattern: "^[a-z][a-z0-9-]{1,58}[a-z0-9]$"
      message: Must be lowercase alphanumeric with hyphens, 3-60 chars

  - name: image
    displayName: Docker Image
    description: Docker image to deploy
    type: string
    required: true
    placeholder: "registry/image:tag"

  - name: port
    displayName: App Port
    type: number
    default: 3000
    validation:
      min: 1
      max: 65535

  - name: replicas
    displayName: Replicas
    type: number
    default: 1
    validation:
      min: 1
      max: 10

  - name: domain
    displayName: Domain
    description: Public domain for the application
    type: string
    required: true
    placeholder: "app.example.com"

  - name: enable-tls
    displayName: Enable HTTPS
    type: boolean
    default: true

resources:
  - name: app
    type: deployment
    config:
      name: "{{ params.app-name }}"
      image: "{{ params.image }}"
      replicas: "{{ params.replicas }}"
      ports:
        - name: http
          containerPort: "{{ params.port }}"
          servicePort: "{{ params.port }}"
          protocol: TCP
      env:
        - key: PORT
          value: "{{ params.port }}"
        - key: NODE_ENV
          value: production

  - name: ingress
    type: ingress
    config:
      host: "{{ params.domain }}"
      tlsEnabled: "{{ params.enable-tls }}"
      routes:
        - path: /
          serviceName: "{{ resources.app.serviceName }}"
          servicePort: "{{ params.port }}"
`;
	}

	function addParameter() {
		parameters = [
			...parameters,
			{
				name: '',
				displayName: '',
				description: '',
				type: 'string',
				default: '',
				required: false,
				placeholder: '',
				validationPattern: '',
				validationMessage: '',
				validationMin: '',
				validationMax: '',
				options: []
			}
		];
	}

	function removeParameter(index: number) {
		parameters = parameters.filter((_, i) => i !== index);
	}

	function addOption(paramIndex: number) {
		parameters[paramIndex].options = [...parameters[paramIndex].options, { label: '', value: '' }];
	}

	function removeOption(paramIndex: number, optIndex: number) {
		parameters[paramIndex].options = parameters[paramIndex].options.filter(
			(_, i) => i !== optIndex
		);
	}

	function addResource() {
		resources = [
			...resources,
			{
				name: '',
				type: 'deployment',
				expanded: true,
				dbName: '',
				image: '',
				replicas: '1',
				ports: [{ name: 'http', containerPort: 3000, servicePort: 3000, protocol: 'TCP' }],
				env: [],
				host: '',
				tlsEnabled: true,
				routes: [{ path: '/', serviceName: '', servicePort: 80 }]
			}
		];
	}

	function removeResource(index: number) {
		resources = resources.filter((_, i) => i !== index);
	}

	function addEnvVar(resIndex: number) {
		resources[resIndex].env = [...resources[resIndex].env, { key: '', value: '' }];
	}

	function removeEnvVar(resIndex: number, envIndex: number) {
		resources[resIndex].env = resources[resIndex].env.filter((_, i) => i !== envIndex);
	}

	function addPort(resIndex: number) {
		resources[resIndex].ports = [
			...resources[resIndex].ports,
			{ name: '', containerPort: 8080, servicePort: 8080, protocol: 'TCP' }
		];
	}

	function removePort(resIndex: number, portIndex: number) {
		resources[resIndex].ports = resources[resIndex].ports.filter((_, i) => i !== portIndex);
	}

	function addRoute(resIndex: number) {
		resources[resIndex].routes = [
			...resources[resIndex].routes,
			{ path: '/', serviceName: '', servicePort: 80 }
		];
	}

	function removeRoute(resIndex: number, routeIndex: number) {
		resources[resIndex].routes = resources[resIndex].routes.filter((_, i) => i !== routeIndex);
	}

	function visualToYaml(): string {
		const lines: string[] = [];
		lines.push('apiVersion: leaf/v1');
		lines.push('kind: Template');
		lines.push('metadata:');
		lines.push(`  name: ${metaName}`);
		lines.push(`  displayName: ${metaDisplayName}`);
		if (metaDescription) lines.push(`  description: ${metaDescription}`);
		if (metaIcon) lines.push(`  icon: ${metaIcon}`);
		lines.push(`  version: "${metaVersion}"`);
		if (metaCategory) lines.push(`  category: ${metaCategory}`);
		if (metaTags.trim()) {
			const tags = metaTags
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);
			lines.push(`  tags: [${tags.map((t) => `"${t}"`).join(', ')}]`);
		}

		if (parameters.length > 0) {
			lines.push('');
			lines.push('parameters:');
			for (const p of parameters) {
				lines.push(`  - name: ${p.name}`);
				lines.push(`    displayName: ${p.displayName || p.name}`);
				if (p.description) lines.push(`    description: ${p.description}`);
				lines.push(`    type: ${p.type}`);
				if (p.default) lines.push(`    default: ${p.type === 'string' ? p.default : p.default}`);
				if (p.required) lines.push(`    required: true`);
				if (p.placeholder) lines.push(`    placeholder: "${p.placeholder}"`);
				if (
					(p.type === 'string' && p.validationPattern) ||
					(p.type === 'number' && (p.validationMin || p.validationMax))
				) {
					lines.push('    validation:');
					if (p.type === 'string' && p.validationPattern) {
						lines.push(`      pattern: "${p.validationPattern}"`);
						if (p.validationMessage) lines.push(`      message: ${p.validationMessage}`);
					}
					if (p.type === 'number') {
						if (p.validationMin) lines.push(`      min: ${p.validationMin}`);
						if (p.validationMax) lines.push(`      max: ${p.validationMax}`);
					}
				}
				if (p.type === 'select' && p.options.length > 0) {
					lines.push('    options:');
					for (const o of p.options) {
						lines.push(`      - label: "${o.label}"`);
						lines.push(`        value: "${o.value}"`);
					}
				}
			}
		}

		if (resources.length > 0) {
			lines.push('');
			lines.push('resources:');
			for (const r of resources) {
				lines.push(`  - name: ${r.name}`);
				lines.push(`    type: ${r.type}`);
				lines.push('    config:');
				switch (r.type) {
					case 'database':
						lines.push(`      name: "${r.dbName}"`);
						break;
					case 'deployment':
						lines.push(`      name: "${r.name}"`);
						lines.push(`      image: "${r.image}"`);
						lines.push(`      replicas: ${r.replicas}`);
						if (r.ports.length > 0) {
							lines.push('      ports:');
							for (const port of r.ports) {
								lines.push(`        - name: ${port.name}`);
								lines.push(`          containerPort: ${port.containerPort}`);
								lines.push(`          servicePort: ${port.servicePort}`);
								lines.push(`          protocol: ${port.protocol}`);
							}
						}
						if (r.env.length > 0) {
							lines.push('      env:');
							for (const e of r.env) {
								lines.push(`        - key: ${e.key}`);
								lines.push(`          value: "${e.value}"`);
							}
						}
						break;
					case 'ingress':
						lines.push(`      host: "${r.host}"`);
						lines.push(`      tlsEnabled: ${r.tlsEnabled}`);
						if (r.routes.length > 0) {
							lines.push('      routes:');
							for (const route of r.routes) {
								lines.push(`        - path: ${route.path}`);
								lines.push(`          serviceName: "${route.serviceName}"`);
								lines.push(`          servicePort: ${route.servicePort}`);
							}
						}
						break;
				}
			}
		}

		lines.push('');
		return lines.join('\n');
	}

	function switchToYaml() {
		if (mode === 'visual' && (parameters.length > 0 || resources.length > 0)) {
			yamlContent = visualToYaml();
		}
		mode = 'yaml';
	}

	function switchToVisual() {
		mode = 'visual';
	}

	async function save() {
		saving = true;
		error = null;

		try {
			const yaml = mode === 'yaml' ? yamlContent : visualToYaml();

			const response = await apiFetch('/apiv1/templates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ yaml })
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || "Couldn't create template");
			}

			toasts.add({
				title: 'Template created',
				description: 'Your custom template is now available',
				color: 'success'
			});

			goto(`${basePath}/templates`);
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't create template";
		} finally {
			saving = false;
		}
	}
</script>

<div class="nt-page">
	<div class="mb-4">
		<Breadcrumbs
			crumbs={[
				{ label: 'Home', href: `/${orgSlug}` },
				{ label: 'Templates', href: `${basePath}/templates` },
				{ label: 'New template' }
			]}
		/>
	</div>

	<div class="nt-header">
		<LayoutTemplate class="h-6 w-6" style="color: var(--sidebar-text-active-border)" />
		<div>
			<h1 class="nt-title">New template</h1>
			<p class="nt-subtitle">Create a reusable app template</p>
		</div>
	</div>

	<div class="nt-mode-toggle">
		<button class="nt-mode-btn" class:nt-mode-active={mode === 'visual'} onclick={switchToVisual}>
			<SlidersHorizontal class="h-4 w-4" />
			Visual editor
		</button>
		<button class="nt-mode-btn" class:nt-mode-active={mode === 'yaml'} onclick={switchToYaml}>
			<Code class="h-4 w-4" />
			YAML editor
		</button>
	</div>

	{#if error}
		<div class="nt-error">{error}</div>
	{/if}

	{#if mode === 'yaml'}
		<div class="nt-yaml-section">
			<p class="nt-yaml-hint">
				Write your template YAML directly. See the
				<button
					class="nt-link"
					onclick={() => {
						yamlContent = exampleYaml();
					}}
				>
					example template
				</button>
				for reference.
			</p>
			<textarea class="nt-yaml-editor" bind:value={yamlContent} spellcheck="false" rows="30"
			></textarea>
		</div>
	{:else}
		<div class="nt-visual">
			<section class="nt-section">
				<h2 class="nt-section-title">Metadata</h2>
				<div class="nt-grid-2">
					<Field label="Name *" for="meta-name" hint="Unique identifier (lowercase, hyphens)">
						<Input id="meta-name" bind:value={metaName} placeholder="my-template" />
					</Field>
					<Field label="Display name *" for="meta-display">
						<Input id="meta-display" bind:value={metaDisplayName} placeholder="My Template" />
					</Field>
				</div>
				<Field label="Description" for="meta-desc">
					<Input
						id="meta-desc"
						bind:value={metaDescription}
						placeholder="What this template does"
					/>
				</Field>
				<div class="nt-grid-3">
					<Field label="Icon" for="meta-icon">
						<Dropdown
							id="meta-icon"
							bind:value={metaIcon}
							options={[
								{ value: '', label: 'None' },
								{ value: 'server', label: 'Server' },
								{ value: 'database', label: 'Database' },
								{ value: 'globe', label: 'Globe' },
								{ value: 'nodejs', label: 'Node.js' },
								{ value: 'wordpress', label: 'WordPress' },
								{ value: 'ghost', label: 'Ghost' }
							]}
						/>
					</Field>
					<Field label="Category" for="meta-cat">
						<Dropdown
							id="meta-cat"
							bind:value={metaCategory}
							options={[
								{ value: '', label: 'None' },
								{ value: 'backend', label: 'Backend' },
								{ value: 'frontend', label: 'Frontend' },
								{ value: 'cms', label: 'CMS' },
								{ value: 'database', label: 'Database' }
							]}
						/>
					</Field>
					<Field label="Version" for="meta-version">
						<Input id="meta-version" bind:value={metaVersion} placeholder="1.0.0" />
					</Field>
				</div>
				<Field label="Tags" for="meta-tags">
					<Input
						id="meta-tags"
						bind:value={metaTags}
						placeholder="nodejs, api, postgres (comma-separated)"
					/>
				</Field>
			</section>

			<section class="nt-section">
				<div class="nt-section-header">
					<h2 class="nt-section-title">Parameters</h2>
					<Button variant="secondary" size="sm" onclick={addParameter}>
						<Plus class="h-3.5 w-3.5" />
						Add
					</Button>
				</div>
				<p class="nt-section-desc">
					Parameters let users customize the template at deploy time. Use <code
						>{'{{ params.name }}'}</code
					> to reference them in resources.
				</p>

				{#each parameters as param, i (i)}
					<div class="nt-param-card">
						<div class="nt-param-header">
							<span class="nt-param-num">#{i + 1}</span>
							<input
								type="text"
								class="nt-input nt-input-sm"
								bind:value={param.name}
								placeholder="param-name"
							/>
							<button class="nt-remove-btn" onclick={() => removeParameter(i)}>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						</div>
						<div class="nt-grid-2">
							<div class="nt-field">
								<label class="nt-label-sm">Display name</label>
								<input
									type="text"
									class="nt-input nt-input-sm"
									bind:value={param.displayName}
									placeholder="Display name"
								/>
							</div>
							<div class="nt-field">
								<label class="nt-label-sm">Type</label>
								<Dropdown
									size="sm"
									bind:value={param.type}
									options={[
										{ value: 'string', label: 'String' },
										{ value: 'number', label: 'Number' },
										{ value: 'boolean', label: 'Boolean' },
										{ value: 'select', label: 'Select' }
									]}
								/>
							</div>
						</div>
						<div class="nt-field">
							<label class="nt-label-sm">Description</label>
							<input
								type="text"
								class="nt-input nt-input-sm"
								bind:value={param.description}
								placeholder="Help text for this parameter"
							/>
						</div>
						<div class="nt-grid-3">
							<div class="nt-field">
								<label class="nt-label-sm">Default</label>
								<input
									type="text"
									class="nt-input nt-input-sm"
									bind:value={param.default}
									placeholder="Default value"
								/>
							</div>
							<div class="nt-field">
								<label class="nt-label-sm">Placeholder</label>
								<input
									type="text"
									class="nt-input nt-input-sm"
									bind:value={param.placeholder}
									placeholder="Hint text"
								/>
							</div>
							<div class="nt-field nt-field-check">
								<label class="nt-check-label">
									<input type="checkbox" bind:checked={param.required} />
									Required
								</label>
							</div>
						</div>

						{#if param.type === 'string'}
							<div class="nt-grid-2">
								<div class="nt-field">
									<label class="nt-label-sm">Validation pattern</label>
									<input
										type="text"
										class="nt-input nt-input-sm nt-input-mono"
										bind:value={param.validationPattern}
										placeholder="^[a-z][a-z0-9-]+$"
									/>
								</div>
								<div class="nt-field">
									<label class="nt-label-sm">Validation message</label>
									<input
										type="text"
										class="nt-input nt-input-sm"
										bind:value={param.validationMessage}
										placeholder="Error message"
									/>
								</div>
							</div>
						{:else if param.type === 'number'}
							<div class="nt-grid-2">
								<div class="nt-field">
									<label class="nt-label-sm">Min</label>
									<input
										type="text"
										class="nt-input nt-input-sm"
										bind:value={param.validationMin}
										placeholder="0"
									/>
								</div>
								<div class="nt-field">
									<label class="nt-label-sm">Max</label>
									<input
										type="text"
										class="nt-input nt-input-sm"
										bind:value={param.validationMax}
										placeholder="100"
									/>
								</div>
							</div>
						{:else if param.type === 'select'}
							<div class="nt-options">
								<label class="nt-label-sm">Options</label>
								{#each param.options as opt, oi (oi)}
									<div class="nt-option-row">
										<input
											type="text"
											class="nt-input nt-input-sm"
											bind:value={opt.label}
											placeholder="Label"
										/>
										<input
											type="text"
											class="nt-input nt-input-sm"
											bind:value={opt.value}
											placeholder="Value"
										/>
										<button class="nt-remove-btn-sm" onclick={() => removeOption(i, oi)}>
											<Trash2 class="h-3 w-3" />
										</button>
									</div>
								{/each}
								<Button variant="secondary" size="sm" onclick={() => addOption(i)}>
									<Plus class="h-3 w-3" /> Add option
								</Button>
							</div>
						{/if}
					</div>
				{/each}

				{#if parameters.length === 0}
					<div class="nt-empty-inline">No parameters yet</div>
				{/if}
			</section>

			<section class="nt-section">
				<div class="nt-section-header">
					<h2 class="nt-section-title">Resources</h2>
					<Button variant="secondary" size="sm" onclick={addResource}>
						<Plus class="h-3.5 w-3.5" />
						Add
					</Button>
				</div>
				<p class="nt-section-desc">
					Orchard creates resources when you deploy. Use <code>{'{{ resources.name.field }}'}</code> to
					reference other resources. Order matters: resources can only reference resources listed above
					them.
				</p>

				{#each resources as res, ri (ri)}
					<div class="nt-res-card">
						<div class="nt-res-header">
							<button
								class="nt-collapse-btn"
								onclick={() => {
									resources[ri].expanded = !resources[ri].expanded;
								}}
							>
								{#if res.expanded}
									<ChevronUp class="h-4 w-4" />
								{:else}
									<ChevronDown class="h-4 w-4" />
								{/if}
							</button>
							<input
								type="text"
								class="nt-input nt-input-sm"
								bind:value={res.name}
								placeholder="resource-name"
							/>
							<div class="nt-res-type">
								<Dropdown
									size="sm"
									bind:value={res.type}
									options={[
										{ value: 'deployment', label: 'App' },
										{ value: 'database', label: 'Database' },
										{ value: 'ingress', label: 'Domain' }
									]}
								/>
							</div>
							<button class="nt-remove-btn" onclick={() => removeResource(ri)}>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						</div>

						{#if res.expanded}
							<div class="nt-res-body">
								{#if res.type === 'database'}
									<div class="nt-field">
										<label class="nt-label-sm">Database name</label>
										<input
											type="text"
											class="nt-input nt-input-sm"
											bind:value={res.dbName}
											placeholder={'{{ params.app-name }}-db'}
										/>
										<p class="nt-hint">Supports interpolation</p>
									</div>
									<div class="nt-res-context">
										<span class="nt-label-sm">Available in context:</span>
										<code>id</code> <code>host</code> <code>port</code> <code>dbName</code>
										<code>dbUser</code> <code>dbPassword</code> <code>connectionString</code>
									</div>
								{:else if res.type === 'deployment'}
									<div class="nt-grid-2">
										<div class="nt-field">
											<label class="nt-label-sm">Image</label>
											<input
												type="text"
												class="nt-input nt-input-sm"
												bind:value={res.image}
												placeholder={'{{ params.image }}'}
											/>
										</div>
										<div class="nt-field">
											<label class="nt-label-sm">Replicas</label>
											<input
												type="text"
												class="nt-input nt-input-sm"
												bind:value={res.replicas}
												placeholder="1"
											/>
										</div>
									</div>

									<div class="nt-sub-section">
										<div class="nt-sub-header">
											<span class="nt-label-sm">Ports</span>
											<Button variant="secondary" size="sm" onclick={() => addPort(ri)}>
												<Plus class="h-3 w-3" /> Add
											</Button>
										</div>
										{#each res.ports as port, pi (pi)}
											<div class="nt-port-row">
												<input
													type="text"
													class="nt-input nt-input-xs"
													bind:value={port.name}
													placeholder="name"
												/>
												<input
													type="number"
													class="nt-input nt-input-xs"
													bind:value={port.containerPort}
													placeholder="container"
												/>
												<input
													type="number"
													class="nt-input nt-input-xs"
													bind:value={port.servicePort}
													placeholder="service"
												/>
												<div class="nt-port-protocol">
													<Dropdown
														size="sm"
														bind:value={port.protocol}
														options={[
															{ value: 'TCP', label: 'TCP' },
															{ value: 'UDP', label: 'UDP' }
														]}
													/>
												</div>
												<button class="nt-remove-btn-sm" onclick={() => removePort(ri, pi)}>
													<Trash2 class="h-3 w-3" />
												</button>
											</div>
										{/each}
									</div>

									<div class="nt-sub-section">
										<div class="nt-sub-header">
											<span class="nt-label-sm">Environment variables</span>
											<Button variant="secondary" size="sm" onclick={() => addEnvVar(ri)}>
												<Plus class="h-3 w-3" /> Add
											</Button>
										</div>
										{#each res.env as env, ei (ei)}
											<div class="nt-env-row">
												<input
													type="text"
													class="nt-input nt-input-sm nt-input-mono"
													bind:value={env.key}
													placeholder="KEY"
												/>
												<input
													type="text"
													class="nt-input nt-input-sm"
													bind:value={env.value}
													placeholder={'value or {{ params.x }}'}
												/>
												<button class="nt-remove-btn-sm" onclick={() => removeEnvVar(ri, ei)}>
													<Trash2 class="h-3 w-3" />
												</button>
											</div>
										{/each}
									</div>

									<div class="nt-res-context">
										<span class="nt-label-sm">Available in context:</span>
										<code>id</code> <code>serviceName</code>
									</div>
								{:else if res.type === 'ingress'}
									<div class="nt-grid-2">
										<div class="nt-field">
											<label class="nt-label-sm">Host</label>
											<input
												type="text"
												class="nt-input nt-input-sm"
												bind:value={res.host}
												placeholder={'{{ params.domain }}'}
											/>
										</div>
										<div class="nt-field nt-field-check" style="padding-top: 1.25rem">
											<label class="nt-check-label">
												<input type="checkbox" bind:checked={res.tlsEnabled} />
												TLS enabled
											</label>
										</div>
									</div>

									<div class="nt-sub-section">
										<div class="nt-sub-header">
											<span class="nt-label-sm">Routes</span>
											<Button variant="secondary" size="sm" onclick={() => addRoute(ri)}>
												<Plus class="h-3 w-3" /> Add
											</Button>
										</div>
										{#each res.routes as route, roi (roi)}
											<div class="nt-route-row">
												<input
													type="text"
													class="nt-input nt-input-sm"
													bind:value={route.path}
													placeholder="/"
													style="max-width: 5rem"
												/>
												<input
													type="text"
													class="nt-input nt-input-sm"
													bind:value={route.serviceName}
													placeholder={'{{ resources.app.serviceName }}'}
												/>
												<input
													type="number"
													class="nt-input nt-input-sm"
													bind:value={route.servicePort}
													placeholder="80"
													style="max-width: 5rem"
												/>
												<button class="nt-remove-btn-sm" onclick={() => removeRoute(ri, roi)}>
													<Trash2 class="h-3 w-3" />
												</button>
											</div>
										{/each}
									</div>

									<div class="nt-res-context">
										<span class="nt-label-sm">Available in context:</span>
										<code>id</code> <code>host</code>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}

				{#if resources.length === 0}
					<div class="nt-empty-inline">No resources yet. Add at least one resource.</div>
				{/if}
			</section>
		</div>
	{/if}

	<div class="nt-actions">
		<Button variant="primary" onclick={save} loading={saving}>
			{#if !saving}<LayoutTemplate class="h-4 w-4" />{/if}
			Create template
		</Button>
	</div>
</div>

<style>
	.nt-page {
		max-width: 48rem;
		margin: 0 auto;
		padding: 2.5rem 2.5rem 4rem;
	}

	.nt-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 2rem;
	}
	.nt-title {
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
		font-weight: 700;
		color: var(--center-channel-color);
		margin: 0;
		letter-spacing: -0.011em;
	}
	.nt-subtitle {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--surface-muted);
		margin: 0.25rem 0 0;
	}

	.nt-mode-toggle {
		display: flex;
		gap: 0;
		margin-bottom: 1.5rem;
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
		width: fit-content;
	}
	.nt-mode-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		border: none;
		background: transparent;
		color: var(--surface-muted);
		cursor: pointer;
		transition: all var(--dur-fast);
	}
	.nt-mode-btn:not(:last-child) {
		border-right: 1px solid var(--surface-border);
	}
	.nt-mode-active {
		background-color: var(--sidebar-text-active-border);
		color: var(--button-color);
	}

	.nt-error {
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		background-color: color-mix(in srgb, var(--error-text-color) 10%, transparent);
		color: var(--error-text-color);
		border: 1px solid color-mix(in srgb, var(--error-text-color) 25%, transparent);
		margin-bottom: 1.5rem;
	}

	.nt-yaml-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.nt-yaml-hint {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--surface-muted);
		margin: 0;
	}
	.nt-link {
		background: none;
		border: none;
		color: var(--sidebar-text-active-border);
		cursor: pointer;
		font-size: inherit;
		padding: 0;
		text-decoration: underline;
	}
	.nt-yaml-editor {
		width: 100%;
		min-height: 500px;
		padding: 1rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--surface-border);
		background-color: var(--center-channel-bg);
		color: var(--center-channel-color);
		font-family: var(--font-mono);
		font-size: var(--text-footnote);
		line-height: 1.6;
		resize: vertical;
		tab-size: 2;
	}
	.nt-yaml-editor:focus {
		outline: none;
		border-color: var(--sidebar-text-active-border);
	}

	.nt-visual {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.nt-section {
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		background-color: var(--surface-bg);
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
		box-shadow:
			0 1px 3px rgb(0 0 0 / 0.03),
			0 1px 2px rgb(0 0 0 / 0.02);
	}
	.nt-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.nt-section-title {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
		letter-spacing: 0.05em;
		color: var(--surface-muted);
		margin: 0;
	}
	.nt-section-desc {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--surface-muted);
		margin: -0.5rem 0 0;
	}
	.nt-section-desc code {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius-xs);
		background-color: color-mix(in srgb, var(--surface-border) 50%, transparent);
	}

	.nt-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.nt-field-check {
		justify-content: center;
	}
	.nt-label-sm {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
		color: var(--surface-muted);
	}
	.nt-hint {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--surface-muted);
		margin: 0;
	}

	.nt-input {
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--surface-border);
		background-color: var(--center-channel-bg);
		color: var(--center-channel-color);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
	}
	.nt-input:focus {
		outline: none;
		border-color: var(--sidebar-text-active-border);
	}
	.nt-input-sm {
		padding: 0.5rem 0.75rem;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
	}
	.nt-input-xs {
		padding: 0.25rem 0.5rem;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
	}
	.nt-input-mono {
		font-family: var(--font-mono);
	}
	.nt-res-type {
		width: 10rem;
		flex-shrink: 0;
	}
	.nt-port-protocol {
		width: 5.5rem;
		flex-shrink: 0;
	}

	.nt-check-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--center-channel-color);
		cursor: pointer;
	}

	.nt-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	.nt-grid-3 {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.75rem;
	}

	.nt-param-card {
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-md);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background-color: var(--center-channel-bg);
	}
	.nt-param-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.nt-param-num {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		color: var(--surface-muted);
		min-width: 1.5rem;
	}

	.nt-res-card {
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-md);
		overflow: hidden;
		background-color: var(--center-channel-bg);
	}
	.nt-res-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background-color: color-mix(in srgb, var(--surface-border) 20%, transparent);
	}
	.nt-res-body {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		border-top: 1px solid var(--surface-border);
	}
	.nt-res-context {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		background-color: color-mix(in srgb, var(--surface-border) 30%, transparent);
	}
	.nt-res-context code {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		padding: 0.0625rem 0.5rem;
		border-radius: var(--radius-xs);
		background-color: color-mix(in srgb, var(--surface-border) 50%, transparent);
		color: var(--center-channel-color);
	}

	.nt-sub-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.nt-sub-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.nt-env-row,
	.nt-port-row,
	.nt-route-row,
	.nt-option-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.nt-env-row > input:first-child {
		max-width: 12rem;
	}

	.nt-remove-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: var(--radius-xs);
		border: none;
		background: transparent;
		color: var(--surface-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition: all var(--dur-fast);
	}
	.nt-remove-btn:hover {
		background-color: color-mix(in srgb, var(--error-text-color) 12%, transparent);
		color: var(--error-text-color);
	}

	.nt-remove-btn-sm {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--radius-xs);
		border: none;
		background: transparent;
		color: var(--surface-muted);
		cursor: pointer;
		flex-shrink: 0;
	}
	.nt-remove-btn-sm:hover {
		color: var(--error-text-color);
	}

	.nt-collapse-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border: none;
		background: transparent;
		color: var(--surface-muted);
		cursor: pointer;
		flex-shrink: 0;
	}

	.nt-empty-inline {
		padding: 1.5rem;
		text-align: center;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--surface-muted);
		border: 1px dashed var(--surface-border);
		border-radius: var(--radius-md);
	}

	.nt-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.nt-actions {
		margin-top: 1.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--surface-border);
	}
</style>

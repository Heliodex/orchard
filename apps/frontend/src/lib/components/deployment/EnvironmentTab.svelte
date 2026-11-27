<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { Boxes, ChevronDown, Database, KeyRound, Link2, Pencil, Plus } from 'lucide-svelte';
	import {
		Alert,
		Button,
		EmptyState,
		EnvVarEditor,
		FormActions,
		Menu,
		MenuItem,
		MenuLabel,
		SectionCard,
		SegmentedControl,
		Swap,
		type EnvVarEditorRow,
		type EnvVarIssue
	} from '$lib/components/ui';
	import { rawToEnvVars } from '$lib/utils/format';
	import {
		PRIMARY_FIELD,
		fieldLabel,
		isResourceRef,
		refFor,
		refLabel,
		refParts,
		suggestedKey,
		type Binding,
		type BindingOption
	} from './bindings';

	let {
		envVars = $bindable<EnvVarEditorRow[]>(),
		isEditing = $bindable(false),
		savingEnv,
		onSave,
		onDiscard,
		bindings = [],
		resourceOptions = [],
		onConnect,
		conflicts = []
	}: {
		envVars: EnvVarEditorRow[];
		isEditing?: boolean;
		savingEnv: boolean;
		onSave: () => void;
		onDiscard?: () => void;
		bindings?: Binding[];
		resourceOptions?: BindingOption[];
		onConnect?: (option: BindingOption) => Promise<Binding | null>;
		conflicts?: { key: string; reason: string }[];
	} = $props();

	const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
	const MODES = [
		{ value: 'grid', label: 'Editor' },
		{ value: 'raw', label: 'Raw' }
	];
	const CONFLICT_REASONS: Record<string, string> = {
		reference: 'Changed in Kubernetes, but its value comes from a reference. Edit it here.',
		'foreign-source': "Read from a ConfigMap or Secret Orchard doesn't manage.",
		'orphan-secret-ref': 'Points at a secret Orchard has no variable for.',
		'removed-secret':
			'Removed in Kubernetes. Orchard kept its value. If that was intended, delete it here.',
		'mass-removal':
			'Removed from Kubernetes with most other variables. Orchard kept it. If that was intended, delete it here.'
	};

	type Pick = { kind: 'bound'; binding: Binding } | { kind: 'option'; option: BindingOption };

	let mode = $state<'grid' | 'raw'>('grid');
	let raw = $state('');
	let connecting = $state(false);
	let started = $state(false);
	let stored = $state<ReadonlySet<string>>(new Set());

	$effect(() => {
		if (isEditing) return;
		const next = new Set(
			envVars.filter((e) => e.secret && e.value === '').map((e) => e.key.trim())
		);
		untrack(() => (stored = next));
	});

	const picks = $derived<Pick[]>([
		...bindings.map((binding) => ({ kind: 'bound' as const, binding })),
		...resourceOptions.map((option) => ({ kind: 'option' as const, option }))
	]);
	const databasePicks = $derived(picks.filter((p) => pickType(p) === 'database'));
	const appPicks = $derived(picks.filter((p) => pickType(p) === 'deployment'));

	const named = $derived(envVars.filter((e) => e.key.trim()));
	const empty = $derived(named.length === 0 && !started && !isEditing && mode === 'grid');

	const draftKeys = $derived(
		mode === 'raw' ? rawToEnvVars(raw).map((p) => p.key.trim()) : named.map((e) => e.key.trim())
	);

	const issues = $derived.by(() => {
		const out = new Map<string, EnvVarIssue[]>();
		const add = (key: string, issue: EnvVarIssue) => out.set(key, [...(out.get(key) ?? []), issue]);
		const seen = new Set<string>();
		for (const key of draftKeys) {
			if (!KEY_RE.test(key))
				add(key, {
					tone: 'error',
					text: "Use letters, digits and underscores, and don't start with a digit."
				});
			if (seen.has(key)) add(key, { tone: 'error', text: 'This name is set more than once.' });
			seen.add(key);
		}
		for (const e of named) {
			const key = e.key.trim();
			if (!e.secret && stored.has(key))
				add(key, {
					tone: 'error',
					text: 'Sealed. Remove it and add it back to make it visible.'
				});
		}
		for (const c of conflicts) {
			if (seen.has(c.key))
				add(c.key, {
					tone: 'warning',
					text: CONFLICT_REASONS[c.reason] ?? 'Differs from the running app.'
				});
		}
		return out;
	});
	const blocking = $derived([...issues.values()].flat().filter((i) => i.tone === 'error').length);
	const strayConflicts = $derived(conflicts.filter((c) => !draftKeys.includes(c.key)));

	function pickType(p: Pick) {
		return p.kind === 'bound' ? p.binding.resourceType : p.option.resourceType;
	}
	function pickName(p: Pick) {
		return p.kind === 'bound' ? (p.binding.resource?.name ?? p.binding.name) : p.option.name;
	}
	function pickEndpoint(p: Pick) {
		return p.kind === 'bound' ? p.binding.endpoint : p.option.endpoint;
	}

	async function resolvePick(p: Pick): Promise<Binding | null> {
		if (p.kind === 'bound') return p.binding;
		if (!onConnect) return null;
		connecting = true;
		try {
			return await onConnect(p.option);
		} finally {
			connecting = false;
		}
	}

	async function useResource(row: EnvVarEditorRow | null, p: Pick) {
		const binding = await resolvePick(p);
		if (!binding) return;
		const field = PRIMARY_FIELD[binding.resourceType];
		const taken = envVars.map((e) => e.key.trim()).filter(Boolean);
		const target = row;
		const key = target?.key.trim() || suggestedKey(binding, field, taken);
		const next = { key, value: refFor(binding.name, field), secret: stored.has(key) };
		started = true;
		isEditing = true;
		if (target) Object.assign(target, next);
		else envVars = [...envVars, next];
	}

	function setValue(row: EnvVarEditorRow, value: string) {
		row.value = value;
		row.secret = stored.has(row.key.trim());
		isEditing = true;
	}

	function addFirst() {
		started = true;
		isEditing = true;
		if (!envVars.some((e) => !e.key.trim())) envVars = [...envVars, { key: '', value: '' }];
	}

	function switchMode(next: string) {
		if (next !== 'grid' && next !== 'raw') return;
		if (next === mode) return;
		isEditing = true;
		mode = next;
	}

	async function save() {
		if (mode === 'raw') {
			mode = 'grid';
			await tick();
		}
		onSave();
	}

	function discard() {
		mode = 'grid';
		started = false;
		onDiscard?.();
	}
</script>

{#snippet resourceMenu(onPick: (p: Pick) => void)}
	{#if databasePicks.length > 0}
		<MenuLabel>Databases</MenuLabel>
		{#each databasePicks as p (p.kind === 'bound' ? p.binding.id : p.option.resourceId)}
			<MenuItem
				icon={Database}
				description={pickEndpoint(p) ?? undefined}
				onclick={() => onPick(p)}
			>
				{pickName(p)}
			</MenuItem>
		{/each}
	{/if}
	{#if appPicks.length > 0}
		<MenuLabel>Apps on this project</MenuLabel>
		{#each appPicks as p (p.kind === 'bound' ? p.binding.id : p.option.resourceId)}
			<MenuItem
				icon={Boxes}
				description={pickEndpoint(p) ?? 'No port exposed yet'}
				onclick={() => onPick(p)}
			>
				{pickName(p)}
			</MenuItem>
		{/each}
	{/if}
{/snippet}

{#snippet accessory(row: EnvVarEditorRow)}
	{#if isResourceRef(row.value)}
		{@const bound = bindings.find((b) => b.name === refParts(row.value)?.binding)}
		<Menu placement="bottom-start">
			{#snippet trigger(props)}
				<button {...props} type="button" class="token" title={row.value}>
					<Link2 size={13} aria-hidden="true" />
					<span class="token-text">{refLabel(row.value, bindings)}</span>
					<ChevronDown size={12} aria-hidden="true" />
				</button>
			{/snippet}
			{#if bound}
				<MenuLabel>Read from {bound.resource?.name ?? bound.name}</MenuLabel>
				{#each bound.fields as field (field)}
					<MenuItem
						checked={row.value === refFor(bound.name, field)}
						onclick={() => setValue(row, refFor(bound.name, field))}
					>
						{fieldLabel(field)}
					</MenuItem>
				{/each}
			{/if}
			<MenuItem icon={Pencil} onclick={() => setValue(row, '')}>Type a value instead</MenuItem>
		</Menu>
	{:else if row.value === '' && picks.length > 0}
		<Menu placement="bottom-end">
			{#snippet trigger(props)}
				<Button {...props} variant="ghost" size="sm" icon={Link2} disabled={connecting}
					>Use a resource</Button
				>
			{/snippet}
			{@render resourceMenu((p) => useResource(row, p))}
		</Menu>
	{/if}
{/snippet}

<SectionCard title="Environment variables">
	{#snippet actions()}
		{#if !empty}
			<SegmentedControl
				label="Editor mode"
				size="sm"
				options={MODES}
				bind:value={() => mode, switchMode}
			/>
		{/if}
	{/snippet}

	<div class="body">
		{#if strayConflicts.length > 0}
			<Alert tone="warning" title="Changed outside Orchard">
				<ul class="conflicts">
					{#each strayConflicts as conflict (conflict.key)}
						<li>
							<code>{conflict.key}</code>
							{CONFLICT_REASONS[conflict.reason] ?? 'Differs from the running app.'}
						</li>
					{/each}
				</ul>
			</Alert>
		{/if}

		<Swap key={empty ? 'empty' : 'editor'}>
			{#if empty}
				<EmptyState title="No variables yet">
					{#snippet icon()}<KeyRound size={18} />{/snippet}
					<div class="empty-actions">
						<Button variant="primary" icon={Plus} onclick={addFirst}>Add variable</Button>
						{#if picks.length > 0}
							<Menu placement="bottom-start">
								{#snippet trigger(props)}
									<Button {...props} variant="secondary" icon={Link2} disabled={connecting}
										>Use a resource</Button
									>
								{/snippet}
								{@render resourceMenu((p) => useResource(null, p))}
							</Menu>
						{/if}
					</div>
				</EmptyState>
			{:else}
				<EnvVarEditor
					bind:rows={envVars}
					bind:raw
					{mode}
					secrets
					{stored}
					{issues}
					confirmSecret
					{accessory}
					tokenized={(row) => isResourceRef(row.value)}
					onedit={() => (isEditing = true)}
				>
					{#snippet addon()}
						{#if picks.length > 0}
							<Menu placement="bottom-start">
								{#snippet trigger(props)}
									<Button {...props} variant="ghost" size="sm" icon={Link2} disabled={connecting}
										>Use a resource</Button
									>
								{/snippet}
								{@render resourceMenu((p) => useResource(null, p))}
							</Menu>
						{/if}
					{/snippet}
				</EnvVarEditor>
			{/if}
		</Swap>

		{#if !empty}
			<FormActions hint="Saving restarts your app.">
				<Button variant="ghost" disabled={!isEditing || savingEnv} onclick={discard}>Discard</Button
				>
				<Button
					variant="primary"
					loading={savingEnv}
					disabled={!isEditing || blocking > 0}
					onclick={save}>Save</Button
				>
			</FormActions>
		{/if}
	</div>
</SectionCard>

<style>
	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.conflicts {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.conflicts code {
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-weight: var(--weight-semibold);
	}
	.empty-actions {
		display: flex;
		gap: var(--space-2);
	}
	.token {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		max-width: 100%;
		height: 1.75rem;
		padding: 0 0.625rem;
		border: 0;
		border-radius: var(--radius-pill);
		background: color-mix(in oklab, var(--accent) 12%, transparent);
		color: var(--accent);
		font-size: var(--text-footnote);
		font-weight: var(--weight-medium);
		cursor: pointer;
		transition: background-color var(--fade-in) var(--curve-out);
	}
	.token:hover {
		background: color-mix(in oklab, var(--accent) 18%, transparent);
	}
	.token-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>

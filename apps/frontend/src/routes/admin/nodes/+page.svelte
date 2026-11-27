<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, RefreshCw, Server, Trash2, X } from 'lucide-svelte';
	import { apiFetch, toasts } from '$lib/stores';
	import { formatCpuMilli, formatMemoryBytes } from '$lib/quantity';
	import {
		Alert,
		Avatar,
		Badge,
		Button,
		Combobox,
		Dropdown,
		EmptyState,
		Field,
		FieldGrid,
		FormActions,
		Input,
		ItemLabel,
		List,
		ListRow,
		Modal,
		RowList,
		SectionCard,
		SectionTitle,
		SegmentedControl,
		Skeleton,
		Stack,
		StatusBadge,
		Swap,
		Table,
		statusMeta
	} from '$lib/components/ui';
	import type { TableColumn } from '$lib/components/ui/Table.svelte';
	import Progress from '$lib/components/ui/Progress.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import CapacityList, { capacityTone } from '$lib/components/ui/CapacityList.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import NodePoolsPanel from '$lib/components/admin/NodePoolsPanel.svelte';

	interface Taint {
		key: string;
		value: string | null;
		effect: string;
	}

	interface TaintRow {
		id: number;
		key: string;
		value: string;
		effect: string;
	}

	interface NodeItem {
		id: string;
		name: string;
		schedulable: boolean;
		notes: string | null;
		cpuCapacity: string | null;
		memoryCapacity: string | null;
		labels: Record<string, string> | null;
		taints: Taint[] | null;
		lastSeenAt: string | null;
		_count: { assignments: number };
		usage: { cpuMilli: number; memoryBytes: number; pods: number };
	}

	interface Assignment {
		id: string;
		organizationId: string;
		mode: 'allow' | 'deny';
		cpuLimit: string | null;
		memoryLimit: string | null;
		maxServices: number | null;
		organization: { id: string; name: string; slug: string; avatarUrl: string | null };
	}

	interface NodeDetail extends Omit<NodeItem, '_count'> {
		assignments: Assignment[];
		perOrgUsage: Array<{ orgId: string; cpuMilli: number; memBytes: number; pods: number }>;
	}

	interface OrgLite {
		id: string;
		name: string;
		slug: string;
		avatarUrl?: string;
	}

	const COLUMNS: TableColumn<NodeItem>[] = [
		{ id: 'name', label: 'Name', width: 'minmax(6.5rem, 1fr)' },
		{ id: 'status', label: 'Status', width: '7rem' },
		{ id: 'cpu', label: 'CPU requested', width: '9rem' },
		{ id: 'memory', label: 'Memory requested', width: '10rem' },
		{ id: 'pods', label: 'Pods', numeric: true },
		{ id: 'assignments', label: 'Assignments', numeric: true }
	];

	const LABEL_COLUMNS: TableColumn<[string, string]>[] = [
		{ id: 'key', width: 'minmax(0, 3fr)' },
		{ id: 'value', width: 'minmax(0, 2fr)' },
		{ id: 'remove', width: '3.5rem', align: 'end' }
	];

	const TAINT_EFFECTS = [
		{ value: 'NoSchedule', label: 'NoSchedule' },
		{ value: 'PreferNoSchedule', label: 'PreferNoSchedule' },
		{ value: 'NoExecute', label: 'NoExecute' }
	];

	const ASSIGN_MODES = [
		{ value: 'allow', label: 'Allow' },
		{ value: 'deny', label: 'Deny' }
	];

	const MEMORY_UNITS: Record<string, number> = {
		'': 1,
		K: 1e3,
		M: 1e6,
		G: 1e9,
		T: 1e12,
		P: 1e15,
		Ki: 1024,
		Mi: 1024 ** 2,
		Gi: 1024 ** 3,
		Ti: 1024 ** 4,
		Pi: 1024 ** 5
	};

	let nodes = $state<NodeItem[]>([]);
	let loaded = $state(false);
	let loadError = $state<string | null>(null);
	let syncing = $state(false);
	let orgs = $state<OrgLite[]>([]);

	let sheetOpen = $state(false);
	let sheetName = $state('');
	let selectedNode = $state<NodeDetail | null>(null);
	let togglingSchedulable = $state(false);

	let assignOpen = $state(false);
	let addOrgId = $state('');
	let addOrgQuery = $state('');
	let addMode = $state<'allow' | 'deny'>('allow');
	let addCpuLimit = $state('');
	let addMemoryLimit = $state('');
	let addMaxServices = $state<string | number>('');
	let savingAssignment = $state(false);

	let removingAssignment = $state<Assignment | null>(null);
	let removeAssignmentOpen = $state(false);

	let taintRows = $state<TaintRow[]>([]);
	let savedTaints = $state('[]');
	let savingTaints = $state(false);
	let nextRowId = 0;

	let newLabelKey = $state('');
	let newLabelValue = $state('');
	let savingLabels = $state(false);

	const view = $derived(
		!loaded ? 'loading' : loadError ? 'error' : nodes.length === 0 ? 'empty' : 'rows'
	);

	const nodesSummary = $derived.by(() => {
		if (view !== 'rows') return undefined;
		const cordoned = nodes.filter((n) => !n.schedulable).length;
		const count = `${nodes.length} node${nodes.length === 1 ? '' : 's'}`;
		return cordoned ? `${count}, ${cordoned} cordoned` : count;
	});

	const assignableOrgs = $derived(
		selectedNode
			? orgs.filter((o) => !selectedNode!.assignments.some((a) => a.organizationId === o.id))
			: orgs
	);

	const labelRows = $derived(Object.entries(selectedNode?.labels ?? {}) as [string, string][]);

	const taintPayload = $derived(
		taintRows
			.filter((t) => t.key.trim())
			.map((t) => ({
				key: t.key.trim(),
				value: t.value.trim() || null,
				effect: t.effect
			}))
	);
	const taintsDirty = $derived(JSON.stringify(taintPayload) !== savedTaints);

	const capacityItems = $derived(
		selectedNode
			? [
					{
						id: 'cpu',
						label: 'CPU',
						value: selectedNode.usage.cpuMilli,
						max: cpuMilliOf(selectedNode.cpuCapacity),
						format: formatCpuMilli
					},
					{
						id: 'memory',
						label: 'Memory',
						value: selectedNode.usage.memoryBytes,
						max: memoryBytesOf(selectedNode.memoryCapacity),
						format: formatMemoryBytes
					}
				]
			: []
	);

	function cpuMilliOf(quantity: string | null): number | null {
		const m = quantity?.match(/^(\d+(?:\.\d+)?)(m)?$/);
		if (!m) return null;
		return m[2] ? Number(m[1]) : Number(m[1]) * 1000;
	}

	function memoryBytesOf(quantity: string | null): number | null {
		const m = quantity?.match(/^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|Pi|K|M|G|T|P)?$/);
		if (!m) return null;
		return Number(m[1]) * MEMORY_UNITS[m[2] ?? ''];
	}

	function nodeStatus(node: { schedulable: boolean }) {
		return node.schedulable
			? statusMeta('success', 'Schedulable')
			: statusMeta('neutral', 'Cordoned');
	}

	function plural(n: number, one: string, many = `${one}s`) {
		return `${n} ${n === 1 ? one : many}`;
	}

	function nodeDetailLine(node: NodeItem) {
		const taints = node.taints?.length ?? 0;
		return taints ? plural(taints, 'taint') : null;
	}

	function assignmentDetail(a: Assignment) {
		return [
			`CPU ${a.cpuLimit || 'unlimited'}`,
			`Memory ${a.memoryLimit || 'unlimited'}`,
			`Services ${a.maxServices ?? 'unlimited'}`
		].join(' · ');
	}

	function toTaintRows(taints: Taint[] | null | undefined): TaintRow[] {
		return (taints ?? []).map((t) => ({
			id: ++nextRowId,
			key: t.key,
			value: t.value ?? '',
			effect: t.effect || 'NoSchedule'
		}));
	}

	function taintsSnapshot(rows: TaintRow[]) {
		return JSON.stringify(
			rows.map((t) => ({ key: t.key.trim(), value: t.value.trim() || null, effect: t.effect }))
		);
	}

	async function loadNodes() {
		try {
			const res = await apiFetch('/apiv1/admin/nodes');
			if (!res.ok) throw new Error(`The server answered ${res.status}.`);
			nodes = await res.json();
			loadError = null;
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Request failed';
			if (loaded && !loadError)
				toasts.add({ title: "Couldn't load nodes", description: message, color: 'error' });
			else loadError = message;
		} finally {
			loaded = true;
		}
	}

	function retryLoad() {
		loaded = false;
		loadError = null;
		loadNodes();
	}

	async function loadOrgs() {
		try {
			const res = await apiFetch('/apiv1/admin/organizations?limit=100');
			if (!res.ok) return;
			const body = await res.json();
			orgs = body.organizations || [];
		} catch {
			orgs = [];
		}
	}

	async function syncNow() {
		syncing = true;
		try {
			const res = await apiFetch('/apiv1/admin/nodes/sync', { method: 'POST' });
			if (!res.ok) throw new Error('Sync failed');
			await loadNodes();
			toasts.add({ title: 'Nodes synced', color: 'success' });
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : 'Sync failed', color: 'error' });
		} finally {
			syncing = false;
		}
	}

	async function refreshNode(id: string) {
		const res = await apiFetch(`/apiv1/admin/nodes/${id}`);
		if (!res.ok) throw new Error("Couldn't load node");
		selectedNode = await res.json();
	}

	async function openNode(node: NodeItem) {
		selectedNode = null;
		sheetName = node.name;
		sheetOpen = true;
		try {
			await refreshNode(node.id);
			taintRows = toTaintRows(selectedNode?.taints);
			savedTaints = taintsSnapshot(taintRows);
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : 'Request failed', color: 'error' });
			sheetOpen = false;
		}
	}

	function resetAssignmentForm() {
		addOrgId = '';
		addOrgQuery = '';
		addMode = 'allow';
		addCpuLimit = '';
		addMemoryLimit = '';
		addMaxServices = '';
	}

	function closeDetail() {
		resetAssignmentForm();
		newLabelKey = '';
		newLabelValue = '';
	}

	async function toggleSchedulable(node: { id: string; schedulable: boolean }) {
		togglingSchedulable = true;
		try {
			const res = await apiFetch(`/apiv1/admin/nodes/${node.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ schedulable: !node.schedulable })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(
					err.message || (node.schedulable ? "Couldn't cordon node" : "Couldn't uncordon node")
				);
			}
			await loadNodes();
			if (selectedNode?.id === node.id) await refreshNode(node.id);
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : 'Request failed', color: 'error' });
		} finally {
			togglingSchedulable = false;
		}
	}

	function openAssign() {
		resetAssignmentForm();
		assignOpen = true;
	}

	async function saveAssignment() {
		if (!selectedNode || !addOrgId) return;
		savingAssignment = true;
		try {
			const body: Record<string, unknown> = { mode: addMode };
			if (addCpuLimit.trim()) body.cpuLimit = addCpuLimit.trim();
			if (addMemoryLimit.trim()) body.memoryLimit = addMemoryLimit.trim();
			if (String(addMaxServices).trim()) body.maxServices = parseInt(String(addMaxServices), 10);
			const res = await apiFetch(`/apiv1/admin/nodes/${selectedNode.id}/assignments/${addOrgId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) throw new Error("Couldn't save assignment");
			await refreshNode(selectedNode.id);
			await loadNodes();
			assignOpen = false;
			toasts.add({ title: 'Assignment saved', color: 'success' });
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : 'Request failed', color: 'error' });
		} finally {
			savingAssignment = false;
		}
	}

	function askRemoveAssignment(a: Assignment) {
		removingAssignment = a;
		removeAssignmentOpen = true;
	}

	async function deleteAssignment() {
		if (!selectedNode || !removingAssignment) return;
		try {
			const res = await apiFetch(
				`/apiv1/admin/nodes/${selectedNode.id}/assignments/${removingAssignment.organizationId}`,
				{ method: 'DELETE' }
			);
			if (!res.ok) throw new Error('Failed');
			await refreshNode(selectedNode.id);
			await loadNodes();
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : 'Request failed', color: 'error' });
		}
	}

	function addTaintRow() {
		taintRows = [...taintRows, { id: ++nextRowId, key: '', value: '', effect: 'NoSchedule' }];
	}
	function removeTaintRow(i: number) {
		taintRows = taintRows.filter((_, idx) => idx !== i);
	}

	async function saveTaints() {
		if (!selectedNode) return;
		savingTaints = true;
		try {
			const taints = taintPayload;
			const res = await apiFetch(`/apiv1/admin/nodes/${selectedNode.id}/taints`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ taints })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || "Couldn't save taints");
			}
			await refreshNode(selectedNode.id);
			savedTaints = JSON.stringify(taints);
			toasts.add({ title: 'Taints updated', color: 'success' });
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : 'Request failed', color: 'error' });
		} finally {
			savingTaints = false;
		}
	}

	async function patchLabels(labels: Record<string, string | null>) {
		if (!selectedNode) return;
		savingLabels = true;
		try {
			const res = await apiFetch(`/apiv1/admin/nodes/${selectedNode.id}/labels`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ labels })
			});
			if (!res.ok) throw new Error("Couldn't update labels");
			await refreshNode(selectedNode.id);
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : 'Request failed', color: 'error' });
		} finally {
			savingLabels = false;
		}
	}

	async function addLabel() {
		if (!newLabelKey.trim()) return;
		await patchLabels({ [newLabelKey.trim()]: newLabelValue.trim() });
		newLabelKey = '';
		newLabelValue = '';
	}

	onMount(() => {
		loadNodes();
		loadOrgs();
	});
</script>

{#snippet meter(
	used: number,
	cap: number | null,
	raw: string | null,
	format: (n: number) => string,
	name: string
)}
	{@const of = cap ? format(cap).replace(/ cores?$/, '') : raw}
	<span class="meter">
		<span class="meter-text" title={of ? `${format(used)} of ${of}` : format(used)}>
			{format(used)}
			{#if of}<span class="meter-of">of {of}</span>{/if}
		</span>
		{#if cap}
			<Progress
				size="sm"
				value={used}
				max={cap}
				label="{name} requested"
				labelHidden
				tone={capacityTone(used / cap)}
			/>
		{/if}
	</span>
{/snippet}

<SectionCard title="Nodes" description={nodesSummary} flush>
	{#snippet actions()}
		{#if view === 'rows'}
			<Button size="sm" icon={RefreshCw} loading={syncing} onclick={syncNow}>Sync nodes</Button>
		{/if}
	{/snippet}

	<Swap key={view}>
		{#if view === 'loading'}
			<div class="inset">
				<Stack gap="xs">
					<Skeleton height="2.75rem" />
					<Skeleton height="2.75rem" />
					<Skeleton height="2.75rem" />
				</Stack>
			</div>
		{:else if view === 'error'}
			<div class="inset">
				<Alert tone="error" title="Couldn't load nodes">
					{loadError}
					{#snippet actions()}
						<Button size="sm" onclick={retryLoad}>Retry</Button>
					{/snippet}
				</Alert>
			</div>
		{:else if view === 'empty'}
			<EmptyState title="No nodes synced yet">
				{#snippet icon()}<Server size={20} />{/snippet}
				<Button variant="primary" icon={RefreshCw} loading={syncing} onclick={syncNow}>
					Sync nodes
				</Button>
			</EmptyState>
		{:else}
			<Table
				columns={COLUMNS}
				rows={nodes}
				rowKey={(node) => node.id}
				onRowClick={openNode}
				rowLabel={(node) => `Open ${node.name}`}
				inset={false}
				label="Nodes"
			>
				{#snippet cell(node, col)}
					{#if col.id === 'name'}
						<ItemLabel title={node.name} detail={nodeDetailLine(node)} />
					{:else if col.id === 'status'}
						<StatusBadge meta={nodeStatus(node)} variant="plain" />
					{:else if col.id === 'cpu'}
						{@render meter(
							node.usage.cpuMilli,
							cpuMilliOf(node.cpuCapacity),
							node.cpuCapacity,
							formatCpuMilli,
							'CPU'
						)}
					{:else if col.id === 'memory'}
						{@render meter(
							node.usage.memoryBytes,
							memoryBytesOf(node.memoryCapacity),
							node.memoryCapacity,
							formatMemoryBytes,
							'Memory'
						)}
					{:else if col.id === 'pods'}
						{node.usage.pods}
					{:else if col.id === 'assignments'}
						{node._count.assignments}
					{/if}
				{/snippet}
			</Table>
		{/if}
	</Swap>
</SectionCard>

<NodePoolsPanel />

<Sheet bind:open={sheetOpen} title={sheetName} size="lg" onclose={closeDetail}>
	<Swap key={selectedNode ? 'detail' : 'loading'}>
		{#if !selectedNode}
			<Stack gap="sm">
				<Skeleton height="2rem" />
				<Skeleton height="4rem" />
				<Skeleton height="8rem" />
				<Skeleton height="8rem" />
			</Stack>
		{:else}
			{@const node = selectedNode}
			<Stack gap="lg">
				<Stack gap="sm">
					<div class="state-row">
						<StatusBadge meta={nodeStatus(node)} />
						<span class="state-pods">{plural(node.usage.pods, 'pod')}</span>
						<Button size="sm" loading={togglingSchedulable} onclick={() => toggleSchedulable(node)}>
							{node.schedulable ? 'Cordon' : 'Uncordon'}
						</Button>
					</div>
					<CapacityList
						label="Requests on this node"
						items={capacityItems}
						format={formatCpuMilli}
					/>
				</Stack>

				<Stack gap="sm">
					<div class="group-head">
						<SectionTitle title="Taints" size="md" />
						<p class="hint">
							A tainted node runs only workloads that tolerate the taint. To run specific workloads
							here, create a node pool that tolerates it.
						</p>
					</div>
					{#if taintRows.length > 0}
						<RowList
							label="Taints"
							items={taintRows}
							key={(taint) => taint.id}
							columns={[{ label: 'Key' }, { label: 'Value' }, { label: 'Effect', width: '11rem' }]}
							onremove={removeTaintRow}
							removeLabel={(taint) => `Remove ${taint.key || 'taint'}`}
						>
							{#snippet row(taint)}
								<Input bind:value={taint.key} mono placeholder="orchard.io/pool" aria-label="Key" />
								<Input bind:value={taint.value} mono placeholder="background" aria-label="Value" />
								<Dropdown bind:value={taint.effect} options={TAINT_EFFECTS} ariaLabel="Effect" />
							{/snippet}
						</RowList>
					{/if}
					<FormActions>
						{#snippet hint()}
							<span class="pull-ghost">
								<Button variant="ghost" size="sm" icon={Plus} onclick={addTaintRow}
									>Add taint</Button
								>
							</span>
						{/snippet}
						<Button
							variant="primary"
							size="sm"
							loading={savingTaints}
							disabled={!taintsDirty}
							onclick={saveTaints}
						>
							Save taints
						</Button>
					</FormActions>
				</Stack>

				<Stack gap="sm">
					<SectionTitle title="Labels" size="md" />
					{#if labelRows.length > 0}
						<div class="bleed">
							<Table
								columns={LABEL_COLUMNS}
								rows={labelRows}
								rowKey={(entry) => entry[0]}
								dense
								inset={false}
								label="Labels"
							>
								{#snippet cell(entry, col)}
									{#if col.id === 'key'}
										<span class="mono" title={entry[0]}>{entry[0]}</span>
									{:else if col.id === 'value'}
										<span class="mono mono--muted" title={entry[1]}>{entry[1]}</span>
									{:else}
										<Button
											variant="ghost"
											size="sm"
											icon={X}
											label="Remove label {entry[0]}"
											disabled={savingLabels}
											onclick={() => patchLabels({ [entry[0]]: null })}
										/>
									{/if}
								{/snippet}
							</Table>
						</div>
					{/if}
					<form
						class="label-form"
						onsubmit={(e) => {
							e.preventDefault();
							addLabel();
						}}
					>
						<Input bind:value={newLabelKey} mono placeholder="orchard.io/pool" aria-label="Key" />
						<Input bind:value={newLabelValue} mono placeholder="background" aria-label="Value" />
						<Button type="submit" size="sm" loading={savingLabels} disabled={!newLabelKey.trim()}>
							Add label
						</Button>
					</form>
				</Stack>

				<Stack gap="sm">
					<div class="group-head">
						<SectionTitle title="Organization assignments" size="md">
							{#snippet actions()}
								<Button size="sm" icon={Plus} onclick={openAssign}>Add</Button>
							{/snippet}
						</SectionTitle>
						{#if node.assignments.length === 0}
							<p class="hint">
								No assignments, so any organization can run workloads here. Add an assignment to
								restrict this.
							</p>
						{/if}
					</div>
					{#if node.assignments.length > 0}
						<List inset={false} label="Organization assignments">
							{#each node.assignments as a (a.id)}
								<ListRow
									flush
									pinned
									presence
									title={a.organization.name}
									subtitle={assignmentDetail(a)}
								>
									{#snippet leading()}
										<Avatar
											user={a.organization.avatarUrl
												? { id: a.organization.id, imageUrl: a.organization.avatarUrl }
												: undefined}
											seed={a.organization.id}
											size={32}
										/>
									{/snippet}
									{#snippet titleSuffix()}
										<Badge>{a.mode === 'allow' ? 'Allow' : 'Deny'}</Badge>
									{/snippet}
									{#snippet actions()}
										<Button
											variant="ghost"
											size="sm"
											icon={Trash2}
											label="Remove {a.organization.name}"
											onclick={() => askRemoveAssignment(a)}
										/>
									{/snippet}
								</ListRow>
							{/each}
						</List>
					{/if}
				</Stack>
			</Stack>
		{/if}
	</Swap>
</Sheet>

<Modal bind:open={assignOpen} title="Add assignment">
	<div class="form">
		<Field label="Organization">
			<Combobox
				bind:value={addOrgId}
				bind:query={addOrgQuery}
				options={assignableOrgs.map((o) => ({ value: o.id, label: o.name, description: o.slug }))}
				placeholder="Select an organization"
				label="Organization"
			/>
		</Field>
		<Field label="Mode">
			<SegmentedControl
				label="Mode"
				options={ASSIGN_MODES}
				grow
				bind:value={() => addMode, (v) => (addMode = v as 'allow' | 'deny')}
			/>
		</Field>
		<FieldGrid>
			<Field label="CPU limit" for="assign-cpu-limit" hint="For example 2 or 500m">
				<Input id="assign-cpu-limit" bind:value={addCpuLimit} placeholder="Unlimited" />
			</Field>
			<Field label="Memory limit" for="assign-memory-limit" hint="For example 4Gi">
				<Input id="assign-memory-limit" bind:value={addMemoryLimit} placeholder="Unlimited" />
			</Field>
		</FieldGrid>
		<Field label="Max services" for="assign-max-services">
			<Input
				id="assign-max-services"
				type="number"
				bind:value={addMaxServices}
				placeholder="Unlimited"
			/>
		</Field>
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (assignOpen = false)}>Cancel</Button>
		<Button
			variant="primary"
			disabled={!addOrgId}
			loading={savingAssignment}
			onclick={saveAssignment}
		>
			Save assignment
		</Button>
	{/snippet}
</Modal>

<ConfirmModal
	bind:open={removeAssignmentOpen}
	title="Remove {removingAssignment?.organization.name ?? 'this organization'} from this node?"
	description="This drops its allow or deny rule and its limits on this node."
	confirmLabel="Remove"
	onconfirm={deleteAssignment}
	oncancel={() => undefined}
/>

<style>
	.inset {
		padding: 0 var(--space-4) var(--space-4);
	}
	.meter {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		width: 100%;
		min-width: 0;
	}
	.meter-text {
		overflow-x: clip;
		color: var(--text-default);
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meter-of {
		color: var(--text-muted);
	}
	.state-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.state-pods {
		margin-right: auto;
		color: var(--text-muted);
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.group-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.hint {
		color: var(--text-muted);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
	}
	.pull-ghost {
		display: inline-flex;
		margin-left: calc(var(--space-2) * -1);
	}
	.bleed {
		margin-inline: calc(var(--space-4) * -1);
	}
	.mono {
		display: block;
		min-width: 0;
		overflow-x: clip;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mono--muted {
		color: var(--text-muted);
	}
	.label-form {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
</style>

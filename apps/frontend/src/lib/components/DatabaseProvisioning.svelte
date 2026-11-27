<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Check, X, Loader2, Database, ChevronDown } from 'lucide-svelte';
	import TriangleAlertIcon from '$lib/components/icons/TriangleAlertIcon.svelte';
	import { apiFetch, selectedOrganization, subscribeOrgEvents } from '$lib/stores';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import { statusMeta } from '$lib/components/ui/status';

	type StepStatus = 'pending' | 'running' | 'done' | 'error';
	interface Step {
		id: string;
		label: string;
		description: string;
		status: StepStatus;
		detail?: string;
	}
	interface KEvent {
		type: string;
		reason: string;
		message: string;
		kind?: string;
		name?: string;
		count?: number;
		lastTimestamp?: string | null;
	}
	interface Provisioning {
		databaseId: string;
		status: string;
		mode: string;
		done: boolean;
		failed: boolean;
		phase?: string;
		hasImport: boolean;
		importStatus?: 'pending' | 'running' | 'completed' | 'failed';
		importLogs?: string;
		steps: Step[];
		events: KEvent[];
		pod?: {
			name?: string;
			phase?: string;
			waiting?: { reason?: string; message?: string } | null;
		} | null;
		importPod?: { name?: string; phase?: string; status?: string } | null;
	}

	interface Props {
		dbId: string;
		dbName: string;
		onDone?: () => void;
	}
	let { dbId, dbName, onDone }: Props = $props();

	let data = $state<Provisioning | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let logsOpen = $state(true);
	let warningsOpen = $state(true);
	let logsRef: HTMLPreElement | null = $state(null);
	let pollTimer: ReturnType<typeof setTimeout> | null = null;
	let prevLogsLen = 0;
	let firedDone = false;

	async function fetchOnce() {
		try {
			const r = await apiFetch(`/apiv1/databases/${dbId}/provisioning`);
			if (!r.ok) {
				error = `Couldn't load provisioning status (${r.status})`;
				return;
			}
			const j = (await r.json()) as Provisioning;
			data = j;
			error = null;
			if (j.done && !firedDone) {
				firedDone = true;
				onDone?.();
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't load provisioning status";
		} finally {
			loading = false;
		}
	}

	function scheduleNext() {
		if (pollTimer) clearTimeout(pollTimer);
		if (data?.done) return;
		pollTimer = setTimeout(async () => {
			await fetchOnce();
			scheduleNext();
		}, 10_000);
	}

	let fetchQueued = false;

	function queueFetch() {
		if (fetchQueued || data?.done) return;
		fetchQueued = true;
		setTimeout(async () => {
			fetchQueued = false;
			await fetchOnce();
		}, 250);
	}

	onMount(() => {
		fetchOnce().then(scheduleNext);
	});
	onDestroy(() => {
		if (pollTimer) clearTimeout(pollTimer);
	});

	$effect(() => {
		const orgId = $selectedOrganization?.id;
		if (!orgId) return;
		return subscribeOrgEvents(orgId, (ev) => {
			if (ev.type === 'database.changed' && ev.id === dbId) queueFetch();
		});
	});

	$effect(() => {
		const logs = data?.importLogs ?? '';
		if (logs.length > prevLogsLen && logsRef) {
			setTimeout(() => {
				if (logsRef) logsRef.scrollTop = logsRef.scrollHeight;
			}, 0);
		}
		prevLogsLen = logs.length;
	});

	// Plain-English title + hint for the most common kubelet/controller messages
	// we see during DB provisioning. Falls back to the raw text when nothing
	// matches.
	function humanizeWarning(reason: string, msg: string): { title: string; hint: string } | null {
		const r = (reason || '').toLowerCase();
		const m = `${reason ?? ''} ${msg ?? ''}`;
		if (r === 'failedscheduling' || /0\/\d+ nodes are available/i.test(m)) {
			if (/unbound immediate persistentvolumeclaim/i.test(m)) {
				return {
					title: 'Waiting for storage to be ready',
					hint: 'The database is waiting for its volume. This usually takes a few seconds.'
				};
			}
			if (/insufficient (cpu|memory)/i.test(m)) {
				return {
					title: 'No node has enough free CPU or memory',
					hint: 'Lower the database resources, or free up capacity.'
				};
			}
			if (/taint|toleration|nodeselector|node\(s\) didn't match/i.test(m)) {
				return {
					title: 'No node matches the scheduling rules',
					hint: 'Node selectors or taints exclude every node. Check your node labels and taints.'
				};
			}
			return {
				title: "Couldn't find a node for the database",
				hint: 'Kubernetes keeps retrying. If this continues, free up capacity or loosen the scheduling rules.'
			};
		}
		if (
			r === 'failedattachvolume' ||
			r === 'failedmount' ||
			/failed to attach volume|failed to mount/i.test(m)
		) {
			return {
				title: "Couldn't attach the storage volume",
				hint: 'The volume may still be detaching from another node. This usually clears within a minute.'
			};
		}
		if (r === 'provisioningfailed' || /failed to provision volume/i.test(m)) {
			return {
				title: 'Storage provisioning failed',
				hint: "The storage provider couldn't create the volume. Check your storage capacity and provider."
			};
		}
		if (/imagepullbackoff|errimagepull|failed to pull image/i.test(m)) {
			return {
				title: "Couldn't pull the Postgres image",
				hint: 'The registry is unreachable or the tag is missing. Kubernetes keeps retrying.'
			};
		}
		if (/back-?off.*restarting failed container/i.test(m) || /crashloopbackoff/i.test(m)) {
			return {
				title: 'Postgres container keeps crashing on startup',
				hint: 'Check the logs below for the error. Common causes are a corrupt data directory, bad initdb parameters or a failed import.'
			};
		}
		if (/oomkilled|out of memory/i.test(m)) {
			return {
				title: 'Postgres ran out of memory',
				hint: "Raise the database's memory request, or reduce shared_buffers and work_mem."
			};
		}
		if (/secret.*not found|configmap.*not found/i.test(m)) {
			return {
				title: 'A secret or config is missing',
				hint: "The database needs something that doesn't exist yet. This usually clears on its own during creation."
			};
		}
		if (/dnsconfig|dns/i.test(m) && /fail/i.test(m)) {
			return {
				title: 'DNS lookups inside the pod are failing',
				hint: 'Internal DNS is unreachable. The import may not be able to reach the source database.'
			};
		}
		if (/connection refused|could not connect to server/i.test(m)) {
			return {
				title: "Can't reach the source database",
				hint: "Orchard can't reach the host in the migration URL, or the source server is rejecting the connection."
			};
		}
		if (/password authentication failed|role .* does not exist/i.test(m)) {
			return {
				title: 'The source database rejected the credentials',
				hint: 'Check the user and password in the migration URL.'
			};
		}
		return null;
	}

	// Collapse identical (reason + message) warnings into a single row with
	// a count, like the deployment notifications panel.
	const warnings = $derived.by(() => {
		const raw = (data?.events ?? []).filter((e) => e.type === 'Warning');
		const grouped = new Map<string, KEvent & { count: number }>();
		for (const w of raw) {
			const key = `${w.reason}::${w.message}`;
			const prev = grouped.get(key);
			if (prev) {
				prev.count = (prev.count ?? 1) + (w.count || 1);
				const prevTs = prev.lastTimestamp ? new Date(prev.lastTimestamp).getTime() : 0;
				const curTs = w.lastTimestamp ? new Date(w.lastTimestamp).getTime() : 0;
				if (curTs > prevTs) prev.lastTimestamp = w.lastTimestamp;
			} else {
				grouped.set(key, { ...w, count: w.count || 1 });
			}
		}
		return Array.from(grouped.values()).sort((a, b) => {
			const tA = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
			const tB = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
			return tB - tA;
		});
	});

	let expandedWarningRaw = $state<Set<string>>(new Set());
	function toggleWarningRaw(id: string) {
		if (expandedWarningRaw.has(id)) expandedWarningRaw.delete(id);
		else expandedWarningRaw.add(id);
		expandedWarningRaw = new Set(expandedWarningRaw);
	}
	const overallStatus = $derived.by(() => {
		if (!data) return 'loading';
		if (data.failed) return 'failed';
		if (data.done) return 'ready';
		return 'provisioning';
	});
	const completedCount = $derived(data?.steps.filter((s) => s.status === 'done').length ?? 0);
	const totalCount = $derived(data?.steps.length ?? 0);
	const percent = $derived(totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100));

	function relTime(ts?: string | null): string {
		if (!ts) return '';
		const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
		if (s < 60) return `${s}s ago`;
		const m = Math.floor(s / 60);
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	}
</script>

<div class="prov">
	<div class="prov-header">
		<div class="prov-title-row">
			<div class="prov-icon" data-status={overallStatus}>
				{#if overallStatus === 'ready'}
					<Check class="h-4 w-4" />
				{:else if overallStatus === 'failed'}
					<X class="h-4 w-4" />
				{:else}
					<Database class="h-4 w-4" />
				{/if}
			</div>
			<div class="prov-title-text">
				<h1 class="prov-title" title={dbName}>{dbName}</h1>
				<div class="prov-subtitle">
					{#if overallStatus === 'ready'}
						Database is ready
					{:else if overallStatus === 'failed'}
						Provisioning failed. See details below
					{:else if data?.hasImport}
						Provisioning database & migrating data
					{:else}
						Provisioning database
					{/if}
					{#if data?.phase}<span class="prov-phase">· {data.phase}</span>{/if}
				</div>
			</div>
		</div>

		<div class="prov-progress">
			<div class="prov-bar">
				<div class="prov-bar-fill" data-failed={data?.failed} style="width: {percent}%"></div>
			</div>
			<span class="prov-count">{completedCount} / {totalCount}</span>
		</div>
	</div>

	{#if loading && !data}
		<div class="prov-loading">
			<Loader2 class="h-5 w-5 animate-spin" /> Loading provisioning status…
		</div>
	{:else if error}
		<div class="prov-error">{error}</div>
	{:else if data}
		<div class="prov-steps">
			{#each data.steps as step (step.id)}
				<div class="prov-step prov-step-{step.status}">
					<div class="prov-step-icon" data-status={step.status}>
						{#if step.status === 'done'}
							<Check class="h-3.5 w-3.5" />
						{:else if step.status === 'error'}
							<X class="h-3.5 w-3.5" />
						{:else if step.status === 'running'}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
						{:else}
							<StatusDot meta={statusMeta('neutral', 'Pending')} size={8} />
						{/if}
					</div>
					<div class="prov-step-body">
						<div class="prov-step-label">{step.label}</div>
						<div class="prov-step-desc">{step.description}</div>
						{#if step.detail}
							<div class="prov-step-detail" class:prov-step-detail-error={step.status === 'error'}>
								{step.detail}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		{#if data.hasImport && (data.importLogs || data.importPod)}
			<div class="prov-panel">
				<button class="prov-panel-header" onclick={() => (logsOpen = !logsOpen)} type="button">
					<ChevronDown
						class="h-3.5 w-3.5 prov-chev"
						style={logsOpen ? '' : 'transform: rotate(-90deg)'}
					/>
					<span class="prov-panel-title">Migration logs</span>
					{#if data.importPod?.phase}
						<span
							class="prov-pill prov-pill-{data.importStatus === 'failed'
								? 'error'
								: data.importStatus === 'completed'
									? 'done'
									: 'running'}"
						>
							{data.importPod.phase}
						</span>
					{/if}
					{#if data.importPod?.name}
						<span class="prov-panel-sub" title={data.importPod.name}>{data.importPod.name}</span>
					{/if}
				</button>
				{#if logsOpen}
					<pre class="prov-logs" bind:this={logsRef}>{data.importLogs ||
							'Waiting for migration job to start…'}</pre>
				{/if}
			</div>
		{/if}

		{#if warnings.length > 0}
			<div class="prov-panel prov-panel-warning">
				<button
					class="prov-panel-header"
					onclick={() => (warningsOpen = !warningsOpen)}
					type="button"
				>
					<ChevronDown
						class="h-3.5 w-3.5 prov-chev"
						style={warningsOpen ? '' : 'transform: rotate(-90deg)'}
					/>
					<TriangleAlertIcon size={14} animate={true} class="prov-warn-head-icon" />
					<span class="prov-panel-title">Warning</span>
					<span class="prov-panel-sub">
						{warnings.length}
						{warnings.length === 1 ? 'issue' : 'issues'} from Kubernetes
					</span>
				</button>
				{#if warningsOpen}
					<div class="prov-warnings">
						{#each warnings.slice(0, 25) as w (`${w.reason}::${w.message}`)}
							{@const wid = `${w.reason}::${w.message}`}
							{@const human = humanizeWarning(w.reason, w.message)}
							{@const rawOpen = expandedWarningRaw.has(wid)}
							<div class="prov-warn">
								<div class="prov-warn-icon" aria-hidden="true">
									<TriangleAlertIcon size={16} animate={true} />
								</div>
								<div class="prov-warn-body">
									<div class="prov-warn-head-row">
										{#if human && !rawOpen}
											<span class="prov-warn-title">{human.title}</span>
										{:else}
											<span class="prov-warn-title">{w.reason}</span>
										{/if}
										{#if w.count && w.count > 1}
											<span class="prov-warn-count">×{w.count}</span>
										{/if}
										<span class="prov-warn-time">{relTime(w.lastTimestamp)}</span>
									</div>
									{#if w.kind && w.name}
										<div class="prov-warn-kind">{w.kind}/{w.name}</div>
									{/if}
									{#if human && !rawOpen}
										<p class="prov-warn-hint">{human.hint}</p>
									{:else}
										<p class="prov-warn-raw">{w.message}</p>
									{/if}
									{#if human}
										<button
											type="button"
											class="prov-warn-toggle"
											onclick={() => toggleWarningRaw(wid)}
										>
											{rawOpen ? 'Hide original message' : 'View original message'}
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.prov {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.prov-header {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.prov-title-row {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		min-width: 0;
	}

	.prov-title-text {
		min-width: 0;
	}

	.prov-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--radius-md);
		background-color: color-mix(in srgb, var(--button-bg) 14%, transparent);
		color: var(--button-bg);
	}
	.prov-icon[data-status='ready'] {
		background-color: color-mix(in srgb, var(--online-indicator) 18%, transparent);
		color: var(--online-indicator);
	}
	.prov-icon[data-status='failed'] {
		background-color: color-mix(in srgb, var(--error-text-color) 18%, transparent);
		color: var(--error-text-color);
	}

	.prov-title {
		margin: 0;
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
		font-weight: 700;
		color: var(--center-channel-color);
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.prov-subtitle {
		margin-top: 0.125rem;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--surface-muted);
	}

	.prov-phase {
		margin-left: 0.25rem;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
	}

	.prov-progress {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.prov-bar {
		flex: 1;
		height: 0.4rem;
		border-radius: var(--radius-pill);
		background-color: color-mix(in srgb, var(--surface-border) 70%, transparent);
		overflow: hidden;
	}

	.prov-bar-fill {
		height: 100%;
		background-color: var(--button-bg);
		transition: width var(--dur-base) ease;
	}
	.prov-bar-fill[data-failed='true'] {
		background-color: var(--error-text-color);
	}

	.prov-count {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--surface-muted);
	}

	.prov-loading,
	.prov-error {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 1.125rem;
		border-radius: var(--radius-md);
		background-color: var(--control-bg);
		border: 1px solid var(--surface-border);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--surface-muted);
	}
	.prov-error {
		color: var(--error-text-color);
		border-color: color-mix(in srgb, var(--error-text-color) 40%, transparent);
	}

	.prov-steps {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-md);
		background-color: var(--control-bg);
		overflow: hidden;
	}

	.prov-step {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.875rem;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid color-mix(in srgb, var(--surface-border) 50%, transparent);
	}
	.prov-step:last-child {
		border-bottom: none;
	}
	.prov-step-running {
		background-color: color-mix(in srgb, var(--button-bg) 5%, transparent);
	}
	.prov-step-error {
		background-color: color-mix(in srgb, var(--error-text-color) 7%, transparent);
	}

	.prov-step-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: var(--radius-pill);
		flex-shrink: 0;
		margin-top: 0.125rem;
	}
	.prov-step-icon[data-status='done'] {
		background-color: var(--online-indicator);
		color: white;
	}
	.prov-step-icon[data-status='error'] {
		background-color: var(--error-text-color);
		color: white;
	}
	.prov-step-icon[data-status='running'] {
		color: var(--button-bg);
	}
	.prov-step-icon[data-status='pending'] {
		background-color: transparent;
	}

	.prov-step-label {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		font-weight: 600;
		color: var(--center-channel-color);
	}

	.prov-step-desc {
		margin-top: 0.125rem;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--surface-muted);
	}

	.prov-step-detail {
		margin-top: 0.5rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--center-channel-color);
		background-color: color-mix(in srgb, var(--surface-border) 40%, transparent);
		padding: 0.5rem 0.5rem;
		border-radius: var(--radius-xs);
		white-space: pre-wrap;
		word-break: break-word;
	}
	.prov-step-detail-error {
		color: var(--error-text-color);
		background-color: color-mix(in srgb, var(--error-text-color) 10%, transparent);
	}

	.prov-panel {
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-md);
		background-color: var(--control-bg);
		overflow: hidden;
	}
	.prov-panel-warning {
		border-color: color-mix(in srgb, var(--away-indicator) 40%, var(--surface-border));
	}

	.prov-panel-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem 0.875rem;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--surface-border);
		cursor: pointer;
		color: var(--center-channel-color);
		font-family: inherit;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		text-align: left;
	}
	.prov-panel-header:hover {
		background-color: color-mix(in srgb, var(--surface-border) 30%, transparent);
	}

	.prov-chev {
		color: var(--surface-muted);
		transition: transform var(--dur-fast);
	}

	.prov-panel-title {
		font-weight: 600;
	}

	.prov-panel-sub {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--surface-muted);
		margin-left: auto;
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.prov-pill {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		padding: 0.1rem 0.45rem;
		border-radius: var(--radius-pill);
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
		letter-spacing: 0.04em;
	}
	.prov-pill-done {
		background-color: color-mix(in srgb, var(--online-indicator) 18%, transparent);
		color: var(--online-indicator);
	}
	.prov-pill-running {
		background-color: color-mix(in srgb, var(--button-bg) 18%, transparent);
		color: var(--button-bg);
	}
	.prov-pill-error {
		background-color: color-mix(in srgb, var(--error-text-color) 18%, transparent);
		color: var(--error-text-color);
	}

	.prov-logs {
		margin: 0;
		padding: 0.875rem 1rem;
		max-height: 22rem;
		overflow-y: auto;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--text-caption);
		line-height: 1.5;
		color: var(--center-channel-color);
		white-space: pre-wrap;
		word-break: break-word;
		background-color: color-mix(in srgb, var(--surface-border) 25%, transparent);
	}

	.prov-warnings {
		display: flex;
		flex-direction: column;
		padding: 0.25rem 0;
	}

	.prov-warn {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem;
		padding: 0.75rem 0.875rem;
		border-bottom: 1px solid color-mix(in srgb, var(--surface-border) 50%, transparent);
	}
	.prov-warn:last-child {
		border-bottom: none;
	}

	.prov-warn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: var(--radius-sm);
		background-color: color-mix(in srgb, var(--away-indicator) 15%, transparent);
		color: var(--away-indicator);
		flex-shrink: 0;
	}

	.prov-warn-body {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.prov-warn-head-row {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.prov-warn-title {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		color: var(--center-channel-color);
	}

	.prov-warn-kind {
		overflow-wrap: anywhere;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--surface-muted);
	}

	.prov-warn-count {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		padding: 0.05rem 0.4rem;
		border-radius: var(--radius-pill);
		background-color: color-mix(in srgb, var(--away-indicator) 18%, transparent);
		color: var(--away-indicator);
		font-weight: 600;
	}

	.prov-warn-time {
		margin-left: auto;
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--surface-muted);
	}

	.prov-warn-hint {
		margin: 0.125rem 0 0;
		font-size: var(--text-caption);
		line-height: 1.45;
		color: var(--center-channel-color);
		opacity: 0.78;
		word-break: break-word;
	}

	.prov-warn-raw {
		margin: 0.125rem 0 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--text-caption);
		line-height: 1.45;
		color: var(--center-channel-color);
		opacity: 0.85;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.prov-warn-toggle {
		align-self: flex-start;
		margin-top: 0.5rem;
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		padding: 0.1rem 0.45rem;
		border-radius: var(--radius-xs);
		border: 1px solid color-mix(in srgb, var(--surface-border) 80%, transparent);
		background: transparent;
		color: var(--surface-muted);
		cursor: pointer;
		transition:
			background-color var(--dur-fast),
			color var(--dur-fast);
	}
	.prov-warn-toggle:hover {
		background-color: color-mix(in srgb, var(--surface-border) 40%, transparent);
		color: var(--center-channel-color);
	}

	:global(.prov-warn-head-icon) {
		color: var(--away-indicator);
	}
</style>

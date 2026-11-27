<script lang="ts">
	import { untrack } from 'svelte';
	import { BellRing, Pause, Play, Plus, Trash2 } from 'lucide-svelte';
	import {
		Button,
		Dropdown,
		Input,
		Field,
		List,
		ListRow,
		Modal,
		ModalIntro,
		SectionCard,
		Skeleton,
		StatusBadge,
		ToneTile,
		statusMeta
	} from '$lib/components/ui';
	import { stateEcho } from '$lib/utils/motion.svelte';
	import { toasts } from '$lib/stores';
	import type { NotificationScopeType } from './types';
	import {
		WINDOW_OPTIONS,
		createAlertRule,
		deleteAlertRule,
		fetchAlertCatalogue,
		fetchAlertRules,
		fetchAlertStates,
		statusLabel,
		statusTone,
		updateAlertRule,
		windowLabel,
		type AlertComparator,
		type AlertMetric,
		type AlertMetricId,
		type AlertRule,
		type AlertState
	} from './alerts';

	let {
		organizationId,
		scopeType,
		scopeId = null,
		canEdit = true
	}: {
		organizationId: string;
		scopeType: NotificationScopeType;
		scopeId?: string | null;
		canEdit?: boolean;
	} = $props();

	let loading = $state(true);
	let rules = $state<AlertRule[]>([]);
	let states = $state<AlertState[]>([]);
	let catalogue = $state<AlertMetric[]>([]);
	let busyId = $state<string | null>(null);
	let formOpen = $state(false);
	let saving = $state(false);
	let formMetric = $state<AlertMetricId>('cpu_percent');
	let formComparator = $state<AlertComparator>('gt');
	let formThreshold = $state('85');
	let formFor = $state('300');
	let formMinRate = $state('');

	const metric = $derived(catalogue.find((m) => m.id === formMetric) ?? null);
	const stateByRule = $derived(new Map(states.map((s) => [s.ruleId, s])));
	const own = $derived(rules.filter((r) => !r.inherited));
	const inherited = $derived(rules.filter((r) => r.inherited));
	const canSubmit = $derived(
		!!metric && Number.isFinite(Number(formThreshold)) && Number(formThreshold) >= 0
	);

	async function load() {
		loading = true;
		try {
			const [r, c] = await Promise.all([
				fetchAlertRules(organizationId, scopeType, scopeId),
				catalogue.length ? Promise.resolve(catalogue) : fetchAlertCatalogue(organizationId)
			]);
			rules = r;
			catalogue = c;
			states =
				scopeType === 'deployment' && scopeId
					? await fetchAlertStates(organizationId, scopeId)
					: [];
		} catch (e) {
			toasts.add({
				title: "Couldn't load alerts",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		const scope = [organizationId, scopeType, scopeId];
		if (scope[0]) untrack(load);
	});

	function pickMetric(id: string) {
		formMetric = id as AlertMetricId;
		const def = catalogue.find((m) => m.id === id);
		if (!def) return;
		formComparator = def.comparators[0];
		formThreshold = String(def.defaultThreshold);
		formFor = String(def.defaultForSeconds);
	}

	function openCreate() {
		pickMetric(catalogue[0]?.id ?? 'cpu_percent');
		formMinRate = '';
		formOpen = true;
	}

	async function submit() {
		if (!canSubmit || saving || !metric) return;
		saving = true;
		try {
			await createAlertRule(organizationId, {
				scopeType,
				scopeId,
				metric: metric.id,
				comparator: formComparator,
				threshold: Number(formThreshold),
				forSeconds: Number(formFor),
				minRequestRate:
					metric.requestRateGuard && formMinRate.trim() !== '' ? Number(formMinRate) : undefined
			});
			formOpen = false;
			await load();
		} catch (e) {
			toasts.add({
				title: "Couldn't create the alert",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			saving = false;
		}
	}

	async function toggle(rule: AlertRule) {
		busyId = rule.id;
		try {
			await updateAlertRule(organizationId, rule.id, { enabled: !rule.enabled });
			await load();
		} catch (e) {
			toasts.add({
				title: "Couldn't update the alert",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			busyId = null;
		}
	}

	async function remove(rule: AlertRule) {
		busyId = rule.id;
		try {
			await deleteAlertRule(organizationId, rule.id);
			rules = rules.filter((r) => r.id !== rule.id);
		} catch (e) {
			toasts.add({
				title: "Couldn't delete the alert",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			busyId = null;
		}
	}

	function thresholdSuffix(m: AlertMetric | null): string {
		return m?.unit ? `Threshold (${m.unit})` : 'Threshold';
	}
	const formId = $props.id();
</script>

<SectionCard title="Alerts">
	{#snippet actions()}
		{#if canEdit}
			<Button size="sm" icon={Plus} onclick={openCreate} disabled={loading}>Add alert</Button>
		{/if}
	{/snippet}
	{#if loading}
		<div class="loading">
			<Skeleton height="2.5rem" />
			<Skeleton height="2.5rem" />
		</div>
	{:else if rules.length === 0}
		<p class="quiet">
			{canEdit
				? 'No alerts yet. Add one to get notified when a metric crosses a threshold.'
				: 'No alerts yet.'}
		</p>
	{:else}
		<List inset={false} label="Alerts">
			{#each [...own, ...inherited] as rule (rule.id)}
				{@const st = stateByRule.get(rule.id)}
				{@const meta = st
					? statusMeta(statusTone(st.status), statusLabel(st.status), st.status === 'firing')
					: statusMeta(rule.enabled ? 'success' : 'neutral', rule.enabled ? 'On' : 'Off')}
				<ListRow flush presence title={rule.description}>
					{#snippet leading()}
						<span
							class="tile motion-echo echo--{meta.kind}"
							{@attach stateEcho(() => st?.status ?? (rule.enabled ? 'on' : 'off'))}
						>
							<ToneTile size={32} tone={st ? meta.kind : 'neutral'}><BellRing size={15} /></ToneTile
							>
						</span>
					{/snippet}
					{#snippet subtitle()}
						{#if rule.inherited}
							<span>From {rule.scopeType === 'org' ? 'the organization' : 'the project'}</span>
						{/if}
						{#if st?.valueLabel}
							{#if rule.inherited}<span class="sep" aria-hidden="true">·</span>{/if}
							<span class="mono">now {st.valueLabel}</span>
						{/if}
						{#if rule.activeEpisodes > 0 && scopeType !== 'deployment'}
							<span class="sep" aria-hidden="true">·</span>
							<span
								>{rule.activeEpisodes} app{rule.activeEpisodes === 1 ? '' : 's'} over the threshold</span
							>
						{/if}
					{/snippet}
					{#snippet trailing()}
						<StatusBadge {meta} />
					{/snippet}
					{#snippet actions()}
						{#if canEdit && !rule.inherited}
							<Button
								variant="ghost"
								size="sm"
								icon={rule.enabled ? Pause : Play}
								disabled={busyId === rule.id}
								onclick={() => toggle(rule)}
							>
								{rule.enabled ? 'Pause' : 'Resume'}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								icon={Trash2}
								label="Delete alert"
								loading={busyId === rule.id}
								onclick={() => remove(rule)}
							/>
						{/if}
					{/snippet}
				</ListRow>
			{/each}
		</List>
	{/if}
</SectionCard>

<Modal bind:open={formOpen} size="md" labelledby="{formId}-title">
	<form
		class="form"
		onsubmit={(e) => {
			e.preventDefault();
			void submit();
		}}
	>
		<ModalIntro id="{formId}-title" icon={BellRing} tone="accent" title="Add an alert" />
		<div class="grid">
			<Field label="Metric">
				<Dropdown
					value={formMetric}
					options={catalogue.map((m) => ({ value: m.id, label: m.label }))}
					onchange={pickMetric}
				/>
			</Field>
			<Field label="Is">
				<Dropdown
					bind:value={formComparator}
					options={(metric?.comparators ?? ['gt']).map((c) => ({
						value: c,
						label: c === 'gt' ? 'above' : 'below'
					}))}
				/>
			</Field>
			<Field label={thresholdSuffix(metric)}>
				<Input type="number" min="0" step="any" bind:value={formThreshold} />
			</Field>
			<Field label="For">
				<Dropdown
					bind:value={formFor}
					options={WINDOW_OPTIONS.map((w) => ({ value: String(w), label: windowLabel(w) }))}
				/>
			</Field>
			{#if metric?.requestRateGuard}
				<Field label="Min req/s" hint="Skipped below this traffic">
					<Input type="number" min="0" step="any" placeholder="0.2" bind:value={formMinRate} />
				</Field>
			{/if}
		</div>
		{#if metric?.needsIngress}
			<p class="quiet">Needs a domain on the app. Apps without one are skipped.</p>
		{/if}
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (formOpen = false)} disabled={saving}>Cancel</Button>
		<Button variant="primary" disabled={!canSubmit || saving} loading={saving} onclick={submit}
			>Add alert</Button
		>
	{/snippet}
</Modal>

<style>
	.loading,
	.form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.form {
		gap: 1rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.quiet {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.tile {
		display: inline-flex;
		border-radius: calc(var(--radius-md) * var(--corner-scale));
	}
	.sep {
		color: var(--text-faint);
	}
	.mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
	}
</style>

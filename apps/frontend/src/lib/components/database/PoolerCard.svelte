<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch, toasts } from '$lib/stores';
	import {
		ActionRow,
		Button,
		Dropdown,
		FormActions,
		SectionCard,
		SettingRow,
		SettingsList,
		Skeleton,
		StatusDot,
		Stepper,
		Switch,
		statusMeta
	} from '$lib/components/ui';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { presence } from '$lib/utils/transitions';
	import { errorMessage } from './recovery';
	import type { DatabaseDetail, PoolerConfig, PoolerState } from './types';

	let {
		database,
		onchanged = undefined
	}: {
		database: DatabaseDetail;
		onchanged?: (state: PoolerState) => void;
	} = $props();

	let pooler = $state<PoolerState | null>(null);
	let draft = $state<PoolerConfig | null>(null);
	let toggling = $state(false);
	let saving = $state(false);

	const MODES = [
		{
			value: 'transaction',
			label: 'Transaction',
			description: 'A server connection per transaction. Fits most apps.'
		},
		{
			value: 'session',
			label: 'Session',
			description: 'A server connection per client. Needed for LISTEN and session settings.'
		}
	];

	const dirty = $derived(
		!!pooler &&
			!!draft &&
			(draft.poolMode !== pooler.config.poolMode ||
				draft.defaultPoolSize !== pooler.config.defaultPoolSize ||
				draft.maxClientConn !== pooler.config.maxClientConn)
	);

	const address = $derived(pooler?.host ? `${pooler.host}:${pooler.port ?? 5432}` : '');
	const live = $derived(
		pooler?.ready ? statusMeta('success', 'Running') : statusMeta('progress', 'Starting', true)
	);

	function adopt(next: PoolerState) {
		pooler = next;
		draft = { ...next.config };
		onchanged?.(next);
	}

	async function load() {
		try {
			const res = await apiFetch(`/apiv1/databases/${database.id}/pooler`);
			if (res.ok) adopt(await res.json());
		} catch {
			return;
		}
	}

	async function put(body: Record<string, unknown>) {
		const res = await apiFetch(`/apiv1/databases/${database.id}/pooler`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) throw new Error(await errorMessage(res, "Couldn't save"));
		adopt(await res.json());
	}

	async function toggle(on: boolean) {
		toggling = true;
		try {
			await put({ enabled: on });
			toasts.add({ title: on ? 'Pooler turned on' : 'Pooler turned off', color: 'success' });
		} catch (e) {
			if (pooler) pooler = { ...pooler };
			toasts.add({
				title: "Couldn't change the pooler",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			toggling = false;
		}
	}

	async function save() {
		if (!draft) return;
		saving = true;
		try {
			await put({
				poolMode: draft.poolMode,
				defaultPoolSize: draft.defaultPoolSize,
				maxClientConn: draft.maxClientConn
			});
			toasts.add({ title: 'Pooler saved', color: 'success' });
		} catch (e) {
			toasts.add({
				title: "Couldn't save the pooler",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			saving = false;
		}
	}

	onMount(load);
</script>

<SectionCard title="Connection pooler">
	{#if !pooler || !draft}
		<SettingsList>
			<div class="skeleton-row">
				<Skeleton width="10rem" height="0.875rem" />
				<Skeleton width="2.25rem" height="1.25rem" rounded="999px" />
			</div>
		</SettingsList>
	{:else}
		<SettingsList>
			<ActionRow
				label="Pool connections"
				hint={pooler.enabled
					? 'Apps that connect through the pooler share a small set of server connections.'
					: 'Apps connect to Postgres directly, one server connection each.'}
			>
				<Switch
					label="Connection pooler"
					checked={pooler.enabled}
					disabled={toggling || database.mode !== 'cnpg'}
					onchange={toggle}
				/>
			</ActionRow>
			{#if pooler.enabled}
				<div data-settings-group in:presence out:presence>
					<SettingRow label="Address" hint={live.label}>
						<span class="address">
							<StatusDot meta={live} label={live.label} />
							<code class="host" title={address}>{address}</code>
							<CopyButton value={address} label="Copy address" />
						</span>
					</SettingRow>
					<SettingRow
						label="Mode"
						for="pooler-mode"
						hint={MODES.find((m) => m.value === draft!.poolMode)?.description}
					>
						<div class="picker">
							<Dropdown
								id="pooler-mode"
								bind:value={
									() => draft!.poolMode, (v) => (draft!.poolMode = v as PoolerConfig['poolMode'])
								}
								options={MODES.map((m) => ({ value: m.value, label: m.label }))}
								placement="bottom-end"
								disabled={saving}
							/>
						</div>
					</SettingRow>
					<SettingRow
						label="Pool size"
						for="pooler-size"
						hint="Server connections per database and user"
					>
						<Stepper
							id="pooler-size"
							label="Pool size"
							size="sm"
							shape="capsule"
							min={1}
							max={100}
							disabled={saving}
							bind:value={draft.defaultPoolSize}
						/>
					</SettingRow>
					<SettingRow
						label="Max client connections"
						for="pooler-clients"
						hint="Clients the pooler accepts before it refuses new ones"
					>
						<Stepper
							id="pooler-clients"
							label="Max client connections"
							size="sm"
							shape="capsule"
							min={10}
							max={5000}
							step={50}
							disabled={saving}
							bind:value={draft.maxClientConn}
						/>
					</SettingRow>
				</div>
			{/if}
		</SettingsList>
		{#if pooler.enabled && (dirty || saving)}
			<div class="save" in:presence out:presence>
				<FormActions hint="Clients reconnect once when the pooler restarts">
					<Button
						variant="ghost"
						disabled={saving}
						onclick={() => (draft = pooler ? { ...pooler.config } : draft)}>Discard</Button
					>
					<Button variant="primary" loading={saving} onclick={save}>Save</Button>
				</FormActions>
			</div>
		{/if}
	{/if}
</SectionCard>

<style>
	.address {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		max-width: 32rem;
	}
	.host {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		color: var(--text-default);
	}
	.picker {
		width: 15rem;
	}
	.save {
		margin-top: var(--space-4);
	}
	.skeleton-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
</style>

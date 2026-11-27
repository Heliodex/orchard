<script lang="ts">
	import { CircleArrowUp } from 'lucide-svelte';
	import { apiFetch } from '$lib/stores';
	import { Alert, Button, Dropdown, Field, Modal, ModalIntro, ToggleRow } from '$lib/components/ui';
	import { duration, errorMessage } from './recovery';
	import { loadVersions, upgradeMajors, versionNote } from './versions';
	import type {
		DatabaseDetail,
		DatabaseOperation,
		DatabaseSecurity,
		DatabaseVersions
	} from './types';

	let {
		open = $bindable(false),
		database,
		security,
		onstarted
	}: {
		open?: boolean;
		database: DatabaseDetail;
		security: DatabaseSecurity;
		onstarted: (op: DatabaseOperation) => void;
	} = $props();

	const uid = $props.id();

	let major = $state('');
	let rehearse = $state(true);
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let versions = $state<DatabaseVersions | null>(null);
	let rehearsalMs = $state<number | null>(null);
	let idempotencyKey = '';
	let wasOpen = false;

	$effect(() => {
		const isOpen = open;
		if (isOpen && !wasOpen) {
			major = String(upgradeMajors(security).at(-1) ?? '');
			rehearse = true;
			error = null;
			idempotencyKey = crypto.randomUUID();
			void prepare();
		}
		wasOpen = isOpen;
	});

	async function prepare() {
		const [v, ops] = await Promise.all([
			loadVersions(),
			apiFetch(`/apiv1/databases/${database.id}/operations`)
				.then((r) => (r.ok ? (r.json() as Promise<DatabaseOperation[]>) : []))
				.catch(() => [] as DatabaseOperation[])
		]);
		versions = v;
		rehearsalMs =
			ops.find((o) => o.kind === 'upgrade' && o.result?.rehearsal?.upgradeMs)?.result?.rehearsal
				?.upgradeMs ?? null;
	}

	const options = $derived(
		upgradeMajors(security)
			.reverse()
			.map((m) => {
				const v = versions?.versions.find((x) => x.major === m);
				return {
					value: String(m),
					label: `Postgres ${m}`,
					description: v ? versionNote(v, versions?.defaultMajor) : undefined
				};
			})
	);

	const offline = $derived(
		rehearsalMs
			? `about ${duration(rehearsalMs)}, measured by the last rehearsal`
			: 'usually a minute or two for small databases'
	);

	async function submit() {
		if (!major || submitting) return;
		submitting = true;
		error = null;
		try {
			const res = await apiFetch(`/apiv1/databases/${database.id}/upgrade`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
				body: JSON.stringify({ major: Number(major), rehearse })
			});
			if (!res.ok) throw new Error(await errorMessage(res, "Couldn't start the upgrade"));
			const op = (await res.json()) as DatabaseOperation;
			open = false;
			onstarted(op);
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't start the upgrade";
		} finally {
			submitting = false;
		}
	}
</script>

<Modal bind:open size="md" closable={false} dismissable labelledby="{uid}-title">
	<form
		class="sheet"
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
	>
		<ModalIntro
			id="{uid}-title"
			icon={CircleArrowUp}
			tone="accent"
			title={`Upgrade ${database.name}`}
			description={`From Postgres ${security.running}`}
		/>

		<Field label="To" for="{uid}-major">
			<Dropdown id="{uid}-major" size="lg" bind:value={major} {options} disabled={submitting} />
		</Field>

		<ToggleRow
			bind:checked={rehearse}
			label="Rehearse on a copy first"
			hint="Adds a few minutes before the upgrade."
			disabled={submitting}
		/>

		<ol class="steps">
			{#if rehearse}
				<li>A copy of {database.name} is upgraded to check it works.</li>
			{/if}
			<li>Orchard takes a checkpoint.</li>
			<li>
				<strong>{database.name} is offline while it upgrades</strong>, {offline}.
			</li>
			<li>If the upgrade fails, it is put back on Postgres {security.major}.</li>
		</ol>

		{#if error}<Alert tone="error">{error}</Alert>{/if}
	</form>
	{#snippet footer()}
		<Button variant="ghost" disabled={submitting} onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" loading={submitting} disabled={!major} onclick={submit}>
			Upgrade to Postgres {major}
		</Button>
	{/snippet}
</Modal>

<style>
	.sheet {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.steps {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-left: 1.25rem;
		list-style: decimal;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.steps strong {
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.steps li::marker {
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
</style>

<script lang="ts">
	import {
		Ellipsis,
		History,
		KeyRound,
		Pause,
		Pencil,
		Play,
		Plus,
		Send,
		Trash2
	} from 'lucide-svelte';
	import {
		Badge,
		Button,
		Field,
		Input,
		List,
		ListRow,
		Menu,
		MenuItem,
		MenuSeparator,
		Modal,
		ModalIntro,
		SecretString,
		SectionCard,
		Skeleton,
		Stack,
		StatusBadge,
		StatusDot,
		ToneTile,
		statusMeta
	} from '$lib/components/ui';
	import RadioGroup from '$lib/components/ui/RadioGroup.svelte';
	import type { StatusKind } from '$lib/components/ui/status';
	import {
		CHANNEL_TYPE_META,
		NotificationRules,
		replayChannel
	} from '$lib/components/notifications';
	import { formatRelativeTime } from '$lib/utils/format';
	import { emailEnabled, toasts } from '$lib/stores';

	import type { NotificationChannel, ChannelPayload } from './notification-types';

	let {
		canEditOrg,
		organizationId,
		loading,
		channels = [],
		saving,
		deletingId,
		testingId,
		togglingId,
		createdSecret,
		onSaveChannel,
		onDeleteChannel,
		onTestChannel,
		onToggleChannel,
		onDismissSecret
	}: {
		canEditOrg: boolean;
		organizationId: string;
		loading: boolean;
		channels: NotificationChannel[];
		saving: boolean;
		deletingId: string | null;
		testingId: string | null;
		togglingId: string | null;
		createdSecret: string | null;
		onSaveChannel: (payload: ChannelPayload, channelId: string | null) => Promise<boolean>;
		onDeleteChannel: (channel: NotificationChannel) => void;
		onTestChannel: (id: string) => void;
		onToggleChannel: (id: string, enabled: boolean) => void;
		onDismissSecret: () => void;
		index?: number;
	} = $props();

	let formOpen = $state(false);
	let editingId = $state<string | null>(null);
	let formType = $state('discord');
	let formName = $state('');
	let formUrl = $state('');
	let formRecipients = $state('');
	let replayingId = $state<string | null>(null);
	const formId = $props.id();

	const NO_EMAIL = "This instance can't send email";

	const TYPE_OPTIONS = $derived(
		Object.entries(CHANNEL_TYPE_META).map(([value, meta]) => ({
			value,
			label: meta.label,
			description: value === 'email' && !$emailEnabled ? NO_EMAIL : meta.hint,
			icon: meta.icon,
			disabled:
				(editingId !== null && formType !== value) ||
				(editingId === null && value === 'email' && !$emailEnabled)
		}))
	);

	function openCreate() {
		editingId = null;
		formType = 'discord';
		formName = '';
		formUrl = '';
		formRecipients = '';
		formOpen = true;
	}

	function openEdit(channel: NotificationChannel) {
		editingId = channel.id;
		formType = channel.type;
		formName = channel.name;
		formUrl = '';
		formRecipients = (channel.config.recipients || []).join(', ');
		formOpen = true;
	}

	const formValid = $derived(
		formName.trim().length > 0 &&
			(formType === 'email'
				? formRecipients.trim().length > 0
				: formUrl.trim().length > 0 || editingId !== null)
	);

	const editingChannel = $derived(channels.find((c) => c.id === editingId) ?? null);

	async function submit() {
		if (!formValid || saving) return;
		const payload: ChannelPayload = {
			name: formName.trim(),
			type: formType,
			config:
				formType === 'email'
					? {
							recipients: formRecipients
								.split(',')
								.map((r) => r.trim())
								.filter(Boolean)
						}
					: { url: formUrl.trim() || undefined }
		};
		const ok = await onSaveChannel(payload, editingId);
		if (ok) formOpen = false;
	}

	async function replay(channel: NotificationChannel) {
		if (replayingId) return;
		replayingId = channel.id;
		try {
			const result = await replayChannel(organizationId, channel.id, 24);
			toasts.add({
				title:
					result.queued > 0
						? `Queued ${result.queued} ${result.queued === 1 ? 'notification' : 'notifications'}`
						: 'Nothing to replay from the last 24 hours',
				description: result.message,
				color: result.queued > 0 ? 'success' : 'info'
			});
		} catch (e) {
			toasts.add({
				title: "Couldn't replay",
				description: e instanceof Error ? e.message : undefined,
				color: 'error'
			});
		} finally {
			replayingId = null;
		}
	}

	function healthSummary(channel: NotificationChannel): string | null {
		const health = channel.health;
		if (!health) return null;
		if (health.state === 'auto_disabled') {
			return 'turned off after a day of failures';
		}
		if (health.state === 'paused' && health.until) {
			return `paused until ${formatRelativeTime(new Date(health.until))}`;
		}
		if (health.state === 'failing') {
			return health.since
				? `failing since ${formatRelativeTime(new Date(health.since))}`
				: 'failing';
		}
		if (channel.lastDelivery) {
			const verb = channel.lastDelivery.status === 'sent' ? 'delivered' : 'failed';
			return `${verb} ${formatRelativeTime(new Date(channel.lastDelivery.createdAt))}`;
		}
		return null;
	}

	function healthTone(channel: NotificationChannel): 'ok' | 'fail' | 'warn' | 'none' {
		const state = channel.health?.state;
		if (state === 'auto_disabled' || state === 'failing') return 'fail';
		if (state === 'paused') return 'warn';
		if (channel.lastDelivery) return channel.lastDelivery.status === 'sent' ? 'ok' : 'fail';
		return 'none';
	}

	const HEALTH_KIND: Record<ReturnType<typeof healthTone>, StatusKind> = {
		ok: 'success',
		fail: 'error',
		warn: 'warning',
		none: 'neutral'
	};
</script>

{#snippet list()}
	{#if loading}
		<div class="placeholder">
			<Skeleton height="2.75rem" />
			<Skeleton height="2.75rem" />
		</div>
	{:else if channels.length === 0}
		<p class="quiet">
			Add a Slack or Discord channel, then write a rule to say what it should receive.
		</p>
	{:else}
		<List inset={false} label="Destinations">
			{#each channels as channel (channel.id)}
				{@const meta = CHANNEL_TYPE_META[channel.type]}
				{@const tone = healthTone(channel)}
				{@const summary = healthSummary(channel)}
				<ListRow flush presence title={channel.name}>
					{#snippet leading()}<ToneTile size={32}><meta.icon size={16} /></ToneTile>{/snippet}
					{#snippet titleSuffix()}
						{#if channel.scopeLabel}<Badge>{channel.scopeLabel}</Badge>{/if}
						{#if channel.health?.state === 'auto_disabled'}
							<StatusBadge meta={statusMeta('error', 'Turned off')} />
						{:else if !channel.enabled}
							<StatusBadge meta={statusMeta('neutral', 'Paused')} />
						{/if}
					{/snippet}
					{#snippet subtitle()}
						<span>{meta.label}</span>
						{#if channel.ruleCount === 0}
							<span class="warn">· No rules, nothing is sent</span>
						{:else}
							<span>· {channel.ruleCount} {channel.ruleCount === 1 ? 'rule' : 'rules'}</span>
						{/if}
						{#if channel.config.urlPreview}
							<span class="preview" title={channel.config.urlPreview}
								>· <span class="mono">{channel.config.urlPreview}</span></span
							>
						{/if}
						{#if summary}
							<span class="health" title={channel.lastDelivery?.error || undefined}
								>· <StatusDot meta={statusMeta(HEALTH_KIND[tone], summary)} />{summary}</span
							>
						{/if}
					{/snippet}
					{#snippet actions()}
						{#if canEditOrg}
							<Button
								variant="ghost"
								size="sm"
								icon={Send}
								label="Send a test notification"
								loading={testingId === channel.id}
								onclick={() => onTestChannel(channel.id)}
							/>
							<Menu placement="bottom-end">
								{#snippet trigger(props)}
									<Button
										{...props}
										variant="ghost"
										size="sm"
										icon={Ellipsis}
										label="More for {channel.name}"
										loading={replayingId === channel.id ||
											togglingId === channel.id ||
											deletingId === channel.id}
									/>
								{/snippet}
								<MenuItem icon={Pencil} onclick={() => openEdit(channel)}>Edit</MenuItem>
								<MenuItem
									icon={History}
									disabled={replayingId === channel.id || !channel.enabled}
									onclick={() => replay(channel)}>Replay the last 24 hours</MenuItem
								>
								<MenuItem
									icon={channel.enabled ? Pause : Play}
									description={!channel.enabled && channel.type === 'email' && !$emailEnabled
										? NO_EMAIL
										: undefined}
									disabled={togglingId === channel.id ||
										(!channel.enabled && channel.type === 'email' && !$emailEnabled)}
									onclick={() => onToggleChannel(channel.id, !channel.enabled)}
									>{channel.enabled ? 'Pause' : 'Resume'}</MenuItem
								>
								<MenuSeparator />
								<MenuItem
									icon={Trash2}
									danger
									disabled={deletingId === channel.id}
									onclick={() => onDeleteChannel(channel)}>Delete</MenuItem
								>
							</Menu>
						{/if}
					{/snippet}
				</ListRow>
			{/each}
		</List>
	{/if}
{/snippet}

{#snippet add()}
	{#if canEditOrg && !loading}
		<Button size="sm" icon={Plus} onclick={openCreate}>Add destination</Button>
	{/if}
{/snippet}

<SectionCard
	title="Notifications"
	description={channels.length > 0 ? 'Rules decide what each destination receives.' : undefined}
	actions={add}
	children={list}
/>

{#if !loading && channels.length > 0}
	<NotificationRules {organizationId} scopeType="org" canEdit={canEditOrg} />
{/if}

{#if canEditOrg}
	<Modal bind:open={formOpen} title={editingId ? 'Edit destination' : 'Add destination'}>
		<form
			id={formId}
			onsubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
		>
			<Stack>
				<Field label="Send to">
					<RadioGroup
						label="Destination type"
						variant="cards"
						columns={2}
						options={TYPE_OPTIONS}
						bind:value={formType}
					/>
				</Field>
				<Field label="Name" for="{formId}-name">
					<Input
						id="{formId}-name"
						size="lg"
						bind:value={formName}
						placeholder="#deploys"
						maxlength={100}
					/>
				</Field>
				{#if formType === 'email'}
					<Field
						label="Recipients"
						for="{formId}-recipients"
						hint="Comma separated. Recipients must be members of this organization."
					>
						<Input
							id="{formId}-recipients"
							size="lg"
							bind:value={formRecipients}
							placeholder={CHANNEL_TYPE_META.email.placeholder}
						/>
					</Field>
				{:else}
					<Field
						label="Webhook URL"
						for="{formId}-url"
						hint={editingId && editingChannel?.config.urlConfigured
							? 'Leave it empty to keep the current one.'
							: undefined}
					>
						<Input
							id="{formId}-url"
							size="lg"
							mono
							bind:value={formUrl}
							placeholder={editingId && editingChannel?.config.urlConfigured
								? (editingChannel.config.urlPreview ?? CHANNEL_TYPE_META[formType].placeholder)
								: CHANNEL_TYPE_META[formType].placeholder}
							autocomplete="off"
							spellcheck="false"
						/>
					</Field>
				{/if}
			</Stack>
		</form>

		{#snippet footer()}
			<Button variant="ghost" shape="capsule" onclick={() => (formOpen = false)} disabled={saving}>
				Cancel
			</Button>
			<Button
				type="submit"
				form={formId}
				variant="primary"
				shape="capsule"
				loading={saving}
				disabled={!formValid}
			>
				{editingId ? 'Save destination' : 'Add destination'}
			</Button>
		{/snippet}
	</Modal>
{/if}

<Modal
	bind:open={
		() => !!createdSecret,
		(v) => {
			if (!v) onDismissSecret();
		}
	}
	closable={false}
	labelledby="{formId}-secret"
>
	<Stack>
		<ModalIntro
			id="{formId}-secret"
			icon={KeyRound}
			tone="success"
			solid
			title="Copy the signing secret"
			description="It isn't shown again."
		/>
		<Field label="Signing secret">
			<SecretString
				masked={'•'.repeat(24)}
				resolve={async () => createdSecret}
				label="Signing secret"
			/>
		</Field>
		<p class="note">
			Each delivery carries <code
				>x-orchard-signature: sha256=HMAC(secret, timestamp + "." + body)</code
			>
			and the timestamp in <code>x-orchard-timestamp</code>.
		</p>
	</Stack>
	{#snippet footer()}
		<Button variant="primary" shape="capsule" onclick={onDismissSecret}>Done</Button>
	{/snippet}
</Modal>

<style>
	.placeholder {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.quiet,
	.note {
		margin: 0;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.note code,
	.mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
	}
	.preview {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
	}
	.note code {
		color: var(--text-default);
	}
	.warn {
		color: var(--status-warning);
	}
	.health {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
</style>

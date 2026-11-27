<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch, toasts, selectedOrganization, subscribeOrgEvents } from '$lib/stores';
	import { RefreshCw } from 'lucide-svelte';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import {
		Avatar,
		Button,
		List,
		ListRow,
		SearchField,
		SectionCard,
		Skeleton
	} from '$lib/components/ui';

	interface Props {
		scope: 'global' | { organizationId: string } | { deploymentId: string };
		title?: string;
	}

	let { scope, title = 'Audit log' }: Props = $props();

	interface Actor {
		id: string;
		email: string;
		username?: string;
		firstName?: string | null;
		lastName?: string | null;
		imageUrl?: string | null;
	}
	interface Entry {
		id: string;
		createdAt: string;
		action: string;
		actorUserId: string | null;
		actorEmail: string | null;
		organizationId: string | null;
		projectId: string | null;
		deploymentId: string | null;
		targetType: string | null;
		targetId: string | null;
		targetLabel: string | null;
		metadata: Record<string, unknown> | null;
		actor: Actor | null;
	}

	let entries = $state<Entry[]>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let nextCursor = $state<string | null>(null);
	let actionFilter = $state('');

	function endpoint(): string {
		if (scope === 'global') return '/apiv1/audit-logs/global';
		if ('organizationId' in scope) return `/apiv1/audit-logs/organization/${scope.organizationId}`;
		return `/apiv1/audit-logs/deployment/${scope.deploymentId}`;
	}

	async function load(reset = false) {
		if (reset) {
			if (!entries.length) loading = true;
			nextCursor = null;
		} else {
			loadingMore = true;
		}
		try {
			const params = new URLSearchParams({ limit: '50' });
			if (!reset && nextCursor) params.set('cursor', nextCursor);
			if (actionFilter.trim()) params.set('action', actionFilter.trim());
			const res = await apiFetch(`${endpoint()}?${params}`);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || "Couldn't load audit logs");
			}
			const data = await res.json();
			entries = reset ? data.entries : [...entries, ...data.entries];
			nextCursor = data.nextCursor;
		} catch (e) {
			toasts.add({
				title: "Couldn't load audit logs",
				description: e instanceof Error ? e.message : "Couldn't load audit logs",
				color: 'error'
			});
		} finally {
			loading = false;
			loadingMore = false;
		}
	}

	function actorName(entry: Entry): string {
		if (!entry.actor) return entry.actorEmail || 'System';
		const fn = [entry.actor.firstName, entry.actor.lastName].filter(Boolean).join(' ');
		return fn || entry.actor.username || entry.actor.email;
	}

	function formatAction(action: string): string {
		return action
			.split('.')
			.map((p) => p.replace(/_/g, ' '))
			.join(' › ');
	}

	function formatMetadata(meta: Record<string, unknown> | null): string {
		if (!meta) return '';
		const parts: string[] = [];
		for (const [key, value] of Object.entries(meta)) {
			if (Array.isArray(value) && value.length === 2) {
				parts.push(`${key}: ${formatVal(value[0])} → ${formatVal(value[1])}`);
			} else if (value !== null && value !== undefined && value !== '') {
				parts.push(`${key}: ${formatVal(value)}`);
			}
		}
		return parts.join(' · ');
	}

	function formatVal(v: unknown): string {
		if (v === null) return '∅';
		if (typeof v === 'string') {
			if (/^[0-9a-f]{32,}$/i.test(v)) return v.slice(0, 7);
			return v.length > 60 ? v.slice(0, 60) + '…' : v;
		}
		return String(v);
	}

	function entryTitle(entry: Entry): string {
		const action = formatAction(entry.action);
		return entry.targetLabel ? `${action} · ${entry.targetLabel}` : action;
	}

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onFilterInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => load(true), 300);
	}

	onMount(() => {
		void load(true);
	});

	function matchesScope(payload: { deploymentId?: string | null } | undefined): boolean {
		if (scope === 'global' || 'organizationId' in scope) return true;
		return payload?.deploymentId === scope.deploymentId;
	}

	let liveTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const orgId = $selectedOrganization?.id ?? null;
		if (!orgId) return;
		return subscribeOrgEvents(orgId, (ev) => {
			if (ev.type !== 'audit.created' || !matchesScope(ev.payload)) return;
			if (liveTimer) clearTimeout(liveTimer);
			liveTimer = setTimeout(() => {
				liveTimer = null;
				void load(true);
			}, 400);
		});
	});
</script>

<SectionCard {title} description="Last 180 days">
	{#snippet actions()}
		<div class="filter">
			<SearchField
				size="sm"
				bind:value={actionFilter}
				oninput={onFilterInput}
				placeholder="Filter by action"
			/>
		</div>
		<Button
			variant="ghost"
			size="sm"
			icon={RefreshCw}
			label="Refresh audit log"
			onclick={() => load(true)}
		/>
	{/snippet}

	{#if loading}
		<div class="placeholder">
			<Skeleton height="2.75rem" />
			<Skeleton height="2.75rem" />
			<Skeleton height="2.75rem" />
		</div>
	{:else if entries.length === 0}
		<p class="quiet">
			{actionFilter.trim() ? 'No entries match that action.' : 'Nothing has happened yet.'}
		</p>
	{:else}
		<List inset={false} label={title}>
			{#each entries as entry (entry.id)}
				<ListRow flush title={entryTitle(entry)}>
					{#snippet leading()}
						<Avatar
							user={entry.actor}
							seed={entry.actor ? undefined : (entry.actorEmail ?? 'system')}
							size={28}
						/>
					{/snippet}
					{#snippet subtitle()}
						{@const meta = formatMetadata(entry.metadata)}
						<span class="who" title={actorName(entry)}>{actorName(entry)}</span>
						{#if meta}<span class="meta" title={meta}>· {meta}</span>{/if}
					{/snippet}
					{#snippet trailing()}<RelativeTime date={entry.createdAt} />{/snippet}
				</ListRow>
			{/each}
		</List>
		{#if nextCursor}
			<div class="more">
				<Button variant="ghost" size="sm" loading={loadingMore} onclick={() => load(false)}>
					Load more
				</Button>
			</div>
		{/if}
	{/if}
</SectionCard>

<style>
	.filter {
		width: 16rem;
	}
	.placeholder {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.quiet {
		margin: 0;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.who,
	.meta {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		flex-shrink: 100;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
	}
	.more {
		display: flex;
		justify-content: center;
		padding-top: var(--space-2);
	}
</style>

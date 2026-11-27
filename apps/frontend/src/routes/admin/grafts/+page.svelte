<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronDown, ExternalLink, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-svelte';
	import {
		ActionRow,
		Alert,
		Badge,
		Button,
		Chip,
		EmptyState,
		List,
		ListRow,
		SectionCard,
		SettingRow,
		SettingsList,
		Skeleton,
		Stack,
		StatusBadge,
		Swap,
		Table,
		statusMeta
	} from '$lib/components/ui';
	import Progress from '$lib/components/ui/Progress.svelte';
	import Snippet from '$lib/components/ui/Snippet.svelte';
	import { apiFetch } from '$lib/stores';
	import { springCollapse, springRotate } from '$lib/utils/motion.svelte';

	type Claim = {
		kind: string;
		value: string;
		state: 'own' | 'alias' | 'shadowed';
		shadowedBy?: string;
	};
	type Route = {
		method: string;
		path: string;
		classification: 'public' | 'authenticated' | 'superadmin';
	};
	type Graft = {
		id: string;
		status: 'loaded' | 'failed';
		phase: string | null;
		reason: string | null;
		warnings: string[];
		name: string;
		version: string | null;
		publisher: string | null;
		description: string | null;
		capabilities: string[];
		permissions: Record<string, { label: string; defaultGrants: string[] }>;
		coreReads: Record<string, string[]>;
		adopts: string[];
		signature: Signature | null;
		claims: Claim[];
		routes: Route[];
		migrationsApplied: string[];
		dbRole: string | null;
		dbPool: { total: number; idle: number; waiting: number; max: number } | null;
		dbPoolSize: { size: number; source: 'values' | 'graft' | 'default' } | null;
		settings: { id: string; title: string }[];
	};
	type Tier = 'official' | 'community' | 'tap' | 'publisher';
	type Signature = {
		tier?: Tier | null;
		keyId: string | null;
		publisher?: string;
		repo?: string;
		tap?: string;
		signedBy: 'official' | 'publisher' | null;
	};
	type Tap = { name: string; url: string; keyId: string };
	type Trust = 'official' | 'listed' | 'taps' | 'any';
	type DbBudget = {
		usable: number;
		inUse: number;
		perPod: number;
		steadyPeak: number;
		rolloutPeak: number;
		level: 'ok' | 'tight' | 'over';
		summary: string;
	};
	type Overview = {
		platform: string;
		sdk: string;
		trust: Trust | 'signed';
		taps?: Tap[];
		database: DbBudget | null;
		grafts: Graft[];
	};

	const POOL_SOURCE = {
		values: 'set in your values',
		graft: 'what the graft asks for',
		default: 'the default'
	} as const;

	let overview = $state<Overview | null>(null);
	let loadError = $state<string | null>(null);
	let open = $state<Record<string, boolean>>({});

	onMount(async () => {
		try {
			const res = await apiFetch('/apiv1/admin/grafts');
			if (!res.ok) throw new Error(`Couldn't load grafts (${res.status})`);
			overview = await res.json();
		} catch (err) {
			loadError = (err as Error).message;
		}
	});

	const TRUST_BADGE: Record<Trust, string> = {
		official: 'Official grafts only',
		listed: 'Official and listed grafts',
		taps: 'Taps allowed',
		any: 'Unsigned grafts allowed'
	};

	const TRUST_COPY: Record<Trust, string> = {
		official: 'Only grafts signed by Orchard can load.',
		listed:
			'Official grafts, community grafts listed in the Extension Marketplace and grafts signed by a publisher key you added can load.',
		taps: 'Official, listed and publisher-key grafts can load, plus grafts from the taps you added.',
		any: 'Unsigned grafts can load. Anything placed in the grafts directory runs.'
	};

	const trust = $derived<Trust>(
		!overview || overview.trust === 'signed' ? 'listed' : overview.trust
	);

	function statusOf(g: Graft) {
		if (g.status === 'failed') return statusMeta('error', `Failed during ${g.phase ?? 'load'}`);
		if (g.warnings.length) return statusMeta('warning', 'Running with warnings');
		return statusMeta('success', 'Running');
	}

	function tierOf(sig: Signature | null): Tier | null {
		if (!sig) return null;
		if (sig.tier !== undefined) return sig.tier;
		return sig.signedBy;
	}

	function tierLabel(g: Graft): {
		tone: 'success' | 'info' | 'warning' | 'error' | 'neutral';
		text: string;
	} {
		const sig = g.signature;
		switch (tierOf(sig)) {
			case 'official':
				return { tone: 'success', text: 'Official' };
			case 'community':
				return { tone: 'warning', text: `Community · by ${sig?.publisher ?? 'unknown'}` };
			case 'tap':
				return { tone: 'warning', text: `Tap: ${sig?.tap ?? 'unknown'}` };
			case 'publisher':
				return { tone: 'warning', text: `Publisher key ${sig?.keyId ?? ''}`.trim() };
			default:
				return { tone: 'error', text: 'Unsigned' };
		}
	}

	const thirdParty = $derived(
		(overview?.grafts ?? []).filter((g) => tierOf(g.signature) !== 'official')
	);

	const tapUrl = (name: string | undefined) =>
		overview?.taps?.find((t) => t.name === name)?.url ?? null;

	const publicRoutes = (g: Graft) => g.routes.filter((r) => r.classification === 'public');
	const aliasClaims = (g: Graft) => g.claims.filter((c) => c.state !== 'own');

	const ROUTE_ACCESS = {
		public: { label: 'No sign-in', tone: 'warning' },
		authenticated: { label: 'Signed in', tone: 'neutral' },
		superadmin: { label: 'Admins only', tone: 'neutral' }
	} as const;

	const ROUTE_COLUMNS = [
		{ id: 'method', label: 'Method', width: '4.5rem' },
		{ id: 'path', label: 'Path' },
		{ id: 'access', label: 'Access', width: '8rem' }
	];

	function databaseDetail(g: Graft) {
		return [
			g.dbRole ? `Runs as ${g.dbRole}` : 'Shares the main database user',
			g.dbPoolSize
				? `Up to ${g.dbPoolSize.size} connections per pod, ${POOL_SOURCE[g.dbPoolSize.source]}`
				: null,
			g.dbPool
				? `${g.dbPool.total - g.dbPool.idle} of ${g.dbPool.max} connections busy on this pod`
				: 'No connections open on this pod',
			`${g.migrationsApplied.length} new ${g.migrationsApplied.length === 1 ? 'migration' : 'migrations'} this boot`
		].filter((line): line is string => !!line);
	}
</script>

{#snippet tierBadge(g: Graft)}
	{@const sig = tierLabel(g)}
	<Badge tone={sig.tone}>
		<span class="tier" title={sig.text}>
			{#if sig.tone === 'error'}
				<ShieldX size={12} />
			{:else if sig.tone === 'warning'}
				<ShieldAlert size={12} />
			{:else}
				<ShieldCheck size={12} />
			{/if}
			<span class="tier-text">{sig.text}</span>
		</span>
	</Badge>
{/snippet}

{#snippet graftFacts(g: Graft)}
	<SettingsList label="What {g.name} asks for">
		{#if tierOf(g.signature) === 'community'}
			<SettingRow label="Publisher" wide>
				<p class="value">
					{g.signature?.publisher}, not Orchard. Orchard checked it when it was listed, but doesn't
					review its updates.
					{#if g.signature?.repo}
						<a
							class="link"
							href="https://github.com/{g.signature.repo}"
							target="_blank"
							rel="noreferrer"
						>
							github.com/{g.signature.repo}<ExternalLink size={11} />
						</a>
					{/if}
				</p>
			</SettingRow>
		{/if}
		<SettingRow label="Asked for" wide>
			{#if g.capabilities.length}
				<span class="chips">
					{#each g.capabilities as cap (cap)}<Chip mono>{cap}</Chip>{/each}
				</span>
			{:else}
				<p class="value value--muted">Nothing beyond its own routes</p>
			{/if}
		</SettingRow>
		<SettingRow label="Reads from core tables" wide>
			<div class="lines">
				{#each Object.entries(g.coreReads) as [table, cols] (table)}
					<code class="mono">{table}({cols.join(', ')})</code>
				{:else}
					<p class="value value--muted">None</p>
				{/each}
				{#if g.adopts?.length}
					<p class="value value--muted">
						Replaced {g.adopts.join(', ')} from Orchard. The old names still work as views.
					</p>
				{/if}
			</div>
		</SettingRow>
		<SettingRow label="Paths outside /{g.id}" wide>
			<div class="lines">
				{#each aliasClaims(g) as claim (claim.kind + claim.value)}
					<span class="claim">
						<code class="mono" class:shadowed={claim.state === 'shadowed'}>{claim.value}</code>
						<span class="value value--muted">
							{claim.state === 'shadowed' ? `taken by ${claim.shadowedBy}` : claim.kind}
						</span>
					</span>
				{:else}
					<p class="value value--muted">None</p>
				{/each}
			</div>
		</SettingRow>
		<SettingRow label="Database" wide>
			<div class="lines">
				<code class="mono">schema ext_{g.id.replaceAll('-', '_')}</code>
				{#each databaseDetail(g) as line (line)}
					<p class="value value--muted">{line}</p>
				{/each}
			</div>
		</SettingRow>
		{#if g.settings.length}
			<ActionRow label="Settings" hint={g.settings.map((s) => s.title).join(', ')}>
				<Button size="sm" href="/admin/instance">Open Configuration</Button>
			</ActionRow>
		{/if}
	</SettingsList>
{/snippet}

<Stack>
	<Alert tone="warning" title="Only install grafts you trust">
		A graft runs with the same access as Orchard, including your database and your users' data. The
		details below show what each graft asks for, but they don't limit it.
	</Alert>
	{#if thirdParty.length > 0}
		<Alert tone="error" title="Not made by Orchard: {thirdParty.map((g) => g.name).join(', ')}">
			These run inside Orchard with no sandbox. They can read your secrets and database, sign in as
			any user, and change the apps on this cluster. Orchard can't limit what they do, and nobody at
			Orchard reviews their updates. Remove any you wouldn't give full control of this server.
		</Alert>
	{/if}

	<Swap key={loadError ? 'error' : overview ? 'ready' : 'loading'}>
		{#if loadError}
			<Alert tone="error" title="Couldn't load grafts">{loadError}</Alert>
		{:else if !overview}
			<Stack>
				<Skeleton height="5rem" rounded="var(--radius-widget)" />
				<Skeleton height="16rem" rounded="var(--radius-widget)" />
			</Stack>
		{:else}
			<Stack>
				<SectionCard title="Trust policy" description={TRUST_COPY[trust]}>
					{#snippet actions()}
						<Badge tone={trust === 'any' ? 'warning' : trust === 'taps' ? 'info' : 'neutral'}>
							{TRUST_BADGE[trust]}
						</Badge>
					{/snippet}
				</SectionCard>

				{#if overview.database}
					{@const db = overview.database}
					{#if db.level === 'ok'}
						<SectionCard
							title="Database connections"
							description="{db.summary} {db.inUse} are open right now."
						>
							<Progress
								value={db.rolloutPeak}
								max={db.usable > 0 ? db.usable : db.rolloutPeak}
								tone="neutral"
								size="lg"
								label="Database connections at peak"
								labelHidden
							/>
						</SectionCard>
					{:else}
						<Alert
							tone={db.level === 'over' ? 'error' : 'warning'}
							title={db.level === 'over'
								? 'Grafts could run the database out of connections'
								: 'Database connections are getting tight'}
						>
							{db.summary} When the database runs out, new requests fail until connections free up. Lower
							a graft's pool with <code>orchardctl graft pool &lt;id&gt; &lt;n&gt;</code>, or raise
							<code>max_connections</code> on the database.
						</Alert>
					{/if}
				{/if}

				{#if overview.grafts.length === 0}
					<SectionCard>
						<EmptyState
							title="No grafts installed"
							description="Grafts add pages, APIs and integrations. Pick one from the Extension Marketplace, then install it on your Orchard server."
						>
							<Snippet command="orchardctl graft add <id> --apply" />
						</EmptyState>
					</SectionCard>
				{:else}
					<SectionCard
						title="Installed"
						description="{overview.grafts.length} {overview.grafts.length === 1
							? 'graft'
							: 'grafts'} on Orchard {overview.platform}, graft SDK {overview.sdk}. Add more with orchardctl graft add or your Helm values."
					>
						<List inset={false} label="Installed grafts">
							{#each overview.grafts as g (g.id)}
								{@const isOpen = !!open[g.id]}
								{@const toggle = () => (open = { ...open, [g.id]: !open[g.id] })}
								<div class="graft">
									{#snippet subtitle()}
										<span class="line" title={g.description ?? g.id}>
											{g.description ??
												g.id}{#if g.publisher && tierOf(g.signature) !== 'official' && tierOf(g.signature) !== 'community'}&nbsp;·
												says it is by {g.publisher}{/if}
										</span>
									{/snippet}
									{#snippet controls()}
										<span class="graft-end">
											<span class="graft-badges">
												{@render tierBadge(g)}
												<span class="graft-status">
													<StatusBadge meta={statusOf(g)} variant="plain" />
												</span>
											</span>
											<span {@attach springRotate(() => isOpen, { rest: 0, on: 180 })}>
												<Button
													variant="ghost"
													size="sm"
													icon={ChevronDown}
													label={isOpen ? `Hide ${g.name} details` : `Show ${g.name} details`}
													aria-expanded={isOpen}
													aria-controls="graft-{g.id}"
													onclick={toggle}
												/>
											</span>
										</span>
									{/snippet}
									<ListRow
										flush
										pinned
										title={g.name}
										{subtitle}
										actions={controls}
										onclick={toggle}
									>
										{#snippet titleSuffix()}
											{#if g.version}<code class="version">{g.version}</code>{/if}
										{/snippet}
									</ListRow>
									<div id="graft-{g.id}" inert={!isOpen} {@attach springCollapse(() => !isOpen)}>
										<div class="graft-detail">
											{#if g.status === 'failed'}
												<Alert tone="error" title="Failed during {g.phase}">{g.reason}</Alert>
											{/if}
											{#each g.warnings as warning (warning)}
												<Alert tone="warning">{warning}</Alert>
											{/each}
											{#if tierOf(g.signature) === 'tap'}
												<Alert tone="warning" title="Third-party graft">
													From the {g.signature?.tap} tap{#if tapUrl(g.signature?.tap)}&nbsp;at
														<code>{tapUrl(g.signature?.tap)}</code>{/if}. Orchard hasn't checked
													anything in this tap. Install it only if you trust {g.signature?.tap}.
												</Alert>
											{/if}
											{@render graftFacts(g)}
											{#if g.routes.length}
												<div class="routes">
													<p class="routes-title">
														{g.routes.length}
														{g.routes.length === 1 ? 'route' : 'routes'}, {publicRoutes(g).length} open
														to anyone
													</p>
													<Table
														dense
														inset={false}
														label="{g.name} routes"
														columns={ROUTE_COLUMNS}
														rows={g.routes}
														rowKey={(route) => route.method + route.path}
														maxHeight="16rem"
													>
														{#snippet cell(route, column)}
															{#if column.id === 'method'}
																<code class="mono mono--muted">{route.method}</code>
															{:else if column.id === 'path'}
																<code class="mono path" title={route.path}>{route.path}</code>
															{:else}
																<Badge tone={ROUTE_ACCESS[route.classification].tone}>
																	{ROUTE_ACCESS[route.classification].label}
																</Badge>
															{/if}
														{/snippet}
													</Table>
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</List>
					</SectionCard>
				{/if}

				{#if overview.taps?.length}
					<SectionCard
						title="Taps"
						description="Graft catalogues you added with orchardctl graft tap add. Orchard hasn't checked them. Grafts from a tap must be signed with its key{trust ===
							'taps' || trust === 'any'
							? '.'
							: ', and only load once the trust policy allows taps.'}"
					>
						<List inset={false} label="Taps">
							{#each overview.taps as tap (tap.name)}
								<ListRow flush title={tap.name} subtitle={tap.url}>
									{#snippet trailing()}
										<code class="mono mono--muted">key {tap.keyId}</code>
									{/snippet}
								</ListRow>
							{/each}
						</List>
					</SectionCard>
				{/if}
			</Stack>
		{/if}
	</Swap>
</Stack>

<style>
	.graft {
		container-type: inline-size;
		min-width: 0;
	}
	.graft + .graft {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.graft-end {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.graft-badges {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.graft-status {
		display: flex;
		align-items: center;
		width: 10rem;
	}
	.graft-detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-bottom: var(--space-4);
	}
	.tier {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
		max-width: 14rem;
	}
	.tier :global(svg) {
		flex-shrink: 0;
	}
	.tier-text,
	.line {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
	}
	.version,
	.mono {
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
	}
	.version {
		color: var(--text-faint);
	}
	.mono {
		color: var(--text-default);
		overflow-wrap: anywhere;
	}
	.mono--muted {
		color: var(--text-muted);
	}
	.shadowed {
		color: var(--text-faint);
		text-decoration: line-through;
	}
	.path {
		display: block;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.lines {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.claim {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
	}
	.value {
		min-width: 0;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-default);
	}
	.value--muted {
		color: var(--text-muted);
	}
	.link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--text-link);
	}
	.routes {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.routes-title {
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	@container (max-width: 46rem) {
		.graft-badges {
			flex-direction: column;
			align-items: flex-end;
			gap: var(--space-1);
		}
		.graft-status {
			justify-content: flex-end;
			width: auto;
		}
	}
</style>

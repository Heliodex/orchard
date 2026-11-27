<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fromStore } from 'svelte/store';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { apiFetch, instanceFeatures, toasts, subscribeOrgEvents } from '$lib/stores';
	import { formatCpuMilli, formatMemoryBytes } from '$lib/quantity';
	import { Activity, BarChart3, Gauge, Pencil, Puzzle, Users } from 'lucide-svelte';
	import GraftMount from '$lib/grafts/GraftMount.svelte';
	import { graftHost } from '$lib/grafts/host.svelte';
	import {
		Alert,
		ActionRow,
		Avatar,
		Breadcrumbs,
		Button,
		CheckList,
		EmptyState,
		Field,
		ItemLabel,
		Input,
		Modal,
		ModalIntro,
		PageTabs,
		SearchField,
		SectionCard,
		SegmentedControl,
		SettingsList,
		LoadingBar,
		StatusBadge,
		Table,
		TopList
	} from '$lib/components/ui';
	import type { TableColumn, TableSort } from '$lib/components/ui/Table.svelte';
	import Widget from '$lib/components/ui/Widget.svelte';
	import Metric from '$lib/components/ui/Metric.svelte';
	import Progress from '$lib/components/ui/Progress.svelte';
	import ResourceHeader from '$lib/components/patterns/ResourceHeader.svelte';
	import { statusMeta } from '$lib/components/ui/status';

	const formatPods = (n: number) => `${n}`;

	if (browser) instanceFeatures.load().catch(() => undefined);
	import type { PageData } from './$types';

	type Role = 'owner' | 'admin' | 'member' | 'guest';
	type AllowanceSource = 'explicit' | 'default' | 'unlimited';
	type Verdict = 'over' | 'under' | 'ok' | 'unknown';

	interface OrgQuota {
		org: {
			id: string;
			name: string;
			cpuLimitMilli: number | null;
			memoryLimitBytes: number | null;
			maxPods: number | null;
			maxServices: number | null;
		};
		usage: { cpuMilli: number; memoryBytes: number; pods: number; services: number };
	}
	interface ProjectRow {
		id: string;
		name: string;
		slug: string;
		namespace: string;
		cpuLimitMilli: number | null;
		memoryLimitBytes: number | null;
		maxPods: number | null;
		maxServices: number | null;
		usage: { cpuMilli: number; memoryBytes: number; pods: number };
	}
	interface MemberRow {
		user: {
			id: string;
			username: string;
			email: string;
			firstName: string | null;
			lastName: string | null;
			imageUrl: string | null;
		};
		role: string;
		allowance: {
			cpuMilli: number | null;
			memoryBytes: number | null;
			source: { cpu: AllowanceSource; memory: AllowanceSource };
		};
		usage: { cpuMilli: number; memoryBytes: number };
	}
	interface MembersData {
		org: {
			cpuLimitMilli: number | null;
			memoryLimitBytes: number | null;
			defaultMemberCpuMilli: number | null;
			defaultMemberMemoryBytes: number | null;
		};
		commitment: { cpuMilli: number; memoryBytes: number };
		members: MemberRow[];
	}
	interface MyUsage {
		allowance: {
			cpuMilli: number | null;
			memoryBytes: number | null;
			source: { cpu: AllowanceSource; memory: AllowanceSource };
		};
		usage: {
			cpuMilli: number;
			memoryBytes: number;
			breakdown: Array<{
				kind: 'deployment' | 'database' | 'templateInstance';
				id: string;
				name: string;
				projectId: string;
				projectName: string;
				cpuMilli: number;
				memoryBytes: number;
				replicas: number;
			}>;
		};
		orgCap: { cpuLimitMilli: number | null; memoryLimitBytes: number | null };
		effectiveLimit: { cpuMilli: number | null; memoryBytes: number | null };
	}
	interface ProvisioningRow {
		kind: 'deployment' | 'database';
		id: string;
		name: string;
		projectId: string;
		projectName: string;
		namespace: string;
		requestedCpuMilli: number;
		requestedMemoryBytes: number;
		actualCpuMilliP95: number | null;
		actualMemoryBytesP95: number | null;
		cpuUtilization: number | null;
		memoryUtilization: number | null;
		verdict: Verdict;
	}

	let { data } = $props<{ data: PageData }>();
	const usageProgress = $derived(fromStore(data.usageProgress));

	let role = $state<Role>('member');
	let isAdmin = $state(false);
	let orgId = $state<string | null>(null);
	let orgQuota = $state<OrgQuota | null>(null);
	let projects = $state<ProjectRow[]>([]);
	let membersData = $state<MembersData | null>(null);
	let myUsage = $state<MyUsage | null>(null);
	let provisioning = $state<ProvisioningRow[]>([]);
	let loading = $state(true);

	const orgSlug = $derived(data.orgSlug);
	const range = $derived(data.range);

	type Tab = 'overview' | 'me' | 'members' | 'provisioning' | `graft-${string}`;

	const graftTabs = $derived(
		orgId
			? graftHost.slot('org.usage.tabs', { orgId, orgSlug }).map(({ graftId, host, item }) => ({
					key: `graft-${graftId}-${item.id}` as Tab,
					id: item.id,
					graftId,
					host,
					label: item.label,
					mount: item.mount
				}))
			: []
	);
	const activeGraftTab = $derived(graftTabs.find((t) => t.key === activeTab));

	const availableTabs = $derived.by<Array<{ id: Tab; label: string; icon: any }>>(() => {
		const tabs: Array<{ id: Tab; label: string; icon: any }> = [
			{ id: 'me', label: 'Yours', icon: Gauge }
		];
		if (isAdmin) {
			tabs.unshift({ id: 'overview', label: 'Organization', icon: Activity });
			tabs.push({ id: 'members', label: 'Members', icon: Users });
			tabs.push({ id: 'provisioning', label: 'Right-sizing', icon: BarChart3 });
		}
		for (const t of graftTabs) tabs.push({ id: t.key, label: t.label, icon: Puzzle });
		return tabs;
	});

	const urlTab = $derived(($page.url.searchParams.get('tab') as Tab | null) ?? null);
	const activeTab = $derived.by<Tab>(() => {
		if (urlTab && availableTabs.find((t) => t.id === urlTab)) return urlTab;
		const aliased = graftTabs.find((t) => t.id === urlTab);
		if (aliased) return aliased.key;
		return isAdmin ? 'overview' : 'me';
	});

	function setTab(t: Tab) {
		const u = new URL($page.url);
		u.searchParams.set('tab', t);
		goto(u.pathname + u.search, { keepFocus: true, noScroll: true, replaceState: true });
	}
	function setRange(r: string) {
		const u = new URL($page.url);
		u.searchParams.set('range', r);
		goto(u.pathname + u.search, { keepFocus: true, noScroll: true });
	}

	let usageUnsub: (() => void) | null = null;
	let usageRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	const USAGE_EVENTS = new Set([
		'deployment.changed',
		'database.changed',
		'project.changed',
		'membership.changed',
		'pod.changed'
	]);
	let hasLoadedOnce = false;

	$effect(() => {
		const promise = data.usagePromise;
		const isInitial = !hasLoadedOnce;
		if (isInitial) loading = true;
		promise
			.then((p: any) => {
				if (p.role === 'guest') {
					goto(`/${orgSlug}`, { replaceState: true });
					return;
				}
				role = p.role;
				isAdmin = p.isAdmin;
				orgId = p.orgId;
				orgQuota = p.orgQuota;
				projects = p.projectsData?.projects ?? [];
				membersData = p.membersData ?? null;
				myUsage = p.myUsage ?? null;
				provisioning = p.provisioning?.rows ?? [];
				hasLoadedOnce = true;
				loading = false;
				usageUnsub?.();
				usageUnsub = subscribeOrgEvents(p.orgId, (ev) => {
					if (!USAGE_EVENTS.has(ev.type)) return;
					if (usageRefreshTimer) return;
					usageRefreshTimer = setTimeout(() => {
						usageRefreshTimer = null;
						invalidate(`org:${orgSlug}:usage`);
					}, 5000);
				});
			})
			.catch((e: any) => {
				if (isInitial) loading = false;
				toasts.add({
					title: "Couldn't load usage",
					description: e instanceof Error ? e.message : "Couldn't load usage",
					color: 'error'
				});
			});
	});

	onDestroy(() => {
		usageUnsub?.();
		if (usageRefreshTimer) clearTimeout(usageRefreshTimer);
	});

	let editingDefault = $state(false);
	let defaultCpuInput = $state('');
	let defaultMemInput = $state('');
	let defaultCpuUnlim = $state(false);
	let defaultMemUnlim = $state(false);
	let savingDefault = $state(false);

	function startEditDefault() {
		if (!membersData) return;
		defaultCpuInput =
			membersData.org.defaultMemberCpuMilli === null
				? ''
				: String(membersData.org.defaultMemberCpuMilli);
		defaultMemInput =
			membersData.org.defaultMemberMemoryBytes === null
				? ''
				: String(Math.round(membersData.org.defaultMemberMemoryBytes / (1024 * 1024)));
		defaultCpuUnlim = membersData.org.defaultMemberCpuMilli === null;
		defaultMemUnlim = membersData.org.defaultMemberMemoryBytes === null;
		editingDefault = true;
	}
	async function saveDefault() {
		if (!orgId) return;
		savingDefault = true;
		try {
			const cpuMilli = defaultCpuUnlim
				? null
				: String(defaultCpuInput).trim() === ''
					? null
					: Math.max(0, parseInt(String(defaultCpuInput), 10));
			const memoryBytes = defaultMemUnlim
				? null
				: String(defaultMemInput).trim() === ''
					? null
					: Math.max(0, parseInt(String(defaultMemInput), 10)) * 1024 * 1024;
			const res = await apiFetch(`/apiv1/organizations/${orgId}/quota/default-member-allowance`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cpuMilli, memoryBytes })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || `Couldn't save default (${res.status})`);
			}
			editingDefault = false;
			invalidate(`org:${orgSlug}:usage`);
			toasts.add({ title: 'Saved', description: 'Default allowance updated', color: 'success' });
		} catch (e) {
			toasts.add({
				title: "Couldn't save",
				description: e instanceof Error ? e.message : "Couldn't save",
				color: 'error'
			});
		} finally {
			savingDefault = false;
		}
	}

	let editingMemberId = $state<string | null>(null);
	let memCpuInput = $state('');
	let memMemInput = $state('');
	let memCpuUnlim = $state(false);
	let memMemUnlim = $state(false);
	let memCpuUseDefault = $state(false);
	let memMemUseDefault = $state(false);
	let savingMember = $state(false);

	function startEditMember(m: MemberRow) {
		editingMemberId = m.user.id;
		const isDefaultCpu = m.allowance.source.cpu === 'default';
		const isDefaultMem = m.allowance.source.memory === 'default';
		const isUnlimCpu = m.allowance.source.cpu === 'unlimited';
		const isUnlimMem = m.allowance.source.memory === 'unlimited';
		memCpuUseDefault = isDefaultCpu;
		memMemUseDefault = isDefaultMem;
		memCpuUnlim = isUnlimCpu;
		memMemUnlim = isUnlimMem;
		memCpuInput =
			!isDefaultCpu && !isUnlimCpu && m.allowance.cpuMilli !== null
				? String(m.allowance.cpuMilli)
				: '';
		memMemInput =
			!isDefaultMem && !isUnlimMem && m.allowance.memoryBytes !== null
				? String(Math.round(m.allowance.memoryBytes / (1024 * 1024)))
				: '';
	}
	async function saveMember() {
		if (!orgId || !editingMemberId) return;
		savingMember = true;
		try {
			const cpuMilli = memCpuUnlim
				? null
				: memCpuUseDefault
					? null
					: String(memCpuInput).trim() === ''
						? null
						: Math.max(0, parseInt(String(memCpuInput), 10));
			const memoryBytes = memMemUnlim
				? null
				: memMemUseDefault
					? null
					: String(memMemInput).trim() === ''
						? null
						: Math.max(0, parseInt(String(memMemInput), 10)) * 1024 * 1024;
			const res = await apiFetch(`/apiv1/organizations/${orgId}/quota/members/${editingMemberId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cpuMilli,
					memoryBytes,
					cpuUnlimited: memCpuUnlim,
					memoryUnlimited: memMemUnlim
				})
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || `Couldn't save (${res.status})`);
			}
			editingMemberId = null;
			invalidate(`org:${orgSlug}:usage`);
			toasts.add({ title: 'Saved', description: 'Allowance updated', color: 'success' });
		} catch (e) {
			toasts.add({
				title: "Couldn't save",
				description: e instanceof Error ? e.message : "Couldn't save",
				color: 'error'
			});
		} finally {
			savingMember = false;
		}
	}

	function memberName(m: MemberRow): string {
		const fn = [m.user.firstName, m.user.lastName].filter(Boolean).join(' ').trim();
		return fn || m.user.username || m.user.email;
	}
	function allowanceLabel(
		src: AllowanceSource,
		value: number | null,
		fmt: (n: number) => string
	): string {
		if (src === 'unlimited' || value === null) return 'Unlimited';
		return `${fmt(value)}${src === 'default' ? ' · default' : ''}`;
	}

	const topWasters = $derived.by(() => {
		const byCpu = [...provisioning]
			.filter((r) => r.actualCpuMilliP95 !== null && r.requestedCpuMilli > 0)
			.map((r) => ({
				row: r,
				wasted: Math.max(0, r.requestedCpuMilli - (r.actualCpuMilliP95 ?? 0))
			}))
			.filter((x) => x.wasted > 0)
			.sort((a, b) => b.wasted - a.wasted)
			.slice(0, 5);
		const byMem = [...provisioning]
			.filter((r) => r.actualMemoryBytesP95 !== null && r.requestedMemoryBytes > 0)
			.map((r) => ({
				row: r,
				wasted: Math.max(0, r.requestedMemoryBytes - (r.actualMemoryBytesP95 ?? 0))
			}))
			.filter((x) => x.wasted > 0)
			.sort((a, b) => b.wasted - a.wasted)
			.slice(0, 5);
		return { byCpu, byMem };
	});

	const provisioningSummary = $derived.by(() => {
		const counts = { over: 0, under: 0, ok: 0, unknown: 0 } as Record<Verdict, number>;
		let wastedCpu = 0;
		let wastedMem = 0;
		for (const r of provisioning) {
			counts[r.verdict] += 1;
			if (r.actualCpuMilliP95 !== null) {
				wastedCpu += Math.max(0, r.requestedCpuMilli - r.actualCpuMilliP95);
			}
			if (r.actualMemoryBytesP95 !== null) {
				wastedMem += Math.max(0, r.requestedMemoryBytes - r.actualMemoryBytesP95);
			}
		}
		return { counts, wastedCpu, wastedMem };
	});

	const RANGES = [
		{ value: '1h', label: '1h' },
		{ value: '24h', label: '24h' },
		{ value: '7d', label: '7d' }
	];

	type Tone = 'neutral' | 'success' | 'warning' | 'error';
	type Tile = {
		label: string;
		value: string;
		unit?: string;
		detail?: string;
		tone: Tone;
		ratio: number | null;
	};

	function splitAmount(s: string): { value: string; unit?: string } {
		const i = s.lastIndexOf(' ');
		return i > 0 ? { value: s.slice(0, i), unit: s.slice(i + 1) } : { value: s };
	}

	function toneFor(ratio: number | null): Tone {
		if (ratio == null) return 'neutral';
		return ratio >= 0.9 ? 'error' : ratio >= 0.75 ? 'warning' : 'neutral';
	}

	function capTile(
		label: string,
		used: number,
		cap: number | null,
		fmt: (n: number) => string
	): Tile {
		if ($instanceFeatures.resourceLimits === 'off') {
			return {
				label,
				...splitAmount(fmt(used)),
				detail: 'Limits are off',
				tone: 'neutral',
				ratio: null
			};
		}
		const ratio = cap && cap > 0 ? used / cap : null;
		return {
			label,
			...splitAmount(fmt(used)),
			detail: cap ? `of ${fmt(cap)} · ${Math.round((ratio ?? 0) * 100)}%` : 'No cap',
			tone: toneFor(ratio),
			ratio
		};
	}

	const orgTiles = $derived.by((): Tile[] => {
		if (!orgQuota) return [];
		const { org, usage } = orgQuota;
		return [
			capTile('CPU reserved', usage.cpuMilli, org.cpuLimitMilli, formatCpuMilli),
			capTile('Memory reserved', usage.memoryBytes, org.memoryLimitBytes, formatMemoryBytes),
			capTile('Pods', usage.pods, org.maxPods, formatPods),
			capTile('Services', usage.services, org.maxServices, formatPods)
		];
	});

	const myTiles = $derived.by((): Tile[] => {
		if (!myUsage) return [];
		const make = (
			label: string,
			used: number,
			left: number | null,
			total: number | null,
			fmt: (n: number) => string
		): Tile => {
			if (left == null) {
				return {
					label,
					value: 'Unlimited',
					detail: `${fmt(used)} in use`,
					tone: 'neutral',
					ratio: null
				};
			}
			const ratio = total && total > 0 ? 1 - left / total : null;
			return {
				label,
				...splitAmount(fmt(Math.max(0, left))),
				detail: total
					? `${fmt(used)} used by you · ${fmt(total)} in total`
					: `${fmt(used)} used by you`,
				tone: toneFor(ratio),
				ratio
			};
		};
		return [
			make(
				'CPU you can still assign',
				myUsage.usage.cpuMilli,
				myUsage.effectiveLimit.cpuMilli,
				myUsage.allowance.cpuMilli ?? myUsage.orgCap.cpuLimitMilli,
				formatCpuMilli
			),
			make(
				'Memory you can still assign',
				myUsage.usage.memoryBytes,
				myUsage.effectiveLimit.memoryBytes,
				myUsage.allowance.memoryBytes ?? myUsage.orgCap.memoryLimitBytes,
				formatMemoryBytes
			)
		];
	});

	const commitTiles = $derived.by((): Tile[] => {
		if (!membersData) return [];
		const { org, commitment } = membersData;
		const over = (used: number, cap: number | null) =>
			cap && used > cap ? ' · over the cap, which is allowed' : '';
		const cpu = capTile(
			'CPU allocated to members',
			commitment.cpuMilli,
			org.cpuLimitMilli,
			formatCpuMilli
		);
		const mem = capTile(
			'Memory allocated to members',
			commitment.memoryBytes,
			org.memoryLimitBytes,
			formatMemoryBytes
		);
		return [
			{
				...cpu,
				detail: (cpu.detail ?? '') + over(commitment.cpuMilli, org.cpuLimitMilli),
				tone: cpu.tone === 'error' ? 'warning' : cpu.tone
			},
			{
				...mem,
				detail: (mem.detail ?? '') + over(commitment.memoryBytes, org.memoryLimitBytes),
				tone: mem.tone === 'error' ? 'warning' : mem.tone
			}
		];
	});

	const headerFacts = $derived.by((): string[] => {
		if (orgQuota && isAdmin) {
			const workloads = provisioning.length;
			return [
				`${projects.length} project${projects.length === 1 ? '' : 's'}`,
				`${membersData?.members.length ?? 0} member${membersData?.members.length === 1 ? '' : 's'}`,
				...(workloads ? [`${workloads} workload${workloads === 1 ? '' : 's'} measured`] : [])
			];
		}
		if (myUsage) {
			return [
				`${formatCpuMilli(myUsage.usage.cpuMilli)} and ${formatMemoryBytes(myUsage.usage.memoryBytes)} yours`,
				`${myUsage.usage.breakdown.length} workload${myUsage.usage.breakdown.length === 1 ? '' : 's'}`
			];
		}
		return [];
	});

	const PROJECT_METRICS = [
		{ value: 'cpu', label: 'CPU' },
		{ value: 'mem', label: 'Memory' },
		{ value: 'pods', label: 'Pods' }
	];
	let projectMetric = $state<'cpu' | 'mem' | 'pods'>('cpu');
	const projectItems = $derived(
		projects.map((p) => ({
			id: p.id,
			label: p.name,
			value:
				projectMetric === 'cpu'
					? p.usage.cpuMilli
					: projectMetric === 'mem'
						? p.usage.memoryBytes
						: p.usage.pods
		}))
	);
	const projectFormat = $derived(
		projectMetric === 'cpu'
			? formatCpuMilli
			: projectMetric === 'mem'
				? formatMemoryBytes
				: formatPods
	);

	const MY_METRICS = [
		{ value: 'cpu', label: 'CPU' },
		{ value: 'mem', label: 'Memory' }
	];
	let myMetric = $state<'cpu' | 'mem'>('cpu');
	const myItems = $derived(
		(myUsage?.usage.breakdown ?? []).map((b) => ({
			id: `${b.kind}:${b.id}`,
			label: `${b.projectName} / ${b.name}`,
			value: myMetric === 'cpu' ? b.cpuMilli : b.memoryBytes
		}))
	);
	const myFormat = $derived(myMetric === 'cpu' ? formatCpuMilli : formatMemoryBytes);

	function verdictMeta(v: Verdict) {
		switch (v) {
			case 'over':
				return statusMeta('warning', 'Over-provisioned');
			case 'under':
				return statusMeta('error', 'Under-provisioned');
			case 'ok':
				return statusMeta('success', 'Right-sized');
			default:
				return statusMeta('neutral', 'No data yet');
		}
	}

	function utilTone(u: number | null): 'neutral' | 'warning' | 'error' {
		if (u == null) return 'neutral';
		return u >= 0.9 ? 'error' : u >= 0.75 ? 'warning' : 'neutral';
	}

	function tabHref(t: Tab) {
		const u = new URL($page.url);
		u.searchParams.set('tab', t);
		return u.pathname + u.search;
	}

	const verdictChecks = $derived(
		(['ok', 'under', 'over', 'unknown'] as Verdict[])
			.filter((v) => v !== 'unknown' || provisioningSummary.counts.unknown > 0)
			.map((v) => ({
				id: v,
				label: verdictMeta(v).label,
				value: String(provisioningSummary.counts[v]),
				meta:
					provisioningSummary.counts[v] === 0 && v !== 'ok'
						? statusMeta('neutral', verdictMeta(v).label)
						: verdictMeta(v),
				href: tabHref('provisioning')
			}))
	);

	const reclaimLine = $derived(
		`${formatCpuMilli(provisioningSummary.wastedCpu)} and ${formatMemoryBytes(provisioningSummary.wastedMem)} reserved but unused at the 95th percentile over ${range}.`
	);

	const rightTiles = $derived.by((): Tile[] => {
		const total = provisioning.length;
		const c = provisioningSummary.counts;
		return [
			{
				label: 'Right-sized',
				value: String(c.ok),
				detail: `of ${total} workloads`,
				tone: 'neutral',
				ratio: total ? c.ok / total : null
			},
			{
				label: 'Under-provisioned',
				value: String(c.under),
				detail: c.under
					? 'Near their limits, may be throttled or killed'
					: 'None near their limits',
				tone: c.under ? 'error' : 'neutral',
				ratio: null
			},
			{
				label: 'Unused CPU',
				...splitAmount(formatCpuMilli(provisioningSummary.wastedCpu)),
				detail: 'Reserved but not used',
				tone: 'neutral',
				ratio: null
			},
			{
				label: 'Unused memory',
				...splitAmount(formatMemoryBytes(provisioningSummary.wastedMem)),
				detail: 'Reserved but not used',
				tone: 'neutral',
				ratio: null
			}
		];
	});

	const wasteCpuItems = $derived(
		topWasters.byCpu.map((x) => ({
			id: `${x.row.kind}:${x.row.id}`,
			label: `${x.row.projectName} / ${x.row.name}`,
			value: x.wasted
		}))
	);
	const wasteMemItems = $derived(
		topWasters.byMem.map((x) => ({
			id: `${x.row.kind}:${x.row.id}`,
			label: `${x.row.projectName} / ${x.row.name}`,
			value: x.wasted
		}))
	);

	let verdictFilter = $state<'all' | Verdict>('all');
	const verdictFilterOptions = $derived([
		{ value: 'all', label: 'All' },
		...(['under', 'over', 'ok'] as Verdict[])
			.filter((v) => provisioningSummary.counts[v] > 0)
			.map((v) => ({
				value: v,
				label: v === 'ok' ? 'Right-sized' : v === 'under' ? 'Under' : 'Over'
			}))
	]);
	let workloadQuery = $state('');
	let workloadSort = $state<TableSort | null>({ id: 'verdict', dir: 'asc' });
	const VERDICT_RANK: Record<Verdict, number> = { under: 0, over: 1, ok: 2, unknown: 3 };
	const WORKLOAD_COLUMNS: TableColumn<ProvisioningRow>[] = [
		{ id: 'name', label: 'Workload', sortable: true, sortValue: (r) => r.name },
		{
			id: 'cpu',
			label: 'CPU used',
			width: '14rem',
			sortable: true,
			sortValue: (r) => r.cpuUtilization ?? -1
		},
		{
			id: 'mem',
			label: 'Memory used',
			width: '14rem',
			sortable: true,
			sortValue: (r) => r.memoryUtilization ?? -1
		},
		{
			id: 'verdict',
			label: 'Verdict',
			width: '11rem',
			sortable: true,
			sortValue: (r) => VERDICT_RANK[r.verdict]
		}
	];
	const visibleWorkloads = $derived.by(() => {
		const q = workloadQuery.trim().toLowerCase();
		return provisioning.filter(
			(r) =>
				(verdictFilter === 'all' || r.verdict === verdictFilter) &&
				(!q || `${r.name} ${r.projectName}`.toLowerCase().includes(q))
		);
	});

	let memberQuery = $state('');
	let memberSort = $state<TableSort | null>({ id: 'cpu', dir: 'desc' });
	const MEMBER_COLUMNS: TableColumn<MemberRow>[] = [
		{ id: 'member', label: 'Member', sortable: true, sortValue: (m) => memberName(m) },
		{ id: 'role', label: 'Role', width: '7rem', sortable: true, sortValue: (m) => m.role },
		{
			id: 'cpu',
			label: 'CPU',
			width: '13rem',
			sortable: true,
			sortValue: (m) => m.usage.cpuMilli
		},
		{
			id: 'mem',
			label: 'Memory',
			width: '13rem',
			sortable: true,
			sortValue: (m) => m.usage.memoryBytes
		},
		{ id: 'edit', width: '3rem', align: 'end' }
	];
	const visibleMembers = $derived.by(() => {
		const q = memberQuery.trim().toLowerCase();
		const list = membersData?.members ?? [];
		return q
			? list.filter((m) => `${memberName(m)} ${m.user.email}`.toLowerCase().includes(q))
			: list;
	});
	const editingMember = $derived(
		membersData?.members.find((m) => m.user.id === editingMemberId) ?? null
	);

	function formatRole(r: string) {
		return r.charAt(0).toUpperCase() + r.slice(1);
	}
	function allowanceText(v: number | null, fmt: (n: number) => string) {
		return v == null ? 'Unlimited' : fmt(v);
	}

	const LIMIT_MODES = [
		{ value: 'custom', label: 'Set a limit' },
		{ value: 'unlimited', label: 'Unlimited' }
	];
	const MEMBER_MODES = [
		{ value: 'default', label: 'Default' },
		{ value: 'custom', label: 'Custom' },
		{ value: 'unlimited', label: 'Unlimited' }
	];

	const showRange = $derived(activeTab === 'provisioning' || activeTab === 'overview');
</script>

{#snippet tile(t: Tile)}
	<Widget>
		<Metric label={t.label} value={t.value} unit={t.unit} detail={t.detail} tone={t.tone}>
			{#snippet chart()}
				{#if t.ratio != null}
					<Progress
						value={Math.min(100, t.ratio * 100)}
						max={100}
						size="sm"
						tone={t.tone === 'neutral' ? 'neutral' : t.tone}
						label={t.label}
						labelHidden
					/>
				{/if}
			{/snippet}
		</Metric>
	</Widget>
{/snippet}

<div class="usage-page">
	<Breadcrumbs crumbs={[{ label: 'Home', href: `/${orgSlug}` }, { label: 'Usage' }]} />

	<ResourceHeader title="Usage">
		{#snippet facts()}
			{#each headerFacts as fact (fact)}<span>{fact}</span>{/each}
		{/snippet}
	</ResourceHeader>

	{#if $instanceFeatures.resourceLimits === 'off'}
		<div class="limits-off">
			<Alert tone="info" title="Resource limits are off">
				Apps and databases can use all of this server's resources. Caps and allowances apply only
				when a superadmin turns limits on.
			</Alert>
		</div>
	{/if}
	{#if availableTabs.length > 1 || showRange}
		<div class="usage-bar">
			{#if availableTabs.length > 1}
				<PageTabs
					label="Usage sections"
					tabs={availableTabs}
					value={activeTab}
					onchange={(v) => setTab(v as Tab)}
				/>
			{/if}
			{#if showRange}
				<SegmentedControl
					label="Range"
					size="sm"
					shape="capsule"
					options={RANGES}
					value={range}
					onchange={(v) => setRange(v)}
				/>
			{/if}
		</div>
	{/if}

	{#if loading}
		<div class="waiting">
			<LoadingBar
				label="Loading usage"
				value={usageProgress.current.total
					? usageProgress.current.done / usageProgress.current.total
					: null}
				detail="{usageProgress.current.done} of {usageProgress.current.total}"
			/>
		</div>
	{:else if activeTab === 'overview' && orgQuota}
		<div class="tiles tiles--4">
			{#each orgTiles as t (t.label)}{@render tile(t)}{/each}
		</div>
		<div class="split">
			<SectionCard title="By project">
				{#snippet actions()}
					<SegmentedControl
						label="Rank projects by"
						size="sm"
						shape="capsule"
						options={PROJECT_METRICS}
						bind:value={projectMetric}
					/>
				{/snippet}
				{#if projectItems.length}
					<TopList label="Projects" items={projectItems} format={projectFormat} />
				{:else}
					<p class="quiet">No projects yet.</p>
				{/if}
			</SectionCard>
			<SectionCard title="Right-sizing">
				{#snippet actions()}
					<Button size="sm" variant="ghost" href={tabHref('provisioning')}>Details</Button>
				{/snippet}
				{#if provisioning.length}
					<div class="stack">
						<CheckList label="Workload verdicts" items={verdictChecks} />
						<p class="quiet">{reclaimLine}</p>
					</div>
				{:else}
					<p class="quiet">No workload has enough history yet.</p>
				{/if}
			</SectionCard>
		</div>
	{:else if activeTab === 'me' && myUsage}
		<div class="tiles tiles--2">
			{#each myTiles as t (t.label)}{@render tile(t)}{/each}
		</div>
		<SectionCard title="By workload">
			{#snippet actions()}
				<SegmentedControl
					label="Rank workloads by"
					size="sm"
					shape="capsule"
					options={MY_METRICS}
					bind:value={myMetric}
				/>
			{/snippet}
			{#if myItems.length}
				<TopList label="Your workloads" items={myItems} format={myFormat} />
			{:else}
				<p class="quiet">Nothing of yours is running yet.</p>
			{/if}
		</SectionCard>
	{:else if activeTab === 'members' && membersData}
		<div class="tiles tiles--2">
			{#each commitTiles as t (t.label)}{@render tile(t)}{/each}
		</div>
		<SectionCard title="Default allowance">
			<SettingsList>
				<ActionRow
					label={`${allowanceText(membersData.org.defaultMemberCpuMilli, formatCpuMilli)} CPU · ${allowanceText(membersData.org.defaultMemberMemoryBytes, formatMemoryBytes)} memory`}
					hint="Members without their own allowance get this"
				>
					<Button size="sm" icon={Pencil} onclick={startEditDefault}>Edit</Button>
				</ActionRow>
			</SettingsList>
		</SectionCard>
		<SectionCard title="Members">
			{#snippet actions()}
				<SearchField size="sm" placeholder="Search members" bind:value={memberQuery} />
			{/snippet}
			<Table
				columns={MEMBER_COLUMNS}
				rows={visibleMembers}
				rowKey={(m) => m.user.id}
				bind:sort={memberSort}
				inset={false}
				label="Members"
				emptyText={memberQuery ? `Nobody matches “${memberQuery}”` : 'No members'}
			>
				{#snippet cell(m, col)}
					{#if col.id === 'member'}
						<ItemLabel title={memberName(m)} detail={m.user.email}>
							{#snippet leading()}<Avatar user={m.user} size={32} />{/snippet}
						</ItemLabel>
					{:else if col.id === 'role'}
						<span class="amount muted">{formatRole(m.role)}</span>
					{:else if col.id === 'cpu'}
						<span class="amount"
							><strong>{formatCpuMilli(m.usage.cpuMilli)}</strong>
							<span class="muted"
								>of {allowanceLabel(
									m.allowance.source.cpu,
									m.allowance.cpuMilli,
									formatCpuMilli
								)}</span
							></span
						>
					{:else if col.id === 'mem'}
						<span class="amount"
							><strong>{formatMemoryBytes(m.usage.memoryBytes)}</strong>
							<span class="muted"
								>of {allowanceLabel(
									m.allowance.source.memory,
									m.allowance.memoryBytes,
									formatMemoryBytes
								)}</span
							></span
						>
					{:else if col.id === 'edit'}
						<Button
							size="sm"
							variant="ghost"
							icon={Pencil}
							label={`Edit ${memberName(m)}'s allowance`}
							onclick={() => startEditMember(m)}
						/>
					{/if}
				{/snippet}
			</Table>
		</SectionCard>
	{:else if activeTab === 'provisioning'}
		<div class="tiles tiles--4">
			{#each rightTiles as t (t.label)}{@render tile(t)}{/each}
		</div>
		{#if topWasters.byCpu.length || topWasters.byMem.length}
			<div class="split split--even">
				<SectionCard title="Most unused CPU">
					<TopList label="Unused CPU" items={wasteCpuItems} format={formatCpuMilli} />
				</SectionCard>
				<SectionCard title="Most unused memory">
					<TopList label="Unused memory" items={wasteMemItems} format={formatMemoryBytes} />
				</SectionCard>
			</div>
		{/if}
		<SectionCard title="Workloads">
			{#snippet actions()}
				<SegmentedControl
					label="Verdict"
					size="sm"
					shape="capsule"
					options={verdictFilterOptions}
					bind:value={verdictFilter}
				/>
				<SearchField size="sm" placeholder="Search workloads" bind:value={workloadQuery} />
			{/snippet}
			<Table
				columns={WORKLOAD_COLUMNS}
				rows={visibleWorkloads}
				rowKey={(r) => `${r.kind}:${r.id}`}
				bind:sort={workloadSort}
				inset={false}
				label="Workloads"
				emptyText={provisioning.length ? 'Nothing matches' : 'No workload has enough history yet'}
			>
				{#snippet cell(r, col)}
					{#if col.id === 'name'}
						<ItemLabel title={r.name} detail="{r.projectName} · {r.kind}" />
					{:else if col.id === 'cpu'}
						<span class="util">
							<span class="amount"
								><strong
									>{r.actualCpuMilliP95 == null ? '–' : formatCpuMilli(r.actualCpuMilliP95)}</strong
								>
								<span class="muted">of {formatCpuMilli(r.requestedCpuMilli)}</span></span
							>
							<Progress
								value={Math.min(100, (r.cpuUtilization ?? 0) * 100)}
								max={100}
								size="sm"
								tone={utilTone(r.cpuUtilization)}
								label="CPU used"
								labelHidden
							/>
						</span>
					{:else if col.id === 'mem'}
						<span class="util">
							<span class="amount"
								><strong
									>{r.actualMemoryBytesP95 == null
										? '–'
										: formatMemoryBytes(r.actualMemoryBytesP95)}</strong
								>
								<span class="muted">of {formatMemoryBytes(r.requestedMemoryBytes)}</span></span
							>
							<Progress
								value={Math.min(100, (r.memoryUtilization ?? 0) * 100)}
								max={100}
								size="sm"
								tone={utilTone(r.memoryUtilization)}
								label="Memory used"
								labelHidden
							/>
						</span>
					{:else if col.id === 'verdict'}
						<StatusBadge meta={verdictMeta(r.verdict)} />
					{/if}
				{/snippet}
			</Table>
		</SectionCard>
	{:else if activeGraftTab && orgId}
		<GraftMount
			graftId={activeGraftTab.graftId}
			mount={activeGraftTab.mount}
			props={{ orgId, orgSlug }}
			host={activeGraftTab.host}
		/>
	{:else}
		<EmptyState
			title="Nothing to show"
			description="Usage for this organization isn't available."
		/>
	{/if}
</div>

<Modal bind:open={editingDefault} size="sm" labelledby="usage-default-title">
	<div class="form">
		<ModalIntro id="usage-default-title" icon={Gauge} tone="accent" title="Default allowance" />
		<Field label="CPU" for="usage-default-cpu">
			<div class="choice">
				<SegmentedControl
					label="CPU allowance"
					options={LIMIT_MODES}
					grow
					bind:value={
						() => (defaultCpuUnlim ? 'unlimited' : 'custom'),
						(v) => (defaultCpuUnlim = v === 'unlimited')
					}
				/>
				{#if !defaultCpuUnlim}
					<Input
						id="usage-default-cpu"
						type="number"
						min="0"
						placeholder="1000"
						suffix="millicores"
						bind:value={defaultCpuInput}
					/>
				{/if}
			</div>
		</Field>
		<Field label="Memory" for="usage-default-mem">
			<div class="choice">
				<SegmentedControl
					label="Memory allowance"
					options={LIMIT_MODES}
					grow
					bind:value={
						() => (defaultMemUnlim ? 'unlimited' : 'custom'),
						(v) => (defaultMemUnlim = v === 'unlimited')
					}
				/>
				{#if !defaultMemUnlim}
					<Input
						id="usage-default-mem"
						type="number"
						min="0"
						placeholder="1024"
						suffix="MiB"
						bind:value={defaultMemInput}
					/>
				{/if}
			</div>
		</Field>
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (editingDefault = false)}>Cancel</Button>
		<Button variant="primary" loading={savingDefault} onclick={saveDefault}>Save</Button>
	{/snippet}
</Modal>

<Modal
	bind:open={() => editingMemberId !== null, (v) => !v && (editingMemberId = null)}
	size="sm"
	labelledby="usage-member-title"
>
	<div class="form">
		<ModalIntro
			id="usage-member-title"
			icon={Gauge}
			tone="accent"
			title={editingMember ? `${memberName(editingMember)}'s allowance` : 'Allowance'}
		/>
		<Field label="CPU" for="usage-member-cpu">
			<div class="choice">
				<SegmentedControl
					label="CPU allowance"
					options={MEMBER_MODES}
					grow
					bind:value={
						() => (memCpuUnlim ? 'unlimited' : memCpuUseDefault ? 'default' : 'custom'),
						(v) => {
							memCpuUnlim = v === 'unlimited';
							memCpuUseDefault = v === 'default';
						}
					}
				/>
				{#if !memCpuUnlim && !memCpuUseDefault}
					<Input
						id="usage-member-cpu"
						type="number"
						min="0"
						placeholder="1000"
						suffix="millicores"
						bind:value={memCpuInput}
					/>
				{/if}
			</div>
		</Field>
		<Field label="Memory" for="usage-member-mem">
			<div class="choice">
				<SegmentedControl
					label="Memory allowance"
					options={MEMBER_MODES}
					grow
					bind:value={
						() => (memMemUnlim ? 'unlimited' : memMemUseDefault ? 'default' : 'custom'),
						(v) => {
							memMemUnlim = v === 'unlimited';
							memMemUseDefault = v === 'default';
						}
					}
				/>
				{#if !memMemUnlim && !memMemUseDefault}
					<Input
						id="usage-member-mem"
						type="number"
						min="0"
						placeholder="1024"
						suffix="MiB"
						bind:value={memMemInput}
					/>
				{/if}
			</div>
		</Field>
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (editingMemberId = null)}>Cancel</Button>
		<Button variant="primary" loading={savingMember} onclick={saveMember}>Save</Button>
	{/snippet}
</Modal>

<style>
	.limits-off {
		margin-bottom: var(--space-4);
	}
	.waiting {
		display: grid;
		place-items: center;
		min-height: 16rem;
	}
	.waiting > :global(.ui-loadbar) {
		max-width: 24rem;
	}
	.usage-page {
		--section-r: var(--radius-widget);
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		max-width: 100rem;
		margin: 0 auto;
		padding: 1.5rem;
	}
	.usage-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
	}
	.tiles {
		display: grid;
		gap: var(--space-4);
	}
	.tiles--4 {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}
	.tiles--2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.split {
		display: grid;
		grid-template-columns: minmax(0, 1.618fr) minmax(0, 1fr);
		gap: var(--space-4);
		align-items: start;
	}
	.split--even {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.stack,
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.form {
		gap: var(--space-4);
	}
	.choice {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.quiet {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
	}
	.muted {
		color: var(--text-muted);
	}
	.amount {
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
	}
	.amount strong {
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.util {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		width: 100%;
		min-width: 0;
	}
	@media (max-width: 64rem) {
		.tiles--4 {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.split,
		.split--even {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>

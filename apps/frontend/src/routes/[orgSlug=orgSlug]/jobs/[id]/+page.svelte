<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		ArrowLeft,
		Play,
		Pause,
		Square,
		Zap,
		History,
		SlidersHorizontal,
		Trash2,
		CalendarClock
	} from 'lucide-svelte';
	import {
		apiFetch,
		toasts,
		subscribeOrgEvents,
		selectedOrganization,
		sseStatusFor
	} from '$lib/stores';
	import { queryClient } from '$lib/query';
	import { jobQueryOptions, jobRunsQueryOptions } from '$lib/queries/jobs';
	import { Button, TabBar, Skeleton, Alert, EmptyState } from '$lib/components/ui';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import {
		JobForm,
		JobStatusBadge,
		ScheduleBadge,
		StepPipeline,
		LiveDuration,
		draftError,
		draftToPayload,
		stepToDraft
	} from '$lib/components/jobs';
	import { overviewQueryOptions } from '$lib/queries/overview';
	import { formatRelativeTime } from '$lib/utils/format';
	import type { Job, JobRun, JobStepDraft } from '$lib/types/jobs';
	import type { PageData } from './$types';
	import '$lib/components/jobs/jobs.css';
	import './job-page.css';

	let { data } = $props<{ data: PageData }>();
	const orgSlug = $derived(data.orgSlug);
	const jobId = $derived(data.jobId);
	const orgId = $derived($selectedOrganization?.id ?? '');

	let sseStatusValue = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
	let sseUnsubs: Array<() => void> = [];
	let subscribedOrgId: string | null = null;
	$effect(() => {
		if (!orgId || subscribedOrgId === orgId) return;
		sseUnsubs.forEach((u) => u());
		sseUnsubs = [
			subscribeOrgEvents(orgId, () => {}),
			sseStatusFor(orgId).subscribe((s) => (sseStatusValue = s))
		];
		subscribedOrgId = orgId;
	});
	onDestroy(() => sseUnsubs.forEach((u) => u()));

	const jobQuery = createQuery(() => ({
		...jobQueryOptions(jobId),
		enabled: !!jobId,
		refetchInterval: (query: { state: { data?: Job } }) => {
			const sseUp = sseStatusValue === 'connected';
			const lastRun = query.state.data?.lastRun ?? null;
			const active = lastRun && ['pending', 'running'].includes(lastRun.status);
			if (active) return sseUp ? 15_000 : 3_000;
			return sseUp ? false : 30_000;
		},
		refetchIntervalInBackground: true
	}));
	const job = $derived(jobQuery.data as Job | undefined);
	const activeRun = $derived(
		job?.lastRun && ['pending', 'running'].includes(job.lastRun.status) ? job.lastRun : null
	);

	const runsQuery = createQuery(() => ({
		...jobRunsQueryOptions(jobId),
		enabled: !!jobId
	}));

	let extraRuns = $state<JobRun[]>([]);
	let extraCursor = $state<string | null>(null);
	let loadingMore = $state(false);
	const runs = $derived.by(() => {
		const first = (runsQuery.data?.runs ?? []) as JobRun[];
		const seen = new Set(first.map((r) => r.id));
		return [...first, ...extraRuns.filter((r) => !seen.has(r.id))];
	});
	const nextCursor = $derived(
		extraCursor !== null ? extraCursor : (runsQuery.data?.nextCursor ?? null)
	);

	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		try {
			const res = await apiFetch(`/apiv1/jobs/${jobId}/runs?cursor=${nextCursor}`);
			if (res.ok) {
				const pageData = await res.json();
				extraRuns = [...extraRuns, ...pageData.runs];
				extraCursor = pageData.nextCursor;
			}
		} finally {
			loadingMore = false;
		}
	}

	const overviewQuery = createQuery(() => ({
		...overviewQueryOptions(orgSlug),
		enabled: !!orgSlug
	}));
	const projectDeployments = $derived.by(() => {
		const projects = (overviewQuery.data?.projects ?? []) as Array<{
			id: string;
			deployments?: Array<{ id: string; name: string }>;
		}>;
		return projects.find((p) => p.id === job?.projectId)?.deployments ?? [];
	});

	const tabs = [
		{ id: 'overview', label: 'Overview', icon: Zap },
		{ id: 'runs', label: 'Runs', icon: History },
		{ id: 'settings', label: 'Settings', icon: SlidersHorizontal }
	];
	let activeTab = $state('overview');
	let tabInitialized = false;
	$effect(() => {
		if (tabInitialized) return;
		const wanted = $page.url.searchParams.get('tab');
		if (wanted && tabs.some((t) => t.id === wanted)) activeTab = wanted;
		tabInitialized = true;
	});

	let runningNow = $state(false);
	async function runNow() {
		if (runningNow) return;
		runningNow = true;
		try {
			const res = await apiFetch(`/apiv1/jobs/${jobId}/runs`, { method: 'POST' });
			if (res.status === 409) {
				toasts.add({ title: 'A run is already in progress', color: 'error' });
				return;
			}
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.message || "Couldn't start run");
			}
			const run = await res.json();
			goto(`/${orgSlug}/jobs/${jobId}/runs/${run.id}`);
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : "Couldn't start run", color: 'error' });
		} finally {
			runningNow = false;
		}
	}

	let canceling = $state(false);
	async function cancelActiveRun() {
		if (activeRun) await cancelRun(activeRun.id);
	}

	async function cancelRun(runId: string) {
		if (canceling) return;
		canceling = true;
		try {
			const res = await apiFetch(`/apiv1/job-runs/${runId}/cancel`, { method: 'POST' });
			if (!res.ok) throw new Error("Couldn't cancel run");
			toasts.add({ title: 'Run canceled', color: 'success' });
			invalidateJob();
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : "Couldn't cancel", color: 'error' });
		} finally {
			canceling = false;
		}
	}

	async function togglePause() {
		if (!job) return;
		try {
			const res = await apiFetch(`/apiv1/jobs/${jobId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled: !job.enabled })
			});
			if (!res.ok) throw new Error("Couldn't update");
			invalidateJob();
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : 'Failed', color: 'error' });
		}
	}

	function invalidateJob() {
		queryClient.invalidateQueries({ queryKey: ['job', jobId] });
		queryClient.invalidateQueries({ queryKey: ['job-runs', jobId] });
		queryClient.invalidateQueries({ queryKey: ['jobs', orgId] });
		extraRuns = [];
		extraCursor = null;
	}

	// Settings form state, seeded from the job once (not while editing).
	let formSeeded = false;
	let editName = $state('');
	let editDescription = $state('');
	let editScheduleCron = $state<string | null>(null);
	let editConcurrency = $state<'allow' | 'forbid'>('forbid');
	let editSteps = $state<JobStepDraft[]>([]);
	let saving = $state(false);
	let settingsError = $state<string | null>(null);

	$effect(() => {
		if (formSeeded || !job?.steps) return;
		editName = job.name;
		editDescription = job.description ?? '';
		editScheduleCron = job.scheduleCron;
		editConcurrency = job.concurrencyPolicy;
		editSteps = job.steps.map(stepToDraft);
		formSeeded = true;
	});

	async function saveSettings() {
		settingsError = null;
		if (!editName.trim()) {
			settingsError = 'Give the job a name';
			return;
		}
		const stepsError = draftError(editSteps);
		if (stepsError) {
			settingsError = stepsError;
			return;
		}
		saving = true;
		try {
			const patch = await apiFetch(`/apiv1/jobs/${jobId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: editName.trim(),
					description: editDescription.trim() || null,
					scheduleCron: editScheduleCron,
					concurrencyPolicy: editConcurrency
				})
			});
			if (!patch.ok) {
				const d = await patch.json().catch(() => ({}));
				throw new Error(d.message || "Couldn't save");
			}
			const stepsRes = await apiFetch(`/apiv1/jobs/${jobId}/steps`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ steps: draftToPayload(editSteps) })
			});
			if (!stepsRes.ok) {
				const d = await stepsRes.json().catch(() => ({}));
				throw new Error(d.message || "Couldn't save steps");
			}
			toasts.add({ title: 'Job saved', color: 'success' });
			formSeeded = false;
			invalidateJob();
		} catch (e) {
			settingsError = e instanceof Error ? e.message : "Couldn't save";
		} finally {
			saving = false;
		}
	}

	let deleteModalOpen = $state(false);
	async function deleteJob() {
		try {
			const res = await apiFetch(`/apiv1/jobs/${jobId}`, { method: 'DELETE' });
			if (!res.ok) throw new Error("Couldn't delete");
			toasts.add({ title: `Deleted "${job?.name}"`, color: 'success' });
			goto(`/${orgSlug}/jobs`);
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : "Couldn't delete", color: 'error' });
		}
	}

	function relTime(iso: string | null | undefined): string {
		if (!iso) return '';
		return formatRelativeTime(new Date(iso));
	}

	function stepSummary(step: {
		type: string;
		command: string | null;
		image?: string | null;
		script?: string | null;
	}): string {
		if (step.type === 'script') {
			return (step.script ?? '').split('\n').find((l) => l.trim() && !l.startsWith('#!')) ?? '';
		}
		return step.command ?? step.image ?? '';
	}

	function stepDotTone(status: string): string {
		if (status === 'succeeded') return 'succeeded';
		if (status === 'failed' || status === 'timed_out') return 'failed';
		if (status === 'running') return 'running';
		if (status === 'skipped' || status === 'canceled') return 'skipped';
		return 'pending';
	}
</script>

<svelte:head>
	<title>{job?.name ?? 'Job'} · Orchard</title>
</svelte:head>

<div class="job-page">
	{#if jobQuery.isPending}
		<Skeleton height="120px" rounded="1rem" />
	{:else if !job}
		<EmptyState title="Job not found" description="It may have been deleted.">
			<Button variant="secondary" href="/{orgSlug}/jobs">Back to jobs</Button>
		</EmptyState>
	{:else}
		<div class="job-page-header">
			<div class="job-page-header-main">
				<a href="/{orgSlug}/jobs" class="jobs-back-link">
					<ArrowLeft size={14} />
					Jobs
				</a>
				<div class="job-page-title-row">
					<h1 class="job-page-title" title={job.name}>{job.name}</h1>
					<ScheduleBadge
						scheduleCron={job.scheduleCron}
						timeZone={job.timeZone}
						enabled={job.enabled}
					/>
				</div>
				<p class="job-page-subtitle">
					{job.projectName}
					{#if job.description}· {job.description}{/if}
				</p>
			</div>
			<div class="job-page-header-actions">
				{#if job.scheduleCron}
					<Button variant="secondary" onclick={togglePause}>
						{#if job.enabled}<Pause size={14} />Pause{:else}<Play size={14} />Resume{/if}
					</Button>
				{/if}
				{#if activeRun}
					<Button variant="danger" loading={canceling} onclick={cancelActiveRun}>
						<Square size={13} />
						Cancel run
					</Button>
				{:else}
					<Button variant="primary" loading={runningNow} onclick={runNow}>
						<Play size={14} />
						Run now
					</Button>
				{/if}
			</div>
		</div>

		<div class="job-page-tabs">
			<TabBar {tabs} bind:value={activeTab} />
		</div>

		{#if activeTab === 'overview'}
			<div class="job-overview">
				<div class="card rounded-2xl p-5">
					<p class="job-form-section-title mb-3">Pipeline</p>
					<StepPipeline
						steps={(job.steps ?? []).map((s) => ({
							stepOrder: s.stepOrder,
							name: s.name,
							type: s.type,
							summary: stepSummary(s)
						}))}
					/>
				</div>

				<div class="job-overview-cards">
					<div class="card rounded-2xl p-5">
						<p class="job-form-section-title mb-2">Latest run</p>
						{#if job.lastRun}
							<div class="job-overview-lastrun">
								<JobStatusBadge status={job.lastRun.status} />
								<span class="job-card-lastrun-time">
									#{job.lastRun.number} · {relTime(job.lastRun.startedAt ?? job.lastRun.createdAt)}
								</span>
								{#if activeRun}
									<LiveDuration startedAt={job.lastRun.startedAt} />
								{/if}
							</div>
							<a class="job-overview-link" href="/{orgSlug}/jobs/{jobId}/runs/{job.lastRun.id}">
								View run →
							</a>
						{:else}
							<p class="job-overview-muted">No runs yet</p>
						{/if}
					</div>
					{#if job.scheduleCron && job.enabled && job.nextRunAt}
						<div class="card rounded-2xl p-5">
							<p class="job-form-section-title mb-2">Next run</p>
							<p class="job-overview-next">
								<CalendarClock size={14} />
								{relTime(job.nextRunAt)}
							</p>
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'runs'}
			<div class="card rounded-2xl p-5">
				{#if runs.length === 0}
					<EmptyState title="No runs yet">
						<Button variant="primary" loading={runningNow} onclick={runNow}>Run now</Button>
					</EmptyState>
				{:else}
					<table class="job-runs-table">
						<thead>
							<tr>
								<th>Run</th>
								<th>Status</th>
								<th>Trigger</th>
								<th>Started</th>
								<th>Duration</th>
								<th>Steps</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each runs as run (run.id)}
								<tr
									class="job-runs-row"
									onclick={() => goto(`/${orgSlug}/jobs/${jobId}/runs/${run.id}`)}
								>
									<td class="type-ident">#{run.number}</td>
									<td><JobStatusBadge status={run.status} /></td>
									<td class="job-runs-muted">
										{run.trigger === 'cron' ? 'Schedule' : (run.triggeredBy?.name ?? 'Manual')}
									</td>
									<td class="job-runs-muted" title={run.startedAt ?? ''}>
										{relTime(run.startedAt ?? run.createdAt)}
									</td>
									<td><LiveDuration startedAt={run.startedAt} finishedAt={run.finishedAt} /></td>
									<td>
										<span class="job-step-dots">
											{#each run.steps ?? [] as s (s.stepOrder)}
												<span
													class="job-step-dot job-step-dot--{stepDotTone(s.status)}"
													title="{s.name} · {s.status}"
												></span>
											{/each}
										</span>
									</td>
									<td>
										{#if ['pending', 'running'].includes(run.status)}
											<Button
												variant="ghost"
												size="sm"
												onclick={(e: MouseEvent) => {
													e.stopPropagation();
													cancelRun(run.id);
												}}
											>
												Cancel
											</Button>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if nextCursor}
						<div class="job-runs-more">
							<Button variant="secondary" size="sm" loading={loadingMore} onclick={loadMore}>
								Load more
							</Button>
						</div>
					{/if}
				{/if}
			</div>
		{:else if activeTab === 'settings'}
			<div class="job-settings">
				<JobForm
					bind:name={editName}
					bind:description={editDescription}
					bind:scheduleCron={editScheduleCron}
					bind:concurrencyPolicy={editConcurrency}
					bind:steps={editSteps}
					deployments={projectDeployments}
				/>
				{#if settingsError}
					<Alert tone="error">{settingsError}</Alert>
				{/if}
				<div class="jobs-form-actions">
					<Button variant="primary" loading={saving} onclick={saveSettings}>Save changes</Button>
				</div>

				<div class="job-danger-zone">
					<div class="job-danger-zone-text">
						<h3 class="job-danger-zone-name">Delete this job</h3>
						<p class="job-form-section-sub">Removes the schedule and every run in its history.</p>
					</div>
					<Button variant="danger" onclick={() => (deleteModalOpen = true)}>
						<Trash2 size={14} />
						Delete job
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<ConfirmModal
	bind:open={deleteModalOpen}
	title="Delete job?"
	description={`This permanently deletes "${job?.name ?? ''}" and its run history.`}
	confirmLabel="Delete job"
	onconfirm={deleteJob}
	oncancel={() => {}}
/>

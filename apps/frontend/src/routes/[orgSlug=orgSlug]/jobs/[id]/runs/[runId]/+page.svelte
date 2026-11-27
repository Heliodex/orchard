<script lang="ts">
	import { onDestroy } from 'svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { ArrowLeft, Square } from 'lucide-svelte';
	import {
		apiFetch,
		toasts,
		subscribeOrgEvents,
		selectedOrganization,
		sseStatusFor
	} from '$lib/stores';
	import { queryClient } from '$lib/query';
	import { jobRunQueryOptions } from '$lib/queries/jobs';
	import { Button, Skeleton, EmptyState, Alert } from '$lib/components/ui';
	import { JobStatusBadge, StepPipeline, RunStepLogs, LiveDuration } from '$lib/components/jobs';
	import { formatRelativeTime } from '$lib/utils/format';
	import type { JobRun } from '$lib/types/jobs';
	import type { PageData } from './$types';
	import '$lib/components/jobs/jobs.css';
	import '../../job-page.css';

	let { data } = $props<{ data: PageData }>();
	const orgSlug = $derived(data.orgSlug);
	const jobId = $derived(data.jobId);
	const runId = $derived(data.runId);
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

	const runQuery = createQuery(() => ({
		...jobRunQueryOptions(runId),
		enabled: !!runId,
		refetchInterval: (query: { state: { data?: JobRun } }) => {
			const sseUp = sseStatusValue === 'connected';
			const status = query.state.data?.status;
			const active = status && ['pending', 'running'].includes(status);
			if (active) return sseUp ? 5_000 : 2_500;
			return false;
		},
		refetchIntervalInBackground: true
	}));
	const run = $derived(runQuery.data as JobRun | undefined);
	const runActive = $derived(!!run && ['pending', 'running'].includes(run.status));

	let expanded = $state(-1);
	let autoExpanded = false;
	$effect(() => {
		if (autoExpanded || !run?.steps?.length) return;
		const interesting =
			run.steps.find((s) => s.status === 'running') ??
			run.steps.find((s) => ['failed', 'timed_out'].includes(s.status));
		if (interesting) expanded = interesting.stepOrder;
		autoExpanded = true;
	});

	let canceling = $state(false);
	async function cancelRun() {
		if (canceling) return;
		canceling = true;
		try {
			const res = await apiFetch(`/apiv1/job-runs/${runId}/cancel`, { method: 'POST' });
			if (!res.ok) throw new Error("Couldn't cancel run");
			toasts.add({ title: 'Run canceled', color: 'success' });
			queryClient.invalidateQueries({ queryKey: ['job-run', runId] });
		} catch (e) {
			toasts.add({ title: e instanceof Error ? e.message : "Couldn't cancel", color: 'error' });
		} finally {
			canceling = false;
		}
	}

	function relTime(iso: string | null | undefined): string {
		if (!iso) return '';
		return formatRelativeTime(new Date(iso));
	}

	const triggerLabel = $derived.by(() => {
		if (!run) return '';
		if (run.trigger === 'cron') return 'Schedule';
		if (run.triggeredBy) return `Manual · ${run.triggeredBy.name}`;
		return run.trigger === 'api' ? 'API' : 'Manual';
	});
</script>

<svelte:head>
	<title>{run ? `${run.jobName ?? 'Run'} #${run.number}` : 'Run'} · Orchard</title>
</svelte:head>

<div class="job-page">
	{#if runQuery.isPending}
		<Skeleton height="120px" rounded="1rem" />
	{:else if !run}
		<EmptyState title="Run not found" description="It may have been deleted.">
			<Button variant="secondary" href="/{orgSlug}/jobs/{jobId}">Back to job</Button>
		</EmptyState>
	{:else}
		<div class="job-run-header">
			<div class="job-page-header-main">
				<a
					href="/{orgSlug}/jobs/{jobId}?tab=runs"
					class="jobs-back-link"
					title={run.jobName ?? undefined}
				>
					<ArrowLeft size={14} />
					<span class="jobs-back-label">{run.jobName ?? 'Job'}</span>
				</a>
				<div class="job-run-title-row">
					<h1 class="job-page-title">Run #{run.number}</h1>
					<JobStatusBadge status={run.status} />
				</div>
				<div class="job-run-meta">
					<span>{triggerLabel}</span>
					{#if run.startedAt}<span>started {relTime(run.startedAt)}</span>{/if}
					<LiveDuration startedAt={run.startedAt} finishedAt={run.finishedAt} />
				</div>
			</div>
			{#if runActive}
				<Button variant="danger" loading={canceling} onclick={cancelRun}>
					<Square size={13} />
					Cancel run
				</Button>
			{/if}
		</div>

		{#if run.errorMessage}
			<div class="job-run-error">
				<Alert tone="error">{run.errorMessage}</Alert>
			</div>
		{/if}

		<div class="card rounded-2xl p-5">
			<StepPipeline
				expandable
				bind:expanded
				steps={(run.steps ?? []).map((s) => ({
					stepOrder: s.stepOrder,
					name: s.name,
					type: s.type,
					summary: s.command ?? s.resolvedImage ?? '',
					runStep: s
				}))}
			>
				{#snippet detail(step)}
					{#if step.runStep && !['pending', 'skipped'].includes(step.runStep.status)}
						<RunStepLogs
							{runId}
							stepOrder={step.stepOrder}
							running={step.runStep.status === 'running'}
						/>
						{#if step.runStep.exitCode != null || step.runStep.reason}
							<p class="job-run-step-meta">
								{#if step.runStep.exitCode != null}exit code {step.runStep.exitCode}{/if}
								{#if step.runStep.reason}
									{step.runStep.exitCode != null ? ' · ' : ''}{step.runStep.reason}
								{/if}
							</p>
						{/if}
					{:else}
						<p class="job-overview-muted">
							{step.runStep?.status === 'skipped' ? 'Skipped' : 'Waiting to start'}
						</p>
					{/if}
				{/snippet}
			</StepPipeline>
		</div>
	{/if}
</div>

<style>
	.job-run-step-meta {
		margin-top: 0.45rem;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--surface-muted);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
	}
</style>

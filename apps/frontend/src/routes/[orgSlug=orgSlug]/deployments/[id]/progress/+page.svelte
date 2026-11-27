<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { apiFetch, toasts, selectedOrganization, subscribeOrgEvents } from '$lib/stores';
	import { ArrowLeft, Loader2, ExternalLink, X } from 'lucide-svelte';
	import DeploymentProgress from '$lib/components/DeploymentProgress.svelte';
	import { ingressUrl } from '$lib/ingress-url';
	import { Button, Alert, SectionCard, StatusDot, resourceStatus } from '$lib/components/ui';

	interface Deployment {
		id: string;
		name: string;
		status: string;
		buildStatus?: string;
		buildStep?: string | null;
		buildLogs?: string | null;
		buildError?: string | null;
		buildStepTimestamps?: Record<string, number> | null;
		githubRepo?: string | null;
		githubBranch?: string | null;
		buildType?: 'dockerfile' | 'railpack' | null;
		warnings?: Array<{ podName: string; message: string; timestamp: string }>;
		ingresses?: Array<{ host: string }>;
	}

	let deployment = $state<Deployment | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let canceling = $state(false);
	// Keep track of logs separately to prevent them from disappearing during refresh
	let accumulatedLogs = $state<string | null>(null);

	const deploymentId = $derived($page.params.id);
	const orgSlug = $derived($page.params.orgSlug);

	let pollInterval: ReturnType<typeof setInterval>;

	async function fetchDeployment() {
		try {
			const response = await apiFetch(`/apiv1/deployments/${deploymentId}`);
			if (!response.ok) {
				throw new Error("Couldn't load app");
			}
			const data = await response.json();

			// The SSE stream owns the log text; the fetched blob only wins while
			// the stream has not delivered anything longer yet.
			if (data.buildLogs && data.buildLogs.length > (accumulatedLogs?.length ?? 0)) {
				accumulatedLogs = data.buildLogs;
			}

			deployment = data;

			// If build succeeded, redirect to main deployment page
			if (data.buildStatus === 'succeeded' || data.status === 'running') {
				goto(`/${orgSlug}/deployments/${deploymentId}`, { replaceState: true });
			}
		} catch (e) {
			if (!deployment) {
				error = e instanceof Error ? e.message : "Couldn't load app";
			}
		} finally {
			loading = false;
		}
	}

	let fetchQueued = false;

	function queueFetch() {
		if (fetchQueued) return;
		fetchQueued = true;
		setTimeout(() => {
			fetchQueued = false;
			fetchDeployment();
		}, 250);
	}

	let logSource: EventSource | null = null;
	let streamedLogs = '';

	function startLogStream() {
		logSource = new EventSource(`/apiv1/observe/deployments/${deploymentId}/build-logs/stream`);
		logSource.onmessage = (e) => {
			let data: {
				type?: string;
				chunk?: string;
				reset?: boolean;
				done?: boolean;
			};
			try {
				data = JSON.parse(e.data);
			} catch {
				return;
			}
			if (data.type === 'heartbeat') return;
			if (data.chunk !== undefined) {
				streamedLogs = data.reset ? data.chunk : streamedLogs + data.chunk;
				if (data.reset || streamedLogs.length > (accumulatedLogs?.length ?? 0)) {
					accumulatedLogs = streamedLogs;
				}
			}
			if (data.done) {
				logSource?.close();
				logSource = null;
				fetchDeployment();
			}
		};
	}

	onMount(() => {
		fetchDeployment();
		pollInterval = setInterval(fetchDeployment, 30_000);
		startLogStream();
	});

	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
		}
		logSource?.close();
	});

	$effect(() => {
		const orgId = $selectedOrganization?.id;
		if (!orgId) return;
		return subscribeOrgEvents(orgId, (ev) => {
			if (ev.id !== deploymentId) return;
			if (
				ev.type === 'deployment.changed' ||
				ev.type === 'build.changed' ||
				ev.type === 'pod.changed'
			) {
				queueFetch();
			}
		});
	});

	const isGitHubDeploy = $derived(Boolean(deployment?.githubRepo));

	async function cancelBuild() {
		if (!deploymentId || canceling) return;

		canceling = true;
		try {
			const response = await apiFetch(`/apiv1/deployments/${deploymentId}/cancel`, {
				method: 'POST'
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || "Couldn't cancel deployment");
			}

			toasts.add({
				title: 'Deployment canceled',

				color: 'success'
			});

			await fetchDeployment();
		} catch (e) {
			toasts.add({
				title: "Couldn't cancel deployment",
				description: e instanceof Error ? e.message : "Couldn't cancel deployment",
				color: 'error'
			});
		} finally {
			canceling = false;
		}
	}

	const canCancel = $derived(deployment?.status === 'building' || deployment?.status === 'pending');

	const failed = $derived(deployment?.status === 'failed' || deployment?.buildStatus === 'failed');

	const statusChip = $derived(
		deployment ? resourceStatus(deployment.status, deployment.buildStatus) : null
	);

	const headline = $derived.by(() => {
		if (!deployment) return '';
		if (failed) return `${deployment.name} failed to deploy`;
		if (canCancel || deployment.buildStatus === 'building') return `Building ${deployment.name}`;
		return `Deploying ${deployment.name}`;
	});

	const buildErrorLead = $derived(deployment?.buildError?.trim().split('\n')[0] ?? null);

	const liveUrl = $derived.by(() => {
		return ingressUrl(deployment?.ingresses?.[0]) || null;
	});
</script>

<div class="progress-page min-h-screen">
	<div class="progress-content mx-auto max-w-2xl px-4 py-12">
		<button
			onclick={() => window.history.back()}
			class="back-link mb-8 inline-flex items-center gap-2 text-sm cursor-pointer"
		>
			<ArrowLeft class="h-4 w-4" />
			<span>Back to project</span>
		</button>

		{#if error}
			<Alert tone="error" title={error} />
		{:else if loading}
			<div class="flex flex-col items-center justify-center py-16">
				<Loader2 class="h-12 w-12 animate-spin text-primary-600" />
				<p class="mt-4 text-muted">Loading app…</p>
			</div>
		{:else if deployment}
			<SectionCard>
				<div class="text-center mb-8">
					<h1 class="progress-headline">
						{#if statusChip}
							<StatusDot meta={statusChip} size={10} />
						{/if}
						{headline}
					</h1>
					{#if deployment.githubRepo}
						<div class="mt-2 flex items-center justify-center gap-2 text-sm text-muted">
							<span class="type-ident min-w-0 truncate" title={deployment.githubBranch}
								>{deployment.githubBranch}</span
							>
							{#if deployment.buildType}
								<span class="progress-meta-sep">&middot;</span>
								<span class="type-ident">
									{deployment.buildType === 'railpack' ? 'Railpack' : 'Dockerfile'}
								</span>
							{/if}
							<span class="progress-meta-sep">&middot;</span>
							<a
								href={deployment.githubRepo}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700"
							>
								<ExternalLink class="h-3.5 w-3.5" />
							</a>
						</div>
					{/if}
					{#if liveUrl}
						<div class="mt-3 flex items-center justify-center">
							<a
								href={liveUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="progress-url inline-flex min-w-0 max-w-full items-center gap-1.5 type-ident text-sm"
								title={liveUrl.replace('https://', '')}
							>
								<span class="min-w-0 truncate">{liveUrl.replace('https://', '')}</span>
								<ExternalLink class="h-3.5 w-3.5 shrink-0" />
							</a>
						</div>
					{/if}
				</div>

				{#if failed && buildErrorLead}
					<div class="mb-6">
						<Alert tone="error" title={buildErrorLead} />
					</div>
				{/if}

				<DeploymentProgress
					status={deployment.status}
					buildStatus={deployment.buildStatus}
					buildStep={deployment.buildStep}
					buildLogs={accumulatedLogs ?? deployment.buildLogs}
					buildError={deployment.buildError}
					{isGitHubDeploy}
					warnings={deployment.warnings}
					buildStepTimestamps={deployment.buildStepTimestamps}
				/>

				<div class="mt-8 flex justify-center gap-3">
					{#if canCancel}
						<Button variant="secondary" onclick={cancelBuild} disabled={canceling}>
							{#if canceling}
								<Loader2 class="h-4 w-4 animate-spin" />
								Canceling…
							{:else}
								<X class="h-4 w-4" />
								Cancel deployment
							{/if}
						</Button>
					{/if}
					{#if failed}
						<Button variant="secondary" onclick={() => window.history.back()}>
							Back to project
						</Button>
						<Button variant="primary" href="/{orgSlug}/deployments/{deployment.id}">View app</Button
						>
					{/if}
				</div>
			</SectionCard>

			{#if canCancel}
				<div class="mt-6 text-center text-sm text-muted">
					<p>Orchard redirects you when the app is ready.</p>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.progress-page {
		position: relative;
		background-color: var(--bg-app);
		color: var(--text-default);
	}

	.progress-content {
		position: relative;
	}

	.progress-headline {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		font-size: var(--text-title-2);
		line-height: var(--lh-title-2);
		font-weight: 700;
		letter-spacing: -0.01em;
		max-width: 100%;
		overflow-wrap: anywhere;
	}

	.progress-meta-sep {
		opacity: 0.5;
	}

	.back-link {
		color: var(--text-muted);
	}

	.back-link:hover {
		color: var(--text-default);
	}

	.progress-url {
		color: var(--accent);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-pill);
		padding: 0.25rem 0.75rem;
		background: var(--bg-raised);
	}

	.progress-url:hover {
		color: var(--text-default);
	}
</style>

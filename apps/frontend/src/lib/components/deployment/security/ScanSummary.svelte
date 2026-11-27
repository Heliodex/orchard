<script lang="ts">
	import { Box, Fingerprint, GitCommit, ScanLine, Tag } from 'lucide-svelte';
	import { Button, Skeleton } from '$lib/components/ui';
	import MetaList from '$lib/components/ui/MetaList.svelte';
	import Progress from '$lib/components/ui/Progress.svelte';
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import Widget from '$lib/components/ui/Widget.svelte';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import SeverityBar from '$lib/components/ui/SeverityBar.svelte';
	import { scanStatus, statusMeta } from '$lib/components/ui/status';
	import type { DeploymentSecurity } from './security-api';

	let {
		data,
		loadError = null,
		requesting = false,
		onScan,
		onRetry
	}: {
		data: DeploymentSecurity | null;
		loadError?: string | null;
		requesting?: boolean;
		onScan: () => void;
		onRetry: () => void;
	} = $props();

	const HEADLINES: Record<string, string> = {
		clean: 'No known vulnerabilities',
		scanning: 'Scanning',
		not_scanned: 'Not scanned yet',
		failed: 'The last scan failed',
		off: 'Image scanning is off',
		external_image: 'Harbor only scans images Orchard builds',
		no_image: 'No image to scan yet',
		not_scannable: "This image can't be scanned",
		not_configured: "Scanning isn't set up on this instance",
		unauthorized: 'The scanner refused Orchard',
		not_found: 'This image is no longer in the registry',
		unreachable: "Can't reach the scanner"
	};

	const DETAILS: Record<string, string> = {
		off: 'A superadmin can turn on Harbor or the Orchard scanner in Instance admin, under Configuration.',
		external_image: 'Build from a repository, or switch the instance to the Orchard scanner.',
		not_found: 'Redeploy to build and scan it again.'
	};

	const NOT_CONFIGURED: Record<string, string> = {
		harbor: 'Harbor is the chosen scanner, but its API credentials are missing.',
		trivy: "The Orchard scanner is chosen, but its Trivy server isn't deployed."
	};

	const PROVIDERS: Record<string, string> = {
		harbor: 'Harbor',
		trivy: 'Orchard scanner'
	};

	const scan = $derived(data?.scan ?? null);
	const state = $derived(scan?.state ?? null);
	const key = $derived(
		state === 'unsupported' || state === 'error' ? (scan?.reason ?? 'unreachable') : state
	);
	const detail = $derived(
		state === 'failed'
			? (scan?.error ?? null)
			: key === 'not_configured'
				? (NOT_CONFIGURED[scan?.provider ?? ''] ?? null)
				: key
					? (DETAILS[key] ?? null)
					: null
	);
	const status = $derived(
		loadError
			? statusMeta('warning', 'Unavailable')
			: scan
				? scanStatus(scan.state, scan.severity)
				: null
	);
	const hasResult = $derived(state === 'vulnerable' || state === 'clean');
	const canRetry = $derived(
		!!loadError || (state === 'error' && (key === 'unreachable' || key === 'unauthorized'))
	);
	const actionLabel = $derived(state === 'not_scanned' ? 'Scan now' : 'Scan again');
	const showScan = $derived(
		state !== 'error' &&
			(!!scan?.canRescan ||
				(!!scan && requesting) ||
				(state === 'scanning' && scan?.provider !== 'off'))
	);

	const facts = $derived.by(() => {
		if (!data) return [];
		const img = data.image;
		const out: { icon: typeof Box; label: string; mono?: boolean }[] = [];
		if (img.source !== 'orchard') {
			if (img.ref) out.push({ icon: Box, label: img.ref, mono: true });
		} else if (img.commitSha) {
			out.push({ icon: GitCommit, label: img.commitSha.slice(0, 7), mono: true });
		} else if (img.tag) out.push({ icon: Tag, label: img.tag, mono: true });
		if (img.digest)
			out.push({
				icon: Fingerprint,
				label: img.digest.replace(/^sha256:/, '').slice(0, 12),
				mono: true
			});
		if (data.scan.scanner && data.scan.provider !== 'off') {
			const engine = [data.scan.scanner.name, data.scan.scanner.version].filter(Boolean).join(' ');
			const via = PROVIDERS[data.scan.provider];
			out.push({ icon: ScanLine, label: via ? `${via} · ${engine}` : engine });
		}
		return out;
	});
</script>

{#snippet head()}
	{#if scan?.finishedAt && hasResult}<RelativeTime date={scan.finishedAt} />{/if}
	{#if showScan}
		<Button
			variant="ghost"
			size="sm"
			loading={requesting || state === 'scanning'}
			disabled={requesting || state === 'scanning'}
			onclick={onScan}>{actionLabel}</Button
		>
	{:else if canRetry}
		<Button variant="ghost" size="sm" onclick={onRetry}>Try again</Button>
	{/if}
{/snippet}

<Widget title="Image scan" meta={head} class="scan-summary">
	{#if !data && !loadError}
		<div class="body" aria-busy="true">
			<Skeleton width="12rem" height="1.25rem" />
			<Skeleton height="0.375rem" rounded="999px" />
			<Skeleton width="16rem" height="0.875rem" />
		</div>
	{:else}
		<div class="body">
			<div class="reading">
				{#if status}<span class="dot"><StatusDot meta={status} /></span>{/if}
				{#if loadError}
					<span class="headline">Couldn't load the security report</span>
				{:else if scan && state === 'vulnerable'}
					<span class="value">{scan.counts.total}</span>
					<span class="of"
						>{scan.counts.total === 1 ? 'vulnerability' : 'vulnerabilities'} · {scan.counts.fixable}
						fixable</span
					>
				{:else if state === 'scanning'}
					<span class="headline">{HEADLINES.scanning}</span>
					{#if scan?.progress}<span class="of">{scan.progress}%</span>{/if}
				{:else if key}
					<span class="headline">{HEADLINES[key] ?? HEADLINES.unreachable}</span>
				{/if}
			</div>

			{#if scan && hasResult}
				<SeverityBar counts={scan.counts} />
			{:else if state === 'scanning'}
				<Progress
					value={scan?.progress ?? null}
					size="sm"
					tone="neutral"
					label="Scan progress"
					labelHidden
				/>
			{:else if detail}
				<p class="detail">{detail}</p>
			{/if}

			{#if facts.length > 0}
				<div class="facts"><MetaList items={facts} /></div>
			{/if}
		</div>
	{/if}
</Widget>

<style>
	:global(.scan-summary) {
		min-width: 0;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}
	.reading {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
	}
	.dot {
		display: inline-flex;
		align-self: center;
		margin-right: 0.25rem;
	}
	.value {
		color: var(--text-default);
		font-size: var(--text-title-2);
		font-weight: var(--weight-semibold);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		line-height: 1;
	}
	.headline {
		overflow: hidden;
		color: var(--text-default);
		font-size: var(--text-headline);
		font-weight: var(--weight-medium);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.of {
		color: var(--text-muted);
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
	}
	.detail {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--text-callout);
	}
	.facts {
		padding-top: 1rem;
		box-shadow: inset 0 1px 0 var(--border-default);
	}
</style>

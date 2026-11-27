<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		Ellipsis,
		GitCommitHorizontal,
		Github,
		Globe,
		ImagePlus,
		Loader2,
		Pencil,
		Square,
		Trash2
	} from 'lucide-svelte';
	import { Play, RefreshCw } from '@jis3r/icons';
	import { motionStagger, springCollapse } from '$lib/utils/motion.svelte';
	import { formatRelativeTime } from '$lib/utils/format';
	import { ingressUrl } from '$lib/ingress-url';
	import { Badge, StatusBadge, Button, Menu, MenuItem, MenuSeparator } from '$lib/components/ui';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import type { StatusMeta } from '$lib/components/ui';
	import type { DotStep } from '$lib/components/ui/StatusDot.svelte';
	import { statusMeta } from '$lib/components/ui/status';
	import { headerVerdict } from './verdict';
	import { releaseLink } from './observe/permalink';
	import { page } from '$app/stores';

	let {
		deployment,
		headerCollapsed,
		deploymentStatusChip,
		buildStatusChip = null,
		deployChip = null,
		debugChips = [],
		repoUrl,
		rebuilding,
		restarting,
		stopped,
		stopping,
		starting,
		deleting,
		actionAnim,
		_isBuilding,
		onRebuild,
		onRestart,
		onStop,
		onStart,
		onRename,
		onChangePicture,
		uploadingPicture = false,
		onShowDeleteModal,
		onTriggerActionAnim,
		onViewBuildLogs,
		_commitLead,
		_commitLeadMono,
		_activeBuild,
		_buildFailed,
		branch,
		setup = undefined
	}: {
		deployment: any;
		headerCollapsed: boolean;
		deploymentStatusChip: StatusMeta;
		buildStatusChip?: StatusMeta | null;
		deployChip?: { meta: StatusMeta; tone?: 'deploy'; steps?: DotStep[] } | null;
		debugChips?: StatusMeta[];
		repoUrl: string | undefined;
		rebuilding: boolean;
		restarting: boolean;
		stopped: boolean;
		stopping: boolean;
		starting: boolean;
		deleting: boolean;
		actionAnim: Record<string, boolean>;
		_isBuilding: boolean;
		onRebuild: () => void;
		onRestart: () => void;
		onStop: () => void;
		onStart: () => void;
		onRename?: () => void;
		onChangePicture?: () => void;
		uploadingPicture?: boolean;
		onShowDeleteModal: () => void;
		onTriggerActionAnim: (id: string) => void;
		onViewBuildLogs: () => void;
		_commitLead: string | null;
		_commitLeadMono: boolean;
		_activeBuild: any;
		_buildFailed: boolean;
		branch: string | undefined;
		setup?: Snippet;
	} = $props();

	const pendingPush = $derived(deployment?.pendingPush ?? null);
	const heldPushes = $derived(
		pendingPush ? `${pendingPush.count} push${pendingPush.count === 1 ? '' : 'es'} since` : null
	);
	const heldPushTitle = $derived(
		pendingPush
			? `${pendingPush.sha.slice(0, 7)} on ${pendingPush.branch}${pendingPush.message ? `: ${pendingPush.message.split('\n')[0]}` : ''}`
			: undefined
	);

	const repoLabel = $derived(
		deployment?.githubRepo
			? deployment.githubRepo.replace('https://github.com/', '').replace(/\.git$/, '')
			: null
	);
	const commitUrl = $derived(
		deployment?.githubRepo && _activeBuild?.commitSha
			? `${deployment.githubRepo.replace(/\.git$/, '')}/commit/${_activeBuild.commitSha}`
			: null
	);
	const when = $derived(
		_activeBuild
			? `Deployed ${formatRelativeTime(new Date(_activeBuild.createdAt))}${
					_activeBuild.triggerType === 'manual' && _activeBuild.triggeredBy
						? ` by @${_activeBuild.triggeredBy.username}`
						: ''
				}`
			: null
	);
	const verdictChip = $derived.by(() => {
		const label = headerVerdict(deployment.latestVerdict, Date.now());
		return label ? statusMeta('warning', label) : null;
	});
	const verdictHref = $derived(
		verdictChip && deployment.latestVerdict?.imageHistoryId
			? releaseLink($page.url, deployment.latestVerdict.imageHistoryId)
			: null
	);
	const primaryDomain = $derived(deployment.ingresses?.[0] ?? null);
	const extraDomains = $derived(Math.max(0, (deployment.ingresses?.length ?? 0) - 1));
	const shortSha = $derived(_activeBuild?.commitSha ? _activeBuild.commitSha.slice(0, 7) : null);
	const sourceTitle = $derived(
		[repoLabel, _commitLead && repoLabel ? `“${_commitLead}”` : null].filter(Boolean).join('  ') ||
			'Source'
	);
</script>

{#snippet identity()}
	<div class="dh-identity">
		{#if deployment.icon}
			<img class="dh-app-icon" src={deployment.icon} alt="" />
		{/if}
		<h1 class="dh-name" title={deployment.displayName || deployment.name}>
			{deployment.displayName || deployment.name}
		</h1>
		<StatusBadge meta={deploymentStatusChip} />
		{#if stopped && heldPushes}
			<span class="dh-held-chip" title={heldPushTitle}>{heldPushes}</span>
		{/if}
		{#if buildStatusChip}
			<StatusBadge meta={buildStatusChip} />
		{/if}
		{#if deployChip}
			<StatusBadge meta={deployChip.meta} tone={deployChip.tone} steps={deployChip.steps} />
		{:else if verdictChip && verdictHref}
			<a class="dh-verdict" href={verdictHref} data-sveltekit-noscroll>
				<StatusBadge meta={verdictChip} />
			</a>
		{:else if verdictChip}
			<StatusBadge meta={verdictChip} />
		{/if}
		{#if deployment.environment}
			<Badge>{deployment.environment.name}</Badge>
		{/if}
		{#each debugChips as chip (chip.label)}
			<StatusBadge meta={chip} />
		{/each}
	</div>
{/snippet}

{#snippet actions()}
	<div class="dh-actions">
		{#if setup}{@render setup()}{/if}
		{#if stopped}
			<Button variant="primary" onclick={onStart} disabled={starting || _isBuilding}>
				{#if starting}<Loader2 size={16} class="animate-spin" />{:else}<Play size={16} />{/if}
				<span>{pendingPush ? 'Build and start' : 'Start'}</span>
			</Button>
		{:else}
			<Button
				variant="secondary"
				onclick={onRestart}
				disabled={restarting || stopping}
				onmouseenter={() => onTriggerActionAnim('restart')}
			>
				{#if restarting}<Loader2 size={16} class="animate-spin" />{:else}<Play
						size={16}
						animate={actionAnim.restart ?? false}
					/>{/if}
				<span>Restart</span>
			</Button>
			{#if repoUrl}
				<Button
					variant="primary"
					onclick={onRebuild}
					disabled={rebuilding || _isBuilding}
					onmouseenter={() => onTriggerActionAnim('redeploy')}
				>
					{#if rebuilding}<Loader2 size={16} class="animate-spin" />{:else}<RefreshCw
							size={16}
							animate={actionAnim.redeploy ?? false}
						/>{/if}
					<span>Redeploy</span>
				</Button>
			{/if}
		{/if}
		<Menu placement="bottom-end">
			{#snippet trigger(props)}
				<Button {...props} variant="ghost" icon={Ellipsis} label="More actions" />
			{/snippet}
			{#if stopped && repoUrl}
				<MenuItem icon={RefreshCw} disabled={rebuilding || _isBuilding} onclick={onRebuild}
					>Deploy and start</MenuItem
				>
			{/if}
			{#if !stopped}
				<MenuItem icon={Square} disabled={stopping || restarting} onclick={onStop}>Stop</MenuItem>
			{/if}
			{#if onRename}
				<MenuItem icon={Pencil} onclick={onRename}>Rename</MenuItem>
			{/if}
			{#if onChangePicture}
				<MenuItem icon={ImagePlus} disabled={uploadingPicture} onclick={onChangePicture}>
					{uploadingPicture
						? 'Uploading picture…'
						: deployment.icon
							? 'Change app picture'
							: 'Add app picture'}
				</MenuItem>
			{/if}
			<MenuSeparator />
			<MenuItem icon={Trash2} danger disabled={deleting} onclick={onShowDeleteModal}>
				Delete app
			</MenuItem>
		</Menu>
	</div>
{/snippet}

{#snippet facts()}
	<div class="dh-facts">
		{#if primaryDomain}
			<a
				class="dh-domain"
				href={ingressUrl(primaryDomain)}
				target="_blank"
				rel="noopener noreferrer"
			>
				<Globe size={14} aria-hidden="true" />
				<span class="dh-domain-host" title={primaryDomain.host}>{primaryDomain.host}</span>
			</a>
			{#if extraDomains}
				<Menu placement="bottom-start">
					{#snippet trigger(props)}
						<button
							{...props}
							type="button"
							class="dh-more-domains"
							aria-label="{extraDomains} more {extraDomains === 1 ? 'domain' : 'domains'}"
							>+{extraDomains}</button
						>
					{/snippet}
					{#each (deployment.ingresses ?? []).slice(1) as ingress (ingress.host + ingress.path)}
						<MenuItem
							icon={Globe}
							href={ingressUrl(ingress)}
							target="_blank"
							rel="noopener noreferrer">{ingress.host}</MenuItem
						>
					{/each}
				</Menu>
			{/if}
		{/if}
		{#if repoLabel || _commitLead}
			<Tooltip text={sourceTitle} delay={200}>
				<a
					class="dh-source"
					href={commitUrl ?? deployment.githubRepo?.replace(/\.git$/, '') ?? undefined}
					target="_blank"
					rel="noopener noreferrer"
				>
					{#if repoLabel}<Github size={14} aria-hidden="true" />{/if}
					{#if _activeBuild?.branch || branch}
						<span class="dh-mono dh-branch">{_activeBuild?.branch || branch}</span>
					{/if}
					{#if shortSha}
						<GitCommitHorizontal size={14} aria-hidden="true" />
						<span class="dh-mono">{shortSha}</span>
					{:else if _commitLead && !repoLabel}
						<span class="dh-mono dh-image" title={_commitLead}>{_commitLead}</span>
					{/if}
				</a>
			</Tooltip>
		{/if}
		{#if when}<span class="dh-when">{when}</span>{/if}
		{#if _buildFailed && (deployment.buildLogs || deployment.buildError)}
			<Button variant="ghost" size="sm" onclick={onViewBuildLogs}>View deployment logs</Button>
		{/if}
	</div>
{/snippet}

<section class="dh-card" {@attach motionStagger({ index: 0, from: { y: 14 } })}>
	<div class="dh-top">
		{@render identity()}
		{@render actions()}
	</div>
	<div class="dh-body" {@attach springCollapse(() => headerCollapsed)}>
		<div class="dh-body-inner">
			{@render facts()}
		</div>
	</div>
</section>

<style>
	.dh-card {
		--dh-control-inset: calc(var(--section-r, var(--radius-widget)) - 0.625rem);
		padding: var(--dh-control-inset) var(--dh-control-inset) 1.25rem 1.5rem;
		border-radius: calc(var(--section-r, var(--radius-widget)) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow: var(--shadow-raised);
	}
	.dh-facts {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
		min-width: 0;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
	}
	.dh-domain,
	.dh-source {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		max-width: 100%;
		text-decoration: none;
	}
	.dh-domain {
		color: var(--text-default);
		font-weight: var(--weight-medium);
	}
	.dh-domain :global(svg),
	.dh-source :global(svg) {
		flex-shrink: 0;
		color: var(--text-faint);
	}
	.dh-domain:hover .dh-domain-host {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.dh-domain-host {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
	}
	.dh-more-domains {
		padding: 0.125rem 0.375rem;
		margin-left: -0.25rem;
		border: none;
		border-radius: var(--radius-pill);
		background: none;
		color: var(--text-muted);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-weight: var(--weight-regular);
		cursor: pointer;
		transition: background-color var(--fade-in) var(--curve-out);
	}
	.dh-more-domains:hover,
	.dh-more-domains[aria-expanded='true'] {
		background: var(--bg-hover);
		color: var(--text-default);
	}
	.dh-source {
		color: var(--text-muted);
	}
	.dh-source:hover {
		color: var(--text-default);
	}
	.dh-mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
		text-box: trim-both cap alphabetic;
	}
	.dh-source .dh-mono + :global(svg) {
		margin-left: 0.375rem;
	}
	.dh-branch,
	.dh-image {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dh-image {
		max-width: 18rem;
	}
	.dh-when {
		color: var(--text-faint);
	}
	.dh-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3) var(--space-4);
		flex-wrap: wrap;
		min-width: 0;
	}
	.dh-identity {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
		min-width: 0;
		flex: 1 1 16rem;
	}
	.dh-name {
		font-size: var(--text-title-1);
		line-height: var(--lh-title-1);
		letter-spacing: var(--track-title);
		font-weight: 600;
		color: var(--text-default);
		margin: 0;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dh-app-icon {
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius-md);
		object-fit: cover;
		flex: none;
	}
	.dh-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}
	.dh-body {
		overflow: hidden;
	}
	.dh-body-inner {
		padding-top: 0.75rem;
	}
	@media (max-width: 640px) {
		.dh-card {
			padding: var(--space-4);
		}
		.dh-actions {
			width: 100%;
			justify-content: flex-start;
		}
	}
	.dh-verdict {
		display: inline-flex;
		border-radius: var(--radius-pill);
		color: inherit;
		text-decoration: none;
		transition: opacity var(--dur-fast) ease;
	}
	.dh-verdict:hover {
		opacity: 0.8;
	}
	.dh-held-chip {
		display: inline-flex;
		align-items: center;
		height: 1.375rem;
		padding: 0 0.5rem;
		border-radius: var(--radius-pill);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		cursor: default;
	}
</style>

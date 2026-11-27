<script lang="ts">
	import { Button, List, ListRow, Skeleton } from '$lib/components/ui';
	import Widget from '$lib/components/ui/Widget.svelte';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import SeverityMeter from '$lib/components/ui/SeverityMeter.svelte';
	import { statusMeta } from '$lib/components/ui/status';
	import { imageTag } from '../deployment-helpers';
	import type { PostureFinding, PostureKind } from './security-api';

	let { findings, failed = false }: { findings: PostureFinding[] | null; failed?: boolean } =
		$props();

	const COPY: Record<PostureKind, { title: string; action: string; href: string }> = {
		'plain-secret': {
			title: 'Secrets in plain variables',
			action: 'Variables',
			href: '?tab=variables'
		},
		'no-tls': { title: 'Served over plain HTTP', action: 'Network', href: '?tab=network' },
		'mutable-tag': {
			title: 'Image tag can change',
			action: 'Source',
			href: '?tab=settings&s=source'
		}
	};

	const clear = statusMeta('success', 'Nothing to flag');

	function subjectsOf(finding: PostureFinding) {
		if (finding.kind !== 'mutable-tag') return finding.subjects.join(', ');
		return finding.subjects.map((ref) => imageTag(ref) ?? 'latest').join(', ');
	}
</script>

{#snippet head()}{/snippet}

<Widget title="Configuration" meta={head} class="posture">
	{#if failed}
		<p class="failed">Couldn't load</p>
	{:else if findings === null}
		<div class="loading" aria-busy="true">
			<Skeleton width="70%" height="0.875rem" />
			<Skeleton width="45%" height="0.875rem" />
		</div>
	{:else if findings.length === 0}
		<div class="clear">
			<StatusDot meta={clear} />
			<span>{clear.label}</span>
		</div>
	{:else}
		<List inset={false} label="Configuration findings">
			{#each findings as finding (finding.kind)}
				{@const copy = COPY[finding.kind]}
				<ListRow title={copy.title} flush pinned>
					{#snippet subtitle()}<span class="subjects" title={finding.subjects.join(', ')}
							>{subjectsOf(finding)}</span
						>{/snippet}
					{#snippet leading()}<SeverityMeter severity={finding.severity} />{/snippet}
					{#snippet actions()}
						<Button variant="ghost" size="sm" href={copy.href}>{copy.action}</Button>
					{/snippet}
				</ListRow>
			{/each}
		</List>
	{/if}
</Widget>

<style>
	.loading {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.failed {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--text-callout);
	}
	.clear {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-muted);
		font-size: var(--text-callout);
	}
	.clear span {
		text-box: trim-both cap alphabetic;
	}
	.subjects {
		display: block;
		overflow: hidden;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(.posture [role='listitem']:first-child) {
		padding-top: 0;
	}
	:global(.posture [role='listitem']:last-child) {
		padding-bottom: 0;
	}
</style>

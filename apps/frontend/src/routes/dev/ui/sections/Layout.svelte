<script lang="ts">
	import { ArrowRight, Check, Folder, House, Plus, Settings, Users } from 'lucide-svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import StatusBadge from '$lib/components/ui/StatusBadge.svelte';
	import MiddleTruncate from '$lib/components/ui/MiddleTruncate.svelte';
	import { statusMeta } from '$lib/components/ui/status';
	import Verdict from './Verdict.svelte';

	const VERDICTS = ['do', 'dont'] as const;
	const STEPS = [0.5, 1, 2, 3, 4, 6, 8, 12, 16];

	let reticule = $state(true);

	const APPS = [
		{ name: 'hackclub-site', meta: statusMeta('success', 'Running') },
		{ name: 'arcade-leaderboard', meta: statusMeta('error', 'Crashing') },
		{ name: 'cdn', meta: statusMeta('progress', 'Building', true) }
	];

	const NAV = [
		{ label: 'Home', icon: House, state: '' },
		{ label: 'Projects', icon: Folder, state: 'selected' },
		{ label: 'Members', icon: Users, state: 'hover' },
		{ label: 'Settings', icon: Settings, state: '' }
	];

	const FOCUSABLE = ['hackclub-site', 'scrapbook', 'arcade-api', 'summer-of-making', 'cdn'];

	const ROWS = ['hackclub-site', 'scrapbook', 'arcade-api'];

	const LONG_NAME = 'hackclub-summer-of-making-production';
	const DIGEST = 'sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
</script>

{#snippet toast(variant: 'do' | 'dont')}
	<div class="toast toast--{variant}" class:toast--reticule={reticule}>
		<span class="glyph"><Check size={14} strokeWidth={2.5} /></span>
		<span class="toast-title">Deployed hackclub-site</span>
		<span class="toast-desc">Live at hackclub-site.orchard.my in 42s</span>
		{#if reticule}
			<span class="guide guide--v guide--icon" aria-hidden="true"
				><i>{variant === 'do' ? 12 : 8}</i></span
			>
			<span class="guide guide--v guide--text" aria-hidden="true"
				><i>{variant === 'do' ? 44 : 40}</i></span
			>
			<span class="guide guide--v guide--end" aria-hidden="true"></span>
			<span class="guide guide--h guide--top" aria-hidden="true"></span>
			<span class="guide guide--h guide--bottom" aria-hidden="true"></span>
		{/if}
	</div>
{/snippet}

<SectionCard
	title="Space"
	description="The 4px grid, these steps only. A container's padding is at least 1.5x the gap inside it, and groups sit about 2x apart."
>
	<div class="flex flex-col gap-6">
		<div class="steps">
			{#each STEPS as n (n)}
				<span class="step">
					<span class="step-bar" style:width="{n * 4}px"></span>
					<span class="text-caption text-fg tabular-nums rond-data">{n}</span>
					<span class="text-caption text-faint tabular-nums rond-data">{n * 4}px</span>
				</span>
			{/each}
		</div>
		<div class="grid grid-cols-2 gap-4">
			<Verdict kind="do" note="Padding 12, gap 8.">
				<div class="spaced" style:--pad="12px" style:--gap="8px">
					<span class="text-body text-fg">hackclub-site</span>
					<span class="text-callout text-muted">main · 4 minutes ago</span>
					<span class="text-callout text-muted">2 replicas</span>
				</div>
			</Verdict>
			<Verdict kind="dont" note="Padding 8, gap 12. The edge crowds the content.">
				<div class="spaced" style:--pad="8px" style:--gap="12px">
					<span class="text-body text-fg">hackclub-site</span>
					<span class="text-callout text-muted">main · 4 minutes ago</span>
					<span class="text-callout text-muted">2 replicas</span>
				</div>
			</Verdict>
		</div>
	</div>
</SectionCard>

<SectionCard
	title="Alignment grid"
	description="Lay it out on a grid before styling, then check it with a reticule. One padding all round, one shared text column, title first, sized to content."
>
	{#snippet actions()}
		<label class="flex items-center gap-2 text-callout text-muted">
			<Switch bind:checked={reticule} label="Reticule" />
			Reticule
		</label>
	{/snippet}
	<div class="flex flex-col gap-4">
		<div class="grid grid-cols-2 gap-4">
			<Verdict kind="do" note="Icon at 12, text at 44, 12 on every side.">
				{@render toast('do')}
			</Verdict>
			<Verdict kind="dont" note="Icon at 8, text at 40, uneven edges.">
				{@render toast('dont')}
			</Verdict>
		</div>
		<div class="grid grid-cols-2 gap-4">
			<Verdict kind="do" note="Status shares a fixed, left-aligned column." align="stretch">
				<div class="apps">
					{#each APPS as a (a.name)}
						<div class="app app--grid">
							<span class="min-w-0 truncate text-body text-fg">{a.name}</span>
							<StatusBadge variant="plain" meta={a.meta} />
						</div>
					{/each}
				</div>
			</Verdict>
			<Verdict kind="dont" note="Status trails the name, so nothing lines up." align="stretch">
				<div class="apps">
					{#each APPS as a (a.name)}
						<div class="app">
							<span class="text-body text-fg">{a.name}</span>
							<StatusBadge variant="plain" meta={a.meta} />
						</div>
					{/each}
				</div>
			</Verdict>
		</div>
	</div>
</SectionCard>

<div class="grid grid-cols-2 gap-6">
	<SectionCard
		title="Highlights never touch"
		description="Where one row can be selected while another is hovered, keep 0.25rem between rows."
	>
		<div class="grid grid-cols-2 gap-4">
			{#each VERDICTS as v (v)}
				<Verdict
					kind={v}
					note={v === 'do' ? '0.25rem apart.' : 'Touching fills read as one blob.'}
					align="stretch"
				>
					<nav class="nav" class:nav--tight={v === 'dont'} aria-label="Example navigation">
						{#each NAV as item (item.label)}
							{@const Icon = item.icon}
							<a
								href="#layout"
								class="nav-row"
								class:nav-row--selected={item.state === 'selected'}
								class:nav-row--hover={item.state === 'hover'}
								onclick={(e) => e.preventDefault()}
							>
								<Icon size={16} strokeWidth={1.75} />
								<span>{item.label}</span>
							</a>
						{/each}
					</nav>
				</Verdict>
			{/each}
		</div>
	</SectionCard>

	<SectionCard
		title="Focus rings sit inside"
		description="Inside anything that scrolls or clips, the ring is inset by 2px so the container never cuts it."
	>
		<div class="grid grid-cols-2 gap-4">
			{#each VERDICTS as v (v)}
				<Verdict
					kind={v}
					note={v === 'do' ? 'outline-offset: -2px' : 'Outset rings get clipped.'}
					align="stretch"
				>
					<div class="scroller" class:scroller--outset={v === 'dont'}>
						{#each FOCUSABLE as name, i (name)}
							<button type="button" class="focus-row" class:focus-row--shown={i === 0}
								>{name}</button
							>
						{/each}
					</div>
				</Verdict>
			{/each}
		</div>
	</SectionCard>
</div>

<div class="grid grid-cols-2 gap-6">
	<SectionCard
		title="Hover-revealed actions"
		description="Per-row actions show on :hover and :has(:focus-visible), never :focus-within. Click one in each and move away."
	>
		<div class="grid grid-cols-2 gap-4">
			{#each VERDICTS as v (v)}
				<Verdict
					kind={v}
					note={v === 'do'
						? 'Gone when the pointer leaves.'
						: ':focus-within keeps them stuck after a click.'}
					align="stretch"
				>
					<div class="hrows">
						{#each ROWS as name, i (name)}
							<div
								class="hrow"
								class:hrow--sticky={v === 'dont'}
								class:hrow--pointer={v === 'do' && i === 0}
								class:hrow--stuck={v === 'dont' && i === 2}
							>
								<span class="min-w-0 truncate text-body text-fg">{name}</span>
								<span class="acts">
									<Button size="sm" variant="ghost" icon={Plus} label="Add to {name}" />
									<Button size="sm" variant="ghost" icon={ArrowRight} label="Open {name}" />
								</span>
							</div>
						{/each}
					</div>
				</Verdict>
			{/each}
		</div>
	</SectionCard>

	<SectionCard
		title="Truncation"
		description="Names and URLs cut at the end. Only hashes, IDs and paths cut in the middle, where the end tells two apart."
	>
		<div class="grid grid-cols-2 gap-4">
			<Verdict kind="do" note="Names lose the end, digests keep it." align="stretch">
				<div class="flex min-w-0 flex-col gap-2">
					<span class="truncate text-body text-fg">{LONG_NAME}</span>
					<span class="text-callout text-muted"><MiddleTruncate text={DIGEST} mono tail={8} /></span
					>
				</div>
			</Verdict>
			<Verdict kind="dont" note="Digests lose the part that differs." align="stretch">
				<div class="flex min-w-0 flex-col gap-2">
					<span class="text-body text-fg"><MiddleTruncate text={LONG_NAME} tail={8} /></span>
					<span class="truncate type-ident text-callout text-muted">{DIGEST}</span>
				</div>
			</Verdict>
		</div>
	</SectionCard>
</div>

<style>
	.steps {
		display: flex;
		align-items: flex-end;
		gap: 1.5rem;
	}
	.step {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.375rem;
	}
	.step-bar {
		display: block;
		height: 1.5rem;
		min-width: 2px;
		border-radius: 2px;
		background: var(--accent-5);
	}
	.spaced {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		width: 13rem;
		padding: var(--pad);
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow: var(--shadow-raised);
	}

	.toast {
		position: relative;
		display: grid;
		grid-template-columns: 1.5rem max-content;
		align-items: center;
		column-gap: 0.5rem;
		row-gap: 0.125rem;
		padding: 0.75rem;
		border-radius: 1.25rem;
		background: var(--toast-fill);
		--tone: var(--toast-success);
	}
	.toast--dont {
		padding: 0.5rem 1rem 0.875rem 0.5rem;
		row-gap: 0.75rem;
	}
	.glyph {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: color-mix(in oklab, var(--tone) 22%, transparent);
		color: var(--tone);
	}
	.toast-title {
		color: var(--tone);
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
		line-height: 1rem;
		text-box: trim-both cap alphabetic;
	}
	.toast-desc {
		grid-column: 2;
		color: var(--toast-muted);
		font-size: var(--text-callout);
		line-height: 1.125rem;
	}
	.guide {
		position: absolute;
		pointer-events: none;
		--guide: color-mix(in oklab, var(--accent-7) 80%, transparent);
	}
	.guide--v {
		top: -0.75rem;
		bottom: -0.75rem;
		width: 0;
		border-left: 1px dashed var(--guide);
	}
	.guide--h {
		left: -0.75rem;
		right: -0.75rem;
		height: 0;
		border-top: 1px dashed var(--guide);
	}
	.guide i {
		position: absolute;
		top: -1.125rem;
		left: 0;
		transform: translateX(-50%);
		color: var(--accent-9);
		font-size: var(--text-micro);
		font-style: normal;
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.toast--do .guide--icon {
		left: 12px;
	}
	.toast--do .guide--text {
		left: 44px;
	}
	.toast--do .guide--end {
		right: 12px;
	}
	.toast--do .guide--top {
		top: 12px;
	}
	.toast--do .guide--bottom {
		bottom: 12px;
	}
	.toast--dont .guide--icon {
		left: 8px;
	}
	.toast--dont .guide--text {
		left: 40px;
	}
	.toast--dont .guide--end {
		right: 16px;
	}
	.toast--dont .guide--top {
		top: 8px;
	}
	.toast--dont .guide--bottom {
		bottom: 14px;
	}

	.apps {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.app {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.app--grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 6rem;
	}

	.nav {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.nav--tight {
		gap: 0;
	}
	.nav-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		height: 2.25rem;
		padding: 0 0.625rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		color: var(--text-muted);
		font-size: var(--text-body);
		text-decoration: none;
		transition: background-color var(--fade-in) var(--curve-out);
	}
	.nav-row:hover,
	.nav-row--hover {
		background: var(--bg-active);
		color: var(--text-default);
	}
	.nav-row--selected,
	.nav-row--selected:hover {
		background: var(--nav-active-bg);
		color: var(--nav-active-fg);
		box-shadow: var(--nav-active-shadow);
	}

	.scroller {
		display: flex;
		flex-direction: column;
		height: 8.5rem;
		overflow: auto;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow: var(--shadow-raised);
	}
	.focus-row {
		flex-shrink: 0;
		height: 2.25rem;
		padding: 0 0.75rem;
		border: none;
		background: none;
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-body);
		text-align: left;
		cursor: pointer;
	}
	.focus-row:focus-visible,
	.focus-row--shown {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: -2px;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
	}
	.scroller--outset .focus-row:focus-visible,
	.scroller--outset .focus-row--shown {
		outline-offset: 2px;
	}

	.hrows {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.hrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		height: 2.25rem;
		padding: 0 0.25rem 0 0.75rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		transition: background-color var(--fade-in) var(--curve-out);
	}
	.hrow:hover,
	.hrow--pointer {
		background: var(--bg-hover);
	}
	.acts {
		display: flex;
		gap: 0.125rem;
		opacity: 0;
		transition: opacity var(--fade-out) var(--curve-in);
	}
	.hrow--pointer .acts,
	.hrow--stuck .acts,
	.hrow:not(.hrow--sticky):is(:hover, :has(:focus-visible)) .acts,
	.hrow--sticky:is(:hover, :focus-within) .acts {
		opacity: 1;
		transition: opacity var(--fade-in) var(--curve-out);
	}
</style>

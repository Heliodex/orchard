<script lang="ts">
	import RelativeTime from '$lib/components/ui/RelativeTime.svelte';
	import AppIcon from '$lib/components/ui/AppIcon.svelte';
	import Widget from '$lib/components/ui/Widget.svelte';
	import NumberRoll from '$lib/components/ui/NumberRoll.svelte';
	import { blurRiseList, glideX, sweepIn } from '$lib/components/ui/widgetMotion.svelte';
	import type { BuildItem, BuildPhaseItem } from './builds';

	let {
		builds,
		title = 'Recent builds'
	}: {
		builds: BuildItem[];
		title?: string;
	} = $props();

	const featured = $derived(builds[0]);
	const rest = $derived(builds.slice(1, 4));
	const live = $derived(featured?.status.kind === 'progress');

	let now = $state(Date.now());
	let mountedAt = Date.now();

	$effect(() => {
		if (!live) return;
		mountedAt = Date.now();
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	const phases = $derived.by((): BuildPhaseItem[] => {
		const list = featured?.phases ?? [];
		const extra = live ? Math.max(0, now - mountedAt) : 0;
		return list.map((p) => (p.live ? { ...p, ms: p.ms + extra } : p));
	});
	const total = $derived(phases.reduce((sum, p) => sum + p.ms, 0));
	const current = $derived(phases.find((p) => p.live) ?? phases[phases.length - 1]);

	const rise = blurRiseList();
	const segs: Record<string, HTMLElement> = $state({});
	let caret = $state<HTMLElement>();
	let hovered = $state<string | null>(null);
	let caretShown = false;
	const focused = $derived(phases.find((p) => p.id === hovered));
	const breakdown = $derived(phases.map((p) => `${p.label} ${clock(p.ms)}`).join(', '));

	function pick(e: PointerEvent) {
		let best: string | null = null;
		let gap = Infinity;
		for (const p of phases) {
			const r = segs[p.id]?.getBoundingClientRect();
			if (!r) continue;
			const d = e.clientX < r.left ? r.left - e.clientX : Math.max(0, e.clientX - r.right);
			if (d < gap) {
				gap = d;
				best = p.id;
			}
		}
		hovered = best;
	}

	function hoverTrack(el: HTMLElement) {
		const leave = () => (hovered = null);
		el.addEventListener('pointermove', pick);
		el.addEventListener('pointerleave', leave);
		return () => {
			el.removeEventListener('pointermove', pick);
			el.removeEventListener('pointerleave', leave);
		};
	}

	$effect(() => {
		const seg = focused && segs[focused.id];
		if (!caret) return;
		if (!seg) {
			caret.style.opacity = '0';
			caretShown = false;
			return;
		}
		void total;
		glideX(caret, seg.offsetLeft + seg.offsetWidth / 2, !caretShown);
		caret.style.opacity = '1';
		caretShown = true;
	});

	function clock(ms: number) {
		const s = Math.floor(ms / 1000);
		if (s < 60) return `${s}s`;
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}
</script>

<Widget {title} meta="Today">
	{#if featured}
		<a class="live live--{featured.status.kind}" href={featured.href}>
			<span class="live-top">
				<AppIcon
					name={featured.project ?? featured.app}
					kind="project"
					icon={featured.projectIcon}
					size="md"
				/>
				<span class="live-text">
					<span class="live-app" title={featured.app}>{featured.app}</span>
					<span class="live-state">
						{#if live && current}
							<span class="phase-dot phase--{current.id}"></span>
							<span>{current.label}</span>
						{:else}
							<span>{featured.status.label}</span>
						{/if}
						{#if featured.project}<span class="faint project" title={featured.project}
								>· {featured.project}</span
							>{/if}
					</span>
				</span>
				{#if total}
					<span class="elapsed"><NumberRoll value={clock(total)} /></span>
				{:else if featured.duration}
					<span class="elapsed">{featured.duration}</span>
				{/if}
			</span>
			{#if phases.length > 1 && total > 0}
				<span class="phase-track" {@attach hoverTrack}>
					<span
						class="phases"
						class:phases--focus={!!focused}
						role="img"
						aria-label="Where the time went: {breakdown}"
						{@attach sweepIn}
					>
						{#each phases as p (p.id)}
							<span
								bind:this={segs[p.id]}
								class="seg phase--{p.id}"
								class:seg--live={p.live}
								class:seg--on={p.id === hovered}
								style:flex-grow={Math.max(p.ms, total * 0.03)}
							></span>
						{/each}
					</span>
					<span class="caret" aria-hidden="true" bind:this={caret}></span>
				</span>
			{/if}
			<span class="live-foot">
				<span class="live-msg" title={focused ? undefined : featured.message}
					>{#if focused}{focused.label} · {clock(
							focused.ms
						)}{:else if featured.branch}{featured.message}
						· {featured.branch}{:else}{featured.message}{/if}</span
				>
				{#if live && featured.eta}<span class="live-eta">{featured.eta}</span>{/if}
			</span>
		</a>
	{/if}
	<div class="list">
		{#each rest as b (b.id)}
			<a class="row" href={b.href} {@attach rise()}>
				<span class="row-icon"
					><AppIcon name={b.project ?? b.app} kind="project" icon={b.projectIcon} size="sm" /></span
				>
				<span class="row-app" title={b.app}>{b.app}</span>
				<span
					class="row-msg"
					class:row-msg--error={b.status.kind === 'error'}
					title={b.status.kind === 'error' ? undefined : b.message}
					>{b.status.kind === 'error' ? 'Failed' : b.message}</span
				>
				<span class="row-when"><RelativeTime date={b.at} /></span>
			</a>
		{/each}
	</div>
</Widget>

<style>
	.live {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		color: inherit;
		text-decoration: none;
	}
	.live-top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.live-text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}
	.live-app,
	.live-msg {
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
	.live-app {
		font-size: var(--text-headline);
		font-weight: var(--weight-medium);
		letter-spacing: -0.01em;
	}
	.live-state {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		overflow-x: clip;
		white-space: nowrap;
		color: var(--text-muted);
		font-size: var(--text-callout);
	}
	.live-state > :global(*) {
		text-box: trim-both cap alphabetic;
	}
	.live--error .live-state {
		color: var(--red-9);
	}
	.faint {
		color: var(--text-faint);
	}
	.project {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
	}
	.elapsed {
		flex-shrink: 0;
		color: var(--text-muted);
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-box: trim-both cap alphabetic;
	}
	.phase-track {
		position: relative;
		display: block;
		padding-block: 0.5rem;
		margin-block: -0.5rem;
	}
	.phases {
		display: flex;
		gap: 2px;
		height: 0.375rem;
	}
	.seg {
		flex-basis: 0;
		min-width: 3px;
		border-radius: var(--radius-pill);
		background: var(--phase);
		transform-origin: left center;
		transition: background-color var(--dur-fast) ease;
	}
	.phases--focus .seg:not(.seg--on) {
		background: color-mix(in oklab, var(--phase), var(--bg-surface) 38%);
	}
	.caret {
		position: absolute;
		top: calc(0.5rem + 0.375rem + 3px);
		left: -3px;
		width: 6px;
		height: 3px;
		border-radius: var(--radius-pill);
		background: var(--text-muted);
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--fade-in) var(--curve-out);
	}
	.seg--live {
		animation: seg-breathe 1.6s ease-in-out infinite;
	}
	@keyframes seg-breathe {
		50% {
			opacity: 0.55;
		}
	}
	.phase-dot {
		width: 6px;
		height: 6px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--phase);
	}
	.phase--queue {
		--phase: var(--neutral-5);
	}
	.phase--schedule {
		--phase: var(--amber-5);
	}
	.phase--start {
		--phase: var(--amber-7);
	}
	.phase--clone {
		--phase: var(--hue-violet, var(--blue-5));
	}
	.phase--build {
		--phase: var(--blue-7);
	}
	.phase--push {
		--phase: var(--green-7);
	}
	.phase--rollout {
		--phase: var(--green-5);
	}
	.live-foot {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: -0.25rem;
	}
	.live-msg {
		min-width: 0;
		color: var(--text-muted);
		font-size: var(--text-caption);
	}
	.live-eta {
		flex-shrink: 0;
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.list {
		display: flex;
		flex-direction: column;
		margin-bottom: -0.25rem;
		padding-top: 0.625rem;
		box-shadow: inset 0 0.5px 0 var(--border-strong);
	}
	.row {
		display: grid;
		grid-template-columns: 2.25rem fit-content(45%) minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.5rem;
		height: 2rem;
		color: inherit;
		font-size: var(--text-callout);
		text-decoration: none;
	}
	.row-icon {
		display: flex;
		justify-content: center;
	}
	.row-app {
		min-width: 0;
		margin-left: 0.25rem;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row-msg {
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-muted);
	}
	.row-msg--error {
		color: var(--red-9);
	}
	.row-when {
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
</style>

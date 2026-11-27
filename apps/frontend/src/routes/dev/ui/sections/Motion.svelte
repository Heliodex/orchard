<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Play } from 'lucide-svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import Table, { type TableColumn } from '$lib/components/ui/Table.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import StatusBadge from '$lib/components/ui/StatusBadge.svelte';
	import { statusMeta, type StatusMeta } from '$lib/components/ui/status';
	import {
		CURVES,
		FADE,
		exitSpec,
		sampleSpring,
		setTempo,
		tempo,
		type CurveName,
		type SpringSpec
	} from '$lib/design/springs';
	import { decorativeMotion, fade, pace, springTiming, stateEcho } from '$lib/utils/motion.svelte';
	import { effectiveAnimation } from '$lib/stores/preferences';
	import Verdict from './Verdict.svelte';
	import MotionRule from './MotionRule.svelte';
	import { curvePath, fadeTo, slide } from './system';

	const USE: Record<CurveName, string> = {
		snap: 'Opens and expands',
		pop: 'Things appearing',
		settle: 'Closes and exits',
		glide: 'Highlights and moves',
		press: 'Press feedback',
		morph: 'Shape morphs',
		bouncy: 'Rare celebrations',
		cinematic: 'Seen-once choreography'
	};

	type Row = { name: CurveName } & SpringSpec;
	const ROWS: Row[] = (Object.keys(CURVES) as CurveName[]).map((name) => ({
		name,
		...CURVES[name]
	}));

	const columns: TableColumn<Row>[] = [
		{ id: 'name', label: 'Curve', width: '6rem' },
		{ id: 'response', label: 'Response', numeric: true },
		{ id: 'damping', label: 'Damping', numeric: true },
		{ id: 'settles', label: 'Settles', numeric: true },
		{ id: 'shape', label: 'Shape', width: '5rem' },
		{ id: 'use', label: 'Use for', width: '13.5rem' },
		{ id: 'track', label: 'Preview', width: 'minmax(10rem, 1fr)' },
		{ id: 'play', width: 'max-content', align: 'end' }
	];

	const initialTempo = tempo();
	let tempoValue = $state(initialTempo);
	onDestroy(() => setTempo(initialTempo));

	const level = $derived($effectiveAnimation);

	function settles(spec: SpringSpec) {
		return sampleSpring(spec, 1000 / 120, tempoValue).durationMs;
	}

	const SHAPE_W = 64;
	const SHAPE_H = 24;
	function shape(spec: SpringSpec) {
		return curvePath(sampleSpring(spec, 1000 / 120, 1).points, SHAPE_W, SHAPE_H);
	}

	const tracks: Record<string, HTMLElement> = {};
	const chips: Record<string, HTMLElement> = {};
	const at: Record<string, boolean> = {};

	function travel(track: HTMLElement, chip: HTMLElement) {
		return track.clientWidth - chip.offsetWidth - 8;
	}

	function play(name: CurveName) {
		const track = tracks[name];
		const chip = chips[name];
		if (!track || !chip) return;
		at[name] = !at[name];
		slide(chip, at[name] ? travel(track, chip) : 0, springTiming(name));
	}

	function playAll() {
		for (const r of ROWS) play(r.name);
	}

	let shortTrack = $state<HTMLElement>();
	let longTrack = $state<HTMLElement>();
	let flatShort = $state<HTMLElement>();
	let flatLong = $state<HTMLElement>();
	let shortW = $state(0);
	let longW = $state(0);
	let paced = false;

	const shortDistance = $derived(Math.max(0, shortW - 28));
	const longDistance = $derived(Math.max(0, longW - 28));
	const pacing = $derived.by(() => {
		void tempoValue;
		void level;
		return {
			short: pace(shortDistance),
			long: pace(longDistance),
			shortMs: Number(springTiming('glide', { distance: shortDistance }).duration),
			longMs: Number(springTiming('glide', { distance: longDistance }).duration),
			flatMs: Number(springTiming('glide').duration)
		};
	});

	function playPacing() {
		paced = !paced;
		const pairs: [HTMLElement | undefined, number, boolean][] = [
			[shortTrack, shortDistance, true],
			[longTrack, longDistance, true],
			[flatShort, shortDistance, false],
			[flatLong, longDistance, false]
		];
		for (const [track, distance, withPace] of pairs) {
			const chip = track?.firstElementChild as HTMLElement | null;
			if (!chip) continue;
			slide(chip, paced ? distance : 0, springTiming('glide', withPace ? { distance } : {}));
		}
	}

	let bubble = $state<HTMLElement>();
	let swapA = $state<HTMLElement>();
	let swapB = $state<HTMLElement>();
	let faded = $state(false);

	function toggleFades() {
		faded = !faded;
		if (bubble) fadeTo(bubble, faded ? 0 : 1, fade(faded ? 'out' : 'in'));
		if (swapA) fadeTo(swapA, faded ? 0 : 1, fade('long'));
		if (swapB) fadeTo(swapB, faded ? 1 : 0, fade('long'));
	}

	let panel = $state<HTMLElement>();
	let open = $state(true);

	function scaleOf(el: HTMLElement) {
		const t = getComputedStyle(el).transform;
		return !t || t === 'none' ? 1 : new DOMMatrixReadOnly(t).a;
	}

	function togglePanel() {
		if (!panel) return;
		open = !open;
		const from = scaleOf(panel);
		const opacity = Number(getComputedStyle(panel).opacity);
		for (const a of panel.getAnimations()) a.cancel();
		const timing = springTiming('snap', { exit: !open });
		if (decorativeMotion()) {
			panel.animate([{ transform: `scale(${from})` }, { transform: `scale(${open ? 1 : 0.9})` }], {
				...timing,
				fill: 'forwards'
			});
			panel.animate([{ opacity }, { opacity: open ? 1 : 0 }], {
				...fade(open ? 'in' : 'out'),
				fill: 'forwards'
			});
		} else {
			panel.animate([{ opacity }, { opacity: open ? 1 : 0 }], { ...timing, fill: 'forwards' });
		}
	}

	const openPath = curvePath(sampleSpring(CURVES.snap, 1000 / 120, 1).points, 120, 40);
	const exitPath = curvePath(sampleSpring(exitSpec(CURVES.snap), 1000 / 120, 1).points, 120, 40);

	const STATES: Record<string, StatusMeta> = {
		ready: statusMeta('success', 'Ready'),
		building: statusMeta('progress', 'Building', true),
		crashing: statusMeta('error', 'Crashing')
	};
	let reality = $state('ready');
	const realityMeta = $derived(STATES[reality]);

	function lateArrival(el: HTMLElement) {
		el.animate(
			[
				{ opacity: 0, transform: 'scale(0.4)' },
				{ opacity: 1, transform: 'scale(1)' }
			],
			{ ...springTiming('bouncy', { delay: 0.2 }), fill: 'backwards' }
		);
	}

	const TIERS = [
		{
			id: 'full',
			name: 'Full',
			detail: 'The named spring. Transforms move.'
		},
		{
			id: 'reduced',
			name: 'Reduced',
			detail:
				'A 260ms cross-fade. Transforms and stagger are stripped. Never faster than full, because a fast snap is the abrupt change people opted out of.'
		},
		{
			id: 'off',
			name: 'Off',
			detail: 'Nothing animates. Progress spinners keep turning at every tier.'
		}
	];

	const RAW = `transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
animate(el, kf, { stiffness: 400, damping: 30 });`;

	const NAMED = `transition: transform var(--spring-glide-duration) var(--spring-glide);
el.animate(kf, springTiming('snap'));`;
</script>

<SectionCard
	title="One curve table"
	description="Each curve is a response and a damping ratio. Tempo scales every one of them at once, here and across the app."
>
	{#snippet actions()}
		<div class="flex items-center gap-3">
			<span class="text-callout text-muted">Tempo</span>
			<div class="w-36">
				<Slider
					label="Tempo"
					bind:value={tempoValue}
					min={0.25}
					max={3}
					step={0.25}
					onchange={(v) => setTempo(v)}
				/>
			</div>
			<span class="w-10 text-callout text-fg tabular-nums rond-data">{tempoValue.toFixed(2)}x</span>
			<Button size="sm" icon={Play} onclick={playAll}>Play all</Button>
		</div>
	{/snippet}
	<Table {columns} rows={ROWS} rowKey={(r) => r.name} inset={false} label="Orchard curves">
		{#snippet cell(r, col)}
			{#if col.id === 'name'}
				<span class="font-mono text-callout text-fg">{r.name}</span>
			{:else if col.id === 'response'}
				<span class="text-muted">{r.response}</span>
			{:else if col.id === 'damping'}
				<span class="text-muted">{r.damping}</span>
			{:else if col.id === 'settles'}
				<span class="text-fg">{settles(r)} <span class="text-faint">ms</span></span>
			{:else if col.id === 'shape'}
				<svg
					class="shape"
					width={SHAPE_W}
					height={SHAPE_H}
					viewBox="0 0 {SHAPE_W} {SHAPE_H}"
					aria-hidden="true"
				>
					<line
						x1="0"
						x2={SHAPE_W}
						y1={SHAPE_H - SHAPE_H / 1.3}
						y2={SHAPE_H - SHAPE_H / 1.3}
						class="shape-target"
					/>
					<path d={shape(r)} class="shape-line" />
				</svg>
			{:else if col.id === 'use'}
				<span class="text-muted">{USE[r.name]}</span>
			{:else if col.id === 'track'}
				<span
					class="track"
					{@attach (el) => {
						tracks[r.name] = el;
					}}
				>
					<span
						class="chip"
						{@attach (el) => {
							chips[r.name] = el;
						}}
					></span>
				</span>
			{:else if col.id === 'play'}
				<Button
					size="sm"
					variant="ghost"
					icon={Play}
					label="Play {r.name}"
					onclick={() => play(r.name)}
				/>
			{/if}
		{/snippet}
	</Table>
</SectionCard>

<div class="grid grid-cols-2 gap-6">
	<SectionCard
		title="Distance sets the pace"
		description="Pass the distance and the curve stretches by the square root of it, so short and long moves read as the same speed."
	>
		{#snippet actions()}
			<Button size="sm" icon={Play} onclick={playPacing}>Play</Button>
		{/snippet}
		<div class="flex flex-col gap-4">
			<Verdict kind="do" note="Paced. Both arrive at a similar speed." align="stretch">
				<div class="flex flex-col gap-3">
					<div class="pace-row">
						<span class="track track--short" bind:this={shortTrack} bind:clientWidth={shortW}>
							<span class="chip"></span>
						</span>
						<span class="readout">{pacing.short.toFixed(2)}x · {pacing.shortMs} ms</span>
					</div>
					<div class="pace-row">
						<span class="track" bind:this={longTrack} bind:clientWidth={longW}>
							<span class="chip"></span>
						</span>
						<span class="readout">{pacing.long.toFixed(2)}x · {pacing.longMs} ms</span>
					</div>
				</div>
			</Verdict>
			<Verdict kind="dont" note="One duration. The long move flies." align="stretch">
				<div class="flex flex-col gap-3">
					<div class="pace-row">
						<span class="track track--short" bind:this={flatShort}><span class="chip"></span></span>
						<span class="readout">{pacing.flatMs} ms</span>
					</div>
					<div class="pace-row">
						<span class="track" bind:this={flatLong}><span class="chip"></span></span>
						<span class="readout">{pacing.flatMs} ms</span>
					</div>
				</div>
			</Verdict>
		</div>
	</SectionCard>

	<div class="flex flex-col gap-6">
		<SectionCard
			title="Fades"
			description="Opacity runs on its own short clock. In is quick, out is a touch slower, swaps take the long one."
		>
			{#snippet actions()}
				<Button size="sm" onclick={toggleFades}>{faded ? 'Fade in' : 'Fade out'}</Button>
			{/snippet}
			<div class="grid grid-cols-2 gap-4">
				<div class="fade-stage">
					<span class="bubble" bind:this={bubble}>Copied</span>
					<span class="readout">
						in {Math.round(FADE.in * tempoValue)} · out {Math.round(FADE.out * tempoValue)} ms
					</span>
				</div>
				<div class="fade-stage">
					<span class="swap">
						<span class="swap-face" bind:this={swapA}>Building</span>
						<span class="swap-face swap-face--b" bind:this={swapB}>Deployed</span>
					</span>
					<span class="readout">long {Math.round(FADE.long * tempoValue)} ms</span>
				</div>
			</div>
		</SectionCard>

		<SectionCard
			title="Exits settle"
			description="Closing uses the exit variant of the same curve: 0.8x the response, damping clamped to 1. It never bounces on the way out."
		>
			{#snippet actions()}
				<Button size="sm" onclick={togglePanel}>{open ? 'Close' : 'Open'}</Button>
			{/snippet}
			<div class="grid grid-cols-[1fr_auto] items-center gap-6">
				<div class="exit-stage">
					<div class="mini-panel" bind:this={panel}>
						<span class="mini-line mini-line--wide"></span>
						<span class="mini-line"></span>
						<span class="mini-line"></span>
					</div>
				</div>
				<div class="flex flex-col gap-3">
					<div class="flex flex-col gap-1">
						<svg width="120" height="40" viewBox="0 0 120 40" class="shape" aria-hidden="true">
							<line x1="0" x2="120" y1={40 - 40 / 1.3} y2={40 - 40 / 1.3} class="shape-target" />
							<path d={openPath} class="shape-line" />
						</svg>
						<span class="readout">snap, opening</span>
					</div>
					<div class="flex flex-col gap-1">
						<svg width="120" height="40" viewBox="0 0 120 40" class="shape" aria-hidden="true">
							<line x1="0" x2="120" y1={40 - 40 / 1.3} y2={40 - 40 / 1.3} class="shape-target" />
							<path d={exitPath} class="shape-line" />
						</svg>
						<span class="readout">snap exit, closing</span>
					</div>
				</div>
			</div>
		</SectionCard>
	</div>
</div>

<SectionCard
	title="Reality arrives instantly"
	description="Cluster state already happened. Show it at once and animate only the trail it leaves. Named springs are for changes the user caused."
>
	{#snippet actions()}
		<SegmentedControl
			size="sm"
			label="Deployment state"
			bind:value={reality}
			options={[
				{ value: 'ready', label: 'Ready' },
				{ value: 'building', label: 'Building' },
				{ value: 'crashing', label: 'Crashing' }
			]}
		/>
	{/snippet}
	<div class="grid grid-cols-2 gap-4">
		<Verdict kind="do" note="The status lands now; a decaying ring marks what changed.">
			<div class="entity motion-echo echo--{realityMeta.kind}" {@attach stateEcho(() => reality)}>
				<span class="text-body text-fg">hackclub-site</span>
				<StatusBadge variant="plain" meta={realityMeta} />
			</div>
		</Verdict>
		<Verdict kind="dont" note="Springing the status in adds latency to news.">
			<div class="entity">
				<span class="text-body text-fg">hackclub-site</span>
				{#key reality}
					<span class="inline-flex" {@attach lateArrival}>
						<StatusBadge variant="plain" meta={realityMeta} />
					</span>
				{/key}
			</div>
		</Verdict>
	</div>
</SectionCard>

<MotionRule />

<div class="grid grid-cols-2 gap-6">
	<SectionCard
		title="Reduced motion"
		description="Every animation resolves through the user's level. Flip it in the bar at the bottom and play a curve."
	>
		<ul class="tiers">
			{#each TIERS as t (t.id)}
				<li class="tier" class:tier--on={level === t.id}>
					<span class="flex items-center gap-2">
						<span class="text-body font-medium text-fg">{t.name}</span>
						{#if level === t.id}<span class="text-caption text-muted">Active</span>{/if}
					</span>
					<span class="text-callout text-muted">{t.detail}</span>
				</li>
			{/each}
		</ul>
	</SectionCard>

	<SectionCard
		title="Name a curve"
		description="Never write cubic-bezier, milliseconds, stiffness or damping for interaction motion in a component."
	>
		<div class="flex flex-col gap-4">
			<Verdict kind="do" note="Tokens and helpers." align="stretch" compact>
				<pre class="code">{NAMED}</pre>
			</Verdict>
			<Verdict kind="dont" note="Raw numbers drift." align="stretch" compact>
				<pre class="code">{RAW}</pre>
			</Verdict>
		</div>
	</SectionCard>
</div>

<style>
	.shape {
		display: block;
		overflow: visible;
	}
	.shape-line {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.shape-target {
		stroke: var(--rule-strong);
		stroke-width: 1;
		stroke-dasharray: 2 3;
	}
	.track {
		position: relative;
		display: block;
		width: 100%;
		height: 1.75rem;
		padding: 0.25rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-sunken);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.track--short {
		width: 35%;
	}
	.chip {
		display: block;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: calc((var(--radius-control) - 0.25rem) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--accent);
		box-shadow: inset 0 1px 0 var(--solid-edge);
	}
	.pace-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 7.5rem;
		align-items: center;
		gap: 0.75rem;
	}
	.pace-row .track {
		background: var(--bg-surface);
	}
	.readout {
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-align: right;
		white-space: nowrap;
	}
	.fade-stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		min-height: 7rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-sunken);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.bubble {
		padding: 0.5rem 0.75rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-raised);
		box-shadow: var(--shadow-floating);
		color: var(--text-default);
		font-size: var(--text-callout);
		line-height: 1;
		text-box: trim-both cap alphabetic;
	}
	.swap {
		display: grid;
		place-items: center;
	}
	.swap-face {
		grid-area: 1 / 1;
		color: var(--text-default);
		font-size: var(--text-headline);
		font-weight: var(--weight-medium);
	}
	.swap-face--b {
		opacity: 0;
	}
	.exit-stage {
		display: grid;
		place-items: center;
		min-height: 9rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-sunken);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.mini-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 9rem;
		padding: 0.75rem;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-raised);
		box-shadow: var(--shadow-floating);
		transform-origin: top center;
	}
	.mini-line {
		display: block;
		height: 0.5rem;
		width: 70%;
		border-radius: var(--radius-floor);
		background: var(--fill-medium);
	}
	.mini-line--wide {
		width: 100%;
	}
	.entity {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		width: 16rem;
		height: 2.75rem;
		padding: 0 0.875rem;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow: var(--shadow-raised);
	}
	.tiers {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tier {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.625rem 0.75rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
	}
	.tier--on {
		background: var(--bg-hover);
	}
	.code {
		margin: 0;
		color: var(--text-default);
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		line-height: 1.6;
		white-space: pre-wrap;
	}
</style>

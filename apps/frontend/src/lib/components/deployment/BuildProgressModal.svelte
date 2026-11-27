<script lang="ts">
	import { Loader2, ChevronDown, GripHorizontal } from 'lucide-svelte';
	import { Check, Clock, Maximize2, X } from '@jis3r/icons';
	import { animate } from 'motion';
	import { page } from '$app/state';
	import {
		springRotate,
		springCollapse,
		motionEnabled,
		transition
	} from '$lib/utils/motion.svelte';
	import { motionPopover } from '$lib/utils/motion.svelte';
	import { Button, Modal } from '$lib/components/ui';
	import DeploymentProgress from '$lib/components/DeploymentProgress.svelte';
	import BuildQueue from './BuildQueue.svelte';

	let {
		deployment,
		showBuildModal = $bindable(),
		buildModalStatus,
		buildModalStep,
		buildModalError,
		buildModalWarnings,
		buildModalTimestamps,
		accumulatedBuildLogs,
		buildElapsed,
		buildProgressValue,
		canCancelBuild,
		cancelingBuild,
		onMinimizeBuildModal,
		onCancelBuild,
		onCloseBuildModal,
		formatBuildElapsed,
		showBuildCard = $bindable(),
		showBuildCardRender = $bindable(),
		onExpandBuildCard
	}: {
		deployment: any;
		showBuildModal: boolean;
		buildModalStatus: string;
		buildModalStep: string | null;
		buildModalError: string | null;
		buildModalWarnings: Array<{ podName: string; message: string; timestamp: string }>;
		buildModalTimestamps: Record<string, number> | null;
		accumulatedBuildLogs: string | null;
		buildElapsed: number;
		buildProgressValue: () => number;
		canCancelBuild: boolean;
		cancelingBuild: boolean;
		onMinimizeBuildModal: () => void;
		onCancelBuild: () => void;
		onCloseBuildModal: () => void;
		formatBuildElapsed: (seconds: number) => string;
		showBuildCard: boolean;
		showBuildCardRender: boolean;
		onExpandBuildCard: () => void;
	} = $props();

	const cardVisible = $derived(showBuildCardRender);
	const cardStatus = $derived(buildModalStatus);
	const cardStep = $derived(buildModalStep);
	const cardElapsed = $derived(buildElapsed);
	const cardProgress = $derived(buildProgressValue());
	const cardName = $derived(deployment?.name ?? 'App');

	// Real-widget behaviour: draggable by the header, collapsible, and both the
	// snapped corner and collapsed state persist across visits.
	type Corner = { h: 'left' | 'right'; v: 'top' | 'bottom' };
	const CORNER_KEY = 'build-widget-corner';
	const COLLAPSED_KEY = 'build-widget-collapsed';
	const WIDGET_W = 288;
	const MARGIN = 24;

	function loadCorner(): Corner {
		if (typeof localStorage === 'undefined') return { h: 'right', v: 'bottom' };
		try {
			const raw = localStorage.getItem(CORNER_KEY);
			const c = raw ? JSON.parse(raw) : null;
			if (c && (c.h === 'left' || c.h === 'right') && (c.v === 'top' || c.v === 'bottom')) return c;
		} catch {
			// ignore
		}
		return { h: 'right', v: 'bottom' };
	}

	// While free-dragging, `pos` (viewport left/top px) drives position. Once
	// released it snaps and `pos` clears, handing positioning back to `corner`,
	// which anchors by the actual snapped edges so height changes (expand /
	// collapse) grow away from the corner instead of drifting off-screen.
	let corner = $state<Corner>(loadCorner());
	let pos = $state<{ x: number; y: number } | null>(null);
	let collapsed = $state(
		typeof localStorage !== 'undefined' && localStorage.getItem(COLLAPSED_KEY) === 'true'
	);

	const anchorStyle = $derived.by(() => {
		if (pos) return `left:${pos.x}px; top:${pos.y}px;`;
		const hs = corner.h === 'left' ? `left:${MARGIN}px;` : `right:${MARGIN}px;`;
		const vs = corner.v === 'top' ? `top:${MARGIN}px;` : `bottom:${MARGIN}px;`;
		return hs + vs;
	});

	function toggleCollapsed() {
		collapsed = !collapsed;
		try {
			localStorage.setItem(COLLAPSED_KEY, String(collapsed));
		} catch {
			// ignore
		}
	}

	let dragging = $state(false);
	let dragStart = { px: 0, py: 0, x: 0, y: 0 };

	function onHeaderPointerDown(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('button')) return;
		const widget = (e.currentTarget as HTMLElement).closest('.build-widget') as HTMLElement | null;
		if (!widget) return;
		// Switch from corner anchoring to pixel anchoring at the current on-screen
		// position so grabbing it never jumps.
		const r = widget.getBoundingClientRect();
		pos = { x: r.left, y: r.top };
		dragStart = { px: e.clientX, py: e.clientY, x: r.left, y: r.top };
		dragging = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onHeaderPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const w = window.innerWidth;
		const h = window.innerHeight;
		const nx = Math.min(Math.max(8, dragStart.x + (e.clientX - dragStart.px)), w - WIDGET_W - 8);
		const ny = Math.min(Math.max(8, dragStart.y + (e.clientY - dragStart.py)), h - 56);
		pos = { x: nx, y: ny };
	}

	function persistCorner() {
		try {
			localStorage.setItem(CORNER_KEY, JSON.stringify(corner));
		} catch {
			// ignore
		}
	}

	// Snap to the nearest corner (the quadrant the widget's center sits in),
	// gliding there with a spring, then hand positioning back to the corner
	// anchor so it stays flush no matter how the widget's height changes.
	function snapToNearest(el: HTMLElement | null) {
		if (!pos) return;
		const h = el?.getBoundingClientRect().height ?? 120;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const ch: 'left' | 'right' = pos.x + WIDGET_W / 2 < vw / 2 ? 'left' : 'right';
		const cv: 'top' | 'bottom' = pos.y + h / 2 < vh / 2 ? 'top' : 'bottom';
		const tx = ch === 'left' ? MARGIN : vw - WIDGET_W - MARGIN;
		const ty = cv === 'top' ? MARGIN : vh - h - MARGIN;
		const settle = () => {
			corner = { h: ch, v: cv };
			pos = null;
			persistCorner();
		};
		if (!motionEnabled()) {
			settle();
			return;
		}
		const sx = pos.x;
		const sy = pos.y;
		animate(0, 1, {
			...transition('smooth'),
			onUpdate: (t: number) => {
				pos = { x: sx + (tx - sx) * t, y: sy + (ty - sy) * t };
			}
		}).finished.then(settle, settle);
	}

	function onHeaderPointerUp(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
		const widget = (e.currentTarget as HTMLElement).closest('.build-widget') as HTMLElement | null;
		snapToNearest(widget);
	}
</script>

<Modal
	bind:open={showBuildModal}
	title={deployment?.name ?? 'Build'}
	size="xl"
	onclose={onMinimizeBuildModal}
>
	<div class="build-modal-progress">
		<DeploymentProgress
			status={deployment?.status ?? 'pending'}
			buildStatus={buildModalStatus}
			buildStep={buildModalStep}
			buildLogs={accumulatedBuildLogs}
			buildError={buildModalError}
			isGitHubDeploy={true}
			warnings={buildModalWarnings}
			buildStepTimestamps={buildModalTimestamps}
			settingsHref="{page.url.pathname}?tab=settings&s=source"
			crashHref="{page.url.pathname}?tab=observe&view=killed"
			onsettings={onCloseBuildModal}
		/>
	</div>

	{#snippet footer()}
		{#if !canCancelBuild}
			<Button variant="secondary" onclick={onCloseBuildModal}>Close</Button>
		{:else}
			<Button variant="danger" loading={cancelingBuild} onclick={onCancelBuild}>
				{#if cancelingBuild}
					Canceling…
				{:else}
					<X size={14} />
					Cancel deployment
				{/if}
			</Button>
		{/if}
	{/snippet}
</Modal>

<!-- Floating Build widget: current build + queued-behind, draggable + collapsible -->
<div
	class="pointer-events-none fixed z-40 flex w-72 flex-col"
	class:build-widget--pinned={!pos}
	style={anchorStyle}
>
	{#if cardVisible}
		<div
			class="build-widget build-card pointer-events-auto w-full overflow-hidden rounded-xl shadow-lg"
			class:build-widget--dragging={dragging}
			style="transform-origin: bottom right;"
			{@attach motionPopover({
				closing: () => !(showBuildCard && !showBuildModal),
				onClosed: () => {
					showBuildCardRender = false;
				},
				from: { y: 18, scale: 0.86, opacity: 0 }
			})}
		>
			<div
				class="build-widget-header flex items-center gap-2 px-3 py-2.5"
				onpointerdown={onHeaderPointerDown}
				onpointermove={onHeaderPointerMove}
				onpointerup={onHeaderPointerUp}
			>
				<GripHorizontal
					size={13}
					class="build-widget-grip shrink-0"
					style="color: var(--surface-muted);"
				/>
				{#if cardStatus === 'building' || cardStatus === 'pending'}
					<Loader2 class="h-4 w-4 animate-spin shrink-0 text-primary-500" />
				{:else if cardStatus === 'failed'}
					<X size={16} class="shrink-0 text-red-500" />
				{:else if cardStatus === 'running'}
					<Check size={16} class="h-4 w-4 shrink-0 text-green-500" />
				{/if}
				<span class="truncate text-sm font-medium">{cardName}</span>
				<div class="ml-auto flex items-center gap-1.5 shrink-0">
					<div
						class="flex items-center gap-1 text-xs type-ident"
						style="color: var(--surface-muted);"
					>
						<Clock size={12} class="h-3 w-3" />
						<span>{formatBuildElapsed(cardElapsed)}</span>
					</div>
					<button
						type="button"
						class="build-widget-btn"
						aria-label={collapsed ? 'Expand widget' : 'Collapse widget'}
						onclick={toggleCollapsed}
					>
						<span {@attach springRotate(() => !collapsed, { rest: -90, on: 0 })}>
							<ChevronDown size={15} />
						</span>
					</button>
					<button
						type="button"
						class="build-widget-btn"
						aria-label="Open build details"
						onclick={onExpandBuildCard}
					>
						<Maximize2 size={13} class="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
			<div {@attach springCollapse(() => collapsed)}>
				<div class="build-widget-body">
					<div class="px-4 pb-3">
						<div class="build-card-track h-1.5 w-full overflow-hidden rounded-full">
							<div
								class="h-full transition-[width] duration-500 ease-out rounded-full {cardStatus ===
								'failed'
									? 'bg-red-500'
									: cardStatus === 'running'
										? 'bg-green-500'
										: 'bg-primary-500'}"
								style="width: {cardProgress}%"
							></div>
						</div>
						<p class="mt-1.5 text-xs" style="color: var(--surface-muted);">
							{#if cardStatus === 'building'}
								{cardStep === 'cloning'
									? 'Scheduling builder...'
									: cardStep === 'building'
										? 'Building image...'
										: cardStep === 'pushing'
											? 'Pushing image...'
											: cardStep === 'deploying'
												? 'Creating app...'
												: 'Building...'}
							{:else if cardStatus === 'pending'}
								Starting deployment…
							{:else if cardStatus === 'failed'}
								Deployment failed
							{:else if cardStatus === 'running'}
								Deployment complete
							{/if}
						</p>
					</div>
					<BuildQueue
						deploymentId={deployment?.id ?? ''}
						githubRepo={deployment?.githubRepo ?? ''}
					/>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.build-modal-progress {
		--progress-h: min(calc(min(85vh, 48rem) - 10.5rem), 30rem);
	}
	.build-widget-header {
		cursor: grab;
		touch-action: none;
		user-select: none;
		border-bottom: 1px solid transparent;
	}

	.build-widget--dragging .build-widget-header {
		cursor: grabbing;
	}

	.build-widget-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--radius-xs);
		color: var(--surface-muted);
		transition:
			background-color var(--dur-fast) ease,
			color var(--dur-fast) ease;
	}

	.build-widget-btn:hover {
		background-color: color-mix(in srgb, var(--center-channel-color) 8%, transparent);
		color: var(--center-channel-color);
	}

	.build-widget--dragging {
		box-shadow:
			0 12px 40px rgb(0 0 0 / 0.22),
			0 2px 8px rgb(0 0 0 / 0.12);
	}
</style>

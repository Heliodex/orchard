<script lang="ts" module>
	export type StackAlertAction = {
		label: string;
		href?: string;
		external?: boolean;
		onclick?: () => void;
		primary?: boolean;
		loading?: boolean;
	};
	export type StackAlert = {
		id: string;
		tone: 'error' | 'warning' | 'info';
		title: string;
		hint?: string;
		actions?: StackAlertAction[];
		dismissible?: boolean;
	};
</script>

<script lang="ts">
	import { CircleAlert, Info, TriangleAlert, X } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let {
		alerts,
		ondismiss = undefined
	}: {
		alerts: StackAlert[];
		ondismiss?: (id: string) => void;
	} = $props();

	const ICON = { error: CircleAlert, warning: TriangleAlert, info: Info };
	const RANK = { error: 0, warning: 1, info: 2 };
	const CARD = 44;
	const GAP = 8;
	const PEEK = 7;
	const LIMIT = 5;

	let hovering = $state(false);
	let pinned = $state(false);
	let focused = $state(false);
	let leaveTimer: ReturnType<typeof setTimeout> | undefined;

	const all = $derived(
		[...new Map(alerts.map((a) => [a.id, a])).values()].sort((a, b) => RANK[a.tone] - RANK[b.tone])
	);
	const sorted = $derived.by((): StackAlert[] => {
		if (all.length <= LIMIT) return all;
		const rest = all.slice(LIMIT - 1);
		return [
			...all.slice(0, LIMIT - 1),
			{
				id: '__more',
				tone: rest[0].tone,
				title: `${rest.length} more`,
				hint: rest.map((a) => a.title).join(' · ')
			}
		];
	});
	const many = $derived(sorted.length > 1);
	const open = $derived(many && (hovering || pinned || focused));
	const counts = $derived(
		(['error', 'warning', 'info'] as const)
			.map((tone) => ({ tone, n: all.filter((a) => a.tone === tone).length }))
			.filter((c) => c.n > 0)
	);
	const fullHeight = $derived(sorted.length * CARD + (sorted.length - 1) * GAP);

	$effect(() => {
		if (!many) pinned = false;
	});

	function enter() {
		clearTimeout(leaveTimer);
		hovering = true;
	}

	function leave() {
		clearTimeout(leaveTimer);
		leaveTimer = setTimeout(() => (hovering = false), 160);
	}

	function place(i: number) {
		if (open) return `translate3d(0, ${i * (CARD + GAP)}px, 0)`;
		const depth = Math.min(i, 2);
		return `translate3d(0, ${depth * PEEK}px, 0) scale(${1 - depth * 0.025})`;
	}
</script>

{#if sorted.length}
	<section
		class="alerts"
		class:alerts--open={open}
		class:alerts--many={many}
		aria-label="Problems"
		style:--card="{CARD}px"
		style:--full="{fullHeight}px"
		onpointerenter={enter}
		onpointerleave={leave}
		onfocusin={() => (focused = true)}
		onfocusout={(e) => {
			if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) focused = false;
		}}
	>
		<span class="pad" aria-hidden="true"></span>
		{#each sorted as alert, i (alert.id)}
			{@const Glyph = ICON[alert.tone]}
			<div
				class="note note--{alert.tone}"
				class:note--back={!open && i > 0}
				class:note--gone={!open && i > 2}
				style:transform={place(i)}
				style:z-index={sorted.length - i}
				style:transition-delay="{open ? i * 24 : (sorted.length - 1 - i) * 12}ms"
				aria-hidden={!open && i > 0 ? 'true' : undefined}
				inert={!open && i > 0}
			>
				<span class="icon"><Glyph size={16} aria-hidden="true" /></span>
				<p class="text" title={alert.hint}>
					<span class="title" title={alert.title}>{alert.title}</span>
					{#if alert.hint}<span class="hint">{alert.hint}</span>{/if}
				</p>
				<span class="acts">
					{#each alert.actions ?? [] as act (act.label)}
						{#if act.href && act.external}
							<Button
								variant="secondary"
								size="sm"
								href={act.href}
								target="_blank"
								rel="noopener noreferrer">{act.label}</Button
							>
						{:else if act.href}
							<Button variant="secondary" size="sm" href={act.href}>{act.label}</Button>
						{:else}
							<Button
								variant={act.primary ? 'primary' : 'secondary'}
								size="sm"
								loading={act.loading}
								disabled={act.loading}
								onclick={act.onclick}>{act.label}</Button
							>
						{/if}
					{/each}
					{#if i === 0 && many}
						<button
							type="button"
							class="counts"
							aria-expanded={open}
							aria-label="{all.length} problems, {pinned ? 'unpin' : 'pin open'}"
							onclick={() => (pinned = !pinned)}
						>
							{#each counts as c (c.tone)}
								{@const CountGlyph = ICON[c.tone]}
								<span class="count count--{c.tone}"
									><CountGlyph size={13} strokeWidth={2.25} aria-hidden="true" />{c.n}</span
								>
							{/each}
						</button>
					{:else if alert.dismissible && ondismiss}
						<Button
							variant="ghost"
							size="sm"
							icon={X}
							label="Dismiss {alert.title}"
							onclick={() => ondismiss(alert.id)}
						/>
					{/if}
				</span>
			</div>
		{/each}
	</section>
{/if}

<style>
	.alerts {
		position: relative;
		height: var(--card);
		z-index: calc(var(--z-dropdown) - 1);
	}
	.alerts {
		flex-shrink: 0;
	}
	.alerts--many {
		margin-bottom: 0.375rem;
	}
	.pad {
		position: absolute;
		inset: 0 0 auto;
		height: var(--card);
		pointer-events: none;
	}
	.alerts--open .pad {
		height: calc(var(--full) + 0.5rem);
		pointer-events: auto;
	}
	.note {
		--tone: var(--status-error);
		--tint: var(--status-error-bg);
		position: absolute;
		inset: 0 0 auto;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: var(--card);
		padding: 0 0.5rem 0 0.875rem;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		background: linear-gradient(var(--tint), var(--tint)), var(--bg-surface);
		box-shadow:
			inset 0 0 0 0.5px color-mix(in oklab, var(--tone) 28%, var(--border-default)),
			0 1px 2px color-mix(in oklab, var(--neutral-10) 6%, transparent);
		transform-origin: 50% 0;
		transition:
			transform var(--spring-glide-duration) var(--spring-glide),
			opacity var(--fade-in) var(--curve-out),
			box-shadow var(--fade-in) var(--curve-out);
	}
	.note--warning {
		--tone: var(--status-warning);
		--tint: var(--status-warning-bg);
	}
	.note--info {
		--tone: var(--status-info);
		--tint: var(--status-info-bg);
	}
	.alerts--open .note {
		box-shadow:
			inset 0 0 0 0.5px color-mix(in oklab, var(--tone) 28%, var(--border-default)),
			var(--shadow-floating);
	}
	.note--back > * {
		opacity: 0;
	}
	.note--back {
		background: linear-gradient(var(--tint), var(--tint)), var(--bg-sunken);
		box-shadow:
			inset 0 0 0 0.5px color-mix(in oklab, var(--tone) 22%, var(--border-default)),
			0 1px 2px color-mix(in oklab, var(--neutral-10) 8%, transparent);
	}
	.note--gone {
		opacity: 0;
	}
	.note > * {
		transition: opacity var(--fade-in) var(--curve-out);
	}
	.icon {
		display: flex;
		flex-shrink: 0;
		color: var(--tone);
	}
	.text {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex: 1 1 auto;
		min-width: 0;
		margin: 0;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
	}
	.title {
		min-width: 0;
		overflow-x: clip;
		font-weight: var(--weight-semibold);
		color: var(--text-default);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hint {
		flex-shrink: 100;
		min-width: 0;
		overflow-x: clip;
		color: var(--text-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.acts {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
	}
	.counts {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		height: 1.75rem;
		padding: 0 0.625rem;
		border: none;
		border-radius: calc(0.5625rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: color-mix(in oklab, var(--tone) 10%, transparent);
		cursor: pointer;
	}
	.counts:hover,
	.counts[aria-expanded='true'] {
		background: color-mix(in oklab, var(--tone) 16%, transparent);
	}
	.count {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--text-footnote);
		font-weight: var(--weight-semibold);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.count--error {
		color: var(--status-error);
	}
	.count--warning {
		color: var(--status-warning);
	}
	.count--info {
		color: var(--status-info);
	}
	@media (prefers-reduced-motion: reduce) {
		.note,
		.note > * {
			transition: none;
		}
	}
</style>

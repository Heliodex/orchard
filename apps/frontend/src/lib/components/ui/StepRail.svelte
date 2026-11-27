<script lang="ts">
	import StatusDot from './StatusDot.svelte';
	import { statusMeta, type StatusMeta } from './status';
	import { formatStepDuration, railStatus, type RailStep, type RailStepStatus } from './steprail';

	let {
		steps,
		current = undefined,
		label = 'Build steps',
		onselect = undefined
	}: {
		steps: RailStep[];
		current?: string;
		label?: string;
		onselect?: (id: string) => void;
	} = $props();

	const META: Record<RailStepStatus, StatusMeta> = {
		queued: statusMeta('info', 'Queued'),
		running: statusMeta('progress', 'Running', true),
		done: statusMeta('success', 'Done'),
		failed: statusMeta('error', 'Failed'),
		skipped: statusMeta('neutral', 'Skipped')
	};

	const states = $derived(steps.map((s) => railStatus(s, current)));
</script>

<ol class="rail" aria-label={label}>
	{#each steps as step, i (step.id)}
		{@const state = states[i]}
		<li class="step" class:step--select={!!onselect} data-state={state}>
			{#if onselect && state !== 'queued' && state !== 'skipped'}
				<button
					type="button"
					class="hit"
					aria-label="Show {step.label}"
					onclick={() => onselect?.(step.id)}
				></button>
			{/if}
			<span class="dot"><StatusDot meta={META[state]} label={META[state].label} /></span>
			<span class="label">{step.label}</span>
			<span class="dur">
				{#if state === 'skipped'}
					Skipped
				{:else if state === 'queued'}
					Queued
				{:else if step.durationMs != null}
					{formatStepDuration(step.durationMs)}
				{/if}
			</span>
			{#if step.detail}<span class="detail" title={step.detail}>{step.detail}</span>{/if}
		</li>
	{/each}
</ol>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.step {
		display: grid;
		grid-template-columns: var(--rail-dot-col, 1rem) minmax(0, 1fr) auto;
		grid-template-areas:
			'dot label dur'
			'. detail detail';
		column-gap: var(--rail-gap, 0.625rem);
		row-gap: 0.125rem;
		align-items: center;
		align-content: center;
		min-height: 2.75rem;
		padding: 0.5rem 0;
	}
	.step--select {
		position: relative;
	}
	.hit {
		position: absolute;
		inset: 0;
		border-radius: calc(0.5rem * var(--corner-scale));
		cursor: pointer;
	}
	.hit:hover {
		background: var(--bg-hover);
	}
	.hit:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.dot,
	.label,
	.dur,
	.detail {
		position: relative;
		pointer-events: none;
	}
	.step:not(:first-child) {
		box-shadow: inset 0 1px 0 var(--border-default);
	}
	.dot {
		grid-area: dot;
		display: grid;
		place-items: center;
		width: 100%;
		height: 1rem;
	}
	.label {
		grid-area: label;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-default);
	}
	.step[data-state='queued'] .label,
	.step[data-state='skipped'] .label {
		color: var(--text-faint);
	}
	.step[data-state='running'] .label,
	.step[data-state='failed'] .label {
		font-weight: var(--weight-medium);
	}
	.dur {
		grid-area: dur;
		font-size: var(--text-footnote);
		line-height: var(--lh-callout);
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
	}
	.detail {
		grid-area: detail;
		min-width: 0;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
		overflow-wrap: anywhere;
	}
	.step[data-state='failed'] .detail {
		color: var(--status-error);
	}
</style>

<script lang="ts">
	import LogViewer from '$lib/components/ui/LogViewer.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import { buildSummary, type ParsedBuildLogs } from '$lib/utils/buildkitParser';
	import type { BuildFailure } from '$lib/utils/build-failure';
	import type { LogLine } from '$lib/utils/log-lines';
	import type { RailStep } from '$lib/components/ui/steprail';
	import BuildTerminal from './BuildTerminal.svelte';

	let {
		parsed,
		lines,
		running = false,
		failure = null,
		loading = false,
		error = null,
		filename = 'build',
		settingsHref = null,
		crashHref = null,
		phases = [],
		onnavigate = undefined
	}: {
		parsed: ParsedBuildLogs;
		lines: LogLine[];
		running?: boolean;
		failure?: BuildFailure | null;
		loading?: boolean;
		error?: string | null;
		filename?: string;
		settingsHref?: string | null;
		crashHref?: string | null;
		phases?: RailStep[];
		onnavigate?: () => void;
	} = $props();

	let view = $state<'steps' | 'raw'>('steps');
	let terminal: BuildTerminal | undefined = $state();

	export async function focus(phase: string) {
		view = 'steps';
		await Promise.resolve();
		await terminal?.focus(phase);
	}
	const summary = $derived(buildSummary(parsed));
</script>

<div class="build-log">
	<div class="bar">
		<div class="bar-text">
			<p class="bar-title">Build logs</p>
			<p class="bar-sub">
				{#if summary.total}
					{summary.total}
					{summary.total === 1 ? 'step' : 'steps'}{#if summary.cached}&nbsp;· {summary.cached} cached{/if}
				{:else if running}
					Waiting for the first step
				{:else}
					{lines.length} {lines.length === 1 ? 'line' : 'lines'}
				{/if}
			</p>
		</div>
		<SegmentedControl
			label="Build log view"
			size="sm"
			options={[
				{ value: 'steps', label: 'Steps' },
				{ value: 'raw', label: 'Raw logs' }
			]}
			bind:value={() => view, (v) => (view = v as 'steps' | 'raw')}
		/>
	</div>
	<div class="panel">
		{#if view === 'steps'}
				<BuildTerminal
					bind:this={terminal}
					{parsed}
					{running}
					{failure}
					{phases}
					{settingsHref}
					{crashHref}
					{onnavigate}
				/>
			{:else}
				<div class="raw">
					<LogViewer {lines} {loading} {error} toolbar sourceLabel="Step" {filename} />
				</div>
		{/if}
	</div>
</div>

<style>
	.build-log {
		position: relative;
		isolation: isolate;
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-height: 0;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--console-bg);
		overflow: clip;
	}
	.build-log::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 2;
		border-radius: inherit;
		corner-shape: inherit;
		box-shadow: inset 0 0 0 1px var(--console-edge);
		pointer-events: none;
	}
	.bar {
		display: flex;
		align-items: center;
		min-height: var(--build-head-h, 3.5rem);
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem 0.625rem 0.875rem;
		box-shadow: inset 0 -1px 0 var(--console-edge);
	}
	.bar-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}
	.bar-title {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		font-weight: var(--weight-semibold);
		color: var(--text-default);
		text-box: trim-both cap alphabetic;
	}
	.bar-sub {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-box: trim-both cap alphabetic;
	}
	.panel {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-height: 0;
	}
	.raw {
		display: flex;
		flex-direction: column;
		height: calc(var(--build-log-h, 30rem) - var(--build-head-h, 3.5rem));
		min-height: 0;
		padding: 0.5rem 0.75rem 0.75rem;
	}
</style>

<script lang="ts">
	import { FlaskConical, X } from 'lucide-svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { TEMPO, setTempo } from '$lib/design/springs';
	import {
		ACTIONS,
		EXPERIMENTS,
		exp,
		persist,
		picks,
		reset,
		runAction
	} from './experiments.svelte';

	let open = $state(false);
	let speed = $state(TEMPO);
	let copied = $state(false);

	const groups = [...new Set(EXPERIMENTS.map((e) => e.group))];
	const changed = $derived(EXPERIMENTS.filter((e) => exp[e.id] !== e.initial).length);

	async function copy() {
		await navigator.clipboard.writeText(picks());
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}
</script>

<div class="dock">
	{#if open}
		<section class="panel" aria-label="Experiments">
			<header class="head">
				<span class="heading">Experiments</span>
				<button type="button" class="close" aria-label="Close" onclick={() => (open = false)}
					><X size={14} /></button
				>
			</header>
			<div class="body">
				{#each groups as g (g)}
					<p class="group-label">{g}</p>
					{#each EXPERIMENTS.filter((e) => e.group === g) as e (e.id)}
						<div class="row" class:row--changed={exp[e.id] !== e.initial}>
							<span class="label-wrap">
								<span class="label">{e.label}</span>
								{#if e.hint}<span class="hint">{e.hint}</span>{/if}
							</span>
							<SegmentedControl
								size="sm"
								label={e.label}
								options={e.options}
								bind:value={exp[e.id]}
								onchange={persist}
							/>
						</div>
					{/each}
				{/each}
				<p class="group-label">Motion</p>
				<div class="row">
					<span class="label-wrap">
						<span class="label">Tempo</span>
						<span class="hint">Scales every Orchard curve at once</span>
					</span>
					<span class="tempo">
						<input
							type="range"
							min="0.5"
							max="2"
							step="0.05"
							bind:value={speed}
							oninput={() => setTempo(speed)}
							aria-label="Tempo"
						/>
						<span class="tempo-value">{speed.toFixed(2)}×</span>
					</span>
				</div>
				<p class="group-label">Simulate</p>
				<div class="actions">
					{#each ACTIONS as a (a.id)}
						<Button size="sm" onclick={() => runAction(a.id)}>{a.label}</Button>
					{/each}
				</div>
			</div>
			<footer class="foot">
				<Button size="sm" variant="ghost" onclick={reset}>Reset</Button>
				<Button size="sm" onclick={copy}>{copied ? 'Copied' : 'Copy my picks'}</Button>
			</footer>
		</section>
	{:else}
		<button type="button" class="pill" onclick={() => (open = true)}>
			<FlaskConical size={14} />
			<span>Experiments</span>
			{#if changed}<span class="changed">{changed}</span>{/if}
		</button>
	{/if}
</div>

<style>
	.dock {
		position: fixed;
		right: 1rem;
		bottom: 1.375rem;
		z-index: var(--z-nav);
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		height: 2rem;
		padding: 0 0.75rem;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--material-glass-bg);
		backdrop-filter: var(--material-glass-filter);
		box-shadow: var(--shadow-floating);
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-callout);
		font-weight: var(--weight-medium);
		cursor: pointer;
	}
	.changed {
		display: grid;
		place-items: center;
		min-width: 1.125rem;
		height: 1.125rem;
		padding: 0 0.3125rem;
		border-radius: var(--radius-pill);
		background: var(--accent-solid);
		color: var(--on-solid);
		font-size: var(--text-micro);
		font-weight: var(--weight-semibold);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.panel {
		display: flex;
		flex-direction: column;
		width: 26rem;
		max-height: calc(100dvh - 3rem);
		border-radius: calc(var(--radius-panel) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--material-glass-bg);
		backdrop-filter: var(--material-glass-filter);
		box-shadow: var(--shadow-floating);
		overflow: hidden;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 0.875rem 0.5rem 1rem;
	}
	.heading {
		font-size: var(--text-headline);
		font-weight: var(--weight-semibold);
	}
	.close {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border: none;
		border-radius: 50%;
		background: color-mix(in oklab, var(--neutral-10) 7%, transparent);
		color: var(--text-muted);
		cursor: pointer;
	}
	.body {
		display: flex;
		flex-direction: column;
		padding: 0 0.5rem 0.5rem;
		overflow-y: auto;
	}
	.group-label {
		padding: 0.75rem 0.5rem 0.25rem;
		color: var(--text-faint);
		font-size: var(--text-caption);
		font-weight: var(--weight-semibold);
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.3125rem 0.5rem;
		border-radius: calc((var(--radius-panel) - 0.5rem) * var(--corner-scale));
		corner-shape: var(--corner);
	}
	.row--changed {
		background: color-mix(in oklab, var(--accent-solid) 7%, transparent);
	}
	.label-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
		padding-block: 0.25rem;
	}
	.label {
		font-size: var(--text-callout);
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
	}
	.hint {
		color: var(--text-faint);
		font-size: var(--text-caption);
		text-box: trim-both cap alphabetic;
	}
	.tempo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.tempo input {
		width: 8rem;
		accent-color: var(--accent-solid);
	}
	.tempo-value {
		min-width: 2.75rem;
		color: var(--text-muted);
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-align: right;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem 0.5rem;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.625rem 0.875rem;
		box-shadow: inset 0 0.5px 0 var(--border-default);
	}
</style>

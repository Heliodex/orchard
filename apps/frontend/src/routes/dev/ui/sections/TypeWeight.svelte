<script lang="ts">
	import { onMount } from 'svelte';
	import { CircleCheck } from 'lucide-svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import StatusDot from '$lib/components/ui/StatusDot.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { statusMeta } from '$lib/components/ui/status';
	import Verdict from './Verdict.svelte';

	const ROLES = [
		{ role: 'display', cls: 'text-display', sample: 'Ship it' },
		{ role: 'title-1', cls: 'text-title-1', sample: 'hackclub-site' },
		{ role: 'title-2', cls: 'text-title-2', sample: 'Deployments' },
		{ role: 'title-3', cls: 'text-title-3', sample: 'Environment' },
		{ role: 'headline', cls: 'text-headline', sample: 'Recent builds' },
		{ role: 'body', cls: 'text-body', sample: 'Everything is running except 3 apps.' },
		{ role: 'callout', cls: 'text-callout', sample: 'Pushed to main 4 minutes ago' },
		{ role: 'caption', cls: 'text-caption', sample: 'us-east · 2 replicas' },
		{ role: 'micro', cls: 'text-micro', sample: 'Updated just now' }
	];

	let metrics = $state<Record<string, string>>({});

	onMount(() => {
		const css = getComputedStyle(document.documentElement);
		const rem = parseFloat(css.fontSize) || 16;
		const px = (v: string) => Math.round(parseFloat(v) * (v.trim().endsWith('rem') ? rem : 1));
		const next: Record<string, string> = {};
		for (const r of ROLES) {
			const size = css.getPropertyValue(`--text-${r.role}`);
			const lh = css.getPropertyValue(`--lh-${r.role}`);
			next[r.role] = `${px(size)}/${px(lh)}`;
		}
		metrics = next;
	});

	const WEIGHTS = [
		{ name: 'Regular', value: 450, use: 'Body, names, metadata' },
		{ name: 'Medium', value: 550, use: 'Section titles, emphasis' },
		{ name: 'Semibold', value: 650, use: 'Page title, failures. Spend it.' }
	];

	const APPS = [
		{ name: 'hackclub-site', owner: '@leafd', meta: statusMeta('success', 'Running'), ok: true },
		{ name: 'scrapbook', owner: '@zrl', meta: statusMeta('error', 'Crashing'), ok: false },
		{ name: 'arcade-api', owner: '@maxwofford', meta: statusMeta('error', 'Failed'), ok: false }
	];

	let rpm = $state(1118);
	onMount(() => {
		const id = setInterval(() => {
			rpm = Math.floor(1000 + Math.random() * 8999);
		}, 220);
		return () => clearInterval(id);
	});
	const rpmText = $derived(rpm.toLocaleString('en-US'));

	let boxes = $state(true);

	const DASH = String.fromCharCode(0x2014);
</script>

<SectionCard
	title="Scale"
	description="Nine roles, read from the tokens. Hierarchy comes from weight and tone before size."
>
	<div class="scale">
		{#each ROLES as r (r.role)}
			<div class="scale-row">
				<span class="font-mono text-caption text-muted">{r.role}</span>
				<span class="text-caption text-faint tabular-nums rond-data">{metrics[r.role] ?? ''}</span>
				<span class="{r.cls} min-w-0 truncate text-fg">{r.sample}</span>
			</div>
		{/each}
	</div>
</SectionCard>

<div class="grid grid-cols-2 gap-6">
	<SectionCard title="Three weights" description="Nothing in between, nothing heavier.">
		<div class="grid grid-cols-3 gap-4">
			{#each WEIGHTS as w (w.value)}
				<div class="weight">
					<span class="weight-sample" style:font-weight={w.value}>Aa</span>
					<span class="flex flex-col gap-1">
						<span class="text-callout text-fg"
							>{w.name} <span class="text-faint">{w.value}</span></span
						>
						<span class="text-caption text-muted">{w.use}</span>
					</span>
				</div>
			{/each}
		</div>
	</SectionCard>

	<SectionCard
		title="Tabular numbers"
		description="Anything that changes keeps its width, so the eye can stay on it."
	>
		<div class="grid grid-cols-2 gap-4">
			<Verdict kind="do" note="tabular-nums">
				<span class="counter tabular-nums rond-data"
					>{rpmText} <span class="text-faint">req/min</span></span
				>
			</Verdict>
			<Verdict kind="dont" note="Proportional digits jitter.">
				<span class="counter counter--proportional"
					>{rpmText} <span class="text-faint">req/min</span></span
				>
			</Verdict>
		</div>
	</SectionCard>
</div>

<SectionCard
	title="Bold budget"
	description="A screen gets one or two semibold things: the page title and whatever is genuinely wrong. If a row looks flat, fix it with tone or spacing first."
>
	<div class="grid grid-cols-2 gap-4">
		<Verdict kind="do" note="Only the failing count is semibold." align="stretch">
			<div class="mini-list">
				<div class="mini-head">
					<span class="text-callout font-medium text-fg">Apps</span>
					<span class="text-callout font-semibold text-error">2 failing</span>
				</div>
				{#each APPS as a (a.name)}
					<div class="mini-row">
						<span class="text-body text-fg">{a.name}</span>
						<span class="text-callout text-muted">{a.owner}</span>
						<span class="status-cell">
							<StatusDot meta={a.meta} />
							<span class="text-callout {a.ok ? 'text-muted' : 'text-error'}">{a.meta.label}</span>
						</span>
					</div>
				{/each}
			</div>
		</Verdict>
		<Verdict kind="dont" note="Everything semibold, so nothing is." align="stretch">
			<div class="mini-list mini-list--loud">
				<div class="mini-head">
					<span class="text-callout text-fg">Apps</span>
					<span class="text-callout text-error">2 failing</span>
				</div>
				{#each APPS as a (a.name)}
					<div class="mini-row">
						<span class="text-body text-fg">{a.name}</span>
						<span class="text-callout text-fg">{a.owner}</span>
						<span class="status-cell">
							<StatusDot meta={a.meta} />
							<span class="text-callout {a.ok ? 'text-success' : 'text-error'}">{a.meta.label}</span
							>
						</span>
					</div>
				{/each}
			</div>
		</Verdict>
	</div>
</SectionCard>

<div class="grid grid-cols-2 gap-6">
	<SectionCard
		title="Trim to the ink"
		description="Text next to an icon or inside a pill trims its box to cap height and baseline, so padding is measured from the letters."
	>
		{#snippet actions()}
			<label class="flex items-center gap-2 text-callout text-muted">
				<Switch bind:checked={boxes} label="Show text boxes" />
				Boxes
			</label>
		{/snippet}
		<div class="grid grid-cols-2 gap-4">
			<Verdict kind="do" note="text-box: trim-both cap alphabetic">
				<span class="pill" class:pill--boxes={boxes}>
					<CircleCheck size={20} strokeWidth={2} />
					<span class="pill-text pill-text--trim">Deployed</span>
				</span>
			</Verdict>
			<Verdict kind="dont" note="Line box padding sits low.">
				<span class="pill pill--loose" class:pill--boxes={boxes}>
					<CircleCheck size={20} strokeWidth={2} />
					<span class="pill-text">Deployed</span>
				</span>
			</Verdict>
		</div>
	</SectionCard>

	<SectionCard
		title="Copy"
		description="Sentence case, short, true right now. No em dashes: use a full stop or a comma."
	>
		<div class="grid grid-cols-2 gap-4">
			<Verdict kind="do" note="Sentence case, plain stops." align="stretch">
				<div class="flex flex-col items-start gap-3">
					<span class="text-body text-fg">Build failed. Check the log.</span>
					<Button size="sm">Add domain</Button>
				</div>
			</Verdict>
			<Verdict kind="dont" note="Title Case and an em dash." align="stretch">
				<div class="flex flex-col items-start gap-3">
					<span class="text-body text-fg">Build Failed {DASH} Check The Log</span>
					<Button size="sm">Add A New Domain</Button>
				</div>
			</Verdict>
		</div>
	</SectionCard>
</div>

<style>
	.scale {
		display: flex;
		flex-direction: column;
	}
	.scale-row {
		display: grid;
		grid-template-columns: 6rem 4rem minmax(0, 1fr);
		align-items: baseline;
		gap: 1rem;
		padding: 0.625rem 0;
		border-top: 1px solid var(--rule);
	}
	.scale-row:first-child {
		padding-top: 0;
		border-top: none;
	}
	.weight {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.weight-sample {
		color: var(--text-default);
		font-size: 2.5rem;
		line-height: 1;
		letter-spacing: -0.011em;
	}
	.counter {
		color: var(--text-default);
		font-size: var(--text-title-2);
		font-weight: var(--weight-medium);
	}
	.counter--proportional {
		font-variant-numeric: proportional-nums;
	}
	.mini-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem;
		border-radius: calc(var(--radius-card) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--bg-surface);
		box-shadow: var(--shadow-raised);
	}
	.mini-list--loud :global(*) {
		font-weight: var(--weight-semibold);
	}
	.mini-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0 0.25rem 0.5rem;
	}
	.mini-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 6.5rem 5.5rem;
		align-items: center;
		gap: 0.75rem;
		height: 2.25rem;
		padding: 0 0.25rem;
	}
	.status-cell {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: calc(var(--radius-control) * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--status-success-bg);
		color: var(--status-success);
		font-size: var(--text-title-2);
		font-weight: var(--weight-medium);
		line-height: var(--lh-title-2);
	}
	.pill-text--trim {
		text-box: trim-both cap alphabetic;
	}
	.pill--boxes .pill-text {
		outline: 1px dashed var(--accent-7);
		outline-offset: 0;
	}
	.pill--boxes {
		outline: 1px dashed var(--rule-strong);
		outline-offset: 0;
	}
</style>

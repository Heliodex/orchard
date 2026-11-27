<script lang="ts">
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import WaveText from '$lib/components/ui/WaveText.svelte';

	let rond = $state('50');
	let weight = $state('550');

	const ROLES = [
		{ token: '--rond-ident', use: 'IDs, SHAs, hosts', sample: 'sha 0aa2ac4 · pod web-7f9c1' },
		{ token: '--rond-data', use: 'Numbers and metrics', sample: '157 MB · 37m · 0.10%' },
		{ token: '--rond-caps', use: 'Uppercase labels', sample: 'PRODUCTION (EU-1)' },
		{ token: '--rond-body', use: 'Running text', sample: 'Deploys roll out one pod at a time.' },
		{ token: '--rond-heading', use: 'Page and card titles', sample: 'Your apps' },
		{ token: '--rond-control', use: 'Buttons, tabs, chips, keys', sample: 'Redeploy' },
		{
			token: '--rond-selected',
			use: 'The selected tab, segment or nav item',
			sample: 'Overview'
		},
		{ token: '--rond-hero', use: 'Sign in, setup, empty states', sample: 'Welcome to Orchard' }
	];

	const FEATURES = [
		{
			name: 'type-ident',
			what: 'Disambiguated I l 1 O 0, slashed zero, tabular figures',
			sample: 'Il1 O0 · 4f2a9c1 · 10.0.0.12:5432'
		},
		{
			name: 'type-figures',
			what: 'Tabular figures, so columns of numbers line up',
			sample: '1,248.31 · 111.11 · 707.07'
		},
		{
			name: 'type-caps',
			what: 'Punctuation lifted to sit beside capitals',
			sample: 'READY (3/3) · [HQ] · NODE-01'
		},
		{ name: 'type-fractions', what: 'Real fractions', sample: '1/2 CPU · 3/4 full' },
		{
			name: 'calt',
			what: 'On everywhere: typed arrows become arrows',
			sample: 'main -> production'
		}
	];
</script>

<SectionCard
	title="Typeface"
	description="Allo by Josh Puckett, SIL Open Font License. One variable font: weight 100 to 900, roundness 0 to 100, optical size that follows the font size."
>
	<div class="typeface">
		<div class="specimen" style:--rond={rond} style:font-weight={weight}>
			<span class="specimen-word">Orchard grows apps</span>
			<span class="specimen-glyphs">⌘ ⌥ ⇧ ⏎ ✓ ⚠ ← → ↻ ● ▲</span>
		</div>
		<div class="controls">
			<SegmentedControl
				bind:value={rond}
				options={[
					{ value: '0', label: 'Sharp' },
					{ value: '50', label: 'Friendly' },
					{ value: '100', label: 'Round' }
				]}
				label="Roundness"
			/>
			<SegmentedControl
				bind:value={weight}
				options={[
					{ value: '400', label: '400' },
					{ value: '550', label: '550' },
					{ value: '800', label: '800' }
				]}
				label="Weight"
			/>
		</div>

		<h3 class="sub">Roundness carries the role</h3>
		<p class="note">
			Every element reads <code>--rond</code>; one global rule turns it into
			<code>font-variation-settings</code>. Set the role on the element, never the axis. A rule with
			<code>font: inherit</code>
			also resets the axes, so it must restate
			<code>font-variation-settings: 'ROND' var(--rond)</code>.
		</p>
		<div class="roles">
			{#each ROLES as role (role.token)}
				<div class="role">
					<span class="role-sample" style:--rond="var({role.token})">{role.sample}</span>
					<span class="role-meta">{role.use} · <code>{role.token}</code></span>
				</div>
			{/each}
		</div>

		<h3 class="sub">Features</h3>
		<div class="roles">
			{#each FEATURES as f (f.name)}
				<div class="role">
					<span class="role-sample {f.name === 'calt' ? '' : f.name}">{f.sample}</span>
					<span class="role-meta">{f.what} · <code>{f.name}</code></span>
				</div>
			{/each}
		</div>

		<h3 class="sub">Roundness in motion</h3>
		<div class="motion">
			<span class="wave-demo"><WaveText text="Hover me" rest="round" peak="sharp" /></span>
			<Button variant="secondary">Press me</Button>
		</div>
		<p class="note">
			The wave is <code>WaveText</code>: roundness only, so nothing reflows, and it holds still
			below the full motion tier. Buttons round their label while pressed; selected tabs, segments
			and nav items round on the smooth spring. Weight never animates, because it changes width.
		</p>

		<h3 class="sub">When mono stays</h3>
		<p class="note">
			Allo is proportional. JetBrains Mono stays for anything that has to line up character for
			character: terminals, logs, code, editors and fields where people type code. A short
			identifier in the UI uses Allo with <code>type-ident</code> instead.
		</p>
	</div>
</SectionCard>

<style>
	.typeface {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.specimen {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-5);
		border-radius: var(--radius-card);
		background: var(--bg-raised);
		transition: font-weight var(--spring-smooth-duration) var(--spring-smooth);
	}
	.specimen-word {
		font-size: var(--text-display);
		line-height: var(--text-display--line-height);
		letter-spacing: var(--text-display--letter-spacing);
		color: var(--text-default);
		transition: font-variation-settings var(--spring-smooth-duration) var(--spring-smooth);
	}
	.specimen-glyphs {
		font-size: var(--text-title-3);
		color: var(--text-muted);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.sub {
		margin: var(--space-2) 0 0;
		font-size: var(--text-headline);
		line-height: var(--text-headline--line-height);
		font-weight: var(--weight-semibold);
		color: var(--text-default);
	}
	.note {
		margin: 0;
		font-size: var(--text-callout);
		line-height: var(--text-callout--line-height);
		color: var(--text-muted);
		max-width: 44rem;
	}
	.roles {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--border-default);
	}
	.role {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border-default);
	}
	.role-sample {
		font-size: var(--text-title-3);
		color: var(--text-default);
	}
	.role-meta {
		font-size: var(--text-caption);
		color: var(--text-faint);
		text-align: right;
	}
	.motion {
		display: flex;
		align-items: center;
		gap: var(--space-5);
	}
	.wave-demo {
		font-size: var(--text-title-1);
		font-weight: var(--weight-semibold);
		color: var(--text-default);
		cursor: default;
	}
</style>

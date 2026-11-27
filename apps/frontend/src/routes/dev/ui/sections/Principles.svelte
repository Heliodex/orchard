<script lang="ts">
	import SectionCard from '$lib/components/ui/SectionCard.svelte';

	const CONSTITUTION = [
		{
			rule: 'One way to do each thing',
			detail: 'Every need maps to exactly one component.'
		},
		{
			rule: 'Space comes from the 4px grid',
			detail:
				'Steps 0.5 1 2 3 4 6 8 12 16 only. Padding is at least 1.5x the gap inside it; groups sit about 2x apart.'
		},
		{
			rule: 'Hierarchy comes from weight and tone',
			detail: 'Three weights, three text tones. Not size.'
		},
		{
			rule: 'Colour means something',
			detail: 'Neutral surfaces, one accent, status colours only for status. Never colour alone.'
		},
		{
			rule: 'One representation per entity',
			detail: 'Deployments, databases and jobs always render through EntityRow.'
		},
		{
			rule: 'Motion is physics',
			detail: 'Only transform and opacity move, on named springs.'
		},
		{
			rule: 'Glass is for floating chrome',
			detail: 'Menus, popovers, toasts and the command menu. Nothing that scrolls.'
		},
		{
			rule: 'Every word earns its place',
			detail:
				'Cut copy that changes nothing someone does or knows. Keep consequences and specifics.'
		},
		{
			rule: 'Spend novelty on deploy moments',
			detail: 'Project identity and toasts get the flourish. Everything else is quiet on purpose.'
		}
	];

	const EXPENSIVE = [
		{ term: 'Optical alignment', detail: 'Icons centre on cap height. Pills trim to the ink.' },
		{
			term: 'Continuous corners',
			detail: 'Superellipse, scaled. Circles only for dots and radios.'
		},
		{
			term: 'Concentric corners',
			detail: 'Inner radius is outer minus the gap. Never equal radii.'
		},
		{ term: 'Dense, not big', detail: '32px controls, 36px nav rows, 14px body.' },
		{ term: 'Hairlines, not borders', detail: 'A 0.5 to 1px ring plus a soft layered shadow.' },
		{
			term: 'Light from above',
			detail: 'A faint top highlight on raised controls. Press to 0.97.'
		},
		{ term: 'Restraint', detail: 'One primary button per view. Muted secondary text.' },
		{ term: 'Tabular numbers', detail: 'Anything that changes keeps its width.' },
		{
			term: 'Every state designed',
			detail: 'Rest, hover, pressed, focus, disabled, loading, empty, error.'
		},
		{ term: 'Staged motion', detail: 'Shape first, content after. Closes settle flat.' }
	];
</script>

<div class="grid grid-cols-[3fr_2fr] gap-6">
	<SectionCard title="Constitution" description="Eight rules. Every screen follows all of them.">
		<ol class="rules">
			{#each CONSTITUTION as item, i (item.rule)}
				<li class="rule">
					<span class="num">{i + 1}</span>
					<span class="flex min-w-0 flex-col gap-1">
						<span class="text-body font-medium text-fg">{item.rule}</span>
						<span class="text-callout text-muted">{item.detail}</span>
					</span>
				</li>
			{/each}
		</ol>
	</SectionCard>

	<SectionCard title="Why it looks expensive" description="Do all of these, every time.">
		<dl class="traits">
			{#each EXPENSIVE as item (item.term)}
				<div class="trait">
					<dt class="text-callout font-medium text-fg">{item.term}</dt>
					<dd class="text-callout text-muted">{item.detail}</dd>
				</div>
			{/each}
		</dl>
	</SectionCard>
</div>

<style>
	.rules {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rule {
		display: grid;
		grid-template-columns: 1.5rem minmax(0, 1fr);
		gap: 0.75rem;
		align-items: baseline;
	}
	.num {
		color: var(--text-faint);
		font-size: var(--text-callout);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-align: right;
	}
	.traits {
		display: flex;
		flex-direction: column;
		margin: 0;
	}
	.trait {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.625rem 0;
		border-top: 1px solid var(--rule);
	}
	.trait:first-child {
		padding-top: 0;
		border-top: none;
	}
	.trait:last-child {
		padding-bottom: 0;
	}
	dd {
		margin: 0;
	}
</style>

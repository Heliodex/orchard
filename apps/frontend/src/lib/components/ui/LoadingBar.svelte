<script lang="ts">
	let {
		value = null,
		label = undefined,
		labelHidden = false,
		detail = undefined,
		delay = 300,
		class: klass = ''
	}: {
		value?: number | null;
		label?: string;
		labelHidden?: boolean;
		detail?: string;
		delay?: number;
		class?: string;
	} = $props();

	let shown = $state(false);

	$effect(() => {
		const timer = setTimeout(() => (shown = true), delay);
		return () => clearTimeout(timer);
	});

	const percent = $derived(
		value == null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100)
	);
</script>

<div
	class="ui-loadbar {klass}"
	class:ui-loadbar--shown={shown}
	role="progressbar"
	aria-label={label ?? 'Loading'}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={percent ?? undefined}
	aria-busy="true"
>
	{#if (label && !labelHidden) || detail}
		<div class="text">
			{#if label && !labelHidden}<span class="label">{label}</span>{/if}
			{#if detail}<span class="detail">{detail}</span>{/if}
		</div>
	{/if}
	<div class="track">
		{#if percent == null}
			<div class="fill fill--sweep" data-motion="progress"></div>
		{:else}
			<div class="fill" style:width="{percent}%"></div>
		{/if}
	</div>
</div>

<style>
	.ui-loadbar {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
		opacity: 0;
		transition: opacity var(--fade-in) var(--curve-out);
	}
	.ui-loadbar--shown {
		opacity: 1;
	}
	.text {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		min-width: 0;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
	}
	.label {
		min-width: 0;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-muted);
	}
	.detail {
		flex-shrink: 0;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
	}
	.track {
		position: relative;
		height: 0.25rem;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: var(--fill-quiet);
	}
	.fill {
		height: 100%;
		border-radius: inherit;
		background: var(--accent-solid);
		transition: width var(--spring-glide-duration) var(--spring-glide);
	}
	.fill--sweep {
		position: absolute;
		inset: 0 auto 0 0;
		width: 35%;
		animation: sweep 1.3s ease-in-out infinite;
	}
	@keyframes sweep {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(290%);
		}
	}
</style>

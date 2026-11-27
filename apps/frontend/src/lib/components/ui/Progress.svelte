<script lang="ts">
	let {
		value = null,
		max = 100,
		size = 'md',
		tone = 'accent',
		label = undefined,
		labelHidden = false,
		showValue = false,
		detail = undefined
	}: {
		value?: number | null;
		max?: number;
		size?: 'sm' | 'md' | 'lg';
		tone?: 'accent' | 'neutral' | 'success' | 'warning' | 'error';
		label?: string;
		labelHidden?: boolean;
		showValue?: boolean;
		detail?: string;
	} = $props();

	const indeterminate = $derived(value == null);
	const ratio = $derived(indeterminate ? 0 : Math.min(1, Math.max(0, (value ?? 0) / max)));
	const percent = $derived(Math.round(ratio * 100));
	const showHead = $derived(!!label && !labelHidden);
</script>

<div class="progress progress--{size} progress--{tone}">
	{#if showHead}
		<div class="head">
			<span class="label">{label}</span>
			{#if detail}
				<span class="value">{detail}</span>
			{:else if showValue && !indeterminate}
				<span class="value">{percent}%</span>
			{/if}
		</div>
	{/if}
	<div
		class="track"
		role="progressbar"
		aria-label={label ?? 'Progress'}
		aria-valuemin={indeterminate ? undefined : 0}
		aria-valuemax={indeterminate ? undefined : 100}
		aria-valuenow={indeterminate ? undefined : percent}
		aria-busy={indeterminate || undefined}
	>
		{#if indeterminate}
			<span class="sweep" data-motion="progress"></span>
		{:else}
			<span class="fill" style:--ratio={ratio}></span>
		{/if}
	</div>
</div>

<style>
	.progress {
		--bar: 0.25rem;
		--tone: var(--accent);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}
	.progress--sm {
		--bar: 0.125rem;
	}
	.progress--lg {
		--bar: 0.375rem;
	}
	.progress--neutral {
		--tone: var(--neutral-8);
	}
	.progress--success {
		--tone: var(--status-success-solid);
	}
	.progress--warning {
		--tone: var(--status-warning-solid);
	}
	.progress--error {
		--tone: var(--status-error-solid);
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		min-width: 0;
	}
	.label {
		display: block;
		min-width: 0;
		overflow-x: clip;
		padding-block: 0.3em;
		margin-block: -0.3em;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-default);
		white-space: nowrap;
		text-overflow: ellipsis;
		text-box: trim-both cap alphabetic;
	}
	.value {
		display: block;
		flex-shrink: 0;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-box: trim-both cap alphabetic;
	}
	.track {
		position: relative;
		height: var(--bar);
		border-radius: var(--radius-pill);
		background: var(--bg-active);
		overflow: hidden;
		isolation: isolate;
	}
	.fill {
		position: absolute;
		top: 0;
		bottom: 0;
		left: -100%;
		width: 200%;
		border-radius: inherit;
		background: var(--tone);
		transform: translateX(calc((var(--ratio) - 1) * 50%));
		transition: transform var(--spring-glide-duration) var(--spring-glide);
	}
	.sweep {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 40%;
		border-radius: inherit;
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--tone) 0%, transparent),
			var(--tone) 30%,
			var(--tone) 70%,
			color-mix(in oklab, var(--tone) 0%, transparent)
		);
		animation: progress-sweep 1.5s cubic-bezier(0.45, 0, 0.35, 1) infinite;
	}
	@keyframes progress-sweep {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(250%);
		}
	}
</style>

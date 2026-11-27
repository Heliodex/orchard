<script lang="ts">
	import { onMount } from 'svelte';
	import { formatRelativeTime } from '$lib/utils/format';
	import { motion, motionEnabled } from '$lib/utils/motion.svelte';
	import { clock } from '$lib/utils/clock.svelte';
	import { clockOptions, logDisplay } from '$lib/stores/log-display.svelte';

	type Row = { zone: string; date: string; time: string };

	let el = $state<HTMLDivElement | null>(null);
	let anchor = $state<HTMLElement | null>(null);
	let raw = $state<string | null>(null);
	let open = $state(false);
	let x = $state(0);
	let y = $state(0);
	let below = $state(false);

	const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	function parts(d: Date, timeZone: string) {
		const date = new Intl.DateTimeFormat(undefined, {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			timeZone
		}).format(d);
		const time = new Intl.DateTimeFormat(undefined, {
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 3,
			timeZone,
			...clockOptions()
		}).format(d);
		const zone =
			new Intl.DateTimeFormat(undefined, { timeZoneName: 'short', timeZone })
				.formatToParts(d)
				.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
		return { zone, date, time };
	}

	const stamp = $derived.by(() => {
		if (!raw) return null;
		const d = new Date(raw);
		if (Number.isNaN(d.getTime())) return null;
		const first = logDisplay.zone === 'utc' ? parts(d, 'UTC') : parts(d, localZone);
		const second = logDisplay.zone === 'utc' ? parts(d, localZone) : parts(d, 'UTC');
		const rows: Row[] = [first];
		if (second.zone !== first.zone) rows.push(second);
		return { d, rows };
	});

	const ago = $derived(stamp && clock.now ? formatRelativeTime(stamp.d) : '');

	function place() {
		const tip = el;
		const from = anchor;
		if (!tip || !from) return;
		const rect = from.getBoundingClientRect();
		const box = tip.getBoundingClientRect();
		const gap = 8;
		below = rect.top - box.height - gap < 8;
		y = below ? rect.bottom + gap : rect.top - box.height - gap;
		x = Math.min(
			Math.max(8, rect.left + rect.width / 2 - box.width / 2),
			window.innerWidth - box.width - 8
		);
	}

	function show(next: HTMLElement) {
		const fresh = !open;
		anchor = next;
		raw = next.dataset.ts ?? null;
		if (!raw) return;
		open = true;
		requestAnimationFrame(() => {
			place();
			const tip = el;
			if (!tip) return;
			tip.classList.remove('motion-entering');
			motion(
				tip,
				fresh
					? { opacity: [0, 1], scale: [0.96, 1], y: [below ? -4 : 4, 0] }
					: { opacity: 1, scale: 1, y: 0 },
				'snappy'
			);
		});
	}

	function hide() {
		if (!open) return;
		anchor = null;
		const tip = el;
		if (!tip || !motionEnabled()) {
			open = false;
			return;
		}
		motion(tip, { opacity: 0, scale: 0.96 }, 'snappy', { exit: true })?.finished.then(() => {
			if (!anchor) open = false;
		});
	}

	onMount(() => {
		function onOver(event: PointerEvent) {
			const target = event.target;
			const pill =
				target instanceof Element ? (target.closest('.log-ts') as HTMLElement | null) : null;
			if (pill === anchor) return;
			if (pill) show(pill);
			else hide();
		}
		document.addEventListener('pointerover', onOver, { passive: true });
		window.addEventListener('scroll', hide, { capture: true, passive: true });
		window.addEventListener('blur', hide);
		return () => {
			document.removeEventListener('pointerover', onOver);
			window.removeEventListener('scroll', hide, true);
			window.removeEventListener('blur', hide);
		};
	});
</script>

{#if open && stamp}
	<div
		bind:this={el}
		class="log-tip motion-entering"
		role="tooltip"
		style="left: {x}px; top: {y}px;"
	>
		<p class="log-tip-ago">{ago}</p>
		<div class="log-tip-rows">
			{#each stamp.rows as row (row.zone)}
				<span class="log-tip-zone">{row.zone}</span>
				<span class="log-tip-date">{row.date}</span>
				<span class="log-tip-time">{row.time}</span>
			{/each}
		</div>
		<p class="log-tip-raw">{raw}</p>
	</div>
{/if}

<style>
	.log-tip {
		position: fixed;
		z-index: 9999;
		min-width: 15rem;
		max-width: min(24rem, calc(100vw - 1rem));
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
		box-shadow: var(--elev-4);
		pointer-events: none;
		transform-origin: center top;
	}

	.log-tip-ago {
		margin: 0 0 0.5rem;
		color: var(--text-default);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-weight: 600;
	}

	.log-tip-rows {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.3125rem 0.5rem;
	}

	.log-tip-zone {
		padding: 0 0.3125rem;
		border-radius: var(--radius-xs);
		background: var(--fill-soft);
		color: var(--text-muted);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-micro);
		line-height: 1.6;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.log-tip-date {
		color: var(--text-default);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		white-space: nowrap;
	}

	.log-tip-time {
		color: var(--text-muted);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
	}

	.log-tip-raw {
		margin: 0.5rem 0 0;
		padding-top: 0.5rem;
		border-top: 1px solid var(--rule);
		color: var(--text-faint);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		word-break: break-all;
	}
</style>

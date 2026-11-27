<script lang="ts">
	import { RotateCcw } from 'lucide-svelte';
	import Button from './Button.svelte';

	let {
		label,
		value = $bindable(null),
		stops,
		marks = undefined,
		format,
		parse,
		fallback = null,
		fallbackLabel = 'Organization default',
		limit = null,
		limitLabel = 'Your limit',
		usage = null,
		recommended = null,
		disabled = false,
		onchange = undefined
	}: {
		label: string;
		value?: number | null;
		stops: number[];
		marks?: number[];
		format: (n: number) => string;
		parse: (text: string) => number | null;
		fallback?: number | null;
		fallbackLabel?: string;
		limit?: number | null;
		limitLabel?: string;
		usage?: number | null;
		recommended?: number | null;
		disabled?: boolean;
		onchange?: (value: number | null) => void;
	} = $props();

	const uid = $props.id();

	let dragging = $state(false);
	let editing = $state(false);
	let draft = $state('');

	const shown = $derived(value ?? fallback);
	const isDefault = $derived(value == null);
	const display = $derived(
		shown == null
			? fallbackLabel
			: isDefault
				? `${fallbackLabel} · ${format(shown)}`
				: format(shown)
	);
	const exhausted = $derived(limit != null && limit <= 0);
	const ceiling = $derived(limit != null && limit > 0 ? limit : null);
	const over = $derived(shown != null && ceiling != null && shown > ceiling);
	const near = (a: number, b: number) => Math.abs(Math.log(a) - Math.log(b)) < Math.log(1.25);

	const scale = $derived.by(() => {
		const base = [...stops].sort((x, y) => x - y);
		if (ceiling == null) return base;
		const list = base.filter((n) => n < ceiling && !near(n, ceiling));
		let top = base[base.length - 1];
		while (top * 2 < ceiling) {
			top *= 2;
			if (!near(top, ceiling)) list.push(top);
		}
		list.push(ceiling);
		if (shown != null && shown > ceiling) list.push(shown);
		return list.length > 1 ? list : [ceiling / 2, ceiling];
	});
	const usable = $derived(ceiling == null ? scale : scale.filter((n) => n <= ceiling));
	const lo = $derived(Math.log(scale[0]));
	const hi = $derived(Math.log(scale[scale.length - 1]));

	const autoMarks = $derived.by(() => {
		const ends = usable.length ? usable : scale;
		const first = ends[0];
		const last = ends[ends.length - 1];
		const count = 5;
		const picked: number[] = [first];
		for (let k = 1; k < count - 1; k++) {
			const target = Math.exp(
				Math.log(first) + ((Math.log(last) - Math.log(first)) * k) / (count - 1)
			);
			const candidate = ends[nearestIndex(target, ends)];
			const gap = (Math.log(candidate) - Math.log(picked[picked.length - 1])) / (hi - lo || 1);
			const tail = (Math.log(last) - Math.log(candidate)) / (hi - lo || 1);
			if (gap > 0.14 && tail > 0.14) picked.push(candidate);
		}
		if (last !== first) picked.push(last);
		return picked;
	});
	const shownMarks = $derived(marks ?? autoMarks);

	function pos(n: number) {
		if (hi === lo) return 1;
		return Math.min(1, Math.max(0, (Math.log(n) - lo) / (hi - lo)));
	}

	function nearestIndex(n: number, list: number[]) {
		let best = 0;
		for (let i = 1; i < list.length; i++) {
			if (Math.abs(Math.log(list[i]) - Math.log(n)) < Math.abs(Math.log(list[best]) - Math.log(n)))
				best = i;
		}
		return best;
	}

	function commit(next: number | null) {
		if (next === value) return;
		value = next;
		onchange?.(next);
	}

	function fromTrack(p: number) {
		const n = Math.exp(lo + p * (hi - lo));
		const list = usable.length ? usable : scale;
		commit(list[nearestIndex(n, list)]);
	}

	function step(dir: 1 | -1) {
		const list = usable.length ? usable : scale;
		const at = nearestIndex(shown ?? list[0], list);
		const current = list[at];
		let i = at;
		if (shown != null && dir > 0 && current < shown) i = at;
		else if (shown != null && dir < 0 && current > shown) i = at;
		else i = at + dir;
		commit(list[Math.min(list.length - 1, Math.max(0, i))]);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(1);
		else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-1);
		else if (e.key === 'Home') commit((usable.length ? usable : scale)[0]);
		else if (e.key === 'End') commit((usable.length ? usable : scale).at(-1)!);
		else return;
		e.preventDefault();
	}

	function startEdit() {
		draft = shown != null ? format(shown) : '';
		editing = true;
	}

	function finishEdit(el: HTMLInputElement) {
		if (!editing) return;
		editing = false;
		const parsed = parse(draft.trim());
		if (parsed != null && parsed > 0) commit(parsed);
		el.value = display;
	}
</script>

<div class="amount" class:amount--off={disabled || exhausted}>
	<div class="head">
		<label class="label" for="{uid}-value">{label}</label>
		<div class="readout">
			{#if !isDefault && fallback != null}
				<Button
					variant="ghost"
					size="sm"
					icon={RotateCcw}
					label="Use {fallbackLabel.toLowerCase()}"
					{disabled}
					onclick={() => commit(null)}
				/>
			{/if}
			<input
				id="{uid}-value"
				class="value"
				class:value--default={isDefault}
				class:value--over={over}
				value={editing ? draft : display}
				disabled={disabled || exhausted}
				spellcheck="false"
				autocomplete="off"
				aria-describedby="{uid}-note"
				onfocus={(e) => {
					startEdit();
					requestAnimationFrame(() => (e.currentTarget as HTMLInputElement).select());
				}}
				oninput={(e) => (draft = (e.currentTarget as HTMLInputElement).value)}
				onblur={(e) => finishEdit(e.currentTarget as HTMLInputElement)}
				onkeydown={(e) => {
					if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
					if (e.key === 'Escape') {
						editing = false;
						(e.currentTarget as HTMLInputElement).blur();
					}
				}}
			/>
		</div>
	</div>

	<div
		class="track"
		class:track--dragging={dragging}
		style:--at={shown != null ? pos(shown) : 0}
		style:--limit={ceiling != null ? pos(ceiling) : 1}
		style:--used={usage != null ? pos(usage) : 0}
		style:--suggested={recommended != null ? pos(recommended) : 0}
	>
		<div class="rail">
			{#if ceiling != null && pos(ceiling) < 1}<span class="beyond"></span>{/if}
			{#if usage != null}<span class="used"></span>{/if}
			{#if recommended != null}<span class="suggested"></span>{/if}
			{#if shown != null}<span class="fill" class:fill--default={isDefault}></span>{/if}
		</div>
		{#if shown != null}
			<span class="thumb" class:thumb--default={isDefault} class:thumb--over={over}></span>
		{/if}
		<input
			type="range"
			class="range"
			min="0"
			max="1000"
			step="1"
			value={shown != null ? Math.round(pos(shown) * 1000) : 0}
			aria-label={label}
			aria-valuetext={display}
			disabled={disabled || exhausted}
			oninput={(e) => fromTrack(Number((e.currentTarget as HTMLInputElement).value) / 1000)}
			onpointerdown={() => (dragging = true)}
			onpointerup={() => (dragging = false)}
			onpointercancel={() => (dragging = false)}
			{onkeydown}
		/>
	</div>

	<div class="marks" aria-hidden="true">
		{#each shownMarks as mark (mark)}
			<span
				class="mark"
				class:mark--beyond={ceiling != null && mark > ceiling}
				style:--p={pos(mark)}>{format(mark)}</span
			>
		{/each}
	</div>

	<p class="note" id="{uid}-note">
		{#if exhausted}
			<span class="note--over">Nothing left in your allowance</span>
		{:else if over && isDefault}
			<span class="note--over"
				>{fallbackLabel} is more than the {format(ceiling!)} you have left</span
			>
		{:else if over}
			<span class="note--over">Over {limitLabel.toLowerCase()} of {format(ceiling!)}</span>
		{:else if usage != null}
			Using {format(usage)} right now
		{:else if ceiling != null}
			{format(ceiling)} available
		{/if}
	</p>
</div>

<style>
	.amount {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	.amount--off {
		opacity: 0.55;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-height: 2rem;
	}
	.label {
		font-size: var(--text-body);
		line-height: var(--lh-body);
		font-weight: var(--weight-medium);
		color: var(--text-default);
	}
	.readout {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.value {
		field-sizing: content;
		min-width: 3.5rem;
		height: 2rem;
		padding: 0 0.625rem;
		border: none;
		border-radius: calc(0.5rem * var(--corner-scale));
		corner-shape: var(--corner);
		background: var(--fill-quiet);
		color: var(--text-default);
		font: inherit;
		font-variation-settings: 'ROND' var(--rond);
		font-size: var(--text-headline);
		font-weight: var(--weight-semibold);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		text-align: right;
		transition: background-color var(--fade-in) var(--curve-out);
	}
	.value:hover:not(:disabled) {
		background: var(--bg-hover);
	}
	.value:focus-visible {
		outline: none;
		background: var(--bg-raised);
		box-shadow:
			inset 0 0 0 1px var(--accent-solid),
			0 0 0 3px var(--focus-ring);
	}
	.value--default {
		font-weight: var(--weight-medium);
		color: var(--text-muted);
	}
	.value--over {
		color: var(--status-error);
	}
	.track {
		position: relative;
		height: 1.5rem;
		margin: 0 0.5625rem;
	}
	.rail {
		position: absolute;
		inset: 50% 0 auto;
		height: 0.375rem;
		border-radius: var(--radius-pill);
		background: var(--fill-quiet);
		box-shadow: inset 0 0 0 0.5px var(--rule);
		overflow: hidden;
		transform: translateY(-50%);
	}
	.beyond {
		position: absolute;
		inset: 0 0 0 calc(var(--limit) * 100%);
		background: repeating-linear-gradient(
			-45deg,
			color-mix(in oklab, var(--neutral-10) 10%, transparent) 0 2px,
			transparent 2px 5px
		);
	}
	.used {
		position: absolute;
		inset: 0 auto 0 0;
		width: calc(var(--used) * 100%);
		background: color-mix(in oklab, var(--accent-solid) 30%, transparent);
	}
	.suggested {
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(var(--suggested) * 100% - 1px);
		width: 2px;
		background: var(--status-success-solid);
		z-index: 1;
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		width: calc(var(--at) * 100%);
		background: var(--accent-solid);
		transition: width var(--spring-glide-duration) var(--spring-glide);
	}
	.fill--default {
		background: color-mix(in oklab, var(--neutral-10) 22%, transparent);
	}
	.thumb {
		position: absolute;
		top: 50%;
		left: calc(var(--at) * 100%);
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 50%;
		background: var(--bg-raised);
		box-shadow:
			0 0 0 0.5px color-mix(in oklab, var(--neutral-10) 18%, transparent),
			0 1px 3px color-mix(in oklab, var(--neutral-10) 22%, transparent);
		transform: translate(-50%, -50%);
		transition: left var(--spring-glide-duration) var(--spring-glide);
		pointer-events: none;
	}
	.thumb--default {
		box-shadow:
			inset 0 0 0 1.5px color-mix(in oklab, var(--neutral-10) 30%, transparent),
			0 1px 2px color-mix(in oklab, var(--neutral-10) 14%, transparent);
	}
	.thumb--over {
		box-shadow:
			inset 0 0 0 2px var(--status-error),
			0 1px 3px color-mix(in oklab, var(--neutral-10) 22%, transparent);
	}
	.track--dragging .fill,
	.track--dragging .thumb {
		transition: none;
	}
	.range {
		position: absolute;
		inset: 0 -0.5625rem;
		width: calc(100% + 1.125rem);
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.range:disabled {
		cursor: not-allowed;
	}
	.track:has(.range:focus-visible) .thumb {
		box-shadow:
			0 0 0 3px var(--focus-ring),
			0 1px 3px color-mix(in oklab, var(--neutral-10) 22%, transparent);
	}
	.marks {
		position: relative;
		height: 1rem;
		margin: 0 0.5625rem;
	}
	.mark {
		position: absolute;
		left: calc(var(--p) * 100%);
		font-size: var(--text-caption);
		line-height: 1rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		--rond: var(--rond-data);
		white-space: nowrap;
		transform: translateX(-50%);
	}
	.mark:first-child {
		transform: translateX(-0.5625rem);
	}
	.mark:last-child {
		transform: translateX(calc(-100% + 0.5625rem));
	}
	.mark--beyond {
		color: var(--text-faint);
	}
	.note {
		min-height: 1.125rem;
		margin: 0;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
	}
	.note--over {
		color: var(--status-error);
	}
</style>

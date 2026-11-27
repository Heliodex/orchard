<script lang="ts">
	let {
		golden = true,
		contained = false,
		lines = []
	}: {
		golden?: boolean;
		contained?: boolean;
		lines?: { axis: 'x' | 'y'; at: number; label?: string }[];
	} = $props();

	let svg: SVGSVGElement | undefined = $state();

	const PHI = (1 + Math.sqrt(5)) / 2;
	const DEPTH = 9;

	let w = $state(0);
	let h = $state(0);

	$effect(() => {
		const host = contained ? svg?.parentElement : null;
		if (host) {
			const ro = new ResizeObserver(() => {
				w = host.clientWidth;
				h = host.clientHeight;
			});
			ro.observe(host);
			return () => ro.disconnect();
		}
		const measure = () => {
			w = window.innerWidth;
			h = window.innerHeight;
		};
		measure();
		window.addEventListener('resize', measure);
		return () => window.removeEventListener('resize', measure);
	});

	type Square = { x: number; y: number; s: number; arc: string };

	const squares = $derived.by(() => {
		const out: Square[] = [];
		let x = 0;
		let y = 0;
		let rw = w;
		let rh = h;
		for (let i = 0; i < DEPTH && rw > 2 && rh > 2; i++) {
			const turn = i % 4;
			if (turn === 0) {
				const s = Math.min(rh, rw);
				out.push({ x, y, s, arc: `M${x} ${y + s}A${s} ${s} 0 0 1 ${x + s} ${y}` });
				x += s;
				rw -= s;
			} else if (turn === 1) {
				const s = Math.min(rw, rh);
				out.push({ x, y, s, arc: `M${x} ${y}A${s} ${s} 0 0 1 ${x + s} ${y + s}` });
				y += s;
				rh -= s;
			} else if (turn === 2) {
				const s = Math.min(rh, rw);
				const sx = x + rw - s;
				out.push({ x: sx, y, s, arc: `M${sx + s} ${y}A${s} ${s} 0 0 1 ${sx} ${y + s}` });
				rw -= s;
			} else {
				const s = Math.min(rw, rh);
				const sy = y + rh - s;
				out.push({ x, y: sy, s, arc: `M${x + s} ${sy + s}A${s} ${s} 0 0 1 ${x} ${sy}` });
				rh -= s;
			}
		}
		return out;
	});

	const cols = $derived([w / PHI / PHI, w / PHI]);
	const rows = $derived([h / PHI / PHI, h / PHI]);
</script>

<svg
	bind:this={svg}
	class="reticle"
	class:reticle--contained={contained}
	viewBox="0 0 {w} {h}"
	width={w}
	height={h}
	aria-hidden="true"
>
	{#each lines as l, i (i)}
		{#if l.axis === 'x'}
			<line class="measure" x1={l.at} y1="0" x2={l.at} y2={h} />
			{#if l.label}<text class="label" x={l.at + 4} y={h - 8}>{l.label}</text>{/if}
		{:else}
			<line class="measure" x1="0" y1={l.at} x2={w} y2={l.at} />
			{#if l.label}<text class="label" x={w - 6} y={l.at - 4} text-anchor="end">{l.label}</text
				>{/if}
		{/if}
	{/each}
	{#if golden}
		{#each squares as sq, i (i)}
			<rect class="square" x={sq.x} y={sq.y} width={sq.s} height={sq.s} />
		{/each}
		<path class="spiral" d={squares.map((sq) => sq.arc).join('')} />
		{#each cols as x, i (i)}
			<line class="axis" x1={x} y1="0" x2={x} y2={h} />
			<text class="label" x={x + 6} y="16">{i === 0 ? '0.382' : '0.618'} w</text>
		{/each}
		{#each rows as y, i (i)}
			<line class="axis" x1="0" y1={y} x2={w} y2={y} />
			<text class="label" x="6" y={y - 6}>{i === 0 ? '0.382' : '0.618'} h</text>
		{/each}
		<line class="center" x1={w / 2} y1="0" x2={w / 2} y2={h} />
		<line class="center" x1="0" y1={h / 2} x2={w} y2={h / 2} />
	{/if}
</svg>

<style>
	.reticle {
		position: fixed;
		inset: 0;
		z-index: var(--z-tooltip);
		pointer-events: none;
	}
	.reticle--contained {
		position: absolute;
		z-index: 2;
	}
	.square {
		fill: none;
		stroke: color-mix(in oklab, var(--blue-solid) 45%, transparent);
		stroke-width: 1;
	}
	.spiral {
		fill: none;
		stroke: var(--blue-solid);
		stroke-width: 1.5;
	}
	.axis {
		stroke: color-mix(in oklab, var(--blue-solid) 80%, transparent);
		stroke-width: 1;
		stroke-dasharray: 6 4;
	}
	.center {
		stroke: color-mix(in oklab, var(--neutral-10) 25%, transparent);
		stroke-width: 1;
		stroke-dasharray: 2 4;
	}
	.measure {
		stroke: color-mix(in oklab, var(--red-solid) 70%, transparent);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}
	.label {
		fill: var(--blue-solid);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: 10px;
	}
</style>

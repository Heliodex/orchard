<script lang="ts">
	import { onMount } from 'svelte';
	import { animate, stagger } from 'motion';
	import { transition, decorativeMotion, motionEnabled } from '$lib/utils/motion.svelte';

	let { onSettled, instant = false }: { onSettled: () => void; instant?: boolean } = $props();

	let field = $state<HTMLElement | null>(null);
	let crest = $state<SVGSVGElement | null>(null);
	let crestPath = $state('');
	let crestWidth = $state(0);
	let done = false;

	const LETTERS = 'orchard'.split('');
	const LOBES = 6;
	const CREST_HEIGHT = 124;
	const RESTING_BAND = 0.2;
	const LOCKUP_CLEARANCE = 88;

	function wavePath(width: number): string {
		const step = width / LOBES;
		const rnd = (a: number, b: number) => a + Math.random() * (b - a);
		const ys: number[] = [];
		const jitter: number[] = [];
		for (let i = 0; i < LOBES; i += 1) {
			ys.push(
				i % 2
					? rnd(CREST_HEIGHT * 0.8, CREST_HEIGHT * 0.62)
					: rnd(CREST_HEIGHT * 0.38, CREST_HEIGHT * 0.18)
			);
			jitter.push(i ? rnd(-step * 0.05, step * 0.05) : 0);
		}
		const at = (i: number) => {
			const j = ((i % LOBES) + LOBES) % LOBES;
			return { x: i * step + jitter[j], y: ys[j] };
		};
		const last = LOBES * 2;
		let d = `M${at(-1).x.toFixed(1)},${at(-1).y.toFixed(1)} `;
		for (let i = -1; i <= last; i += 1) {
			const p0 = at(i - 1);
			const p1 = at(i);
			const p2 = at(i + 1);
			const p3 = at(i + 2);
			d += `C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} `;
			d += `${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} `;
			d += `${p2.x.toFixed(1)},${p2.y.toFixed(1)} `;
		}
		return `${d}L${((last + 2) * step).toFixed(1)},${CREST_HEIGHT} L${(-2 * step).toFixed(1)},${CREST_HEIGHT} Z`;
	}

	let drift: { stop: () => void } | null = null;

	function drawCrest() {
		if (!crest) return;
		const width = window.innerWidth;
		drift?.stop();
		crestWidth = width * 2;
		crestPath = wavePath(width);
		if (!decorativeMotion()) return;
		drift = animate(crest, { x: [0, -width] }, { duration: 22, ease: 'linear', repeat: Infinity });
	}

	const playing: { stop: () => void }[] = [];

	const play = ((...args: Parameters<typeof animate>) => {
		const controls = animate(...args);
		playing.push(controls);
		return controls;
	}) as typeof animate;

	function settle() {
		if (done) return;
		done = true;
		onSettled();
	}

	function band(fraction: number) {
		return `${window.innerHeight * fraction}px`;
	}

	function restingBand(fraction: number) {
		const height = window.innerHeight;
		const ceiling = Math.max(height - LOCKUP_CLEARANCE - CREST_HEIGHT, height * RESTING_BAND);
		return `${Math.min(height * fraction, ceiling)}px`;
	}

	async function overture() {
		const root = document.documentElement;
		const petals = Array.from(document.querySelectorAll('.setup-petal'));
		if (!petals.length) {
			settle();
			return;
		}
		const rings = Array.from(document.querySelectorAll('.setup-ring'));
		const chars = Array.from(document.querySelectorAll('.setup-word span'));
		const lockups = Array.from(document.querySelectorAll('.setup-lockup'));
		const mark = document.querySelector('.setup-mark');

		// `instant` is the return leg of a trip off-site, such as creating the
		// GitHub App. Replaying the overture there would make the operator sit
		// through the whole opening again to get back to the step they left.
		if (instant || !decorativeMotion() || !mark) {
			rest();
			settle();
			return;
		}

		const box = mark.getBoundingClientRect();
		const offset = Math.round(window.innerWidth / 2 - (box.left + box.width / 2));
		play(lockups, { x: offset }, { duration: 0 });

		rings.forEach((ring) => {
			const length = (ring as SVGPathElement).getTotalLength();
			(ring as SVGPathElement).style.strokeDasharray = String(length);
			(ring as SVGPathElement).style.strokeDashoffset = String(length);
		});

		await pause(360);
		if (done) return;
		play(
			petals,
			{ scale: [0, 1], opacity: [0, 1] },
			{
				...transition('bouncy'),
				delay: stagger(0.15)
			}
		);

		await pause(980);
		if (done) return;
		play(rings, { strokeDashoffset: [null, 0] }, { duration: 0.9, ease: [0.32, 0.72, 0, 1] });

		await pause(840);
		if (done) return;
		play(
			Array.from(document.querySelectorAll('.setup-ringband')),
			{ opacity: [0, 1] },
			{ duration: 0.28 }
		);
		play(rings, { opacity: [1, 0] }, { duration: 0.28, delay: 0.1 });
		play([mark], { scale: [1, 1.12, 1] }, { duration: 0.5, ease: [0.34, 1.4, 0.4, 1] });

		await pause(360);
		if (done) return;
		play(lockups, { x: [null, 0] }, transition('smooth'));
		play(
			chars,
			{
				opacity: [0, 1],
				transform: ['rotateX(80deg) translateY(34px)', 'rotateX(0deg) translateY(0px)'],
				filter: ['blur(14px)', 'blur(0px)']
			},
			{ ...transition('smooth'), delay: stagger(0.09) }
		);

		await pause(1020);
		if (done) return;
		play('.setup-wash', { opacity: [0, 1] }, { duration: 1.5, ease: [0.22, 0.61, 0.36, 1] });
		play('.setup-crest', { opacity: [0, 1] }, { duration: 0.4 });
		await play(
			root,
			{ '--setup-band': [null, band(1.15)] },
			{
				duration: 1.15,
				ease: [0.5, 0, 0.25, 1]
			}
		).finished;
		if (done) return;

		play(lockups, { scale: [1, 1.05] }, { duration: 0.9, ease: 'easeOut' });
		await pause(640);
		if (done) return;

		// The closing move covers most of the viewport twice over: the band drops
		// about 95% of the screen while the lockup flies half of it and shrinks
		// to under a third. `cinematic` is sized for exactly this; the panel
		// springs turn it into a cut.
		const travel = window.innerHeight / 2 - 52;
		play(root, { '--setup-band': [null, band(RESTING_BAND)] }, transition('cinematic'));
		play(lockups, { scale: [1.05, 0.3], y: [0, -travel] }, transition('cinematic'));
		play([mark], { rotate: [0, -14] }, transition('cinematic'));
		// Roughly two thirds of the way through the flight: late enough to read as
		// following the lockup up rather than racing it, early enough that they are
		// still one move.
		await pause(400);
		if (done) return;
		settle();
	}

	function pause(ms: number) {
		return new Promise<void>((resolve) => setTimeout(resolve, ms));
	}

	// The resting frame, written directly rather than animated. Both the skip
	// handler and the reduced-motion path need it: every piece of the lockup
	// starts hidden in CSS and is revealed by the overture, so anything that
	// bypasses the overture has to reveal it or the mark renders as an empty
	// outline with no petals and no word.
	function rest() {
		const root = document.documentElement;
		root.style.setProperty('--setup-band', band(RESTING_BAND));
		document.querySelectorAll('.setup-petal').forEach((el) => {
			(el as HTMLElement).style.opacity = '1';
			(el as HTMLElement).style.transform = 'scale(1)';
		});
		document
			.querySelectorAll('.setup-ringband')
			.forEach((el) => ((el as HTMLElement).style.opacity = '1'));
		document
			.querySelectorAll('.setup-ring')
			.forEach((el) => ((el as HTMLElement).style.opacity = '0'));
		document.querySelectorAll('.setup-word span').forEach((el) => {
			(el as HTMLElement).style.opacity = '1';
			(el as HTMLElement).style.transform = 'none';
			(el as HTMLElement).style.filter = 'none';
		});
		document.querySelectorAll('.setup-lockup').forEach((el) => {
			(el as HTMLElement).style.transform =
				`translateY(${-(window.innerHeight / 2 - 52)}px) scale(0.3)`;
		});
		document
			.querySelectorAll('.setup-mark')
			.forEach((el) => ((el as HTMLElement).style.transform = 'rotate(-14deg)'));
		const wash = document.querySelector('.setup-wash') as HTMLElement | null;
		const crestEl = document.querySelector('.setup-crest') as HTMLElement | null;
		if (wash) wash.style.opacity = '1';
		if (crestEl) crestEl.style.opacity = '1';
	}

	function skip() {
		if (done) return;
		playing.forEach((controls) => controls.stop());
		rest();
		settle();
	}

	export function raiseBand(fraction: number) {
		if (!motionEnabled()) {
			document.documentElement.style.setProperty('--setup-band', restingBand(fraction));
			return;
		}
		animate(
			document.documentElement,
			{ '--setup-band': [null, restingBand(fraction)] },
			transition('smooth')
		);
	}

	onMount(() => {
		drawCrest();
		let timer: ReturnType<typeof setTimeout>;
		const onResize = () => {
			clearTimeout(timer);
			timer = setTimeout(drawCrest, 180);
		};
		window.addEventListener('resize', onResize);
		animate('.setup-grain', { opacity: [0, 0.62] }, { duration: 1.2 });
		// A throw anywhere in the overture would leave settle() uncalled, and the
		// card only mounts once the scene reports settled. That is a first-run
		// flow with no way past it: the operator is stuck on a splash screen and
		// cannot claim their own instance. Any failure drops to the resting frame.
		overture().catch((e) => {
			console.error('[setup] overture failed, showing the resting frame', e);
			rest();
			settle();
		});
		return () => {
			window.removeEventListener('resize', onResize);
			drift?.stop();
			clearTimeout(timer);
		};
	});
</script>

<svelte:window onpointerdown={skip} onkeydown={skip} />

<div class="setup-field" bind:this={field} aria-hidden="true">
	<div class="setup-wash"></div>
	<div class="setup-grain"></div>
	<div class="setup-band">
		<svg
			class="setup-crest"
			bind:this={crest}
			width={crestWidth}
			height={CREST_HEIGHT}
			viewBox="0 0 {crestWidth} {CREST_HEIGHT}"
			preserveAspectRatio="none"
		>
			<path d={crestPath} fill="var(--setup-crimson)" />
		</svg>
	</div>
</div>

<div class="setup-layer" aria-hidden="true">
	<div class="setup-lockup">
		<div class="setup-mark">
			<svg viewBox="0 0 56 56">
				<path
					class="setup-ring"
					d="M54.0025 18.5359C56.5651 25.5766 54.0659 33.2235 48.3656 37.4967C48.7562 44.6101 44.5049 51.44 37.4641 54.0026C30.4233 56.5652 22.7752 54.0666 18.5021 48.3661C11.3891 48.7562 4.55993 44.5045 1.99747 37.4642C-0.565038 30.4238 1.93287 22.7759 7.63264 18.5026C7.24243 11.3895 11.4954 4.56003 18.5358 1.99753C25.5761 -0.564934 33.2228 1.93361 37.4962 7.63315C44.6097 7.24236 51.4399 11.495 54.0025 18.5359Z"
				/>
				<path
					class="setup-ringband"
					d="M48.802 20.4287C46.7767 14.8641 40.753 11.9111 35.1562 13.6323C34.9755 13.6879 34.795 13.748 34.6153 13.8134C34.5499 13.6337 34.48 13.4569 34.4064 13.2827C32.1274 7.88886 25.9933 5.17268 20.4287 7.19803C14.8641 9.22338 11.911 15.247 13.6323 20.8438C13.6879 21.0246 13.7479 21.205 13.8133 21.3847C13.6336 21.4501 13.4568 21.5201 13.2826 21.5937C7.8888 23.8727 5.17262 30.0068 7.19797 35.5714C9.28874 41.3157 15.6403 44.2775 21.3846 42.1867C23.4754 47.931 29.827 50.8928 35.5713 48.8021C41.3156 46.7113 44.2774 40.3597 42.1867 34.6154C47.931 32.5246 50.8928 26.1731 48.802 20.4287ZM29.8928 33.2006C30.4244 33.0071 30.9664 32.9008 31.5034 32.8732C32.8729 33.962 34.4856 34.7137 36.2 35.0632C36.5244 35.4926 36.7925 35.9761 36.9862 36.5082C38.0315 39.3804 36.5506 42.5562 33.6785 43.6016C30.8063 44.6469 27.6305 43.166 26.5851 40.2939C26.3915 39.7619 26.2848 39.2194 26.2573 38.682C27.3461 37.3123 28.098 35.7 28.4473 33.9855C28.8767 33.6611 29.3608 33.3942 29.8928 33.2006ZM15.7062 26.5852C16.2377 26.3917 16.7798 26.2854 17.3167 26.2578C18.6863 27.3467 20.2989 28.0983 22.0133 28.4479C22.3378 28.8773 22.6058 29.3607 22.7995 29.8929C22.993 30.4246 23.098 30.9668 23.1256 31.5039C22.037 32.8734 21.2849 34.4862 20.9356 36.2005C20.5064 36.5246 20.0235 36.7927 19.4918 36.9862C16.6197 38.0316 13.4439 36.5507 12.3985 33.6785C11.3531 30.8064 12.834 27.6306 15.7062 26.5852ZM36.5082 19.0139C39.3803 17.9685 42.5561 19.4494 43.6015 22.3216C44.6469 25.1937 43.166 28.3695 40.2938 29.4149C39.7617 29.6086 39.219 29.714 38.6815 29.7415C37.3118 28.6529 35.6994 27.9007 33.985 27.5514C33.661 27.1224 33.394 26.6388 33.2005 26.1072C33.0069 25.5752 32.9001 25.0328 32.8726 24.4954C33.9615 23.1257 34.7133 21.5134 35.0627 19.7988C35.492 19.4745 35.9762 19.2075 36.5082 19.0139ZM22.3215 12.3985C25.1937 11.3532 28.3695 12.8341 29.4148 15.7062C29.6084 16.2379 29.7134 16.7802 29.741 17.3172C28.6523 18.6868 27.9003 20.2996 27.5509 22.0138C27.1218 22.3379 26.6389 22.606 26.1072 22.7995C25.575 22.9932 25.0324 23.0987 24.4949 23.1261C23.1251 22.0375 21.5127 21.2853 19.7983 20.9361C19.4743 20.507 19.2073 20.0235 19.0138 19.4919C17.9684 16.6197 19.4493 13.4439 22.3215 12.3985ZM54.0025 18.5359C56.5651 25.5766 54.0659 33.2235 48.3656 37.4967C48.7562 44.6101 44.5049 51.44 37.4641 54.0026C30.4233 56.5652 22.7752 54.0666 18.5021 48.3661C11.3891 48.7562 4.55993 44.5045 1.99747 37.4642C-0.565038 30.4238 1.93287 22.7759 7.63264 18.5026C7.24243 11.3895 11.4954 4.56003 18.5358 1.99753C25.5761 -0.564934 33.2228 1.93361 37.4962 7.63315C44.6097 7.24236 51.4399 11.495 54.0025 18.5359Z"
					opacity="0"
				/>
				<path
					class="setup-petal"
					opacity="0"
					d="M29.4148 15.7062C30.4602 18.5784 28.9793 21.7542 26.1072 22.7996C23.235 23.8449 20.0592 22.364 19.0138 19.4919C17.9685 16.6197 19.4493 13.4439 22.3215 12.3986C25.1937 11.3532 28.3695 12.8341 29.4148 15.7062Z"
				/>
				<path
					class="setup-petal"
					opacity="0"
					d="M36.9862 36.5081C38.0315 39.3803 36.5506 42.5561 33.6785 43.6014C30.8063 44.6468 27.6305 43.1659 26.5852 40.2938C25.5398 37.4216 27.0207 34.2458 29.8928 33.2004C32.765 32.1551 35.9408 33.6359 36.9862 36.5081Z"
				/>
				<path
					class="setup-petal"
					opacity="0"
					d="M43.6015 22.3216C44.6469 25.1937 43.166 28.3695 40.2938 29.4149C37.4217 30.4603 34.2459 28.9794 33.2005 26.1072C32.1551 23.2351 33.636 20.0593 36.5082 19.0139C39.3803 17.9685 42.5561 19.4494 43.6015 22.3216Z"
				/>
				<path
					class="setup-petal"
					opacity="0"
					d="M22.7995 29.8928C23.8449 32.7649 22.364 35.9407 19.4918 36.9861C16.6196 38.0315 13.4439 36.5506 12.3985 33.6784C11.3531 30.8063 12.834 27.6305 15.7062 26.5851C18.5783 25.5397 21.7541 27.0206 22.7995 29.8928Z"
				/>
			</svg>
		</div>
		<div class="setup-word">
			{#each LETTERS as letter, i (i)}<span>{letter}</span>{/each}
		</div>
	</div>
</div>

<div class="setup-layer setup-layer--inverted" aria-hidden="true">
	<div class="setup-lockup">
		<div class="setup-mark">
			<svg viewBox="0 0 56 56">
				<path
					class="setup-ring"
					d="M54.0025 18.5359C56.5651 25.5766 54.0659 33.2235 48.3656 37.4967C48.7562 44.6101 44.5049 51.44 37.4641 54.0026C30.4233 56.5652 22.7752 54.0666 18.5021 48.3661C11.3891 48.7562 4.55993 44.5045 1.99747 37.4642C-0.565038 30.4238 1.93287 22.7759 7.63264 18.5026C7.24243 11.3895 11.4954 4.56003 18.5358 1.99753C25.5761 -0.564934 33.2228 1.93361 37.4962 7.63315C44.6097 7.24236 51.4399 11.495 54.0025 18.5359Z"
				/>
				<path
					class="setup-ringband"
					d="M48.802 20.4287C46.7767 14.8641 40.753 11.9111 35.1562 13.6323C34.9755 13.6879 34.795 13.748 34.6153 13.8134C34.5499 13.6337 34.48 13.4569 34.4064 13.2827C32.1274 7.88886 25.9933 5.17268 20.4287 7.19803C14.8641 9.22338 11.911 15.247 13.6323 20.8438C13.6879 21.0246 13.7479 21.205 13.8133 21.3847C13.6336 21.4501 13.4568 21.5201 13.2826 21.5937C7.8888 23.8727 5.17262 30.0068 7.19797 35.5714C9.28874 41.3157 15.6403 44.2775 21.3846 42.1867C23.4754 47.931 29.827 50.8928 35.5713 48.8021C41.3156 46.7113 44.2774 40.3597 42.1867 34.6154C47.931 32.5246 50.8928 26.1731 48.802 20.4287ZM29.8928 33.2006C30.4244 33.0071 30.9664 32.9008 31.5034 32.8732C32.8729 33.962 34.4856 34.7137 36.2 35.0632C36.5244 35.4926 36.7925 35.9761 36.9862 36.5082C38.0315 39.3804 36.5506 42.5562 33.6785 43.6016C30.8063 44.6469 27.6305 43.166 26.5851 40.2939C26.3915 39.7619 26.2848 39.2194 26.2573 38.682C27.3461 37.3123 28.098 35.7 28.4473 33.9855C28.8767 33.6611 29.3608 33.3942 29.8928 33.2006ZM15.7062 26.5852C16.2377 26.3917 16.7798 26.2854 17.3167 26.2578C18.6863 27.3467 20.2989 28.0983 22.0133 28.4479C22.3378 28.8773 22.6058 29.3607 22.7995 29.8929C22.993 30.4246 23.098 30.9668 23.1256 31.5039C22.037 32.8734 21.2849 34.4862 20.9356 36.2005C20.5064 36.5246 20.0235 36.7927 19.4918 36.9862C16.6197 38.0316 13.4439 36.5507 12.3985 33.6785C11.3531 30.8064 12.834 27.6306 15.7062 26.5852ZM36.5082 19.0139C39.3803 17.9685 42.5561 19.4494 43.6015 22.3216C44.6469 25.1937 43.166 28.3695 40.2938 29.4149C39.7617 29.6086 39.219 29.714 38.6815 29.7415C37.3118 28.6529 35.6994 27.9007 33.985 27.5514C33.661 27.1224 33.394 26.6388 33.2005 26.1072C33.0069 25.5752 32.9001 25.0328 32.8726 24.4954C33.9615 23.1257 34.7133 21.5134 35.0627 19.7988C35.492 19.4745 35.9762 19.2075 36.5082 19.0139ZM22.3215 12.3985C25.1937 11.3532 28.3695 12.8341 29.4148 15.7062C29.6084 16.2379 29.7134 16.7802 29.741 17.3172C28.6523 18.6868 27.9003 20.2996 27.5509 22.0138C27.1218 22.3379 26.6389 22.606 26.1072 22.7995C25.575 22.9932 25.0324 23.0987 24.4949 23.1261C23.1251 22.0375 21.5127 21.2853 19.7983 20.9361C19.4743 20.507 19.2073 20.0235 19.0138 19.4919C17.9684 16.6197 19.4493 13.4439 22.3215 12.3985ZM54.0025 18.5359C56.5651 25.5766 54.0659 33.2235 48.3656 37.4967C48.7562 44.6101 44.5049 51.44 37.4641 54.0026C30.4233 56.5652 22.7752 54.0666 18.5021 48.3661C11.3891 48.7562 4.55993 44.5045 1.99747 37.4642C-0.565038 30.4238 1.93287 22.7759 7.63264 18.5026C7.24243 11.3895 11.4954 4.56003 18.5358 1.99753C25.5761 -0.564934 33.2228 1.93361 37.4962 7.63315C44.6097 7.24236 51.4399 11.495 54.0025 18.5359Z"
					opacity="0"
				/>
				<path
					class="setup-petal"
					opacity="0"
					d="M29.4148 15.7062C30.4602 18.5784 28.9793 21.7542 26.1072 22.7996C23.235 23.8449 20.0592 22.364 19.0138 19.4919C17.9685 16.6197 19.4493 13.4439 22.3215 12.3986C25.1937 11.3532 28.3695 12.8341 29.4148 15.7062Z"
				/>
				<path
					class="setup-petal"
					opacity="0"
					d="M36.9862 36.5081C38.0315 39.3803 36.5506 42.5561 33.6785 43.6014C30.8063 44.6468 27.6305 43.1659 26.5852 40.2938C25.5398 37.4216 27.0207 34.2458 29.8928 33.2004C32.765 32.1551 35.9408 33.6359 36.9862 36.5081Z"
				/>
				<path
					class="setup-petal"
					opacity="0"
					d="M43.6015 22.3216C44.6469 25.1937 43.166 28.3695 40.2938 29.4149C37.4217 30.4603 34.2459 28.9794 33.2005 26.1072C32.1551 23.2351 33.636 20.0593 36.5082 19.0139C39.3803 17.9685 42.5561 19.4494 43.6015 22.3216Z"
				/>
				<path
					class="setup-petal"
					opacity="0"
					d="M22.7995 29.8928C23.8449 32.7649 22.364 35.9407 19.4918 36.9861C16.6196 38.0315 13.4439 36.5506 12.3985 33.6784C11.3531 30.8063 12.834 27.6305 15.7062 26.5851C18.5783 25.5397 21.7541 27.0206 22.7995 29.8928Z"
				/>
			</svg>
		</div>
		<div class="setup-word">
			{#each LETTERS as letter, i (i)}<span>{letter}</span>{/each}
		</div>
	</div>
</div>

<style>
	:global(:root) {
		--setup-band: 0px;
	}

	.setup-field {
		position: fixed;
		inset: 0;
		background: var(--setup-field);
		pointer-events: none;
	}

	.setup-wash {
		position: absolute;
		inset: 0;
		opacity: 0;
		background:
			radial-gradient(50% 40% at 4% 0%, rgba(233, 140, 155, 0.42), transparent 68%),
			radial-gradient(48% 38% at 97% 2%, rgba(250, 186, 110, 0.46), transparent 70%),
			radial-gradient(52% 32% at 46% -8%, rgba(178, 166, 236, 0.34), transparent 68%),
			radial-gradient(40% 30% at 76% 18%, rgba(146, 214, 192, 0.3), transparent 70%);
	}

	.setup-grain {
		position: absolute;
		inset: -50%;
		opacity: 0;
		z-index: 3;
		mix-blend-mode: multiply;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");
	}

	.setup-band {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1;
		height: var(--setup-band);
		background: linear-gradient(180deg, var(--setup-crimson) 0%, var(--setup-crimson-deep) 100%);
	}

	.setup-crest {
		position: absolute;
		left: 0;
		bottom: 100%;
		display: block;
		opacity: 0;
		pointer-events: none;
	}

	.setup-layer {
		position: fixed;
		inset: 0;
		z-index: 4;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.setup-layer--inverted {
		clip-path: inset(calc(100% - var(--setup-band)) 0 0 0);
	}

	.setup-layer--inverted .setup-mark {
		color: var(--setup-field);
	}

	.setup-layer--inverted .setup-word {
		color: var(--setup-field);
	}

	.setup-lockup {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.setup-mark {
		width: 132px;
		height: 132px;
		flex: none;
		color: var(--setup-crimson);
	}

	.setup-mark svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.setup-petal,
	.setup-ringband {
		fill: currentColor;
	}

	/*
	  The hidden start is `opacity="0"` on each path, and it has to stay an
	  attribute. Motion writes opacity on an SVG element as a presentation
	  attribute, which any CSS declaration outranks, so an `opacity: 0` here
	  pins the petals invisible while the animation runs to completion against
	  a value nothing is reading.
	*/
	.setup-petal {
		transform-box: fill-box;
		transform-origin: center;
		transform: scale(0);
	}

	.setup-ring {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.4;
		stroke-linecap: round;
		stroke-dasharray: 1000;
		stroke-dashoffset: 1000;
	}

	.setup-word {
		display: flex;
		color: var(--setup-ink);
		font-size: 96px;
		font-weight: 600;
		letter-spacing: -0.028em;
		line-height: 1;
	}

	.setup-word span {
		display: inline-block;
		opacity: 0;
		transform-origin: 50% 100%;
	}
</style>

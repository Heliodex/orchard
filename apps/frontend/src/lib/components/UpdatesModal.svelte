<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { Sparkles, Waves, Activity, BellRing, Gauge, Rocket, ShieldCheck } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { isSignedIn, isSuperAdmin, showOnboarding, telemetry, user } from '$lib/stores';
	import { unseenUpdate, markUpdateSeen } from '$lib/stores/updates';
	import { Modal, Button } from '$lib/components/ui';
	import AsciiVine from '$lib/components/ui/AsciiVine.svelte';
	import { motionStagger } from '$lib/utils/motion.svelte';
	import type { Update } from '$lib/updates';

	const icons: Record<string, Component> = {
		sparkles: Sparkles,
		motion: Waves,
		observe: Activity,
		bell: BellRing,
		gauge: Gauge,
		rocket: Rocket,
		shield: ShieldCheck
	};

	const quietRoutes = ['/setup', '/invite', '/oauth', '/sso', '/cli', '/mcp', '/auth/protect'];

	let mounted = $state(false);
	let open = $state(false);
	let update = $state<Update | null>(null);
	let presented = false;

	onMount(() => {
		mounted = true;
	});

	$effect(() => {
		if (!mounted || !$isSignedIn || $showOnboarding || presented) return;
		// A new account has an empty seenUpdates, so the newest release note
		// fires the moment it signs in. "Here is what changed" is noise to
		// someone who has not used the product yet, and on a fresh instance it
		// lands on top of the setup they are in the middle of.
		if ($user?.setupCompleted === false) return;
		if (quietRoutes.some((route) => $page.url.pathname.startsWith(route))) return;
		if ($isSuperAdmin && ($telemetry === undefined || $telemetry?.needsAnswer)) return;
		const next = $unseenUpdate;
		if (!next) return;
		presented = true;
		update = next;
		open = true;
	});

	const published = $derived.by(() => {
		if (!update?.date) return '';
		const parsed = new Date(`${update.date}T00:00:00`);
		if (Number.isNaN(parsed.getTime())) return '';
		return parsed.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	});

	function dismiss() {
		open = false;
		if (update) void markUpdateSeen(update.id);
	}
</script>

{#snippet sheetFooter()}
	<div class="sheet-footer">
		<Button variant="primary" onclick={dismiss}>Continue</Button>
	</div>
{/snippet}

{#if update}
	<Modal
		bind:open
		size="md"
		align="viewport"
		closable={false}
		dismissable
		onclose={dismiss}
		footer={sheetFooter}
	>
		<div class="sheet">
			<div class="sheet-hero">
				<AsciiVine class="sheet-vine" seed={23} band={[0.25, 0.7]} />
				<img src="/logo/logoiconcolor.svg" alt="" class="sheet-mark logo-light" />
				<img src="/logo/logoicondm.svg" alt="" class="sheet-mark logo-dark" />
			</div>

			<div class="sheet-head">
				<div class="sheet-meta">
					<span class="sheet-tag">{update.tag}</span>
					{#if published}<span class="sheet-date">{published}</span>{/if}
				</div>
				<h2 class="sheet-title">{update.title}</h2>
				{#if update.summary}
					<p class="sheet-summary">{update.summary}</p>
				{/if}
			</div>

			{#if update.intro}
				<div class="sheet-intro">{@html update.intro}</div>
			{/if}

			<ul class="sheet-features">
				{#each update.sections as section, i (section.title)}
					{@const Icon = icons[section.icon] ?? Sparkles}
					<li class="feature" {@attach motionStagger({ index: i })}>
						<span class="feature-icon"><Icon size={17} strokeWidth={2} /></span>
						<div class="feature-text">
							<h3 class="feature-title">{section.title}</h3>
							<div class="feature-desc">{@html section.html}</div>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	</Modal>
{/if}

<style>
	.sheet {
		margin: -1rem -1.25rem 0;
		padding: 0 1.5rem;
	}

	.sheet-hero {
		position: relative;
		height: 8rem;
		margin: 0 -1.5rem 1.25rem;
		overflow: hidden;
		background: var(--bg-sunken);
		border-bottom: 1px solid var(--border-default);
		border-top-left-radius: var(--radius-xl);
		border-top-right-radius: var(--radius-xl);
	}
	.sheet-hero :global(.sheet-vine) {
		width: 100%;
		height: 100%;
	}
	.sheet-mark {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--radius-md);
		box-shadow: 0 6px 16px rgb(0 0 0 / 0.18);
		transform: translate(-50%, -50%);
	}

	.sheet-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		text-align: center;
	}
	.sheet-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.sheet-tag {
		display: inline-flex;
		align-items: center;
		height: 1.25rem;
		padding: 0 0.5rem;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--text-on-accent);
		font-size: var(--text-micro);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
	}
	.sheet-date {
		font-size: var(--text-caption);
		color: var(--text-faint);
	}
	.sheet-title {
		font-size: var(--text-title-2);
		font-weight: 650;
		letter-spacing: -0.011em;
		line-height: 1.15;
		color: var(--text-default);
	}
	.sheet-summary {
		max-width: 22rem;
		font-size: var(--text-footnote);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.sheet-intro {
		margin-top: 1rem;
		font-size: var(--text-footnote);
		line-height: 1.55;
		color: var(--text-muted);
	}

	.sheet-features {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		margin: 1.375rem 0 0;
		padding: 0;
	}
	.feature {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}
	.feature-icon {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: var(--radius-sm);
		background: var(--accent-subtle);
		color: var(--accent);
	}
	.feature-text {
		min-width: 0;
		padding-top: 0.1rem;
	}
	.feature-title {
		font-size: var(--text-callout);
		font-weight: 600;
		color: var(--text-default);
	}
	.feature-desc {
		margin-top: 0.1rem;
		font-size: var(--text-footnote);
		line-height: 1.45;
		color: var(--text-muted);
	}
	.feature-desc :global(p) {
		margin: 0;
	}
	.feature-desc :global(p + p) {
		margin-top: 0.5rem;
	}
	.feature-desc :global(strong) {
		color: var(--text-default);
		font-weight: 600;
	}
	.feature-desc :global(a) {
		color: var(--text-link);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.sheet-footer {
		display: flex;
		width: 100%;
		padding-top: 1.25rem;
	}
	.sheet-footer :global(button) {
		flex: 1;
		justify-content: center;
		padding-block: 0.55rem;
	}
</style>

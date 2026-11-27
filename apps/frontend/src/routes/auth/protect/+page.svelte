<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Loader2, Lock, ShieldX } from 'lucide-svelte';
	import { Button, Input } from '$lib/components/ui';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import ConsentSignIn from '$lib/components/login/ConsentSignIn.svelte';
	import { motionStagger } from '$lib/utils/motion.svelte';
	import { apiFetch, initApiBase, user, isSignedIn } from '$lib/stores';
	import { env } from '$env/dynamic/public';

	interface IngressInfo {
		host: string;
		protectionMode: string;
		turnstileSiteKey: string | null;
	}

	let info = $state<IngressInfo | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let exchanging = $state(false);
	let password = $state('');
	let passwordError = $state<string | null>(null);
	let widget = $state<{ execute: () => Promise<string> } | null>(null);

	const siteKey = $derived(info?.turnstileSiteKey ?? null);

	async function botHeaders(): Promise<Record<string, string>> {
		if (!siteKey || !widget) return {};
		return { 'x-turnstile-token': await widget.execute() };
	}

	const ingressId = $derived($page.url.searchParams.get('ingressId') || '');
	const returnTo = $derived($page.url.searchParams.get('returnTo') || '');
	const mode = $derived($page.url.searchParams.get('mode') || 'orchard');

	onMount(async () => {
		if (!browser) return;

		const apiBase = env.PUBLIC_API_BASE || '';
		initApiBase(apiBase);

		if (!ingressId || !returnTo) {
			error = 'Invalid protection link.';
			loading = false;
			return;
		}

		try {
			const res = await apiFetch(`/apiv1/auth/protect/info?ingressId=${ingressId}`);
			if (!res.ok) {
				error = "This app isn't protected or doesn't exist.";
				loading = false;
				return;
			}
			info = await res.json();
		} catch {
			error = "Couldn't load this app.";
		}

		await user.fetchUser();
		loading = false;

		if (info?.protectionMode === 'orchard' && $isSignedIn) {
			await attemptExchange();
		}
	});

	function followRedirect(target: string) {
		const url = new URL(target);
		if (url.protocol === 'https:' || url.protocol === 'http:') window.location.href = url.href;
	}

	async function attemptExchange() {
		if (exchanging) return;
		exchanging = true;
		error = null;

		try {
			const res = await apiFetch('/apiv1/auth/protect/exchange/orchard', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ingressId, returnTo })
			});

			if (res.status === 403) {
				error = "You don't have access to this app.";
				exchanging = false;
				return;
			}

			if (!res.ok) {
				error = "Couldn't check your access. Try again.";
				exchanging = false;
				return;
			}

			const data = await res.json();
			followRedirect(data.redirectUrl);
		} catch {
			error = "Couldn't sign you in. Try again.";
			exchanging = false;
		}
	}

	async function submitPassword() {
		if (exchanging || !password.trim()) return;
		exchanging = true;
		passwordError = null;

		try {
			const res = await apiFetch('/apiv1/auth/protect/exchange/password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...(await botHeaders()) },
				body: JSON.stringify({ ingressId, password: password.trim(), returnTo })
			});

			if (res.status === 403) {
				passwordError = 'Wrong password.';
				exchanging = false;
				return;
			}

			if (res.status === 429) {
				const body = await res.json().catch(() => null);
				passwordError = body?.message || 'Too many attempts. Try again later.';
				exchanging = false;
				return;
			}

			if (!res.ok) {
				passwordError = "Couldn't sign you in. Try again.";
				exchanging = false;
				return;
			}

			const data = await res.json();
			followRedirect(data.redirectUrl);
		} catch {
			passwordError = "Couldn't sign you in. Try again.";
			exchanging = false;
		}
	}
</script>

<svelte:head>
	<title>Protected app · Orchard</title>
</svelte:head>

<div class="protect-page">
	{#if loading}
		<div class="protect-loading">
			<Loader2 class="h-5 w-5 animate-spin" />
		</div>
	{:else if error && !info}
		<div class="protect-stack">
			<div class="protect-icon protect-icon--error" {@attach motionStagger({ index: 0 })}>
				<ShieldX size={22} />
			</div>
			<h1 class="protect-title" {@attach motionStagger({ index: 1 })}>{error}</h1>
		</div>
	{:else if info}
		<div class="protect-stack">
			<div class="protect-icon" {@attach motionStagger({ index: 0 })}>
				<Lock size={22} />
			</div>
			<h1 class="protect-title" {@attach motionStagger({ index: 1 })}>This app is protected</h1>
			<p class="protect-subtitle" {@attach motionStagger({ index: 2 })}>
				{#if mode === 'password'}
					Enter the password to view <span class="protect-host" title={info.host}>{info.host}</span>
				{:else}
					Sign in with an Orchard account that has access to
					<span class="protect-host" title={info.host}>{info.host}</span>
				{/if}
			</p>

			<div class="protect-action" {@attach motionStagger({ index: 3 })}>
				{#if mode === 'password'}
					<form
						class="protect-form"
						onsubmit={(e) => {
							e.preventDefault();
							submitPassword();
						}}
					>
						<Input
							type="password"
							class="protect-input"
							placeholder="Password"
							bind:value={password}
							error={!!passwordError}
							disabled={exchanging}
							autocomplete="current-password"
						/>
						{#if passwordError}
							<p class="protect-error">{passwordError}</p>
						{/if}
						{#if siteKey}
							<Turnstile bind:this={widget} {siteKey} action="protection" />
						{/if}
						<Button
							variant="primary"
							class="w-full"
							type="submit"
							loading={exchanging}
							disabled={!password.trim()}
						>
							Continue
						</Button>
					</form>
				{:else if exchanging}
					<div class="protect-verifying">
						<Loader2 class="h-4 w-4 animate-spin" />
						<span>Verifying access…</span>
					</div>
				{:else if error}
					<p class="protect-error">{error}</p>
					{#if !$isSignedIn}
						<ConsentSignIn returnTo={$page.url.pathname + $page.url.search} />
					{/if}
				{:else if !$isSignedIn}
					<ConsentSignIn returnTo={$page.url.pathname + $page.url.search} />
				{:else}
					<Button variant="primary" class="w-full" title={$user?.email} onclick={attemptExchange}>
						Continue as {$user?.email}
					</Button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.protect-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: var(--center-channel-bg);
	}

	.protect-stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		max-width: 20rem;
		text-align: center;
	}

	.protect-loading {
		color: var(--surface-muted);
	}

	.protect-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: var(--radius-lg);
		background: var(--surface-bg);
		border: 1px solid var(--surface-border);
		color: var(--center-channel-color);
		margin-bottom: 1.25rem;
	}

	.protect-icon--error {
		background: color-mix(in srgb, var(--error-text-color) 8%, transparent);
		border-color: color-mix(in srgb, var(--error-text-color) 25%, transparent);
		color: var(--error-text-color);
	}

	.protect-title {
		font-size: var(--text-title-3);
		font-weight: 600;
		letter-spacing: -0.011em;
		color: var(--center-channel-color);
		margin: 0 0 0.5rem;
		line-height: 1.3;
	}

	.protect-subtitle {
		font-size: var(--text-callout);
		color: var(--surface-muted);
		margin: 0 0 1.5rem;
		line-height: 1.6;
	}

	.protect-host {
		color: var(--center-channel-color);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		display: inline-block;
		max-width: 100%;
		overflow-x: clip;
		text-overflow: ellipsis;
		white-space: nowrap;
		vertical-align: bottom;
	}

	.protect-action {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.protect-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.protect-form :global(.protect-input) {
		text-align: center;
	}

	.protect-error {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--error-text-color);
		margin: 0;
	}

	.protect-verifying {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: var(--surface-muted);
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
	}
</style>

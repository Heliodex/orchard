<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { user, isSignedIn, apiFetch } from '$lib/stores';
	import { Terminal } from 'lucide-svelte';
	import { Button } from '$lib/components/ui';
	import ConsentSignIn from '$lib/components/login/ConsentSignIn.svelte';
	import TokenOrgScope from '$lib/components/user-settings/TokenOrgScope.svelte';
	import SsoFirstPrompt from '$lib/components/user-settings/SsoFirstPrompt.svelte';
	import { motionStagger } from '$lib/utils/motion.svelte';

	let port = $derived($page.url.searchParams.get('port') || '');
	let state = $derived($page.url.searchParams.get('state') || '');
	let label = $derived($page.url.searchParams.get('label') || 'Orchard CLI');

	let error = $state<string | null>(null);
	let authorizing = $state(false);
	let done = $state(false);
	let organizationId = $state('');

	// The callback host is hard-coded to loopback; only the port comes from the
	// query string. This prevents a crafted link from redirecting a freshly
	// minted token to an attacker-controlled origin.
	function callbackUrl(params: Record<string, string>): string {
		const u = new URL(`http://127.0.0.1:${encodeURIComponent(port)}/callback`);
		for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
		return u.toString();
	}

	function validPort(): boolean {
		const n = Number(port);
		return Number.isInteger(n) && n > 0 && n < 65536;
	}

	async function deliver(params: Record<string, string>) {
		try {
			await fetch(`http://127.0.0.1:${encodeURIComponent(port)}/callback`, {
				method: 'POST',
				mode: 'no-cors',
				body: new URLSearchParams(params)
			});
			window.location.href = '/cli/done';
		} catch {
			window.location.href = callbackUrl(params);
		}
	}

	async function authorize() {
		if (authorizing) return;
		authorizing = true;
		error = null;
		try {
			const res = await apiFetch('/apiv1/auth/tokens', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: label,
					scopes: ['read', 'deploy', 'exec'],
					...(organizationId ? { organizationId } : {})
				})
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data?.message || "Couldn't create a token. Sign in and try again.");
			}
			const { token } = await res.json();
			done = true;
			await deliver({ token, state });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Authorization failed.';
			authorizing = false;
		}
	}

	function deny() {
		if (validPort()) window.location.href = callbackUrl({ error: 'access_denied', state });
	}

	onMount(() => {
		if (!port || !state) {
			error = 'Invalid request: missing port or state. Re-run `orchard auth login`.';
			return;
		}
		if (!validPort()) {
			error = 'Invalid callback port.';
		}
	});
</script>

<svelte:head>
	<title>Authorize CLI · Orchard</title>
</svelte:head>

<div class="consent-page">
	<div class="consent-stack">
		<div class="consent-brand" {@attach motionStagger({ index: 0 })}>
			<img src="/logo/logofull.svg" alt="Orchard" class="consent-logo logo-light" />
			<img src="/logo/logofulldm.svg" alt="Orchard" class="consent-logo logo-dark" />
		</div>

		{#if error}
			<h1 class="consent-title" {@attach motionStagger({ index: 1 })}>Authorization failed</h1>
			<p class="consent-error" {@attach motionStagger({ index: 2 })}>{error}</p>
		{:else if done}
			<h1 class="consent-title" {@attach motionStagger({ index: 1 })}>Authorized</h1>
			<p class="consent-subtitle" {@attach motionStagger({ index: 2 })}>
				Token sent to your terminal. You can close this tab.
			</p>
		{:else}
			<h1 class="consent-title" {@attach motionStagger({ index: 1 })}>Authorize CLI access</h1>
			<p class="consent-subtitle" {@attach motionStagger({ index: 2 })}>
				The <strong>Orchard CLI</strong> on this computer is requesting access to your account.
			</p>

			<div class="cli-details" {@attach motionStagger({ index: 3 })}>
				<p class="cli-label">Orchard creates a personal API token and sends it to:</p>
				<p class="cli-host"><Terminal class="h-4 w-4" /> 127.0.0.1:{port}</p>
				<p class="cli-name">{label}</p>
				<p class="cli-warning">
					Only approve if you just ran <code>orchard auth login</code> on this machine.
				</p>
			</div>

			<div class="consent-action" {@attach motionStagger({ index: 4 })}>
				{#if $isSignedIn}
					<p class="consent-identity">Signed in as <strong>{$user?.email}</strong></p>
					<div class="cli-scope">
						<SsoFirstPrompt
							returnTo={$page.url.pathname + $page.url.search}
							purpose="use the CLI"
						/>
						<TokenOrgScope id="cli-token-org" bind:value={organizationId} />
					</div>
					<Button variant="primary" class="w-full" onclick={authorize} loading={authorizing}>
						{authorizing ? 'Authorizing...' : 'Authorize'}
					</Button>
					<Button variant="ghost" class="w-full" onclick={deny}>Cancel</Button>
				{:else}
					<ConsentSignIn returnTo={$page.url.pathname + $page.url.search} />
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.cli-scope {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		text-align: left;
	}

	.cli-scope:empty {
		display: none;
	}

	.consent-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.5rem;
		background: var(--bg-app);
	}

	.consent-stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		max-width: 22rem;
		text-align: center;
	}

	.consent-brand {
		margin-bottom: 1.75rem;
	}

	.consent-logo {
		height: 1.75rem;
		width: auto;
	}

	.consent-title {
		font-size: var(--text-title-3);
		line-height: var(--lh-title-3);
		font-weight: 600;
		letter-spacing: -0.011em;
		color: var(--text-default);
		margin: 0 0 0.5rem;
	}

	.consent-subtitle {
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		color: var(--text-muted);
		margin: 0;
		overflow-wrap: anywhere;
	}

	.consent-subtitle strong {
		color: var(--text-default);
		font-weight: 600;
	}

	.consent-action {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.consent-identity {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
		margin: 0;
		overflow-wrap: anywhere;
	}

	.consent-identity strong {
		color: var(--text-default);
		font-weight: 600;
	}

	.consent-error {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--status-error);
		margin: 0;
	}

	.cli-details {
		width: 100%;
		margin-top: 1.5rem;
		padding: 1rem;
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		text-align: left;
	}

	.cli-label {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
		margin: 0 0 0.5rem;
	}

	.cli-host {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--text-callout);
		line-height: var(--lh-callout);
		font-weight: 600;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		color: var(--text-default);
		margin: 0 0 0.25rem;
	}

	.cli-name {
		overflow-wrap: anywhere;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-faint);
		margin: 0 0 0.75rem;
	}

	.cli-warning {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
		margin: 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-default);
	}

	.cli-warning code {
		font-family: var(--font-mono);
		background: var(--bg-sunken);
		color: var(--text-default);
		padding: 0.1rem 0.25rem;
		border-radius: var(--radius-xs);
	}
</style>

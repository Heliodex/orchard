<script lang="ts">
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { user, isSignedIn, apiFetch, authConfig } from '$lib/stores';
	import { KeyRound } from 'lucide-svelte';
	import { Button, Input } from '$lib/components/ui';
	import ConsentSignIn from '$lib/components/login/ConsentSignIn.svelte';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import { motionStagger } from '$lib/utils/motion.svelte';
	import { consentDestination, consentScope, requestedConsentScope } from '$lib/utils/mcp-consent';

	let mcpState = $derived($page.url.searchParams.get('mcp_state') || '');
	let mcpServer = $derived($page.url.searchParams.get('mcp_server') || '');
	let clientName = $derived($page.url.searchParams.get('client_name') || 'An application');
	let redirectUri = $derived($page.url.searchParams.get('redirect_uri') || '');
	let requestedScope = $derived(requestedConsentScope($page.url.searchParams.get('scope')));
	let allowExec = $state(false);
	let grantedScope = $derived(consentScope(requestedScope, allowExec));
	let destination = $derived(consentDestination(redirectUri));

	function originOf(raw: string | undefined): string | null {
		if (!raw) return null;
		try {
			return new URL(raw).origin;
		} catch {
			return null;
		}
	}

	function allowedMcpOrigins(): Set<string> {
		const origins = new Set<string>();
		for (const raw of [env.PUBLIC_MCP_URL, env.PUBLIC_API_BASE]) {
			const origin = originOf(raw);
			if (origin) origins.add(origin);
		}
		if (browser) origins.add(window.location.origin);
		return origins;
	}

	function mcpServerAllowed(server: string): boolean {
		const origin = originOf(server);
		return origin !== null && allowedMcpOrigins().has(origin);
	}

	let error = $state<string | null>(null);
	let authorizing = $state(false);
	let authorized = $state(false);
	let approveLocked = $state(false);
	let approveTimer: ReturnType<typeof setTimeout> | undefined;

	function signedInHere(signedInUser: Parameters<typeof user.set>[0] | undefined) {
		if (!signedInUser) return;
		approveLocked = true;
		clearTimeout(approveTimer);
		approveTimer = setTimeout(() => (approveLocked = false), 800);
		user.set(signedInUser);
	}

	let otpEmail = $state('');
	let otpCode = $state('');
	let otpStep = $state<'email' | 'code'>('email');
	let otpRequesting = $state(false);
	let otpVerifying = $state(false);
	let otpMessage = $state<string | null>(null);
	let otpError = $state<string | null>(null);

	let siteKey = $state<string | null>(null);
	let emailCodes = $state(true);
	let widget = $state<{ execute: () => Promise<string> } | null>(null);

	async function botHeaders(): Promise<Record<string, string>> {
		if (!siteKey || !widget) return {};
		return { 'x-turnstile-token': await widget.execute() };
	}

	let passkeyEmail = $state('');
	let passkeyLoading = $state(false);
	let passkeyError = $state<string | null>(null);
	let passkeySupported = $state(false);

	onMount(() => {
		authConfig
			.load()
			.then((config) => {
				siteKey = config.turnstileSiteKey;
				emailCodes = config.emailCodes !== false;
			})
			.catch(() => {
				siteKey = null;
			});

		if (!mcpState || !mcpServer) {
			error = 'Invalid authorization request. Missing parameters.';
			return;
		}

		if (!mcpServerAllowed(mcpServer)) {
			error = 'Invalid authorization request. Unrecognized MCP server.';
			return;
		}

		if (!destination) {
			error = 'Invalid authorization request. Missing a valid redirect address.';
			return;
		}

		if (browser && typeof window !== 'undefined') {
			passkeySupported =
				window.isSecureContext && typeof window.PublicKeyCredential !== 'undefined';
		}
	});

	async function approve() {
		if (authorizing || approveLocked) return;
		if (!mcpServerAllowed(mcpServer)) {
			error = 'Invalid authorization request. Unrecognized MCP server.';
			return;
		}
		authorizing = true;
		error = null;

		try {
			const tokenRes = await apiFetch('/apiv1/auth/mcp-token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!tokenRes.ok) {
				throw new Error("Couldn't get an authorization token. Sign in first.");
			}

			const { token } = await tokenRes.json();

			const completeRes = await fetch(`${mcpServer}/authorize/complete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mcp_state: mcpState,
					session_token: token,
					scope: grantedScope,
					redirect_uri: redirectUri,
					client_name: $page.url.searchParams.get('client_name') ?? ''
				})
			});

			if (!completeRes.ok) {
				const data = await completeRes.json().catch(() => ({}));
				throw new Error(data?.error || 'Authorization failed.');
			}

			const { redirect_url } = await completeRes.json();
			authorized = true;
			window.location.href = redirect_url;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Authorization failed.';
		} finally {
			authorizing = false;
		}
	}

	async function requestOtp() {
		if (otpRequesting) return;

		const email = otpEmail.trim().toLowerCase();
		if (!email) {
			otpError = 'Enter your email address.';
			return;
		}

		otpRequesting = true;
		otpError = null;

		try {
			const response = await apiFetch('/apiv1/auth/otp/request', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...(await botHeaders()) },
				body: JSON.stringify({ email })
			});

			const data = await response.json().catch(() => ({}));

			if (!response.ok) {
				throw new Error(data?.message || "Couldn't send the code.");
			}

			otpStep = 'code';
			otpMessage = data?.message || 'Check your inbox for a 6-digit code.';
			otpCode = '';
		} catch (err) {
			otpError = err instanceof Error ? err.message : "Couldn't send the code.";
		} finally {
			otpRequesting = false;
		}
	}

	async function verifyOtp() {
		if (otpVerifying) return;

		const email = otpEmail.trim().toLowerCase();
		const code = otpCode.trim();

		if (!code || code.length !== 6) {
			otpError = 'Enter the 6-digit code we sent you.';
			return;
		}

		otpVerifying = true;
		otpError = null;

		try {
			const response = await apiFetch('/apiv1/auth/otp/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...(await botHeaders()) },
				body: JSON.stringify({ email, code })
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data?.message || 'That code is wrong or expired.');
			}

			const data = await response.json().catch(() => null);
			signedInHere(data?.user);
		} catch (err) {
			otpError = err instanceof Error ? err.message : "Couldn't check the code.";
		} finally {
			otpVerifying = false;
		}
	}

	async function signInWithPasskey() {
		if (passkeyLoading) return;
		passkeyLoading = true;
		passkeyError = null;

		try {
			const response = await apiFetch('/apiv1/auth/passkey/authenticate/options', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: passkeyEmail.trim() || undefined })
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data?.message || "Couldn't start passkey authentication.");
			}

			const options = await response.json();
			const { startAuthentication } = await import('@simplewebauthn/browser');
			const credential = await startAuthentication({ optionsJSON: options });

			const verifyResponse = await apiFetch('/apiv1/auth/passkey/authenticate/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ response: credential })
			});

			if (!verifyResponse.ok) {
				const data = await verifyResponse.json().catch(() => ({}));
				throw new Error(data?.message || 'Passkey authentication failed.');
			}

			const data = await verifyResponse.json().catch(() => null);
			signedInHere(data?.user);
		} catch (err) {
			if (err instanceof Error && err.name === 'NotAllowedError') {
				passkeyError = 'Passkey request canceled.';
			} else {
				passkeyError = err instanceof Error ? err.message : 'Passkey sign-in failed.';
			}
		} finally {
			passkeyLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Authorize MCP access · Orchard</title>
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
		{:else if authorized}
			<h1 class="consent-title" {@attach motionStagger({ index: 1 })}>Authorized</h1>
			<p class="consent-subtitle" {@attach motionStagger({ index: 2 })}>
				Going back to {clientName}...
			</p>
		{:else}
			<h1 class="consent-title" {@attach motionStagger({ index: 1 })}>Authorize MCP access</h1>
			<p class="consent-subtitle" {@attach motionStagger({ index: 2 })}>
				<strong>{clientName}</strong> is requesting access to your Orchard account.
			</p>
			{#if destination}
				<p class="consent-origin" {@attach motionStagger({ index: 2 })}>
					That name is self-reported. Access goes to
					{#if destination.local}
						a local app on this machine (<strong>{destination.host}</strong>).
					{:else}
						<strong>{destination.host}</strong>.
					{/if}
				</p>
			{/if}

			<div class="consent-details" {@attach motionStagger({ index: 3 })}>
				<p class="consent-label">If you approve, it can:</p>
				<ul class="consent-grants">
					<li>View your projects, apps and logs</li>
					{#if requestedScope !== 'read'}
						<li>Change and deploy your projects</li>
					{/if}
				</ul>
				{#if requestedScope === 'exec'}
					<label class="consent-exec">
						<input type="checkbox" bind:checked={allowExec} />
						<span>
							<span class="consent-exec-label">
								Also allow running commands inside containers
							</span>
							<span class="consent-exec-hint">
								Lets {clientName} run shell commands in your apps. Leave this off to allow only reading
								and deploying.
							</span>
						</span>
					</label>
				{/if}
			</div>

			{#if redirectUri}
				<div class="consent-details" {@attach motionStagger({ index: 4 })}>
					<p class="consent-label">After you approve, Orchard sends your authorization code to:</p>
					<p class="consent-uri">{redirectUri}</p>
					<p class="consent-warning">
						Only approve if you recognize this destination. Anyone with access to that URL can use
						your Orchard account.
					</p>
				</div>
			{/if}

			<div class="consent-action" {@attach motionStagger({ index: 5 })}>
				{#if $isSignedIn}
					<p class="consent-identity">Signed in as <strong>{$user?.email}</strong></p>
					<Button
						variant="primary"
						class="w-full"
						onclick={approve}
						loading={authorizing}
						disabled={approveLocked}
					>
						{authorizing ? 'Approving...' : 'Approve'}
					</Button>
				{:else}
					<ConsentSignIn returnTo={$page.url.pathname + $page.url.search}>
						{#snippet children(hasProviders)}
							{#if hasProviders && emailCodes}
								<div class="consent-divider"><span>or continue with email</span></div>
							{/if}

							{#if emailCodes}
								<form
									class="consent-form"
									novalidate
									onsubmit={(e) => {
										e.preventDefault();
										if (otpStep === 'email') requestOtp();
										else verifyOtp();
									}}
								>
									<Input
										type="email"
										placeholder="you@example.com"
										id="otp-email"
										bind:value={otpEmail}
										autocomplete="email"
										error={!!otpError}
										required
									/>
									{#if otpStep === 'code'}
										<div class="consent-otp-row">
											<Input
												type="text"
												class="consent-code"
												inputmode="numeric"
												maxlength="6"
												placeholder="000000"
												id="otp-code"
												bind:value={otpCode}
												autocomplete="one-time-code"
												error={!!otpError}
											/>
											<Button
												variant="ghost"
												type="button"
												onclick={() => {
													otpStep = 'email';
													otpCode = '';
													otpMessage = null;
												}}
											>
												Back
											</Button>
										</div>
									{/if}
									{#if otpError}
										<p class="consent-error">{otpError}</p>
									{/if}
									{#if otpMessage}
										<p class="consent-success">{otpMessage}</p>
									{/if}
									{#if siteKey}
										<Turnstile bind:this={widget} {siteKey} action="signin" />
									{/if}
									<Button
										variant="primary"
										class="w-full"
										type="submit"
										loading={otpRequesting || otpVerifying}
									>
										{otpStep === 'email' ? 'Send code' : 'Verify and continue'}
									</Button>
								</form>
							{/if}

							{#if passkeySupported}
								{#if emailCodes}
									<div class="consent-divider"><span>or use a passkey</span></div>
								{/if}
								<div class="consent-form">
									<Input
										type="email"
										placeholder="Email (optional)"
										id="passkey-email"
										bind:value={passkeyEmail}
									/>
									<Button
										variant="secondary"
										class="w-full"
										type="button"
										onclick={signInWithPasskey}
										loading={passkeyLoading}
									>
										<KeyRound class="h-4 w-4" />
										Sign in with passkey
									</Button>
									{#if passkeyError}
										<p class="consent-error">{passkeyError}</p>
									{/if}
								</div>
							{/if}
						{/snippet}
					</ConsentSignIn>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
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

	.consent-origin {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
		margin: 0.5rem 0 0;
		overflow-wrap: anywhere;
	}

	.consent-origin strong {
		color: var(--text-default);
		font-weight: 600;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
	}

	.consent-details {
		width: 100%;
		margin-top: 1.5rem;
		padding: 1rem;
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		text-align: left;
	}

	.consent-details + .consent-details {
		margin-top: 0.75rem;
	}

	.consent-grants {
		list-style: disc;
		margin: 0;
		padding-left: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-default);
	}

	.consent-exec {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-default);
		cursor: pointer;
	}

	.consent-exec input {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		margin: 0.125rem 0 0;
		accent-color: var(--accent);
		cursor: pointer;
	}

	.consent-exec > span {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.consent-exec-label {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		font-weight: 600;
		color: var(--text-default);
	}

	.consent-exec-hint {
		overflow-wrap: anywhere;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
	}

	.consent-label {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-muted);
		margin: 0 0 0.5rem;
	}

	.consent-uri {
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-default);
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		margin: 0 0 0.75rem;
		word-break: break-all;
	}

	.consent-warning {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
		margin: 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-default);
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

	.consent-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.consent-otp-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.consent-otp-row :global(.consent-code) {
		flex: 1;
		min-width: 0;
		text-align: center;
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		letter-spacing: 0.3em;
	}

	.consent-divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: var(--text-caption);
		line-height: var(--lh-caption);
		color: var(--text-faint);
	}

	.consent-divider::before,
	.consent-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border-default);
	}

	.consent-error {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--status-error);
		margin: 0;
	}

	.consent-success {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--status-success);
		margin: 0;
	}
</style>

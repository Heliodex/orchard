<script lang="ts">
	import {
		ArrowRight,
		Copy,
		Database,
		Globe,
		KeyRound,
		Link2,
		Plus,
		RotateCw,
		ScrollText,
		Search,
		Settings,
		Share2,
		Trash2,
		X
	} from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import PopoverPanel from '$lib/components/ui/PopoverPanel.svelte';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import CommandMenu, { type CommandGroup } from '$lib/components/ui/CommandMenu.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

	let renameOpen = $state(false);
	let redeployOpen = $state(false);
	let buildOpen = $state(false);
	let deleteOpen = $state(false);
	let stopOpen = $state(false);
	let domainOpen = $state(false);
	let envOpen = $state(false);
	let popoverOpen = $state(false);

	let appName = $state('web');
	let domain = $state('');
	let forceHttps = $state(true);
	let wildcard = $state(false);
	let previews = $state(true);
	let last = $state('Nothing yet');
	let commandQuery = $state('');

	const ENV = [
		['DATABASE_URL', 'postgres://orchard@postgres:5432/app'],
		['REDIS_URL', 'redis://redis:6379/0'],
		['NODE_ENV', 'production'],
		['PORT', '3000'],
		['PUBLIC_SITE_URL', 'https://hackclub-site.orchard.my'],
		['SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/T0/B0/xxxx'],
		['SENTRY_DSN', 'https://4f2a9c1@o0.ingest.sentry.io/1'],
		['S3_BUCKET', 'hackclub-site-uploads'],
		['S3_REGION', 'auto'],
		['LOG_LEVEL', 'info'],
		['SESSION_SECRET', 'b81e0d4aa93ce77f0128ab9e'],
		['FEATURE_SPONSORS', 'true'],
		['GITHUB_APP_ID', '381204'],
		['GITHUB_CLIENT_ID', 'Iv1.4f2a9c1b81e0d4aa'],
		['SMTP_HOST', 'smtp.postmarkapp.com'],
		['SMTP_PORT', '587'],
		['CDN_URL', 'https://assets.orchard.my'],
		['RATE_LIMIT_PER_MINUTE', '120'],
		['TZ', 'UTC']
	];

	const COMMANDS: CommandGroup[] = [
		{
			label: 'Apps',
			items: [
				{ id: 'web', label: 'web', icon: Globe, hint: 'hackclub-site' },
				{ id: 'api', label: 'api', icon: Globe, hint: 'hackclub-site' },
				{ id: 'worker', label: 'worker', icon: Globe, hint: 'arcade-leaderboard' },
				{ id: 'postgres', label: 'postgres', icon: Database, hint: 'hackclub-site' }
			]
		},
		{
			label: 'Commands',
			items: [
				{ id: 'redeploy', label: 'Redeploy web', icon: RotateCw, shortcut: ['⌘', 'R'] },
				{ id: 'logs', label: 'View logs', icon: ScrollText, shortcut: ['⌘', 'L'] },
				{ id: 'env', label: 'Add environment variable', icon: KeyRound },
				{ id: 'domain', label: 'Add a domain', icon: Link2 },
				{ id: 'settings', label: 'Open settings', icon: Settings, shortcut: ['⌘', ','] }
			]
		}
	];
</script>

<SectionCard
	title="Dialogs"
	description="Modal for focused decisions. Cancel always leads the primary action."
>
	<div class="flex flex-col gap-6">
		<div class="flex flex-wrap items-center gap-2">
			<Button onclick={() => (renameOpen = true)}>Rename app</Button>
			<Button onclick={() => (redeployOpen = true)}>Small</Button>
			<Button onclick={() => (buildOpen = true)}>Large, scrolling</Button>
			<Button onclick={() => (stopOpen = true)}>Confirm</Button>
			<Button variant="danger" icon={Trash2} onclick={() => (deleteOpen = true)}
				>Type to confirm</Button
			>
			<span class="ml-auto text-callout text-muted"
				>Last result: <span class="text-fg">{last}</span></span
			>
		</div>
		<div class="stage">
			<div class="ui-modal specimen">
				<div class="ui-modal-header">
					<h2 class="ui-modal-title">Rename app</h2>
					<button type="button" class="ui-modal-close" aria-label="Close"><X size={16} /></button>
				</div>
				<div class="ui-modal-body">
					<Field label="Name" hint="Lowercase letters, numbers and dashes. URLs keep working.">
						<Input value="web" />
					</Field>
				</div>
				<div class="ui-modal-footer">
					<Button>Cancel</Button>
					<Button variant="primary">Rename</Button>
				</div>
			</div>
		</div>
	</div>
</SectionCard>

<div class="grid grid-cols-2 gap-6">
	<SectionCard
		title="Sheet"
		description="Side panel for create and edit flows. Body scrolls, footer stays."
	>
		<div class="flex flex-wrap gap-2">
			<Button variant="primary" icon={Plus} onclick={() => (domainOpen = true)}>Add domain</Button>
			<Button onclick={() => (envOpen = true)}>Edit variables</Button>
		</div>
	</SectionCard>

	<SectionCard title="Popover and tooltip" description="Glass panels anchored to their trigger.">
		<div class="flex flex-wrap items-center gap-2">
			<PopoverPanel bind:open={popoverOpen} placement="bottom-start" class="share">
				{#snippet trigger(props)}
					<Button {...props} icon={Share2}>Share preview</Button>
				{/snippet}
				{#snippet children({ close })}
					<div class="flex flex-col gap-3">
						<div class="flex flex-col gap-1">
							<p class="text-headline text-fg">Share preview</p>
							<p class="text-callout text-muted">Anyone with the link can see feat/sponsors.</p>
						</div>
						<div class="link">
							<code class="link-text">feat-sponsors.hackclub-site.orchard.my</code>
							<CopyButton value="https://feat-sponsors.hackclub-site.orchard.my" />
						</div>
						<label class="flex items-center justify-between gap-3 text-callout text-fg">
							Require an Orchard login
							<Switch bind:checked={previews} />
						</label>
						<div class="flex justify-end">
							<Button size="sm" onclick={close}>Done</Button>
						</div>
					</div>
				{/snippet}
			</PopoverPanel>
			<Tooltip text="Search" shortcut="⌘K"><Button icon={Search} label="Search" /></Tooltip>
			<Tooltip text="Copy URL" placement="bottom"><Button icon={Copy} label="Copy URL" /></Tooltip>
			<Tooltip text="Redeploy with the same image" placement="right"
				><Button variant="ghost" icon={RotateCw} label="Redeploy" /></Tooltip
			>
		</div>
	</SectionCard>
</div>

<SectionCard
	title="Command menu"
	description="Presentational. Type to filter, arrow keys move, Enter picks."
>
	<div class="stage stage--command">
		<CommandMenu groups={COMMANDS} bind:query={commandQuery} onselect={(id) => (last = id)} />
	</div>
</SectionCard>

<Modal bind:open={renameOpen} title="Rename app">
	<Field label="Name" hint="Lowercase letters, numbers and dashes. URLs keep working.">
		<Input bind:value={appName} />
	</Field>
	{#snippet footer()}
		<Button onclick={() => (renameOpen = false)}>Cancel</Button>
		<Button
			variant="primary"
			onclick={() => {
				last = `Renamed to ${appName}`;
				renameOpen = false;
			}}>Rename</Button
		>
	{/snippet}
</Modal>

<Modal bind:open={redeployOpen} title="Redeploy web?" size="sm">
	<p class="text-body text-muted">
		Builds main at 4f2a9c1 again and swaps traffic over once it is healthy.
	</p>
	{#snippet footer()}
		<Button onclick={() => (redeployOpen = false)}>Cancel</Button>
		<Button
			variant="primary"
			onclick={() => {
				last = 'Redeployed';
				redeployOpen = false;
			}}>Redeploy</Button
		>
	{/snippet}
</Modal>

<Modal bind:open={buildOpen} title="Build settings" size="lg">
	<div class="flex flex-col gap-4">
		{#each ['Install command', 'Build command', 'Start command', 'Root directory', 'Dockerfile path', 'Build cache key', 'Health check path', 'Port'] as label (label)}
			<Field {label}>
				<Input placeholder={label} />
			</Field>
		{/each}
	</div>
	{#snippet footer()}
		<Button onclick={() => (buildOpen = false)}>Cancel</Button>
		<Button variant="primary" onclick={() => (buildOpen = false)}>Save</Button>
	{/snippet}
</Modal>

<ConfirmModal
	bind:open={stopOpen}
	danger={false}
	title="Stop web?"
	description="Every replica shuts down and the URL returns 503 until you start it again."
	confirmLabel="Stop app"
	onconfirm={() => (last = 'Stopped')}
	oncancel={() => (last = 'Cancelled')}
/>

<ConfirmModal
	bind:open={deleteOpen}
	title="Delete web?"
	description="This removes the app, its <strong>3 domains</strong> and every build. Logs are kept for 7 days."
	html
	confirmText="web"
	confirmLabel="Delete app"
	onconfirm={() => (last = 'Deleted')}
	oncancel={() => (last = 'Cancelled')}
/>

<Sheet
	bind:open={domainOpen}
	title="Add domain"
	description="Point a domain you own at web. We issue the certificate once DNS resolves."
>
	<div class="flex flex-col gap-4">
		<Field label="Domain" hint="Apex domains need an A record, subdomains a CNAME.">
			<Input bind:value={domain} placeholder="hackclub.com" icon={Globe} />
		</Field>
		<Field label="Path" hint="Leave empty to serve the whole site.">
			<Input placeholder="/" />
		</Field>
		<label class="flex items-center justify-between gap-3 text-body text-fg">
			Redirect HTTP to HTTPS
			<Switch bind:checked={forceHttps} />
		</label>
		<label class="flex items-center justify-between gap-3 text-body text-fg">
			Include subdomains
			<Switch bind:checked={wildcard} />
		</label>
		<div class="dns">
			<p class="text-caption font-medium text-faint">DNS record</p>
			<div class="dns-row">
				<span class="text-callout text-muted">CNAME</span>
				<code class="dns-value">{domain || 'hackclub.com'}</code>
				<ArrowRight size={14} class="text-faint" />
				<code class="dns-value">ingress.orchard.my</code>
			</div>
		</div>
	</div>
	{#snippet footer()}
		<Button onclick={() => (domainOpen = false)}>Cancel</Button>
		<Button
			variant="primary"
			onclick={() => {
				last = `Added ${domain || 'hackclub.com'}`;
				domainOpen = false;
			}}>Add domain</Button
		>
	{/snippet}
</Sheet>

<Sheet
	bind:open={envOpen}
	size="lg"
	title="Environment variables"
	description="Changes apply on the next deploy of web."
>
	<div class="flex flex-col gap-3">
		{#each ENV as [key, value] (key)}
			<div class="env-row">
				<Input value={key} aria-label="Name" />
				<Input {value} aria-label="Value" />
				<Button variant="ghost" icon={Trash2} label="Remove {key}" />
			</div>
		{/each}
		<div>
			<Button size="sm" variant="ghost" icon={Plus}>Add variable</Button>
		</div>
	</div>
	{#snippet footer()}
		<Button onclick={() => (envOpen = false)}>Cancel</Button>
		<Button
			variant="primary"
			onclick={() => {
				last = 'Variables saved';
				envOpen = false;
			}}>Save and redeploy</Button
		>
	{/snippet}
</Sheet>

<style>
	.stage {
		display: flex;
		justify-content: center;
		padding: 2rem;
		border-radius: var(--radius-card);
		background: var(--bg-sunken);
		box-shadow: inset 0 0 0 1px var(--border-default);
	}
	.stage--command {
		padding: 2.5rem 2rem;
	}
	.specimen {
		display: flex;
		position: static;
		inset: auto;
		margin: 0;
		width: 28rem;
	}
	:global(.ui-popover.share) {
		width: 20rem;
		padding: 1rem;
	}
	.link {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		height: 2rem;
		padding: 0 0.25rem 0 0.625rem;
		border-radius: var(--radius-control);
		background: var(--bg-raised);
		box-shadow: inset 0 0 0 1px var(--border-default);
	}
	.link-text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		color: var(--text-muted);
	}
	.dns {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: var(--radius-card);
		background: var(--bg-sunken);
		box-shadow: inset 0 0 0 1px var(--border-default);
	}
	.dns-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.dns-value {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: inherit;
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
		font-size: var(--text-caption);
		color: var(--text-default);
	}
	.env-row :global(input) {
		font-family: var(--font-mono);
		font-size: var(--text-callout);
	}
	.env-row {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) auto;
		gap: 0.5rem;
		align-items: center;
	}
</style>

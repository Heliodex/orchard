<script lang="ts">
	import { Check, Copy, ExternalLink } from 'lucide-svelte';
	import { Modal, Button } from '$lib/components/ui';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const INSTALL = [
		{
			id: 'brew',
			label: 'Homebrew',
			command: 'brew install --cask leafdtk/tap/orchard-cli',
			note: 'Homebrew core already uses the name orchard, so the cask is orchard-cli. The command it installs is orchard.'
		},
		{
			id: 'curl',
			label: 'Script',
			command:
				'curl -fsSL https://raw.githubusercontent.com/LeafdTK/orchard-releases/main/install.sh | sh',
			note: 'Linux, or macOS without Homebrew.'
		}
	];

	const USAGE = [
		{ command: 'orchard auth login', note: 'Signs you in through a browser' },
		{ command: 'orchard up', note: 'Deploys the current directory' },
		{ command: 'orchard deploy list', note: 'Lists your apps with status and replicas' },
		{ command: 'orchard logs <app>', note: 'Streams live logs' }
	];

	let copied = $state<string | null>(null);

	async function copy(text: string, id: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = id;
			setTimeout(() => {
				if (copied === id) copied = null;
			}, 1600);
		} catch {
			/* clipboard unavailable, the text is selectable anyway */
		}
	}
</script>

<Modal bind:open title="Orchard on the command line" size="md">
	<p class="cli-intro">Deploy, read logs and scale from your terminal.</p>

	<div class="cli-section">
		<h3 class="cli-heading">Install</h3>
		{#each INSTALL as item (item.id)}
			<div class="cli-block">
				<div class="cli-block-head">
					<span class="cli-label">{item.label}</span>
					<button
						class="cli-copy"
						type="button"
						onclick={() => copy(item.command, item.id)}
						aria-label={`Copy the ${item.label} install command`}
					>
						{#if copied === item.id}
							<Check class="h-3 w-3" />
							Copied
						{:else}
							<Copy class="h-3 w-3" />
							Copy
						{/if}
					</button>
				</div>
				<code class="cli-command">{item.command}</code>
				<p class="cli-note">{item.note}</p>
			</div>
		{/each}
	</div>

	<div class="cli-section">
		<h3 class="cli-heading">Then</h3>
		<div class="cli-usage">
			{#each USAGE as item (item.command)}
				<div class="cli-usage-row">
					<code class="cli-usage-command">{item.command}</code>
					<span class="cli-usage-note">{item.note}</span>
				</div>
			{/each}
		</div>
	</div>

	{#snippet footer()}
		<Button
			variant="secondary"
			href="https://docs.orchard.hackclub.com/reference/cli/"
			target="_blank"
			rel="noopener"
		>
			<ExternalLink class="h-3.5 w-3.5" />
			Every command
		</Button>
		<Button variant="primary" onclick={() => (open = false)}>Done</Button>
	{/snippet}
</Modal>

<style>
	.cli-intro {
		font-size: var(--text-footnote);
		line-height: var(--lh-footnote);
		color: var(--text-muted);
	}
	.cli-section {
		margin-top: 1.25rem;
	}
	.cli-heading {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		text-transform: uppercase;
		font-feature-settings: var(--font-features-caps);
		--rond: var(--rond-caps);
		letter-spacing: 0.06em;
		color: var(--text-faint);
		margin-bottom: 0.5rem;
	}
	.cli-block {
		border: 1px solid var(--border-edge);
		border-radius: var(--radius-md);
		background-color: var(--bg-raised);
		padding: 0.625rem 0.75rem;
	}
	.cli-block + .cli-block {
		margin-top: 0.5rem;
	}
	.cli-block-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.375rem;
	}
	.cli-label {
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		font-weight: 600;
		color: var(--text-fg);
	}
	.cli-copy {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--text-micro);
		line-height: var(--lh-micro);
		color: var(--text-muted);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}
	.cli-copy:hover {
		color: var(--text-fg);
	}
	.cli-command {
		display: block;
		font-family: var(--font-mono);
		font-size: var(--text-micro);
		line-height: var(--lh-caption);
		color: var(--text-fg);
		word-break: break-all;
	}
	.cli-note {
		margin-top: 0.375rem;
		font-size: var(--text-micro);
		line-height: var(--lh-caption);
		color: var(--text-faint);
	}
	.cli-usage {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.cli-usage-row {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.cli-usage-command {
		font-family: var(--font-mono);
		font-size: var(--text-micro);
		line-height: var(--lh-caption);
		color: var(--text-fg);
	}
	.cli-usage-note {
		font-size: var(--text-micro);
		line-height: var(--lh-caption);
		color: var(--text-faint);
	}
</style>

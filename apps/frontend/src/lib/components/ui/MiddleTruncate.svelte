<script lang="ts">
	let { text, tail = 8, mono = false }: { text: string; tail?: number; mono?: boolean } = $props();

	const head = $derived(text.length > tail * 2 ? text.slice(0, -tail) : text);
	const end = $derived(text.length > tail * 2 ? text.slice(-tail) : '');
</script>

<span class="mt" class:mt--mono={mono} title={text}
	><span class="head">{head}</span>{#if end}<span class="end">{end}</span>{/if}</span
>

<style>
	.mt {
		display: inline-flex;
		min-width: 0;
		max-width: 100%;
		white-space: nowrap;
	}
	.mt--mono {
		font-feature-settings: var(--font-features-ident);
		--rond: var(--rond-ident);
	}
	.head {
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.end {
		flex-shrink: 0;
	}
</style>

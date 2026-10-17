<script lang="ts">
	import { lookup, posLabel, type DictGroup } from '../dictionary';

	// Plain text whose words show the dictionary card on hover (used for headlines).
	let { text }: { text: string } = $props();

	// Odd indices are words, even indices are the text between them.
	const parts = $derived(text.split(/([\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*)/u));

	let tip = $state<{
		word: string;
		x: number;
		y: number;
		below: boolean;
		groups: DictGroup[];
	} | null>(null);

	function show(e: Event, word: string) {
		const groups = lookup(word);
		if (!groups) {
			tip = null;
			return;
		}
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		tip = { word, x: r.left + r.width / 2, y: r.top, below: r.top < 110, groups };
	}

	function hide() {
		tip = null;
	}
</script>

<svelte:window onscroll={hide} />

{#each parts as part, i (i)}
	{#if i % 2 === 1}
		<span class="hw" role="note" onpointerenter={(e) => show(e, part)} onpointerleave={hide}
			>{part}</span
		>
	{:else}{part}{/if}
{/each}

{#if tip}
	<div
		class="tip"
		class:below={tip.below}
		style="left: {Math.min(window.innerWidth - 130, Math.max(130, tip.x))}px; top: {tip.below
			? tip.y + 34
			: tip.y - 10}px"
		role="tooltip"
	>
		<strong>{tip.word}</strong>
		{#each tip.groups as g (g.pos)}
			<div class="entry">
				<span class="pos" title={g.pos}>{posLabel(g.pos)}</span>
				{g.ru.join(', ')}
			</div>
			{#if g.note}<div class="note-line">{g.note}</div>{/if}
		{/each}
	</div>
{/if}

<style>
	.hw {
		border-radius: 0.2em;
		transition: background-color 160ms ease;
	}
	.hw:hover {
		background: #fef3c7;
	}
	.tip {
		position: fixed;
		z-index: 30;
		transform: translate(-50%, -100%);
		pointer-events: none;
		max-width: 16rem;
		padding: 0.5rem 0.7rem;
		background: #fffdf8;
		border: 1px solid #e7e5e4;
		border-radius: 0.7rem;
		box-shadow: 0 10px 28px -12px rgba(28, 25, 23, 0.35);
		font-family: 'Noto Sans', system-ui, sans-serif;
		font-size: 0.86rem;
		font-weight: 400;
		line-height: 1.35;
		color: #1c1917;
		text-align: left;
	}
	.tip.below {
		transform: translate(-50%, 0);
	}
	.tip strong {
		display: block;
		font-family: ui-serif, Georgia, serif;
		font-size: 0.95rem;
		margin-bottom: 0.2rem;
	}
	.tip .entry {
		color: #44403c;
	}
	.tip .pos {
		font-size: 0.72rem;
		letter-spacing: 0.02em;
		color: #b45309;
		font-weight: 600;
		margin-right: 0.25rem;
	}
	.tip .note-line {
		font-size: 0.75rem;
		color: #78716c;
		margin-top: 0.1rem;
	}
</style>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { episodes, sectionLabel } from '../lib/episodes';
	import { chipClass } from '../lib/colors';
	import { onMount } from 'svelte';

	// Cards are shown as a grid or as a list; the choice is remembered in this browser.
	let view = $state<'grid' | 'list'>('grid');
	onMount(() => {
		try {
			if (localStorage.getItem('voa-player:view') === 'list') view = 'list';
		} catch {
			// storage unavailable: keep the grid
		}
	});
	$effect(() => {
		try {
			localStorage.setItem('voa-player:view', view);
		} catch {
			// storage unavailable
		}
	});

	const sections = [...new Set(episodes.map((e) => e.section))];
	let filter = $state<string | null>(null);
	const shown = $derived(
		[...episodes]
			.filter((e) => !filter || e.section === filter)
			.sort((a, b) => b.date.localeCompare(a.date))
	);
	const batchName: Record<string, string> = {
		'learning-english-2025': 'Learning English · 2025',
		'special-english-2011': 'Special English · 2011'
	};
</script>

<svelte:head>
	<meta
		name="description"
		content="Listen to VOA Special English while following the transcript, word by word."
	/>
</svelte:head>

<section class="intro">
	<h1>Listen and read along.</h1>
	<p>
		Pick a story. The transcript follows the narration, word by word, so you can hear the
		pronunciation and see the spelling at the same time.
	</p>
</section>

<nav class="filters" aria-label="Filter by section">
	<button type="button" class:on={filter === null} onclick={() => (filter = null)}>All</button>
	{#each sections as s (s)}
		<button type="button" class:on={filter === s} onclick={() => (filter = s)}>
			{sectionLabel(s)}
		</button>
	{/each}
	<div class="view" role="group" aria-label="Show as">
		<button
			type="button"
			class="icon"
			class:on={view === 'grid'}
			aria-label="Grid view"
			aria-pressed={view === 'grid'}
			onclick={() => (view = 'grid')}
		>
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"
				><path
					d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linejoin="round"
				/></svg
			>
		</button>
		<button
			type="button"
			class="icon"
			class:on={view === 'list'}
			aria-label="List view"
			aria-pressed={view === 'list'}
			onclick={() => (view = 'list')}
		>
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"
				><path
					d="M4 6h16M4 12h16M4 18h16"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/></svg
			>
		</button>
	</div>
</nav>

<ul class="grid" class:list={view === 'list'}>
	{#each shown as e (e.id)}
		<li>
			<a class="card" href={resolve('/episode/[id]', { id: String(e.id) })}>
				<span class="chip {chipClass(e.section)}">{sectionLabel(e.section)}</span>
				<h2>{e.title}</h2>
				<p class="meta">
					{new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})}
					· {batchName[e.batch] ?? e.batch}
				</p>
				<span class="play-hint" aria-hidden="true">Listen →</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.intro {
		max-width: 46rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 1rem;
	}
	h1 {
		font-family: ui-serif, Georgia, 'Iowan Old Style', serif;
		font-size: clamp(2.2rem, 6vw, 3.4rem);
		line-height: 1.05;
		letter-spacing: -0.02em;
		margin: 0 0 0.6rem;
	}
	.intro p {
		color: #57534e;
		font-size: 1.05rem;
		line-height: 1.6;
		max-width: 36rem;
	}
	.filters {
		max-width: 64rem;
		margin: 1.25rem auto 0;
		padding: 0 1.25rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.filters button {
		font: inherit;
		font-size: 0.875rem;
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		border: 1px solid #e7e5e4;
		background: #fff;
		color: #44403c;
		cursor: pointer;
	}
	.view {
		display: flex;
		gap: 0.3rem;
		margin-left: auto;
	}
	.filters button.icon {
		display: grid;
		place-items: center;
		width: 2.2rem;
		height: 2.2rem;
		padding: 0;
	}
	.filters button.on {
		background: #1c1917;
		border-color: #1c1917;
		color: #fff;
	}
	.grid {
		list-style: none;
		max-width: 64rem;
		margin: 1.5rem auto 4rem;
		padding: 0 1.25rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
	}
	/* list view: one card per row, with the title and date on one line; wide screens only, phones always use the grid */
	@media (min-width: 641px) {
		.grid.list {
			grid-template-columns: 1fr;
			gap: 0.6rem;
		}
		.grid.list .card {
			flex-direction: row;
			align-items: center;
			gap: 1rem;
			padding: 0.9rem 1.1rem;
		}
		.grid.list .card h2 {
			flex: 1;
			font-size: 1.05rem;
		}
		.grid.list .card .meta {
			margin: 0;
		}
	}
	@media (max-width: 640px) {
		.view {
			display: none;
		}
	}
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		height: 100%;
		padding: 1.2rem 1.25rem 1.1rem;
		background: #fff;
		border: 1px solid #e7e5e4;
		border-radius: 1.1rem;
		text-decoration: none;
		color: inherit;
		transition:
			transform 180ms ease,
			box-shadow 180ms ease;
	}
	.card:hover {
		transform: translateY(-3px);
		box-shadow: 0 14px 30px -18px rgba(120, 53, 15, 0.45);
	}
	.chip {
		align-self: flex-start;
		padding: 0.22rem 0.6rem;
		border-radius: 999px;
		font:
			600 0.7rem/1 system-ui,
			sans-serif;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	h2 {
		font-family: ui-serif, Georgia, 'Iowan Old Style', serif;
		font-size: 1.2rem;
		line-height: 1.25;
		margin: 0;
		color: #1c1917;
	}
	.meta {
		margin: auto 0 0;
		font-size: 0.8rem;
		color: #78716c;
	}
	.play-hint {
		font-size: 0.85rem;
		font-weight: 600;
		color: #b45309;
	}
</style>

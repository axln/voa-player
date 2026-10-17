<script lang="ts">
	import { resolve } from '$app/paths';
	import Player from '../../../lib/components/Player.svelte';
	import DictWords from '../../../lib/components/DictWords.svelte';
	import { parseTranscript } from '../../../lib/align';
	import { sectionLabel, staticUrl } from '../../../lib/episodes';
	import { chipClass } from '../../../lib/colors';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const parsed = $derived(parseTranscript(data.text.replace(/^[^\n]*\n\n/, '')));
	const title = $derived(data.episode.title);
</script>

<svelte:head>
	<title>{title} · VOA Player</title>
</svelte:head>

<header class="hero">
	<a class="back" href={resolve('/')}>← All stories</a>
	<span class="chip {chipClass(data.episode.section)}">{sectionLabel(data.episode.section)}</span>
	<h1><DictWords text={title} /></h1>
	<p class="meta">
		{new Date(data.episode.date + 'T12:00:00').toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})}
		· <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={data.episode.story_url} target="_blank" rel="noreferrer">original story</a>
	</p>
</header>

{#key data.episode.id}
	<Player
		episodeId={data.episode.id}
		audioSrc={staticUrl(data.episode.audio_file)}
		timingsSrc={staticUrl(`data/timings/${data.episode.id}.json`)}
		paragraphs={parsed.paragraphs}
		weights={parsed.weights}
	/>
{/key}

<style>
	.hero {
		max-width: 46rem;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 1.5rem;
	}
	.back {
		display: block;
		font-family: system-ui, sans-serif;
		font-size: 0.9rem;
		color: #78716c;
		text-decoration: none;
	}
	.back:hover {
		color: #b45309;
	}
	h1 {
		font-family: ui-serif, Georgia, 'Iowan Old Style', serif;
		font-size: clamp(1.9rem, 5vw, 2.6rem);
		line-height: 1.15;
		margin: 0.9rem 0 0.5rem;
		color: #1c1917;
	}
	.meta {
		font-family: system-ui, sans-serif;
		color: #78716c;
		font-size: 0.95rem;
	}
	.meta a {
		color: #b45309;
	}
	.chip {
		display: inline-block;
		margin-top: 1.2rem;
		padding: 0.25rem 0.7rem;
		border-radius: 999px;
		font:
			600 0.75rem/1 system-ui,
			sans-serif;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
</style>

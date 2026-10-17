import manifest from '../../static/data/episodes.json';
import { asset } from '$app/paths';

// asset() only types known static files, so widen it for files like optional timings.
export const staticUrl = (path: string) => asset(path as 'robots.txt');

export type Episode = {
	batch: string;
	section: string;
	id: number;
	title: string;
	date: string;
	story_url: string;
	transcript_file: string; // relative to static/
	transcript_source: string;
	audio_file: string; // relative to static/
	audio_source: string;
};

export const episodes = manifest as Episode[];

const SECTION_NAMES: Record<string, string> = {
	'health-lifestyle': 'Health & Lifestyle',
	'science-technology': 'Science & Technology',
	'arts-culture': 'Arts & Culture',
	'words-and-their-stories': 'Words and Their Stories',
	'in-the-news': 'In the News',
	'as-it-is': 'As It Is',
	'ask-a-teacher': 'Ask a Teacher',
	'everyday-grammar': 'Everyday Grammar'
};

export const sectionLabel = (slug: string) =>
	SECTION_NAMES[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);

const transcripts = import.meta.glob('/static/data/transcripts/**/*.txt', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

export const transcriptText = (file: string) => {
	const text = transcripts[`/static/${file}`];
	if (text === undefined) throw new Error(`Missing transcript: ${file}`);
	return text;
};

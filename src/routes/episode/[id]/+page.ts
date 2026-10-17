import { error } from '@sveltejs/kit';
import { episodes, transcriptText } from '../../../lib/episodes';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => episodes.map((e) => ({ id: String(e.id) }));

export const load: PageLoad = ({ params }) => {
	const episode = episodes.find((e) => String(e.id) === params.id);
	if (!episode) error(404, 'Episode not found');
	return { episode, text: transcriptText(episode.transcript_file) };
};

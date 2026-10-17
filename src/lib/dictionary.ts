// English -> Russian lookup from static/data/dictionary.json (built by scripts/dict/build.mjs).
// Source: FreeDict eng-rus, CC BY-SA 3.0. See the "source" field in that file.
import data from '../../static/data/dictionary.json';
import { wordKey } from './word';

// note: optional grammar hint shown under the translations (used for forms of "to be").
export type DictGroup = { pos: string; ru: string[]; note?: string };

const words = data.words as Record<string, DictGroup[]>;

export function lookup(text: string): DictGroup[] | null {
	return words[wordKey(text)] ?? null;
}

// Russian abbreviations for parts of speech, for learners who do not know the English grammar terms.
// Keys cover the labels in dictionary.json (FreeDict's and the supplement's).
const POS_RU: Record<string, string> = {
	noun: 'сущ.',
	verb: 'гл.',
	adj: 'прил.',
	adjective: 'прил.',
	adv: 'нар.',
	adverb: 'нар.',
	pron: 'мест.',
	pronoun: 'мест.',
	determiner: 'опр.',
	det: 'опр.',
	prep: 'предл.',
	preposition: 'предл.',
	conj: 'союз',
	conjunction: 'союз',
	interj: 'межд.',
	interjection: 'межд.',
	article: 'арт.',
	aux: 'вспом.',
	particle: 'частица',
	'proper noun': 'имя',
	suffix: 'суфф.',
	prefix: 'приставка',
	numeral: 'числ.',
	postposition: 'послел.',
	abbreviation: 'сокр.'
};

export function posLabel(pos: string): string {
	return POS_RU[pos] ?? pos;
}

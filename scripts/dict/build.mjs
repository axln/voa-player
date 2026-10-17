// Builds static/data/dictionary.json: short English -> Russian entries for the words in our transcripts.
// Source: FreeDict eng-rus (CC BY-SA 3.0), https://freedict.org. The release archive is cached in scripts/dict/.cache.
// Usage (from the project root): node scripts/dict/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { wordKey } from '../../src/lib/word.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const STATIC = path.join(ROOT, 'static');
const CACHE = path.join(import.meta.dirname, '.cache');
const RELEASE = '2025.11.23';
const ARCHIVE = `freedict-eng-rus-${RELEASE}.src.tar.xz`;
const URL = `https://download.freedict.org/dictionaries/eng-rus/${RELEASE}/${ARCHIVE}`;
const OUT = path.join(STATIC, 'data/dictionary.json');
const SUPPLEMENT_FILE = JSON.parse(
	fs.readFileSync(path.join(import.meta.dirname, 'supplement.json'), 'utf8')
);
const SUPPLEMENT = SUPPLEMENT_FILE.words;
const LEMMAS = SUPPLEMENT_FILE.lemmas;
const MAX_POS = 2; // parts of speech shown per word
const MAX_TRANS = 3; // translations shown per part of speech

const POS = {
	n: 'noun',
	v: 'verb',
	adj: 'adj',
	adv: 'adv',
	prep: 'prep',
	conj: 'conj',
	pron: 'pron',
	interjection: 'interj',
	pn: 'proper noun',
	det: 'det',
	aux: 'aux'
};

fs.mkdirSync(CACHE, { recursive: true });
const archive = path.join(CACHE, ARCHIVE);
if (!fs.existsSync(archive)) {
	execFileSync('curl', ['-sL', '--fail', '--max-time', '600', '-o', archive, URL], {
		stdio: 'inherit'
	});
}
const tei = path.join(CACHE, 'eng-rus', 'eng-rus.tei');
if (!fs.existsSync(tei)) execFileSync('tar', ['-xJf', archive, '-C', CACHE, 'eng-rus/eng-rus.tei']);

// Stress marks (combining acute) are removed only for duplicate detection; the displayed form keeps them.
const plain = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// headword -> [{ pos, ru: [...] }] from the TEI entries
const dict = new Map();
const xml = fs.readFileSync(tei, 'utf8');
for (const [entry] of xml.matchAll(/<entry>[\s\S]*?<\/entry>/g)) {
	const orth = entry.match(/<orth>([^<]*)<\/orth>/)?.[1];
	if (!orth) continue;
	const key = wordKey(orth);
	const pos =
		POS[entry.match(/<pos>([^<]*)<\/pos>/)?.[1] ?? ''] ??
		entry.match(/<pos>([^<]*)<\/pos>/)?.[1] ??
		'';
	const ru = [];
	for (const [, cit] of entry.matchAll(/<cit type="trans" xml:lang="ru">([\s\S]*?)<\/cit>/g)) {
		for (const [, q] of cit.matchAll(/<quote>([^<]*)<\/quote>/g)) {
			const t = q.trim();
			// drop grammar notes such as "чем + comp., тем + comp."
			// suffixes ("-ать") and grammar notes are not useful as hints
			if (t && !/[+.[]/.test(t) && !t.startsWith('-')) ru.push(t);
		}
	}
	if (!ru.length) continue;
	if (!dict.has(key)) dict.set(key, []);
	dict.get(key).push({ pos, ru });
}

// Merge entries with the same part of speech, dedupe translations, and cap the sizes.
function summarize(groups) {
	const byPos = new Map();
	for (const { pos, ru } of groups) {
		if (!byPos.has(pos)) byPos.set(pos, []);
		const list = byPos.get(pos);
		for (const t of ru) if (!list.some((x) => plain(x) === plain(t))) list.push(t);
	}
	return [...byPos.entries()]
		.slice(0, MAX_POS)
		.map(([pos, ru]) => ({ pos, ru: ru.slice(0, MAX_TRANS) }));
}

// Lemma fallbacks for inflected transcript words (e.g. "grows" -> "grow").
function candidates(key) {
	const c = LEMMAS[key] ? [LEMMAS[key]] : []; // irregular forms first
	c.push(key);
	if (key.endsWith("'s")) c.push(key.slice(0, -2));
	if (key.endsWith('ies')) c.push(key.slice(0, -3) + 'y');
	if (key.endsWith('ied')) c.push(key.slice(0, -3) + 'y');
	if (key.endsWith('es')) c.push(key.slice(0, -2));
	if (key.endsWith('s')) c.push(key.slice(0, -1));
	if (key.endsWith('ed')) c.push(key.slice(0, -2), key.slice(0, -1));
	if (key.endsWith('ing')) c.push(key.slice(0, -3), key.slice(0, -3) + 'e');
	return c.filter((x, i) => i === 0 || x.length >= 2); // the word itself is always tried; stems need 2+ letters
}

// Every distinct token in the transcripts and the episode titles.
const episodes = JSON.parse(fs.readFileSync(path.join(STATIC, 'data/episodes.json'), 'utf8'));
const tokens = new Set();
for (const ep of episodes) {
	for (const [w] of ep.title.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu))
		tokens.add(wordKey(w));
	const text = fs.readFileSync(path.join(STATIC, ep.transcript_file), 'utf8');
	for (const [w] of text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)) tokens.add(wordKey(w));
}

const words = {};
let missing = 0;
for (const w of [...tokens].sort()) {
	if (SUPPLEMENT[w]) {
		words[w] = SUPPLEMENT[w];
		continue;
	}
	// Show the base word's entries too (before the surface form's), because an inflected form such as
	// "remains" is often a verb even when the surface form is also a noun. Both appear; the card shows up to MAX_POS.
	const bases = candidates(w).filter((c) => c !== w && dict.has(c));
	const own = dict.has(w) ? dict.get(w) : [];
	const groups = [...bases.flatMap((c) => dict.get(c)), ...own];
	if (!groups.length) {
		missing++;
		continue;
	}
	words[w] = summarize(groups);
}

const out = {
	source: {
		name: 'FreeDict English-Russian dictionary',
		version: RELEASE,
		url: 'https://freedict.org/',
		license: 'CC BY-SA 3.0',
		licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
		note: 'Adapted for this project: word list limited to the transcripts, translations filtered and shortened.'
	},
	words
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(
	`${Object.keys(words).length} words with entries, ${missing} without (of ${tokens.size}). Wrote ${path.relative(ROOT, OUT)}`
);

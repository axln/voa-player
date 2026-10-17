import { expect, test } from 'vitest';
import { buildTimeline, findWordIndex, parseTranscript } from './align';

const text = 'Hello there, friend.\n\nThis is a test!';

test('parseTranscript numbers words and keeps every character', () => {
	const { paragraphs, weights } = parseTranscript(text);
	expect(weights.length).toBe(7);
	expect(paragraphs.length).toBe(2);
	const rebuilt = paragraphs.map((p) => p.map((x) => x.text).join('')).join('\n\n');
	expect(rebuilt).toBe(text);
	const words = paragraphs.flat().filter((p) => p.word >= 0);
	expect(words.map((w) => w.word)).toEqual([0, 1, 2, 3, 4, 5, 6]);
});

test('timeline is monotonic and ends at duration', () => {
	const { weights } = parseTranscript(text);
	const starts = buildTimeline(weights, 30);
	expect(starts[0]).toBe(0);
	expect(starts[starts.length - 1]).toBe(30);
	for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1]);
});

test('findWordIndex picks the spoken word at a given time', () => {
	const starts = Float64Array.from([0, 1, 2, 3]);
	expect(findWordIndex(starts, -1)).toBe(-1);
	expect(findWordIndex(starts, 0)).toBe(0);
	expect(findWordIndex(starts, 1.5)).toBe(1);
	expect(findWordIndex(starts, 99)).toBe(2);
});

test('findWordIndex with ends only highlights inside a word', () => {
	const starts = Float64Array.from([0, 1, 5, 6]); // three words, plus the end of the file
	const ends = Float64Array.from([0.5, 1.5, 5.5]);
	expect(findWordIndex(starts, 0.2, ends)).toBe(0);
	expect(findWordIndex(starts, 0.7, ends)).toBe(-1); // pause after word 0
	expect(findWordIndex(starts, 3, ends)).toBe(-1); // gap before word 2
	expect(findWordIndex(starts, 5.2, ends)).toBe(2);
	expect(findWordIndex(starts, 6, ends)).toBe(-1); // after the last word
});

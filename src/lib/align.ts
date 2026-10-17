// Splits a transcript into paragraphs of pieces, where each word piece knows its index.
// The transcript has no word timings, so timings are estimated from word weights (see buildTimeline).

export type Piece = { text: string; word: number }; // word: index into the word list, or -1 for punctuation/space
export type Parsed = { paragraphs: Piece[][]; weights: number[] };

const WORD = /([\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*)/u;

// VOA's vocabulary list at the end of a story, e.g. "cozy –adj. a feeling of ease and warmth".
const VOCAB = /^[^\n]{1,60}?\s[–—-]\s?(n|v|adj|adv|prep|pron|conj|interj|phr|idiom|det|modal)\b\./;
// Printed credits after the sign-off, e.g. "Kiyoko Metzler reported this story for AFP…" or "Contributing: …".
// They are not narrated (checked against the word timestamps of several episodes).
const CREDIT =
	/(reported (this|the|on this) story for|adapted (it|this) for VOA|wrote this lesson for VOA|^Contributing\b)/i;

export function isVocabulary(block: string): boolean {
	return VOCAB.test(block.trim());
}

// A speaker label at the start of a paragraph, e.g. "CASSENDRA WALLER: " in a direct-speech block. Printed, not spoken.
const SPEAKER = /^(?:[A-Z][A-Z.'’-]+)(?:\s+[A-Z][A-Z.'’-]+){0,3}\s*:\s*/;

export function speakerLabel(block: string): string {
	return block.match(SPEAKER)?.[0] ?? '';
}

export function isCredit(block: string): boolean {
	const t = block.trim();
	return t.length < 400 && CREDIT.test(t);
}

// The paragraphs of a transcript body, without separator lines.
export function blocksOf(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map((b) => b.replace(/_{3,}/g, '').trim())
		.filter(Boolean);
}

// For each paragraph, whether it is printed but not narrated: vocabulary, and the credits and notes after the last spoken paragraph.
export function nonSpokenFlags(blocks: string[]): boolean[] {
	const flags = blocks.map((b) => isVocabulary(b));
	for (let i = blocks.length - 1; i >= 0; i--) {
		if (flags[i]) continue;
		if (isCredit(blocks[i])) flags[i] = true;
		else break;
	}
	return flags;
}

// The paragraphs that are narrated (the text sent to the aligners).
export function spokenParagraphs(text: string): string[] {
	const blocks = blocksOf(text);
	const flags = nonSpokenFlags(blocks);
	return blocks.filter((_, i) => !flags[i]).map((b) => b.slice(speakerLabel(b).length));
}

export function parseTranscript(text: string): Parsed {
	const weights: number[] = [];
	const paragraphs: Piece[][] = [];
	const blocks = blocksOf(text);
	const flags = nonSpokenFlags(blocks);
	for (const [bi, raw] of blocks.entries()) {
		const spoken = !flags[bi];
		const label = speakerLabel(raw);
		const pieces: Piece[] = label ? [{ text: label, word: -1 }] : [];
		const parts = raw.slice(label.length).split(WORD); // odd indices are words
		for (let i = 0; i < parts.length; i++) {
			if (parts[i] === '') continue;
			if (i % 2 === 1 && spoken) {
				weights.push(0);
				pieces.push({ text: parts[i], word: weights.length - 1 });
			} else {
				pieces.push({ text: parts[i], word: -1 });
			}
		}
		// Pause weight: the gap after each word, from the punctuation that follows it.
		for (let i = 0; i < pieces.length; i++) {
			const p = pieces[i];
			if (p.word < 0) continue;
			const letters = p.text.replace(/[^\p{L}\p{N}]/gu, '').length;
			let pause = 0;
			for (let j = i + 1; j < pieces.length && pieces[j].word < 0; j++) {
				if (/[.!?]/.test(pieces[j].text)) pause = Math.max(pause, 4);
				else if (/[,;:—–-]/.test(pieces[j].text)) pause = Math.max(pause, 2);
			}
			if (pause === 0 && i === pieces.length - 1) pause = 6; // paragraph end
			weights[p.word] = Math.max(1, letters) + pause;
		}
		paragraphs.push(pieces);
	}
	return { paragraphs, weights };
}

// Start time of each word, plus a final entry equal to duration.
export function buildTimeline(weights: number[], duration: number): Float64Array {
	const starts = new Float64Array(weights.length + 1);
	const total = weights.reduce((a, b) => a + b, 0) || 1;
	let acc = 0;
	for (let i = 0; i < weights.length; i++) {
		starts[i] = (acc / total) * duration;
		acc += weights[i];
	}
	starts[weights.length] = duration;
	return starts;
}

// Index of the word being spoken at time t: the last word that started at or before t. When word ends
// are given, a word only counts while t is before its end, so gaps (pauses, music) highlight nothing.
// Returns -1 before the first word and in gaps.
export function findWordIndex(starts: Float64Array, t: number, ends?: Float64Array): number {
	const n = starts.length - 1;
	if (n <= 0 || t < starts[0]) return -1;
	let lo = 0,
		hi = n - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (starts[mid] <= t) lo = mid;
		else hi = mid - 1;
	}
	if (ends && t >= ends[lo]) return -1;
	return lo;
}

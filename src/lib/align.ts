// Splits a transcript into paragraphs of pieces, where each word piece knows its index.
// The transcript has no word timings, so timings are estimated from word weights (see buildTimeline).

export type Piece = { text: string; word: number }; // word: index into the word list, or -1 for punctuation/space
export type Parsed = { paragraphs: Piece[][]; weights: number[] };

const WORD = /([\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*)/u;

export function parseTranscript(text: string): Parsed {
	const weights: number[] = [];
	const paragraphs: Piece[][] = [];
	for (const block of text.split(/\n\s*\n/)) {
		const raw = block.replace(/_{3,}/g, '').trim(); // drop separator lines of underscores
		if (!raw) continue;
		const parts = raw.split(WORD); // odd indices are words
		const pieces: Piece[] = [];
		for (let i = 0; i < parts.length; i++) {
			if (parts[i] === '') continue;
			if (i % 2 === 1) {
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

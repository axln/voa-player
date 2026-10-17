// Builds static/data/timings/<id>.json for every episode.
// Runs ElevenLabs forced alignment and Scribe v2, maps both onto the original transcript's words,
// and keeps the better result per episode. Usage (from the project root):
//   node --env-file=.env scripts/align/align.mjs [--only=<id>] [--methods=forced,scribe] [--force]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseTranscript, spokenParagraphs } from '../../src/lib/align.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const STATIC = path.join(ROOT, 'static');
const DATA = path.join(STATIC, 'data');
const CACHE = path.join(import.meta.dirname, '.cache');
const TIMINGS = path.join(DATA, 'timings');
const REPORT = path.join(import.meta.dirname, 'report.json');

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
const methods = (
	args.find((a) => a.startsWith('--methods='))?.split('=')[1] ?? 'forced,scribe'
).split(',');
const force = args.includes('--force');
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error('ELEVENLABS_API_KEY is not set. Run with: node --env-file=.env ...');

fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(TIMINGS, { recursive: true });

// ---------- text helpers ----------

const norm = (s) =>
	s
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]/gu, '');

function lev(a, b) {
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		for (let j = 1; j <= b.length; j++) {
			cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
		}
		prev = cur;
	}
	return prev[b.length];
}

// Words match if equal, or if long enough and at most one letter off (handles small transcription errors).
const same = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && lev(a, b) <= 1);

// LCS-style alignment of our words to the provider's words. Returns, for each of our words, the index of the matched provider word or -1.
function matchWords(ours, theirs) {
	const n = ours.length;
	const m = theirs.length;
	const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			dp[i][j] = same(ours[i], theirs[j])
				? dp[i + 1][j + 1] + 1
				: Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}
	const map = new Array(n).fill(-1);
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (same(ours[i], theirs[j]) && dp[i][j] === dp[i + 1][j + 1] + 1) {
			map[i] = j;
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
		else j++;
	}
	return map;
}

// ---------- timing from matches ----------

// Start time per our word. Unmatched words are interpolated between their matched neighbours.
// End time per word: the provider's end when matched, else a short default. Never past the next word's start,
// so a word is only highlighted while it is being spoken.
function buildEnds(anchorEnds, starts, duration, letters) {
	const n = starts.length;
	return starts.map((start, i) => {
		const nextStart = i + 1 < n ? starts[i + 1] : (duration ?? start + 0.6);
		// Cap by word length, about 0.25 s plus 0.1 s per letter. The aligner can stretch a word across a pause.
		const cap = Math.max(0.4, 0.25 + 0.1 * letters[i]);
		const wanted = Math.min(anchorEnds[i] ?? start + cap, start + cap);
		return Math.min(nextStart, Math.max(start + 0.05, wanted));
	});
}

function buildStarts(anchors, duration) {
	const n = anchors.length;
	const starts = new Array(n).fill(null);
	anchors.forEach((t, i) => (starts[i] = t));
	let i = 0;
	while (i < n) {
		if (starts[i] !== null) {
			i++;
			continue;
		}
		let end = i;
		while (end < n && starts[end] === null) end++;
		const from = i > 0 ? starts[i - 1] : 0;
		const to = end < n ? starts[end] : (duration ?? from + (end - i + 1) * 0.4);
		const span = end - i + 1;
		for (let k = i; k < end; k++) starts[k] = from + ((to - from) * (k - i + 1)) / span;
		i = end;
	}
	for (let k = 1; k < n; k++) starts[k] = Math.max(starts[k], starts[k - 1]);
	return starts;
}

function longestUnmatchedRun(anchors) {
	let best = 0;
	let run = 0;
	for (const t of anchors) {
		run = t === null ? run + 1 : 0;
		best = Math.max(best, run);
	}
	return best;
}

function audioDuration(file) {
	try {
		const out = execFileSync('afinfo', [file], { encoding: 'utf8' });
		const m = out.match(/estimated duration:\s*([\d.]+)/);
		return m ? Number(m[1]) : null;
	} catch {
		return null; // afinfo is macOS-only; the tail check is skipped without it
	}
}

// ---------- API ----------

async function call(name, id, makeForm, suffix = '') {
	const cacheFile = path.join(CACHE, `${id}.${name}${suffix ? `.${suffix}` : ''}.json`);
	if (!force && fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
	const url =
		name === 'forced'
			? 'https://api.elevenlabs.io/v1/forced-alignment'
			: 'https://api.elevenlabs.io/v1/speech-to-text';
	for (let attempt = 1; attempt <= 3; attempt++) {
		let res;
		try {
			res = await fetch(url, {
				method: 'POST',
				headers: { 'xi-api-key': key },
				body: makeForm()
			});
		} catch (err) {
			// network error (e.g. a dropped upload): retry
			if (attempt === 3)
				throw new Error(`${name} ${id}: network error ${err.cause?.code ?? err.message}`, {
					cause: err
				});
			await new Promise((r) => setTimeout(r, 2000 * attempt));
			continue;
		}
		if (res.ok) {
			const json = await res.json();
			fs.writeFileSync(cacheFile, JSON.stringify(json));
			return json;
		}
		const text = await res.text();
		if (attempt === 3 || (res.status !== 429 && res.status < 500)) {
			throw new Error(`${name} ${id}: HTTP ${res.status} ${text.slice(0, 300)}`);
		}
		await new Promise((r) => setTimeout(r, 2000 * attempt));
	}
}

// ---------- per episode ----------

function scoreOf(anchors, duration) {
	const n = anchors.length;
	const matched = anchors.filter((t) => t !== null).length;
	const coverage = matched / n;
	const maxRun = longestUnmatchedRun(anchors);
	const lastAnchor = [...anchors].reverse().find((t) => t !== null) ?? 0;
	const tailShort = duration ? duration - lastAnchor > 15 : false; // the last words should reach near the end of the audio
	const score = coverage - (2 * maxRun) / n - (tailShort ? 0.2 : 0);
	return { coverage, maxRun, lastAnchor, tailShort, score };
}

// Merge the two services. Scribe is primary: it transcribes what is actually spoken, so its word times are
// the audio evidence. Forced alignment only fills words Scribe did not match, and only where its time lies
// between the nearest Scribe-timed words, so a bad forced time cannot pull a word out of place.
function mergeAnchors(scribe, forced, duration) {
	const anchors = scribe.anchors.slice();
	const anchorEnds = scribe.anchorEnds.slice();
	const from = { scribe: 0, forced: 0, none: 0 };
	const n = anchors.length;
	// nearest Scribe-timed word before and after each index
	const before = new Array(n);
	const after = new Array(n);
	let last = null;
	for (let i = 0; i < n; i++) {
		before[i] = last;
		if (anchors[i] !== null) last = anchors[i];
	}
	let next = duration ?? null;
	for (let i = n - 1; i >= 0; i--) {
		after[i] = next;
		if (anchors[i] !== null) next = anchors[i];
	}
	for (let i = 0; i < n; i++) {
		if (anchors[i] !== null) {
			from.scribe++;
			continue;
		}
		const fa = forced.anchors[i];
		const lo = before[i] ?? 0;
		const hi = after[i] ?? Infinity;
		if (fa !== null && fa >= lo && fa <= hi) {
			anchors[i] = fa;
			anchorEnds[i] = forced.anchorEnds[i];
			from.forced++;
		} else {
			from.none++;
		}
	}
	return { anchors, anchorEnds, from };
}

async function processEpisode(ep) {
	const txt = fs.readFileSync(path.join(STATIC, ep.transcript_file), 'utf8');
	const body = txt.replace(/^[^\n]*\n\n/, ''); // the first line is the title, shown separately in the app
	const parsed = parseTranscript(body);
	const ours = parsed.paragraphs
		.flat()
		.filter((p) => p.word >= 0)
		.map((p) => p.text);
	const oursNorm = ours.map(norm);
	const letters = oursNorm.map((w) => w.length);
	const audioFile = path.join(STATIC, ep.audio_file);
	const duration = audioDuration(audioFile);
	// Only the narrated text goes to forced alignment; trailing vocabulary notes are not spoken.
	const apiText = spokenParagraphs(body).join('\n\n');
	const textKey = createHash('sha1').update(apiText).digest('hex').slice(0, 10);

	const results = {};
	for (const method of methods) {
		let providerWords;
		if (method === 'forced') {
			const json = await call(
				'forced',
				ep.id,
				() => {
					const f = new FormData();
					f.append(
						'file',
						new Blob([fs.readFileSync(audioFile)], { type: 'audio/mpeg' }),
						path.basename(audioFile)
					);
					f.append('text', apiText);
					return f;
				},
				textKey
			);
			providerWords = json.words.map((w) => ({ text: w.text, start: w.start, end: w.end }));
		} else {
			const json = await call('scribe', ep.id, () => {
				const f = new FormData();
				f.append(
					'file',
					new Blob([fs.readFileSync(audioFile)], { type: 'audio/mpeg' }),
					path.basename(audioFile)
				);
				f.append('model_id', 'scribe_v2');
				f.append('timestamps_granularity', 'word');
				f.append('language_code', 'en');
				return f;
			});
			providerWords = json.words
				.filter((w) => w.type === 'word' && typeof w.start === 'number')
				.map((w) => ({ text: w.text, start: w.start, end: w.end }));
		}
		const map = matchWords(
			oursNorm,
			providerWords.map((w) => norm(w.text))
		);
		results[method] = {
			anchors: map.map((j) => (j >= 0 ? providerWords[j].start : null)),
			anchorEnds: map.map((j) => (j >= 0 ? providerWords[j].end : null))
		};
	}

	let anchors;
	let anchorEnds;
	let method;
	let from = null;
	if (methods.length === 2) {
		({ anchors, anchorEnds, from } = mergeAnchors(results.scribe, results.forced, duration));
		method = 'merged';
	} else {
		method = methods[0];
		({ anchors, anchorEnds } = results[method]);
	}
	const metrics = scoreOf(anchors, duration);
	const starts = buildStarts(anchors, duration);
	const ends = buildEnds(anchorEnds, starts, duration, letters);
	fs.writeFileSync(
		path.join(TIMINGS, `${ep.id}.json`),
		JSON.stringify({
			method,
			words: ours.length,
			duration,
			starts: starts.map(round3),
			ends: ends.map(round3)
		})
	);
	const summary = { coverage: round(metrics.coverage), maxRun: metrics.maxRun, from };
	return {
		id: ep.id,
		title: ep.title,
		words: ours.length,
		duration: round(duration),
		method,
		summary
	};
}

const round = (x) => (x === null || x === undefined ? null : Math.round(x * 1000) / 1000);
const round3 = (x) => Math.round(x * 1000) / 1000;

// ---------- run ----------

const episodes = JSON.parse(fs.readFileSync(path.join(DATA, 'episodes.json'), 'utf8'));
const report = [];
for (const ep of episodes) {
	if (only && String(ep.id) !== only) continue;
	process.stdout.write(`${ep.id} ${ep.title} ... `);
	const r = await processEpisode(ep);
	report.push(r);
	console.log(`${r.method} ${JSON.stringify(r.summary)}`);
}
if (!only) fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

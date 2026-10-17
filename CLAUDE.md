# VOA Player

A player for VOA Special English audio material. It plays an episode while the official transcript is shown and the currently spoken word is highlighted, karaoke style.

## Current status

- Repo: `github.com/axln/voa-player` (private), `main` branch. Pushed; GitHub Pages deployment not set up yet.
- Scaffold: SvelteKit 3 with TypeScript, Tailwind, ESLint, Prettier, Vitest and Playwright. Uses `adapter-static`, and `src/routes/+layout.ts` prerenders all routes. `npm run build` passes.
- Imports: SvelteKit `$lib` and `#lib` aliases did not resolve in this setup, so app code uses relative imports. `$app/paths` exports `resolve()` and `asset()` here, not `base`.
- Phase 1 (done): sample data for 17 episodes across 2011 and 2025 batches. See Data notes.
- Player (built, not deployed): library page with section filters; episode page with the transcript, karaoke highlight, play/pause, skip ±5 s, speed (0.75×–1.5×), click a word to seek, keyboard (space, arrows), auto-scroll, and a settings popup.
- Highlight rules: a word is highlighted only between its start and end. Words already spoken are dimmed. During a pause of at least 1 s (`LONG_PAUSE` in `Player.svelte`), a yellow underline bar marks the next word. The active word is a plain yellow background that fades in, with no ring or border.
- Word timings: `static/data/timings/<id>.json` is `{ "starts": [...], "ends": [...] }`, one start and one end (seconds) per word, in transcript word order. When the file exists, the player uses it. Otherwise it uses a mock estimate from word length and punctuation (`src/lib/align.ts`) and shows a note.
- Ends: the provider's word end, capped at about 0.25 s plus 0.1 s per letter and never past the next word's start. Without the cap, the aligner stretches a word across a pause.
- `npm run align` (`scripts/align/align.mjs`, needs `ELEVENLABS_API_KEY` in `.env`) runs ElevenLabs forced alignment and Scribe v2, maps both onto the original words, and keeps the better one by a score (coverage minus long unmatched runs). Results are in `scripts/align/report.json`. Raw API responses are cached in `scripts/align/.cache/` (git-ignored), so reruns don't call the API. Forced alignment won on all 17 episodes, so the current timings come from it.
- Playback uses the Web Audio API with the Signalsmith Stretch AudioWorklet (`src/lib/web-audio-player.ts`, MIT, `signalsmith-stretch` npm package). It changes tempo without changing pitch, and the position comes from `AudioContext.currentTime`, not the `<audio>` element. Gotcha: the worklet throws on chunked `addBuffers` uploads, which silences the node with no error on the page, so the whole file is uploaded in one call. Trade-off: the whole file is decoded and copied into memory.
- Settings popup (sliders button in the dock, floats above the button): "Remember position" (default on; when off, positions are neither saved nor restored) and "Forget saved positions" (clears all `voa-player:position:*` keys). Auto-scroll stays in the dock row.
- Not deployed: nothing is on GitHub Pages yet. `paths.base` is not set.
- The template's `svelte.config.js` is absent. The adapter is set in `vite.config.ts`, and the build works with that.

## Data notes

- Each episode needs: audio file, official transcript text, and ideally word- or sentence-level timing for the highlight. If timing is missing, we need a way to create it (for example forced alignment), and that is a separate decision.
- Keep the collected sample set in a dedicated folder (`static/data/`), with one entry per article: title, date, source URL, audio URL, transcript source.
- Record the source of every file so licensing and provenance stay traceable.
- Layout (same for every batch): `static/data/audio/<section>/<id>-<date>.mp3` and `static/data/transcripts/<section>/<id>-<date>.txt`. One manifest, `static/data/episodes.json`, lists every episode with `batch`, `section`, title, date, paths and sources.
- Batches:
  - `special-english-2011`: 10 Sept 2011 reports from manythings.org mirror pages. Sections are the report names (economics, health, technology, agriculture, education, in-the-news). The voanews.com text links are 404 now, so the text is a mirror copy.
  - `learning-english-2025`: 7 stories from 7 sections, Feb–Mar 2025, from learningenglish.voanews.com. Sections are the site's section slugs. These are VOA's own article texts.
- Audio and transcripts are both committed (GitHub Pages serves the audio).
- Freshness: the article sections on learningenglish.voanews.com (and their RSS feeds) stop at about 14 March 2025. Section and archive pages show the same snapshot for every date. Newer items exist as daily podcast audio (e.g., Dec 2025 MP3s on the live page), but their article pages did not load, so no transcripts were found after March 2025.
- Themes: spread downloads across sections (Health & Lifestyle, Science & Technology, Arts & Culture, Words and Their Stories, As It Is, Ask a Teacher, Everyday Grammar). Not yet available: American Stories (newest with audio is 2017), Education Tips (page has no body text), News Words, English in a Minute, English @ the Movies, and Everyday Grammar Video (empty).
- Fetching: use plain curl with no custom User-Agent (a custom one gets 406). Article pages on learningenglish.voanews.com must be loaded by slug URL (`/a/<slug>/<id>.html`). The ID-only URL returns an empty shell.

## Working rules

- Do not deploy to GitHub Pages, and do not commit or push, without the user's explicit request.
- Keep the code small. Prefer the platform (browser audio, HTML/CSS/JS) over new dependencies until the player needs one.
- Audio files are committed to the repo, because GitHub Pages serves them. Keep each file under GitHub's 100 MB limit and the Pages site under 1 GB.

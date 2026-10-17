# VOA Player

A player for VOA Special English audio material. It plays an episode while the official transcript is shown and the currently spoken word is highlighted, karaoke style.

## Current status

- Empty repository, not yet under git.
- Phase 1 (in progress): find about 10 VOA Special English articles with their audio and official transcripts, hosted on the Internet. VOA audio is treated as licensed for free distribution, and many sites host it.
- Phase 2 (later): build the player. Audio plays, the transcript is displayed, and the current word is highlighted in sync with playback.

## Data notes

- Each episode needs: audio file, official transcript text, and ideally word- or sentence-level timing for the highlight. If timing is missing, we need a way to create it (for example forced alignment), and that is a separate decision.
- Keep the collected sample set in a dedicated folder (`data/`), with one entry per article: title, date, source URL, audio URL, transcript source.
- Record the source of every file so licensing and provenance stay traceable.
- Two sample sets, both with transcripts and MP3s (MP3s git-ignored):
  - `data/episodes.json`: 10 Sept 2011 Special English reports, from manythings.org mirror pages. Those pages' voanews.com text links are 404 now, so the text is a mirror copy.
  - `data/episodes-2025.json`: 7 stories from 7 different sections, Feb–Mar 2025, taken from learningenglish.voanews.com. Transcripts are in `data/learning-english/<section>/`. These are the article texts from VOA's own site.
- Freshness: the article sections on learningenglish.voanews.com (and their RSS feeds) stop at about 14 March 2025. Section and archive pages show the same snapshot for every date. Newer items exist as daily podcast audio (e.g., Dec 2025 MP3s on the live page), but their article pages did not load, so no transcripts were found after March 2025.
- Themes: spread downloads across sections (Health & Lifestyle, Science & Technology, Arts & Culture, Words and Their Stories, As It Is, Ask a Teacher, Everyday Grammar). Not yet available: American Stories (newest with audio is 2017), Education Tips (page has no body text), News Words, English in a Minute, English @ the Movies, and Everyday Grammar Video (empty).
- Fetching: use plain curl with no custom User-Agent (a custom one gets 406). Article pages on learningenglish.voanews.com must be loaded by slug URL (`/a/<slug>/<id>.html`). The ID-only URL returns an empty shell.

## Working rules

- Keep the code small. Prefer the platform (browser audio, HTML/CSS/JS) over new dependencies until the player needs one.
- Do not commit downloaded audio to git.

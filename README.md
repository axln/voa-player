# VOA Player

A web player for [VOA Special English](https://learningenglish.voanews.com/) audio. It plays an episode while showing its transcript, and highlights each word as it is spoken, karaoke style.

> **Status:** the player works. It is published with GitHub Pages from `main` (https://axln.github.io/voa-player/).

## Sample data

The `static/data/` folder holds the sample episodes, with audio and transcripts for each. Files there are served as-is.

| Batch                   | Episodes | Source                                               | Date         |
| ----------------------- | -------- | ---------------------------------------------------- | ------------ |
| `special-english-2011`  | 10       | manythings.org mirror of VOA Special English reports | Sept 2011    |
| `learning-english-2025` | 37       | learningenglish.voanews.com                          | Jan–Mar 2025 |

Layout:

```
static/data/
├── episodes.json                  # manifest: one entry per episode
├── audio/<section>/<id>-<date>.mp3
├── transcripts/<section>/<id>-<date>.txt
└── timings/<id>.json              # optional: word start and end times (seconds)
```

Word timings are optional. `timings/<id>.json` holds a start and an end time for each word. The player highlights a word only between its start and end. Without the file, the player estimates timings from word lengths, so the highlight is approximate.

The vocabulary list and the credit lines after the sign-off, and speaker labels such as `DAVID MWANGI:`, are printed rather than spoken. They are shown muted and never timed.

Timings come from ElevenLabs. `yarn align` runs Scribe v2 (word timestamps) and forced alignment, and merges them: Scribe is primary, and forced alignment fills only the words Scribe did not match. Create `.env` with `ELEVENLABS_API_KEY=...` first. The script caches API responses in `scripts/align/.cache/`, so reruns don't call the API again.

`episodes.json` records each episode's batch, section, title, date, and the source URLs for its audio and transcript. Check the sources before reusing the material.

## Development

Install dependencies, then start the dev server:

```sh
yarn install
yarn dev
```

Other scripts:

| Command          | What it does                               |
| ---------------- | ------------------------------------------ |
| `yarn build`     | Build the static site into `build/`        |
| `yarn preview`   | Serve the production build locally         |
| `yarn check`     | Type-check the project with `svelte-check` |
| `yarn lint`      | Run Prettier and ESLint                    |
| `yarn test:unit` | Run unit tests with Vitest                 |
| `yarn test:e2e`  | Run end-to-end tests with Playwright       |
| `yarn align`     | Regenerate word timings (needs `.env`)     |
| `yarn dict`      | Rebuild the word dictionary from FreeDict  |

## Stack

- [SvelteKit](https://svelte.dev/docs/kit) with the static adapter, so the whole site is prerendered
- Web Audio API for playback, with [Signalsmith Stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch) (MIT) for speed changes that keep the pitch
- Tailwind CSS
- TypeScript, ESLint, Prettier
- Vitest (unit) and Playwright (end-to-end)

## Deployment

The audio is committed to this repo and served by GitHub Pages, so keep individual files under GitHub's 100 MB limit and the whole site under 1 GB.

Before the first deploy, set `paths.base` to `/voa-player` if the site is served from a project URL such as `https://<user>.github.io/voa-player/`. The app uses `resolve()` and `asset()` for links and files, so it works with a base path.

## Dictionary

Hovering a word in the player or in an episode title shows its short English → Russian entry, with the part of speech in Russian abbreviations. The entries come from the [FreeDict English–Russian dictionary](https://freedict.org/) (CC BY-SA 3.0). `yarn dict` builds `static/data/dictionary.json` for the words in the transcripts. The file keeps the license and attribution in its `source` field.

## Licensing

The code is licensed under the [MIT License](LICENSE). The sample audio, transcripts, and dictionary data have their own terms, described below.

VOA's Special English material is produced by the Voice of America, a US government broadcaster. Per the manythings.org mirror, that material is public domain. Verify the current terms on the VOA site before redistributing it.

`static/data/dictionary.json` is derived from FreeDict eng-rus and is licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Share-alike applies to that file.

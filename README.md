# VOA Player

A web player for [VOA Special English](https://learningenglish.voanews.com/) audio. It plays an episode while showing its transcript, and highlights each word as it is spoken, karaoke style.

> **Status:** early. The sample data is collected and the project is scaffolded, but the player itself is not built yet.

## Sample data

The `data/` folder holds the sample episodes, with audio and transcripts for each.

| Batch | Episodes | Source | Date |
|---|---|---|---|
| `special-english-2011` | 10 | manythings.org mirror of VOA Special English reports | Sept 2011 |
| `learning-english-2025` | 7 | learningenglish.voanews.com | Feb–Mar 2025 |

Layout:

```
data/
├── episodes.json                  # manifest: one entry per episode
├── audio/<section>/<id>-<date>.mp3
└── transcripts/<section>/<id>-<date>.txt
```

`episodes.json` records each episode's batch, section, title, date, and the source URLs for its audio and transcript. Check the sources before reusing the material.

## Development

Install dependencies, then start the dev server:

```sh
yarn install
yarn dev
```

Other scripts:

| Command | What it does |
|---|---|
| `yarn build` | Build the static site into `build/` |
| `yarn preview` | Serve the production build locally |
| `yarn check` | Type-check the project with `svelte-check` |
| `yarn lint` | Run Prettier and ESLint |
| `yarn test:unit` | Run unit tests with Vitest |
| `yarn test:e2e` | Run end-to-end tests with Playwright |

## Stack

- [SvelteKit](https://svelte.dev/docs/kit) with the static adapter, so the whole site is prerendered
- Tailwind CSS
- TypeScript, ESLint, Prettier
- Vitest (unit) and Playwright (end-to-end)

## Deployment

The audio is committed to this repo and served by GitHub Pages, so keep individual files under GitHub's 100 MB limit and the whole site under 1 GB.

Before the first deploy, the Vite/SvelteKit config needs a `paths.base` value if the site is served from a project URL such as `https://<user>.github.io/voa-player/`.

## Licensing

VOA's Special English material is produced by the Voice of America, a US government broadcaster. Per the manythings.org mirror, that material is public domain. Verify the current terms on the VOA site before redistributing it.

# Ratio — paint color mixer

A client-side calculator for artists and hobbyists: add the paints you have on hand, set a target color (by hex or by sampling a photo), and get back an estimated mixing ratio — as percentages, whole-number "parts," or milliliters for a batch size you choose.

Everything runs in the browser. There is no backend — nothing you enter is ever sent to a server. Sharing a palette works by encoding it into a URL query param that the recipient's browser decodes into their own independent, editable copy.

## Features

- Add colors from presets, a native color picker, or by sampling a pixel from an uploaded image
- Solves for the mix ratio that best reproduces a target color, using a painter-oriented (RYB-approximated) mixing model rather than a naive RGB average
- Batch size in ml, with a %/ml toggle and whole-number "parts" for easy real-world measuring
- Copy the recipe as text, download it as a PNG, or share a link that opens a fresh, independently-editable copy for whoever opens it
- Everything persists locally (`localStorage`) between visits

## Tech stack

- [Preact](https://preactjs.com/) + TypeScript, built with [Vite](https://vite.dev/)
- [Vitest](https://vitest.dev/) for the color-math test suite
- [Oxlint](https://oxc.rs/) for linting
- No backend, no database, no external API calls

## Getting started

```sh
npm install
npm run dev       # start the dev server
npm run build     # type-check and produce a production build in dist/
npm run preview   # serve the production build locally
npm run lint       # oxlint
npm run test       # vitest — color-math numeric parity tests
```

## Running with Docker

A multi-stage `Dockerfile` builds the app and serves the static output with nginx.

```sh
docker compose up --build
```

The site is then available at [http://localhost:8080](http://localhost:8080). To build/run the image directly instead of via Compose:

```sh
docker build -t ratio-color-mixer .
docker run --rm -p 8080:80 ratio-color-mixer
```

A GitHub Actions workflow (`.github/workflows/docker.yml`) lints, tests, and builds the app on every push and pull request, and publishes the image to `ghcr.io/<owner>/<repo>` on pushes to `main` (tagged `latest`) and on version tags (`v1.2.3`).

## Project structure

```text
src/
  lib/           # pure TS: color math solver, ratio/recipe formatting, share-link
                  # encode/decode, localStorage persistence, clipboard, image export/sampling
  hooks/         # useMixerState — the app's single stateful hook
  components/    # Preact UI components
  css/           # Font Awesome (icon font used throughout the UI)
```

Two reference-only directories live alongside `src/` and aren't part of the shipped app:

- `mockup/` — the original design mockup (a design-tool export, not runnable source) that the UI was built to match
- `digitpaints_color_math_study/` — a documented study of the underlying paint-mixing math (RYB approximation + simplex-projected gradient descent). `src/lib/color-math.ts` is a **fresh, independent implementation** of the same published technique — see that folder's `NOTICE.md` for why it isn't a port of that code.

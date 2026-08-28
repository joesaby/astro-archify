# astro-archify demo

A minimal Astro project showing `astro-archify` rendering [Archify](https://github.com/tt-a1i/archify)'s own architecture, sequence, and workflow examples from JSON IR fenced in markdown.

## Prerequisites

The `archify` CLI must be on `PATH`:

```bash
npx skills add tt-a1i/archify -g
archify doctor
```

## Run

```bash
npm install
npm run dev     # http://localhost:4321
# or
npm run build && npm run preview
```

Each page (`/`, `/architecture`, `/sequence`, `/workflow`) renders its diagram at build time and embeds Archify's real interactive viewer.

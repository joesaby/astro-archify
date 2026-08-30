# astro-archify demo

A minimal page-based Astro site showing `astro-archify` rendering [Archify](https://github.com/tt-a1i/archify)'s own architecture, workflow, sequence, data flow, and lifecycle examples from JSON IR fenced in markdown.

**Live:** [astro-archify.netlify.app](https://astro-archify.netlify.app/)

For a standalone Astro template with content collections and a sidebar layout, see [`astro-demo/`](../astro-demo/).

## Run

```bash
npm install
npm run dev     # http://localhost:4321
# or
npm run build && npm run preview
```

Each page (`/`, `/architecture`, `/workflow`, `/sequence`, `/dataflow`, `/lifecycle`) renders its diagram at build time and embeds Archify's real interactive viewer.

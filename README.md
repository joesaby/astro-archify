# astro-archify

An Astro integration for rendering [Archify](https://github.com/tt-a1i/archify) system diagrams — architecture, workflow, sequence, data flow, and lifecycle — from JSON IR code blocks in your markdown/MDX content.

Archify turns a typed JSON intermediate representation (IR) into a fully self-contained, already-interactive HTML artifact — inline SVG plus a small pan/zoom/focus viewer, with every script and its ~4800 lines of CSS inlined (the one exception is a Google Fonts `<link>`, which degrades gracefully if it can't load). This integration renders that artifact **at build time** using Archify's own renderer — bundled into this package, see [Attribution](#attribution) — and embeds it as a sandboxed `<iframe>`, so you get Archify's real viewer, not a re-implementation of it.

This is a different rendering model than diagram libraries like Mermaid: there is no client-side JS bundle to ship, because Archify does its layout work in Node during your Astro build, not in the browser.

There's no separate CLI to install — `npm install astro-archify` is everything you need.

## Installation

```bash
npm install astro-archify
```

## Quick Start

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import archify from 'astro-archify';

export default defineConfig({
  integrations: [archify()]
});
```

Then, in markdown or MDX:

````markdown
```archify
{
  "schema_version": 1,
  "diagram_type": "architecture",
  "meta": { "title": "Sample Web App" },
  "components": [
    { "id": "api", "type": "backend", "label": "API", "pos": [40, 40], "size": [120, 60] },
    { "id": "db", "type": "database", "label": "Database", "pos": [260, 40], "size": [120, 60] }
  ],
  "connections": [
    { "from": "api", "to": "db", "label": "SQL" }
  ]
}
```
````

The `diagram_type` field in the IR (`architecture`, `workflow`, `sequence`, `dataflow`, or `lifecycle`) selects the renderer. You can also make the type explicit in the fence's language string instead of relying on the JSON body:

````markdown
```archify:sequence
{ ... }
```
````

## Integration Order (Important!)

When using with Starlight or other markdown-processing integrations, place archify **first**:

```js
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import archify from 'astro-archify';

export default defineConfig({
  integrations: [
    archify(), // ⚠️ Must come BEFORE starlight
    starlight({ title: 'My Docs' })
  ]
});
```

## Configuration

```js
archify({
  // Advanced: use a different Archify checkout instead of the copy bundled
  // with this package. Must be a directory laid out like Archify's own
  // package root (containing renderers/<type>/render-<type>.mjs and
  // assets/template.html). Most projects never need this.
  rendererRoot: '/path/to/a/newer/archify/checkout',

  // Archify quality profile: 'standard' | 'showcase'
  quality: 'showcase',

  // Fail the build instead of rendering a visible inline error block
  strict: false,

  // Initial iframe height in px, shown before the artifact reports its
  // real content height
  height: 480,

  // The iframe never shrinks below this height (defaults to `height`)
  minHeight: 480,

  // The iframe never grows past this height, even for a very tall diagram
  maxHeight: 4000,

  // Wrapper class name
  className: 'archify-diagram',

  // iframe sandbox attribute
  sandbox: 'allow-scripts allow-popups allow-downloads',

  // iframe `allow` (Permissions Policy) attribute — needed for the
  // viewer's clipboard-copy export and fullscreen presentation stage
  allow: 'clipboard-write; fullscreen',

  // Subdirectory diagram artifacts are served from, e.g. /_archify/<id>.html.
  // Change only if it collides with existing content.
  outDir: '_archify',

  // Render timeout, in milliseconds
  timeout: 30000
})
```

## Astro Compatibility

`astro-archify` follows the same markdown-engine detection as [astro-mermaid](https://github.com/joesaby/astro-mermaid) to work across Astro 4 through 7:

| Astro version | Markdown engine | How Archify hooks in |
|---------------|-----------------|-----------------------|
| 7+ | Sätteri (`@astrojs/markdown-satteri`, the new default) | a Sätteri **mdast plugin** |
| 6.4 – 6.x | `unified()` processor | a remark plugin via `markdown.processor` |
| < 6.4 | legacy pipeline | `markdown.remarkPlugins` |

## How It Works

1. **Build time**: for each `archify` code fence, the JSON IR is written to a temp file and rendered by running Archify's own renderer script for that diagram type — `node vendor/archify/renderers/<type>/render-<type>.mjs <input.json> <output.html>` — as a subprocess. That's a real requirement, not just caution: Archify's renderer scripts call `process.exit()` directly on both success and failure, so they have to run out-of-process — importing them directly into the Astro build would let one bad diagram take down the whole build.
2. The resulting self-contained HTML artifact is content-addressed (hashed from its diagram type, quality profile, and JSON source) and cached in memory under that id — so the same diagram appearing on multiple pages, or an unchanged diagram across incremental rebuilds, only renders once.
3. Each artifact is served from its own real URL, `/_archify/<id>.html` by default — written to the final output directory on `astro:build:done` (which runs after Astro's own build, including copying `publicDir`, so this can't race or be clobbered), and served straight from memory by dev middleware in `astro dev`. The code fence is replaced with a sandboxed `<iframe src="/_archify/<id>.html">` plus a plain "Open full view ↗" link to that same URL.
4. **Runtime**: the browser loads Archify's own artifact directly from that URL, inside the iframe — including its full viewer: guide overlay, node finder, guided story/chapter navigation, semantic passport panel, presentation stage, and PNG/JPEG/SVG/WebM exports. This integration doesn't reimplement any of that, and doesn't inline or re-encode it into the page either — it's a normal, separately-cacheable HTTP response.

Archify's viewer assumes it owns the full browser viewport, so a fixed-size box would clip it badly. To avoid that, a small bridge script is appended to each artifact (the only modification this package makes to Archify's output) that reports its real content height to the parent page — on load and via `ResizeObserver` as the reader interacts with the viewer (opening a panel, entering presentation mode, etc.) — and the iframe grows or shrinks to match, bounded by `minHeight`/`maxHeight`.

If a diagram fails to render (invalid JSON, an unknown `diagram_type`, or a schema/composition error from Archify itself), a visible inline error block is rendered in its place — using Archify's own structured diagnostic message and suggested fix when it provides one — and a build warning is logged. Set `strict: true` to fail the build instead.

### A note on SSR

Static builds (`output: 'static'`, the default) are fully supported. Under SSR (`output: 'server'`/`'hybrid'`), `astro:build:done`'s output directory is the client asset directory, which most adapters already serve as static files — so this should generally still work, but it's adapter-dependent and less thoroughly tested than the static case.

## Attribution

Archify's own renderer and viewer are vendored into this package at [`vendor/archify/`](./vendor/archify) — copied from [tt-a1i/archify](https://github.com/tt-a1i/archify) (MIT licensed) at commit `12106be`, and used unmodified. See [`vendor/archify/NOTICE.md`](./vendor/archify/NOTICE.md) for exactly what was copied, why, and how to update it.

To be clear about the boundary: **everything under `vendor/archify/` is Archify's own code**, doing Archify's own layout, rendering, and the entire interactive viewer. Everything else in this repository — the remark/Sätteri plugin glue that finds `archify` code fences, spawning the renderer as a subprocess, content-addressed caching, serving artifacts from their own URLs, the iframe embedding and its auto-resize bridge, the Astro markdown-engine compatibility shim, the tests, and the demo — is original to `astro-archify` (the markdown-engine detection follows the same pattern used in [astro-mermaid](https://github.com/joesaby/astro-mermaid), also by this author).

## Styling

Archify inlines its entire viewer stylesheet (~4800 lines) into every artifact — the only external stylesheet is a Google Fonts `<link>`, which degrades gracefully if it can't load. Combined with the iframe embedding, this means a diagram always renders pixel-identical to opening the artifact standalone: your site's CSS can never leak into it, and its CSS can never leak into your site.

## Demo

See [`demo/`](./demo) for a minimal Astro project rendering Archify's own architecture, sequence, and workflow examples.

## Supported Diagram Types

- Architecture
- Workflow
- Sequence
- Data flow
- Lifecycle

See the [Archify repository](https://github.com/tt-a1i/archify) for the full JSON IR schemas and authoring guide.

## License

MIT © [Jose Sebastian](https://github.com/joesaby)

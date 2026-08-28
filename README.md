# astro-archify

An Astro integration for rendering [Archify](https://github.com/tt-a1i/archify) system diagrams — architecture, workflow, sequence, data flow, and lifecycle — from JSON IR code blocks in your markdown/MDX content.

Archify turns a typed JSON intermediate representation (IR) into a fully self-contained, already-interactive HTML artifact (inline SVG plus a small pan/zoom/focus viewer, no external runtime dependencies). This integration renders that artifact **at build time** by shelling out to the `archify` CLI, and embeds it as a sandboxed `<iframe>` — so you get Archify's real viewer, not a re-implementation of it.

This is a different rendering model than diagram libraries like Mermaid: there is no client-side JS bundle to ship, because Archify does its layout work in Node during your Astro build, not in the browser.

## Prerequisites

You need the `archify` CLI available wherever your site builds. It is distributed as an agent skill rather than an npm package, so install it with:

```bash
npx skills add tt-a1i/archify -g
```

Then confirm it's on your `PATH`:

```bash
archify doctor
```

If `archify` isn't resolvable on `PATH` in your build environment, point the integration at the script directly with the `archifyBin` option (see below).

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
    { "id": "api", "label": "API" },
    { "id": "db", "label": "Database" }
  ],
  "relationships": [
    { "from": "api", "to": "db" }
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
  // Command or script used to invoke Archify. Defaults to 'archify'
  // (resolved via PATH). Point this at a script path if you installed
  // Archify manually instead of putting it on PATH:
  archifyBin: '/opt/archify/bin/archify.mjs',

  // Archify quality profile: 'standard' | 'showcase'
  quality: 'showcase',

  // Fail the build instead of rendering a visible inline error block
  strict: false,

  // iframe height (number = px, or any CSS length string)
  height: 720,

  // Wrapper class name
  className: 'archify-diagram',

  // iframe sandbox attribute
  sandbox: 'allow-scripts allow-popups allow-downloads',

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

1. **Build time**: for each `archify` code fence, the JSON IR is written to a temp file and rendered with `archify render <type> <input.json> <output.html>`.
2. The resulting self-contained HTML artifact is base64-encoded into a `data:` URL and embedded in a sandboxed `<iframe>`, replacing the code fence.
3. **Runtime**: the browser loads Archify's own artifact directly inside that iframe — including its built-in pan/zoom and focus-view controls. No archify-specific JavaScript ships from this integration itself.

If a diagram fails to render (invalid JSON, an unknown `diagram_type`, or the `archify` command being unavailable), a visible inline error block is rendered in its place and a build warning is logged — set `strict: true` to fail the build instead.

## Supported Diagram Types

- Architecture
- Workflow
- Sequence
- Data flow
- Lifecycle

See the [Archify repository](https://github.com/tt-a1i/archify) for the full JSON IR schemas and authoring guide.

## License

MIT © [Jose Sebastian](https://github.com/joesaby)

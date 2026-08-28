---
layout: ../layouts/Layout.astro
title: astro-archify demo
---

# astro-archify demo

This is a plain Astro project using [astro-archify](https://github.com/joesaby/astro-archify) to render [Archify](https://github.com/tt-a1i/archify) system diagrams straight from JSON IR fenced in markdown.

Each diagram below is rendered **at build time** by the real `archify` CLI, then embedded as a sandboxed, auto-resizing iframe — so what you see is Archify's actual interactive viewer (pan/zoom, focus views, node finder, exports), not a re-implementation of it.

- [Architecture](/architecture)
- [Sequence](/sequence)
- [Workflow](/workflow)

## Try it

Try opening the guide (the `?` control in the diagram's own toolbar), searching for a node, or focusing a relationship — it's the same interactive artifact Archify would hand you standalone.

```archify
{
  "schema_version": 1,
  "diagram_type": "architecture",
  "meta": { "title": "Minimal Example" },
  "components": [
    { "id": "client", "type": "frontend", "label": "Client", "pos": [40, 120], "size": [120, 60] },
    { "id": "api", "type": "backend", "label": "API", "pos": [280, 120], "size": [120, 60] },
    { "id": "db", "type": "database", "label": "Database", "pos": [520, 120], "size": [120, 60] }
  ],
  "connections": [
    { "id": "client-api", "from": "client", "to": "api", "label": "HTTPS" },
    { "id": "api-db", "from": "api", "to": "db", "label": "SQL" }
  ]
}
```

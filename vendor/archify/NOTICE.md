# Vendored from Archify

This directory contains source code copied verbatim from [tt-a1i/archify](https://github.com/tt-a1i/archify), used under its MIT license (see `LICENSE` in this directory).

- **Source**: https://github.com/tt-a1i/archify
- **Pinned commit**: `39a21139a4661203888049d44e3b8c0da13fa576`
- **Upstream version**: `2.16.0` (per `archify/package.json` at that commit)
- **Vendored on**: 2026-08-30

## What was copied, and why

`astro-archify` needs Archify's diagram renderers (JSON IR → self-contained HTML with inline SVG and its interactive viewer) to work without requiring a separately-installed `archify` CLI on `PATH`. The files below are the exact, minimal set those five renderers depend on, found by statically tracing their import graph — nothing else from the upstream repository (its CLI commands other than `render`, its architecture-compare/preview/visual-check tooling, its schema files, its scripts, its examples, its agent-skill prompt) is included or needed.

```
renderers/architecture/render-architecture.mjs
renderers/architecture/grid.mjs
renderers/workflow/render-workflow.mjs
renderers/workflow/workflow-compiler.mjs
renderers/workflow/workflow-migration-geometry.mjs
renderers/sequence/render-sequence.mjs
renderers/dataflow/render-dataflow.mjs
renderers/lifecycle/render-lifecycle.mjs
renderers/shared/*.mjs        (16 files: layout, geometry, text-fit, legend,
                                brand marks, i18n, diagnostics, validation, etc.)
assets/template.html          (the viewer: CSS + interactive runtime JS)
```

These files are otherwise **unmodified** from upstream. `astro-archify`'s own code (in the repository root — `astro-archify-integration.js` and friends) invokes them exactly as Archify's own CLI does internally: as a Node subprocess, with the same `argv`/environment-variable contract (`node render-<type>.mjs <input.json> <output.html>`, `ARCHIFY_QUALITY_PROFILE`, `ARCHIFY_DIAGNOSTIC_FORMAT=json`). None of astro-archify's own rendering, embedding, resize, or Astro-integration logic is derived from Archify's code — see the root `README.md`'s "Attribution" section for that boundary.

Confirmed at vendoring time: this file set has **zero npm runtime dependencies** — only Node.js builtins (`fs`, `path`, `crypto`, `child_process`, `url`, `dns/promises`, `http`, `https`, `net`). Archify's own `ajv`/`parse5`/`saxes`/`simple-icons` devDependencies are build-time-only (schema/brand-mark codegen) and are not required to run these files.

## Keeping this in sync (patching)

This is a point-in-time copy, not a live dependency — upstream fixes and features do not arrive automatically. To pull in a newer Archify:

```bash
git clone https://github.com/tt-a1i/archify /tmp/archify-latest
npm run update:vendor -- /tmp/archify-latest
```

This re-traces the same import graph used to vendor these files originally (see `scripts/update-vendor.mjs`), overwrites this directory with whatever changed, and prints a summary of what's new or changed plus the exact "Pinned commit" / "Upstream version" values to put in this file. Then:

```bash
git diff vendor/archify/   # review what actually changed upstream
# update the Pinned commit / Upstream version / Vendored on fields above
npm run vendor:verify
```

`vendor:verify` runs the full test suite and rebuilds both demos. For a quicker check while iterating, `npm test -- --run` is enough.

The script only touches files under `vendor/archify/` — it never edits this file, `git`, or anything outside `vendor/`.

# astro-archify starlight-demo

A [Starlight](https://starlight.astro.build/) documentation site demonstrating `astro-archify` with all five Archify diagram types.

**Live:** [astro-archify-starlight-demo.netlify.app](https://astro-archify-starlight-demo.netlify.app/)

For a standalone Astro template (no Starlight), see [`astro-demo/`](../astro-demo/).

## Run

```bash
npm install
npm run dev     # http://localhost:4321
# or
npm run build && npm run preview
```

## Pages

| Route | Content |
|-------|---------|
| `/` | Welcome + minimal architecture example |
| `/architecture` | Sample Web App architecture |
| `/workflow` | Agent Tool Call Workflow (schema v2) |
| `/sequence` | Cache Miss Request Sequence |
| `/dataflow` | Product Analytics Data Flow |
| `/lifecycle` | Agent Run Lifecycle |

## Deploy

Netlify config is in [`netlify.toml`](./netlify.toml). Set the site root to `starlight-demo/` (or connect this subdirectory in the Netlify UI).

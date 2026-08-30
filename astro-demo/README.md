# astro-archify astro-demo

A standalone Astro project demonstrating `astro-archify` outside of Starlight — content collections, a sidebar layout, and all five Archify diagram types.

**Live page-based demo:** [astro-archify.netlify.app](https://astro-archify.netlify.app/) (built from [`demo/`](../demo/)).

For the Starlight documentation-site listing, see the [Starlight plugins PR](https://github.com/withastro/starlight/pull/4164).

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
| `/docs/architecture` | Sample Web App architecture |
| `/docs/workflow` | Agent Tool Call Workflow (schema v2) |
| `/docs/sequence` | Cache Miss Request Sequence |
| `/docs/dataflow` | Product Analytics Data Flow |
| `/docs/lifecycle` | Agent Run Lifecycle |

## Deploy

Netlify config is in [`netlify.toml`](./netlify.toml). Set the site root to `astro-demo/` (or connect this subdirectory in the Netlify UI).

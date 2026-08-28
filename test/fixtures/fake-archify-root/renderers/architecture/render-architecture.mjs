#!/usr/bin/env node
// A minimal stand-in for archify's render-architecture.mjs, used in tests.
// Matches the real contract: node render-<type>.mjs <input.json> <output.html>
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
const diagram = JSON.parse(readFileSync(input, 'utf8'));

writeFileSync(
  output,
  `<!doctype html><html><body><svg data-archify-type="architecture" data-title="${diagram?.meta?.title ?? ''}"></svg></body></html>`
);

#!/usr/bin/env node
// A minimal stand-in for archify's render-sequence.mjs, used in tests.
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
const diagram = JSON.parse(readFileSync(input, 'utf8'));

writeFileSync(
  output,
  `<!doctype html><html><body><svg data-archify-type="sequence" data-title="${diagram?.meta?.title ?? ''}"></svg></body></html>`
);

#!/usr/bin/env node
// A minimal stand-in for the real `archify` CLI, used in tests.
// Usage: fake-archify.mjs render <type> <input.json> <output.html>
import { readFileSync, writeFileSync } from 'node:fs';

const [command, type, input, output] = process.argv.slice(2);

if (command !== 'render' || !type || !input || !output) {
  console.error('fake-archify: usage: render <type> <input.json> <output.html>');
  process.exit(2);
}

// Reading the input mirrors the real CLI's contract and lets tests assert
// the plugin actually wrote the JSON it was given.
const diagram = JSON.parse(readFileSync(input, 'utf8'));

writeFileSync(
  output,
  `<!doctype html><html><body><svg data-archify-type="${type}" data-title="${diagram?.meta?.title ?? ''}"></svg></body></html>`
);

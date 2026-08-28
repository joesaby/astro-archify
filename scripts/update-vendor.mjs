#!/usr/bin/env node
// Re-vendors Archify's renderer + viewer from a local checkout of
// https://github.com/tt-a1i/archify into vendor/archify/, by re-tracing
// the same import graph used when this was first vendored (see
// vendor/archify/NOTICE.md). Copies files, does NOT touch git or publish
// anything — review the diff, update NOTICE.md's pinned commit/version,
// then run the test suite and demo build before committing.
//
// Usage:
//   node scripts/update-vendor.mjs /path/to/a/checkout/of/tt-a1i/archify
//
// The path should point at the checkout root (the directory containing
// the nested `archify/` package folder), matching how you'd clone
// https://github.com/tt-a1i/archify directly.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const VENDOR_ROOT = path.join(REPO_ROOT, 'vendor', 'archify');

const ENTRY_POINTS = [
  'renderers/architecture/render-architecture.mjs',
  'renderers/workflow/render-workflow.mjs',
  'renderers/sequence/render-sequence.mjs',
  'renderers/dataflow/render-dataflow.mjs',
  'renderers/lifecycle/render-lifecycle.mjs'
];

const IMPORT_RE = /\bfrom\s+['"](\.[^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g;

function traceImportGraph(packageRoot) {
  const visited = new Set();
  const queue = [...ENTRY_POINTS];

  while (queue.length) {
    const rel = queue.shift();
    if (visited.has(rel)) continue;
    visited.add(rel);

    const abs = path.join(packageRoot, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`Expected upstream file is missing: ${rel} (upstream layout may have changed)`);
    }
    if (!/\.(mjs|js)$/.test(rel)) continue;

    const src = fs.readFileSync(abs, 'utf8');
    for (const re of [IMPORT_RE, DYNAMIC_IMPORT_RE]) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(src))) {
        const target = path.normalize(path.join(path.dirname(rel), match[1]));
        if (!visited.has(target)) queue.push(target);
      }
    }
  }

  return [...visited].sort();
}

function upstreamCommit(checkoutRoot) {
  try {
    return execFileSync('git', ['-C', checkoutRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function main() {
  const checkoutRoot = process.argv[2];
  if (!checkoutRoot) {
    console.error('Usage: node scripts/update-vendor.mjs /path/to/a/checkout/of/tt-a1i/archify');
    process.exit(1);
  }

  const packageRoot = path.join(path.resolve(checkoutRoot), 'archify');
  if (!fs.existsSync(path.join(packageRoot, 'package.json'))) {
    console.error(`"${packageRoot}" doesn't look like a tt-a1i/archify checkout (no archify/package.json found).`);
    process.exit(1);
  }

  console.log(`Tracing renderer import graph from ${packageRoot} ...`);
  const files = traceImportGraph(packageRoot);
  files.push('assets/template.html');

  const changed = [];
  const added = [];
  for (const rel of files) {
    const srcPath = path.join(packageRoot, rel);
    const destPath = path.join(VENDOR_ROOT, rel);
    const srcContent = fs.readFileSync(srcPath);

    const isNew = !fs.existsSync(destPath);
    const isChanged = !isNew && !fs.readFileSync(destPath).equals(srcContent);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, srcContent);

    if (isNew) added.push(rel);
    else if (isChanged) changed.push(rel);
  }

  // LICENSE isn't part of the import graph but must stay in sync too.
  const licenseSrc = path.join(packageRoot, '..', 'LICENSE');
  if (fs.existsSync(licenseSrc)) {
    fs.copyFileSync(licenseSrc, path.join(VENDOR_ROOT, 'LICENSE'));
  }

  const version = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version;
  const commit = upstreamCommit(checkoutRoot);

  console.log(`\nVendored ${files.length} files (${added.length} new, ${changed.length} changed).`);
  if (added.length) console.log('  new:\n' + added.map(f => `    ${f}`).join('\n'));
  if (changed.length) console.log('  changed:\n' + changed.map(f => `    ${f}`).join('\n'));
  if (!added.length && !changed.length) console.log('  (no content changes — already up to date)');

  console.log('\nNext steps:');
  console.log(`  1. Review the diff (git diff vendor/archify/).`);
  console.log(`  2. Update vendor/archify/NOTICE.md:`);
  console.log(`       Pinned commit: ${commit || '<run `git rev-parse HEAD` in the checkout>'}`);
  console.log(`       Upstream version: ${version}`);
  console.log(`       Vendored on: ${new Date().toISOString().slice(0, 10)}`);
  console.log(`  3. Re-run the import-graph file list above against NOTICE.md's list if it changed.`);
  console.log(`  4. npm test`);
  console.log(`  5. Rebuild the demo (cd demo && npm install && npm run build) and spot-check a page.`);
}

main();

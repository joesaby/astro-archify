#!/usr/bin/env node
// Run the full vendor verification gate: unit/integration tests, then the
// demo build. Intended after `npm run update:vendor` and before opening a PR.

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, cwd) {
  console.log(`\n> ${command}\n`);
  execSync(command, { cwd, stdio: 'inherit' });
}

run('npm test -- --run', root);
run('npm install', path.join(root, 'demo'));
run('npm install', path.join(root, 'astro-demo'));
run('npm run build', path.join(root, 'demo'));
run('npm run build', path.join(root, 'astro-demo'));

console.log('\nVendor verification passed.\n');

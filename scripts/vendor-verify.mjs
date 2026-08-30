#!/usr/bin/env node
// Run the full vendor verification gate: unit/integration tests, then the
// demo build. Intended after `npm run update:vendor` and before opening a PR.

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demo = path.join(root, 'demo');

function run(command, cwd) {
  console.log(`\n> ${command}\n`);
  execSync(command, { cwd, stdio: 'inherit' });
}

run('npm test -- --run', root);
run('npm install', demo);
run('npm run build', demo);

console.log('\nVendor verification passed.\n');

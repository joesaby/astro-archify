#!/usr/bin/env node
// A stand-in for `archify` that always fails, used to test error handling.
console.error('fake failure: layout could not satisfy composition checks');
process.exit(1);

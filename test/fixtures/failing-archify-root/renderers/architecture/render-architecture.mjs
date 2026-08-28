#!/usr/bin/env node
// A stand-in for archify's renderer that always fails, used to test error
// handling — including the structured ARCHIFY_DIAGNOSTIC_FORMAT=json path
// that the real renderer's diagnostic boundary emits on stderr.
if (process.env.ARCHIFY_DIAGNOSTIC_FORMAT === 'json') {
  console.error(JSON.stringify({
    schemaVersion: 1,
    ok: false,
    source: 'renderer',
    error: 'architecture schema validation failed: composition checks did not pass',
    diagnostics: [{
      code: 'composition/proper-crossing',
      severity: 'error',
      message: 'composition checks did not pass',
      subject: {},
      evidence: {},
      supportedFixes: ['adjust route/via or channel coordinates so unrelated relationships use separate corridors']
    }]
  }));
} else {
  console.error('fake failure: layout could not satisfy composition checks');
}
process.exit(1);

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { htmlNodes, iframeSrc, process, testDir } from './helpers.mjs';

const EXAMPLES_DIR = join(testDir, 'fixtures/archify-examples');

const DIAGRAM_CASES = [
  {
    file: 'web-app.architecture.json',
    type: 'architecture',
    title: 'Sample Web App',
  },
  {
    file: 'agent-tool-call.workflow.json',
    type: 'workflow',
    title: 'Agent Tool Call Workflow',
    note: 'upstream schema v2 workflow example',
  },
  {
    file: 'v1-workflow-700x400.workflow.json',
    type: 'workflow',
    title: 'Legacy narrow workflow',
    note: 'schema v1 workflow backward-compat check',
  },
  {
    file: 'cache-miss-request.sequence.json',
    type: 'sequence',
    title: 'Cache Miss Request Sequence',
  },
  {
    file: 'product-analytics.dataflow.json',
    type: 'dataflow',
    title: 'Product Analytics Data Flow',
  },
  {
    file: 'agent-run.lifecycle.json',
    type: 'lifecycle',
    title: 'Agent Run Lifecycle',
  },
];

describe('bundled Archify renderer regression fixtures', () => {
  for (const { file, type, title, note } of DIAGRAM_CASES) {
    it(`renders ${type} example ${file}${note ? ` (${note})` : ''}`, async () => {
      const ir = JSON.parse(await readFile(join(EXAMPLES_DIR, file), 'utf8'));
      expect(ir.diagram_type).toBe(type);

      const markdown = ['```archify', JSON.stringify(ir), '```'].join('\n');
      const { tree, harness } = await process(markdown, {});
      const html = htmlNodes(tree)[0].value;

      expect(html, `fixture ${file} failed to render`).not.toContain('archify-diagram-error');

      const src = iframeSrc(html);
      const { status, body } = await harness.requestFromDevServer(src);

      expect(status).toBe(200);
      expect(body).toContain('<svg');
      expect(body).toContain(title);
      expect(body).toContain('__astroArchify: true');
      expect(body).toContain(ir.meta.title);
    }, 30000);
  }
});

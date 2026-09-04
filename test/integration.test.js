import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { visit } from 'unist-util-visit';

import astroArchify from '../astro-archify-integration.js';
import { htmlNodes, iframeSrc, process, setupIntegration, testDir } from './helpers.mjs';

const FAKE_ARCHIFY_ROOT = join(testDir, 'fixtures/fake-archify-root');
const FAILING_ARCHIFY_ROOT = join(testDir, 'fixtures/failing-archify-root');

describe('astroArchify remark plugin', () => {
  it('renders an archify code fence and points the iframe at a real content-addressed URL', async () => {
    const markdown = [
      '```archify',
      JSON.stringify({ diagram_type: 'architecture', meta: { title: 'Sample' } }),
      '```'
    ].join('\n');

    const { tree, harness } = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });
    const nodes = htmlNodes(tree);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].value).toContain('class="archify-diagram"');
    expect(nodes[0].value).toContain('sandbox="allow-scripts allow-popups allow-downloads"');
    expect(nodes[0].value).toContain('allow="clipboard-write; fullscreen"');
    expect(nodes[0].value).toContain('allowfullscreen');
    expect(nodes[0].value).toContain('data-archify-min-height="480"');
    expect(nodes[0].value).toContain('data-archify-max-height="4000"');
    expect(nodes[0].value).toContain('archify-diagram-open');

    const src = iframeSrc(nodes[0].value);
    expect(src).toMatch(/^\/_archify\/[0-9a-f]{16}\.html$/);
    // The "open full view" link points at the same real URL, not a data: URI.
    expect(nodes[0].value).toContain(`href="${src}"`);

    const { status, headers, body } = await harness.requestFromDevServer(src);
    expect(status).toBe(200);
    expect(headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(body).toContain('data-archify-type="architecture"');
    expect(body).toContain('data-title="Sample"');
    // The resize bridge should be appended without disturbing the artifact.
    expect(body).toContain('__astroArchify: true');
    expect(body).toContain('ResizeObserver');
    expect(body.indexOf('</body>')).toBeGreaterThan(body.indexOf('__astroArchify'));
  });

  it('respects a configured base path when building the artifact URL', async () => {
    const markdown = ['```archify', JSON.stringify({ diagram_type: 'architecture' }), '```'].join('\n');
    const { tree } = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT }, { base: '/docs/' });
    const src = iframeSrc(htmlNodes(tree)[0].value);
    expect(src).toMatch(/^\/docs\/_archify\/[0-9a-f]{16}\.html$/);
  });

  it('de-duplicates identical diagrams to a single cached artifact id', async () => {
    const ir = { diagram_type: 'architecture', meta: { title: 'Same diagram twice' } };
    const markdown = ['```archify', JSON.stringify(ir), '```', '', '```archify', JSON.stringify(ir), '```'].join('\n');

    const { tree } = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });
    const nodes = htmlNodes(tree);
    expect(nodes).toHaveLength(2);
    expect(iframeSrc(nodes[0].value)).toBe(iframeSrc(nodes[1].value));
  });

  it('writes cached artifacts to disk on astro:build:done', async () => {
    const markdown = [
      '```archify',
      JSON.stringify({ diagram_type: 'architecture', meta: { title: 'Build output' } }),
      '```'
    ].join('\n');
    const { tree, harness } = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });
    const src = iframeSrc(htmlNodes(tree)[0].value);

    const outputDir = await mkdtemp(join(tmpdir(), 'astro-archify-build-'));
    try {
      await harness.buildDone(outputDir);
      const written = await readFile(join(outputDir, '_archify', src.split('/').pop()), 'utf8');
      expect(written).toContain('data-title="Build output"');
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('honors custom height bounds', async () => {
    const markdown = ['```archify', JSON.stringify({ diagram_type: 'architecture' }), '```'].join('\n');
    const { tree } = await process(markdown, {
      rendererRoot: FAKE_ARCHIFY_ROOT,
      height: 300,
      minHeight: 200,
      maxHeight: 1000
    });
    const html = htmlNodes(tree)[0].value;
    expect(html).toContain('height:300px');
    expect(html).toContain('data-archify-min-height="200"');
    expect(html).toContain('data-archify-max-height="1000"');
  });

  it('honors an explicit type in the fence language over the JSON body', async () => {
    const markdown = [
      '```archify:sequence',
      JSON.stringify({ diagram_type: 'architecture', meta: { title: 'Override' } }),
      '```'
    ].join('\n');

    const { tree, harness } = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });
    const src = iframeSrc(htmlNodes(tree)[0].value);
    const { body } = await harness.requestFromDevServer(src);
    expect(body).toContain('data-archify-type="sequence"');
  });

  it('leaves non-archify code fences untouched', async () => {
    const markdown = ['```javascript', 'const x = 1;', '```'].join('\n');
    const { tree } = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });

    let codeBlocks = 0;
    visit(tree, 'code', () => { codeBlocks++; });
    expect(codeBlocks).toBe(1);
    expect(htmlNodes(tree)).toHaveLength(0);
  });

  it('renders an inline error block for invalid JSON instead of throwing', async () => {
    const markdown = ['```archify', '{ not valid json', '```'].join('\n');
    const { tree } = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });

    const nodes = htmlNodes(tree);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].value).toContain('archify-diagram-error');
    expect(nodes[0].value).toContain('invalid JSON');
  });

  it('renders an inline error block for an unknown diagram type', async () => {
    const markdown = ['```archify', JSON.stringify({ diagram_type: 'not-a-real-type' }), '```'].join('\n');
    const { tree } = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });

    const nodes = htmlNodes(tree);
    expect(nodes[0].value).toContain('archify-diagram-error');
    expect(nodes[0].value).toContain('unknown or missing diagram type');
  });

  it('renders an inline error block when the renderer fails', async () => {
    const markdown = ['```archify', JSON.stringify({ diagram_type: 'architecture' }), '```'].join('\n');
    const { tree } = await process(markdown, { rendererRoot: FAILING_ARCHIFY_ROOT });

    const nodes = htmlNodes(tree);
    expect(nodes[0].value).toContain('archify-diagram-error');
    expect(nodes[0].value).toContain('composition checks');
  });

  it('renders an inline error block when rendererRoot points nowhere real', async () => {
    const markdown = ['```archify', JSON.stringify({ diagram_type: 'architecture' }), '```'].join('\n');
    const { tree } = await process(markdown, { rendererRoot: '/definitely/not/a/real/path' });

    const nodes = htmlNodes(tree);
    expect(nodes[0].value).toContain('archify-diagram-error');
    expect(nodes[0].value).toContain('could not find');
  });

  it("surfaces Archify's structured diagnostic message, including a suggested fix", async () => {
    const markdown = ['```archify', JSON.stringify({ diagram_type: 'architecture' }), '```'].join('\n');
    const { tree } = await process(markdown, { rendererRoot: FAILING_ARCHIFY_ROOT });

    const nodes = htmlNodes(tree);
    expect(nodes[0].value).toContain('composition checks did not pass');
    expect(nodes[0].value).toContain('Fix:');
    expect(nodes[0].value).toContain('separate corridors');
  });

  it('throws instead of embedding an error block when strict is enabled', async () => {
    const markdown = ['```archify', '{ not valid json', '```'].join('\n');
    await expect(
      process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT, strict: true })
    ).rejects.toThrow(/invalid JSON/);
  });
});

describe('astroArchify loading diagrams from an external JSON file', () => {
  const filePath = join(testDir, 'fixtures/pages/example.md');

  it('renders a diagram whose JSON IR is loaded from a file="..." attribute', async () => {
    const markdown = ['```archify file="../archify-examples/web-app.architecture.json"', '```'].join('\n');

    const { tree, harness } = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT }, { filePath });
    const nodes = htmlNodes(tree);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].value).not.toContain('archify-diagram-error');

    const src = iframeSrc(nodes[0].value);
    const { body } = await harness.requestFromDevServer(src);
    expect(body).toContain('data-archify-type="architecture"');
    expect(body).toContain('data-title="Sample Web App"');
  });

  it('resolves a relative file path against the markdown file\'s own directory, not the process cwd', async () => {
    const markdown = ['```archify file="./web-app.architecture.json"', '```'].join('\n');
    const pageInFixtureDir = join(testDir, 'fixtures/archify-examples/page.md');

    const { tree, harness } = await process(
      markdown,
      { rendererRoot: FAKE_ARCHIFY_ROOT },
      { filePath: pageInFixtureDir }
    );
    const src = iframeSrc(htmlNodes(tree)[0].value);
    const { body } = await harness.requestFromDevServer(src);
    expect(body).toContain('data-title="Sample Web App"');
  });

  it('honors an explicit type in the fence language alongside a file attribute', async () => {
    const markdown = ['```archify:sequence file="../archify-examples/web-app.architecture.json"', '```'].join('\n');

    const { tree, harness } = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT }, { filePath });
    const src = iframeSrc(htmlNodes(tree)[0].value);
    const { body } = await harness.requestFromDevServer(src);
    expect(body).toContain('data-archify-type="sequence"');
  });

  it('renders an inline error block when the referenced file does not exist', async () => {
    const markdown = ['```archify file="./does-not-exist.json"', '```'].join('\n');

    const { tree } = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT }, { filePath });
    const nodes = htmlNodes(tree);
    expect(nodes[0].value).toContain('archify-diagram-error');
    expect(nodes[0].value).toContain('could not read archify file');
  });

  it('throws instead of embedding an error block for a missing file when strict is enabled', async () => {
    const markdown = ['```archify file="./does-not-exist.json"', '```'].join('\n');
    await expect(
      process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT, strict: true }, { filePath })
    ).rejects.toThrow(/could not read archify file/);
  });
});

describe('astroArchify with the bundled (default) Archify renderer', () => {
  it('renders a real diagram end-to-end with no options at all', async () => {
    const ir = {
      schema_version: 1,
      diagram_type: 'architecture',
      meta: { title: 'Bundled renderer smoke test' },
      components: [
        { id: 'a', type: 'frontend', label: 'A', pos: [0, 0], size: [100, 50] },
        { id: 'b', type: 'backend', label: 'B', pos: [200, 0], size: [100, 50] }
      ],
      connections: [{ id: 'a-b', from: 'a', to: 'b' }]
    };
    const markdown = ['```archify', JSON.stringify(ir), '```'].join('\n');

    const { tree, harness } = await process(markdown, {});
    const nodes = htmlNodes(tree);
    const src = iframeSrc(nodes[0].value);

    const { status, body } = await harness.requestFromDevServer(src);
    expect(status).toBe(200);
    expect(body).toContain('Bundled renderer smoke test');
    expect(body).toContain('<svg');
  }, 20000);
});

describe('README examples', () => {
  it('every complete ```archify JSON example in README.md actually renders', async () => {
    const readme = await readFile(join(testDir, '../README.md'), 'utf8');
    const fenceRe = /```archify(?::\w+)?\n([\s\S]*?)```/g;
    const examples = [];
    let match;
    while ((match = fenceRe.exec(readme))) {
      try {
        examples.push(JSON.parse(match[1]));
      } catch {
        // Not a complete JSON example (e.g. a "{ ... }" placeholder) — nothing to render.
      }
    }
    // Guards against silently having zero examples checked (e.g. a fence syntax change).
    expect(examples.length).toBeGreaterThan(0);

    for (const ir of examples) {
      const markdown = ['```archify', JSON.stringify(ir), '```'].join('\n');
      const { tree } = await process(markdown, {});
      const html = htmlNodes(tree)[0].value;
      expect(html, `README example failed to render:\n${JSON.stringify(ir, null, 2)}`).not.toContain('archify-diagram-error');
    }
  }, 20000);
});

describe('astroArchify options validation', () => {
  it('rejects an invalid quality profile', () => {
    expect(() => astroArchify({ quality: 'ultra' })).toThrow(/quality/);
  });

  it('rejects an invalid className', () => {
    expect(() => astroArchify({ className: '1 not valid' })).toThrow(/className/);
  });

  it('rejects an invalid outDir', () => {
    expect(() => astroArchify({ outDir: '../escape' })).toThrow(/outDir/);
  });
});

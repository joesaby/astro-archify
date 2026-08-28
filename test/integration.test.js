import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';

import astroArchify from '../astro-archify-integration.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAKE_ARCHIFY_ROOT = join(__dirname, 'fixtures/fake-archify-root');
const FAILING_ARCHIFY_ROOT = join(__dirname, 'fixtures/failing-archify-root');

const noopLogger = { info() {}, warn() {}, error() {} };

/**
 * Drives astroArchify's astro:config:setup hook against a minimal mock
 * config (no markdown.processor, so it exercises the legacy
 * markdown.remarkPlugins fallback), then extracts the registered remark
 * plugin + its options so it can be run through a real unified/remark-parse
 * pipeline in isolation from Astro itself.
 */
async function getRemarkPlugin(options) {
  const integration = astroArchify(options);
  let updatedMarkdown;
  const context = {
    config: { markdown: {} },
    updateConfig: patch => { updatedMarkdown = patch.markdown; },
    injectScript: () => {},
    logger: noopLogger
  };
  await integration.hooks['astro:config:setup'](context);
  const [plugin, pluginOptions] = updatedMarkdown.remarkPlugins.at(-1);
  return { plugin, pluginOptions };
}

async function process(markdown, options) {
  const { plugin, pluginOptions } = await getRemarkPlugin(options);
  const processor = unified().use(remarkParse).use(plugin, pluginOptions);
  const tree = processor.parse(markdown);
  await processor.run(tree);
  return tree;
}

function htmlNodes(tree) {
  const nodes = [];
  visit(tree, 'html', node => nodes.push(node));
  return nodes;
}

function decodeIframeSrc(html) {
  const match = html.match(/data:text\/html;base64,([A-Za-z0-9+/=]+)/);
  expect(match).not.toBeNull();
  return Buffer.from(match[1], 'base64').toString('utf8');
}

describe('astroArchify remark plugin', () => {
  it('renders an archify code fence via the archify CLI and embeds an iframe', async () => {
    const markdown = [
      '```archify',
      JSON.stringify({ diagram_type: 'architecture', meta: { title: 'Sample' } }),
      '```'
    ].join('\n');

    const tree = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });
    const nodes = htmlNodes(tree);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].value).toContain('class="archify-diagram"');
    expect(nodes[0].value).toContain('<iframe');
    expect(nodes[0].value).toContain('sandbox="allow-scripts allow-popups allow-downloads"');
    expect(nodes[0].value).toContain('allow="clipboard-write; fullscreen"');
    expect(nodes[0].value).toContain('allowfullscreen');
    expect(nodes[0].value).toContain('data-archify-min-height="480"');
    expect(nodes[0].value).toContain('data-archify-max-height="4000"');

    const artifact = decodeIframeSrc(nodes[0].value);
    expect(artifact).toContain('data-archify-type="architecture"');
    expect(artifact).toContain('data-title="Sample"');
    // The resize bridge should be appended without disturbing the artifact.
    expect(artifact).toContain('__astroArchify: true');
    expect(artifact).toContain('ResizeObserver');
    expect(artifact.indexOf('</body>')).toBeGreaterThan(artifact.indexOf('__astroArchify'));
  });

  it('honors custom height bounds', async () => {
    const markdown = [
      '```archify',
      JSON.stringify({ diagram_type: 'architecture' }),
      '```'
    ].join('\n');

    const tree = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT, height: 300, minHeight: 200, maxHeight: 1000 });
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

    const tree = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });
    const artifact = decodeIframeSrc(htmlNodes(tree)[0].value);
    expect(artifact).toContain('data-archify-type="sequence"');
  });

  it('leaves non-archify code fences untouched', async () => {
    const markdown = ['```javascript', 'const x = 1;', '```'].join('\n');
    const tree = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });

    let codeBlocks = 0;
    visit(tree, 'code', () => { codeBlocks++; });
    expect(codeBlocks).toBe(1);
    expect(htmlNodes(tree)).toHaveLength(0);
  });

  it('renders an inline error block for invalid JSON instead of throwing', async () => {
    const markdown = ['```archify', '{ not valid json', '```'].join('\n');
    const tree = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });

    const nodes = htmlNodes(tree);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].value).toContain('archify-diagram-error');
    expect(nodes[0].value).toContain('invalid JSON');
  });

  it('renders an inline error block for an unknown diagram type', async () => {
    const markdown = [
      '```archify',
      JSON.stringify({ diagram_type: 'not-a-real-type' }),
      '```'
    ].join('\n');
    const tree = await process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT });

    const nodes = htmlNodes(tree);
    expect(nodes[0].value).toContain('archify-diagram-error');
    expect(nodes[0].value).toContain('unknown or missing diagram type');
  });

  it('renders an inline error block when the archify command fails', async () => {
    const markdown = [
      '```archify',
      JSON.stringify({ diagram_type: 'architecture' }),
      '```'
    ].join('\n');
    const tree = await process(markdown, { rendererRoot: FAILING_ARCHIFY_ROOT });

    const nodes = htmlNodes(tree);
    expect(nodes[0].value).toContain('archify-diagram-error');
    expect(nodes[0].value).toContain('composition checks');
  });

  it('renders an inline error block when rendererRoot points nowhere real', async () => {
    const markdown = [
      '```archify',
      JSON.stringify({ diagram_type: 'architecture' }),
      '```'
    ].join('\n');
    const tree = await process(markdown, { rendererRoot: '/definitely/not/a/real/path' });

    const nodes = htmlNodes(tree);
    expect(nodes[0].value).toContain('archify-diagram-error');
    expect(nodes[0].value).toContain('could not find');
  });

  it('surfaces Archify\'s structured diagnostic message, including a suggested fix', async () => {
    const markdown = [
      '```archify',
      JSON.stringify({ diagram_type: 'architecture' }),
      '```'
    ].join('\n');
    const tree = await process(markdown, { rendererRoot: FAILING_ARCHIFY_ROOT });

    const nodes = htmlNodes(tree);
    expect(nodes[0].value).toContain('composition checks did not pass');
    expect(nodes[0].value).toContain('Fix:');
    expect(nodes[0].value).toContain('separate corridors');
  });

  it('throws instead of embedding an error block when strict is enabled', async () => {
    const markdown = ['```archify', '{ not valid json', '```'].join('\n');
    await expect(process(markdown, { rendererRoot: FAKE_ARCHIFY_ROOT, strict: true })).rejects.toThrow(
      /invalid JSON/
    );
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

    const tree = await process(markdown, {});
    const nodes = htmlNodes(tree);

    expect(nodes[0].value).toContain('<iframe');
    const artifact = decodeIframeSrc(nodes[0].value);
    expect(artifact).toContain('Bundled renderer smoke test');
    expect(artifact).toContain('<svg');
  }, 20000);
});

describe('astroArchify options validation', () => {
  it('rejects an invalid quality profile', () => {
    expect(() => astroArchify({ quality: 'ultra' })).toThrow(/quality/);
  });

  it('rejects an invalid className', () => {
    expect(() => astroArchify({ className: '1 not valid' })).toThrow(/className/);
  });
});

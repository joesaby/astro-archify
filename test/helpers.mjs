import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { VFile } from 'vfile';

import astroArchify from '../astro-archify-integration.js';

const noopLogger = { info() {}, warn() {}, error() {} };

/**
 * Drives astroArchify's astro:config:setup and astro:server:setup hooks
 * against minimal mocks (no markdown.processor, so it exercises the legacy
 * markdown.remarkPlugins fallback), then hands back everything a test needs:
 * the registered remark plugin, a way to simulate a dev-server request
 * through the captured middleware, and a way to trigger astro:build:done
 * against a real temp directory.
 */
export async function setupIntegration(options, { base = '/' } = {}) {
  const integration = astroArchify(options);
  let updatedMarkdown;
  let middlewareHandler;

  await integration.hooks['astro:config:setup']({
    config: { markdown: {}, base },
    updateConfig: patch => { updatedMarkdown = patch.markdown; },
    injectScript: () => {},
    logger: noopLogger
  });

  if (integration.hooks['astro:server:setup']) {
    await integration.hooks['astro:server:setup']({
      server: { middlewares: { use: fn => { middlewareHandler = fn; } } }
    });
  }

  const [plugin, pluginOptions] = updatedMarkdown.remarkPlugins.at(-1);

  return {
    plugin,
    pluginOptions,
    requestFromDevServer(pathname) {
      return new Promise(resolve => {
        const res = {
          statusCode: 200,
          headers: {},
          setHeader(name, value) { this.headers[name] = value; },
          end(body) { resolve({ status: this.statusCode, headers: this.headers, body }); }
        };
        middlewareHandler({ url: pathname }, res, () => resolve({ status: 404, headers: {}, body: null }));
      });
    },
    async buildDone(outputDir) {
      await integration.hooks['astro:build:done']({ dir: pathToFileURL(`${outputDir}/`), logger: noopLogger });
    }
  };
}

export async function process(markdown, options, setupOpts) {
  const harness = await setupIntegration(options, setupOpts);
  const processor = unified().use(remarkParse).use(harness.plugin, harness.pluginOptions);
  const file = new VFile({ value: markdown, path: setupOpts?.filePath });
  const tree = processor.parse(file);
  await processor.run(tree, file);
  return { tree, harness };
}

export function htmlNodes(tree) {
  const nodes = [];
  visit(tree, 'html', node => nodes.push(node));
  return nodes;
}

export function iframeSrc(html) {
  const match = html.match(/<iframe src="([^"]+)"/);
  if (!match) throw new Error('expected archify iframe in rendered HTML');
  return match[1];
}

export const testDir = dirname(fileURLToPath(import.meta.url));

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIAGRAM_TYPES = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']);
const CLASS_NAME_PATTERN = /^[a-zA-Z_-][\w-]*$/;

/**
 * Helper function to HTML-escape text content
 */
function escapeHtml(text) {
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(text).replace(/[&<>"']/g, char => htmlEntities[char]);
}

/**
 * Recognize an archify code fence and extract an explicit diagram type, if any.
 * Supports:
 *   ```archify                 -> type read from the IR's "diagram_type" field
 *   ```archify:architecture    -> explicit type override
 *   ```archify-architecture    -> explicit type override
 */
function parseArchifyLang(lang) {
  if (!lang) return null;
  if (lang === 'archify') return { explicitType: null };
  let match = lang.match(/^archify:([a-z]+)$/);
  if (match) return { explicitType: match[1] };
  match = lang.match(/^archify-([a-z]+)$/);
  if (match) return { explicitType: match[1] };
  return null;
}

/**
 * Resolve the archifyBin option into a spawnable command. A path ending in
 * .mjs/.js/.cjs is run through the current Node binary; anything else is
 * treated as an executable name resolved via PATH.
 */
function resolveCommand(bin) {
  if (/\.(mjs|cjs|js)$/.test(bin)) {
    return { command: process.execPath, baseArgs: [bin] };
  }
  return { command: bin, baseArgs: [] };
}

function runProcess(command, args, { env, timeout } = {}) {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(command, args, {
        env: env ? { ...process.env, ...env } : process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (error) {
      resolve({ status: null, stdout: '', stderr: '', spawnError: error, timedOut: false });
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = timeout
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, timeout)
      : null;

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('error', error => {
      if (timer) clearTimeout(timer);
      resolve({ status: null, stdout, stderr, spawnError: error, timedOut: false });
    });

    child.on('close', status => {
      if (timer) clearTimeout(timer);
      resolve({ status, stdout, stderr, spawnError: null, timedOut });
    });
  });
}

/**
 * Render a single Archify JSON IR document to a self-contained HTML artifact
 * by shelling out to the `archify render` CLI at build time.
 */
async function renderArchifyDiagram({ bin, type, source, quality, timeout }) {
  const { command, baseArgs } = resolveCommand(bin);
  const dir = await mkdtemp(join(tmpdir(), 'astro-archify-'));
  const inputPath = join(dir, 'input.json');
  const outputPath = join(dir, 'output.html');

  try {
    await writeFile(inputPath, source, 'utf8');

    const env = quality ? { ARCHIFY_QUALITY_PROFILE: quality } : undefined;
    const result = await runProcess(
      command,
      [...baseArgs, 'render', type, inputPath, outputPath],
      { env, timeout }
    );

    if (result.spawnError) {
      if (result.spawnError.code === 'ENOENT') {
        throw new Error(
          `could not find the "${bin}" command. Install Archify and make sure it is on PATH ` +
          `(e.g. "npx skills add tt-a1i/archify -g"), or set the "archifyBin" option to the ` +
          `full path of Archify's bin/archify.mjs.`
        );
      }
      throw new Error(`could not start Archify: ${result.spawnError.message}`);
    }

    if (result.timedOut) {
      throw new Error(`Archify render timed out after ${timeout}ms while rendering a "${type}" diagram.`);
    }

    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || '').trim();
      throw new Error(`Archify failed to render a "${type}" diagram${detail ? `: ${detail}` : '.'}`);
    }

    return await readFile(outputPath, 'utf8');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Wrap a fully self-contained Archify HTML artifact in a sandboxed iframe.
 * A data: URL is used (rather than srcdoc) so the artifact's own markup
 * never has to be escaped for attribute embedding.
 */
function buildIframeHtml(html, { className, height, sandbox }) {
  const encoded = Buffer.from(html, 'utf8').toString('base64');
  const heightValue = typeof height === 'number' ? `${height}px` : String(height);
  return (
    `<div class="${className}">` +
    `<iframe src="data:text/html;base64,${encoded}" ` +
    `style="width:100%;height:${escapeHtml(heightValue)};border:0;display:block;" ` +
    `loading="lazy" sandbox="${escapeHtml(sandbox)}"></iframe>` +
    `</div>`
  );
}

function buildErrorHtml(className, type, message) {
  return (
    `<div class="${className}-error" style="color:#b91c1c;padding:1rem;border:1px solid #b91c1c;border-radius:0.5rem;">` +
    `<strong>Archify failed to render${type ? ` "${escapeHtml(type)}"` : ''} diagram:</strong> ` +
    `<span>${escapeHtml(message)}</span>` +
    `</div>`
  );
}

async function resolveDiagram({ node, parsed, options, fileLabel }) {
  let diagram;
  try {
    diagram = JSON.parse(node.value);
  } catch (error) {
    const message = `invalid JSON (${error.message})`;
    if (options.strict) throw new Error(`astro-archify: ${message} in ${fileLabel}`);
    options.logger?.warn(`astro-archify: ${message} in ${fileLabel}`);
    return { type: 'html', value: buildErrorHtml(options.className, null, message) };
  }

  const type = parsed.explicitType || diagram?.diagram_type;
  if (!DIAGRAM_TYPES.has(type)) {
    const message = `unknown or missing diagram type "${type ?? ''}". Expected one of: ${[...DIAGRAM_TYPES].join(', ')}`;
    if (options.strict) throw new Error(`astro-archify: ${message} in ${fileLabel}`);
    options.logger?.warn(`astro-archify: ${message} in ${fileLabel}`);
    return { type: 'html', value: buildErrorHtml(options.className, type, message) };
  }

  try {
    const html = await renderArchifyDiagram({
      bin: options.archifyBin,
      type,
      source: node.value,
      quality: options.quality,
      timeout: options.timeout
    });
    options.logger?.info(`astro-archify: rendered ${type} diagram in ${fileLabel}`);
    return {
      type: 'html',
      value: buildIframeHtml(html, { className: options.className, height: options.height, sandbox: options.sandbox })
    };
  } catch (error) {
    if (options.strict) throw new Error(`astro-archify: ${error.message} in ${fileLabel}`);
    options.logger?.warn(`astro-archify: ${error.message} in ${fileLabel}`);
    return { type: 'html', value: buildErrorHtml(options.className, type, error.message) };
  }
}

/**
 * Remark plugin: transforms ```archify code fences at the markdown level.
 * Used for the legacy remark/rehype pipeline (Astro < 6.4) and for the
 * `unified()` processor (Astro 6.4 - 6.x).
 */
function remarkArchifyPlugin(options = {}) {
  return async function transformer(tree, file) {
    const { visit } = await import('unist-util-visit');

    const targets = [];
    visit(tree, 'code', (node, index, parent) => {
      const parsed = parseArchifyLang(node.lang);
      if (parsed && parent && typeof index === 'number') {
        targets.push({ node, index, parent, parsed });
      }
    });

    for (const { node, index, parent, parsed } of targets) {
      const fileLabel = file.path || 'unknown file';
      parent.children[index] = await resolveDiagram({ node, parsed, options, fileLabel });
    }
  };
}

/**
 * Sätteri mdast plugin equivalent, for Astro 7+'s default markdown engine
 * (`@astrojs/markdown-satteri`), which uses its own plugin model instead of
 * remark/rehype.
 */
function satteriArchifyPlugin(options = {}) {
  return {
    name: 'astro-archify',
    async code(node, context) {
      const parsed = parseArchifyLang(node.lang);
      if (!parsed) return;
      const fileLabel = context?.fileURL?.pathname || 'unknown file';
      return resolveDiagram({ node, parsed, options, fileLabel });
    }
  };
}

/**
 * Astro integration that renders Archify diagrams (architecture, workflow,
 * sequence, dataflow, lifecycle) from JSON IR code fences.
 *
 * Unlike client-side diagram libraries, Archify compiles its IR into a
 * fully self-contained, already-interactive HTML artifact at build time by
 * shelling out to the `archify` CLI. That artifact is embedded as a
 * sandboxed iframe, preserving Archify's own pan/zoom/focus viewer.
 *
 * @param {Object} [options]
 * @param {string} [options.archifyBin='archify'] - Command or script path used to invoke Archify.
 * @param {'standard'|'showcase'} [options.quality] - Archify quality profile.
 * @param {boolean} [options.strict=false] - Fail the build instead of rendering an inline error.
 * @param {number|string} [options.height=640] - iframe height (number = px, or any CSS length).
 * @param {string} [options.className='archify-diagram'] - Wrapper class name.
 * @param {string} [options.sandbox='allow-scripts allow-popups allow-downloads'] - iframe sandbox attribute.
 * @param {number} [options.timeout=30000] - Render timeout in milliseconds.
 * @returns {import('astro').AstroIntegration}
 */
export default function astroArchify(options = {}) {
  const {
    archifyBin = 'archify',
    quality,
    strict = false,
    height = 640,
    className = 'archify-diagram',
    sandbox = 'allow-scripts allow-popups allow-downloads',
    timeout = 30000
  } = options;

  if (quality !== undefined && !['standard', 'showcase'].includes(quality)) {
    throw new Error(`astro-archify: "quality" must be "standard" or "showcase", got "${quality}"`);
  }
  if (!CLASS_NAME_PATTERN.test(className)) {
    throw new Error(`astro-archify: "className" must be a valid CSS class name, got "${className}"`);
  }

  return {
    name: 'astro-archify',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, injectScript, logger }) => {
        logger.info('Setting up Archify integration');

        const pluginOptions = { archifyBin, quality, strict, height, className, sandbox, timeout, logger };
        const remarkEntry = [remarkArchifyPlugin, pluginOptions];

        // Newer Astro versions expose the markdown engine on
        // `config.markdown.processor`, and the deprecated top-level
        // `markdown.remarkPlugins` array no longer runs on it. Dispatch on
        // the processor's `name`, mirroring astro-mermaid:
        //   - 'unified' (Astro 6.4+): pass plugins via `unified({...})`.
        //   - 'satteri' (Astro 7+):   register an mdast plugin via `satteri({...})`.
        //   - no processor (Astro <6.4): fall back to the legacy array.
        const existingProcessor = config.markdown?.processor;
        let usedProcessor = false;

        if (existingProcessor?.name === 'unified') {
          try {
            const { unified, isUnifiedProcessor } = await import('@astrojs/markdown-remark');
            if (isUnifiedProcessor(existingProcessor)) {
              const existingOptions = existingProcessor.options || {};
              updateConfig({
                markdown: {
                  processor: unified({
                    ...existingOptions,
                    remarkPlugins: [...(existingOptions.remarkPlugins || []), remarkEntry]
                  })
                }
              });
              usedProcessor = true;
            }
          } catch (error) {
            logger.warn(
              `Could not configure the unified markdown processor, falling back ` +
              `to the remark plugin array: ${error.message}`
            );
          }
        } else if (existingProcessor?.name === 'satteri') {
          try {
            const { satteri, isSatteriProcessor } = await import('@astrojs/markdown-satteri');
            if (isSatteriProcessor(existingProcessor)) {
              const existingOptions = existingProcessor.options || {};
              updateConfig({
                markdown: {
                  processor: satteri({
                    ...existingOptions,
                    mdastPlugins: [...(existingOptions.mdastPlugins || []), satteriArchifyPlugin(pluginOptions)]
                  })
                }
              });
              usedProcessor = true;
            }
          } catch (error) {
            logger.warn(
              `Could not configure the Sätteri markdown processor, falling back ` +
              `to the remark plugin array: ${error.message}`
            );
          }
        }

        if (!usedProcessor) {
          updateConfig({
            markdown: {
              remarkPlugins: [...(config.markdown?.remarkPlugins || []), remarkEntry]
            }
          });
        }

        // Minimal presentational styling for the wrapper only; the
        // Archify artifact itself is fully self-contained.
        injectScript('page', `
          const style = document.createElement('style');
          style.textContent = \`
            .${className} {
              margin: 2rem 0;
              border-radius: 0.5rem;
              overflow: hidden;
              border: 1px solid rgba(128, 128, 128, 0.25);
            }
            .${className} iframe {
              background: transparent;
            }
          \`;
          document.head.appendChild(style);
        `);
      }
    }
  };
}

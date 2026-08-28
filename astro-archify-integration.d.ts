import type { AstroIntegration } from 'astro';

export interface AstroArchifyOptions {
  /**
   * Command or script path used to invoke Archify.
   *
   * Defaults to `'archify'`, resolved via PATH (install with e.g.
   * `npx skills add tt-a1i/archify -g` and make sure the command is on
   * PATH). A path ending in `.mjs`/`.js`/`.cjs` (e.g. a local
   * `.../archify/bin/archify.mjs`) is run through the current Node binary
   * instead.
   * @default 'archify'
   */
  archifyBin?: string;

  /**
   * Archify rendering quality profile, forwarded as `ARCHIFY_QUALITY_PROFILE`.
   */
  quality?: 'standard' | 'showcase';

  /**
   * Fail the Astro build when a diagram fails to render, instead of
   * embedding a visible inline error block.
   * @default false
   */
  strict?: boolean;

  /**
   * Height of the rendered diagram's iframe. A number is treated as pixels;
   * a string is used as-is (any valid CSS length).
   * @default 640
   */
  height?: number | string;

  /**
   * CSS class name applied to the diagram wrapper element.
   * @default 'archify-diagram'
   */
  className?: string;

  /**
   * `sandbox` attribute applied to the diagram's iframe.
   * @default 'allow-scripts allow-popups allow-downloads'
   */
  sandbox?: string;

  /**
   * Render timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;
}

/**
 * Astro integration for rendering Archify system diagrams (architecture,
 * workflow, sequence, dataflow, lifecycle) from JSON IR code fences.
 *
 * @example
 * ```js
 * import { defineConfig } from 'astro/config';
 * import archify from 'astro-archify';
 *
 * export default defineConfig({
 *   integrations: [
 *     archify({
 *       quality: 'showcase'
 *     })
 *   ]
 * });
 * ```
 */
export default function astroArchify(options?: AstroArchifyOptions): AstroIntegration;

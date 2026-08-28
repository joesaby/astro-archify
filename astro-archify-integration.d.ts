import type { AstroIntegration } from 'astro';

export interface AstroArchifyOptions {
  /**
   * Advanced: path to an Archify package root to use instead of the copy
   * vendored into this package (see vendor/archify/NOTICE.md). Must be a
   * directory laid out like Archify's own package root — containing
   * `renderers/<type>/render-<type>.mjs` and `assets/template.html` for
   * each diagram type.
   */
  rendererRoot?: string;

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
   * Initial height of the diagram's iframe, shown before the artifact
   * reports its real content height (see `minHeight`/`maxHeight`). A
   * number is treated as pixels.
   * @default 480
   */
  height?: number;

  /**
   * The iframe never shrinks below this height once auto-resized.
   * @default the value of `height`
   */
  minHeight?: number;

  /**
   * The iframe never grows past this height even if Archify's viewer
   * (guide overlay, story mode, semantic passport panel, etc.) reports a
   * taller content size.
   * @default 4000
   */
  maxHeight?: number;

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
   * `allow` (Permissions Policy) attribute applied to the diagram's
   * iframe, needed for the viewer's clipboard-copy export and fullscreen
   * presentation stage to work inside the embed.
   * @default 'clipboard-write; fullscreen'
   */
  allow?: string;

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

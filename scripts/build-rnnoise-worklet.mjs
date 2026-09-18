/* eslint-disable no-undef -- node build script */
/**
 * Bundles the RNNoise AudioWorklet into a single self-contained script.
 *
 * `@timephy/rnnoise-wasm/NoiseSuppressorWorklet` is an ES module that imports its WASM
 * blob and helpers. `AudioWorklet.addModule()` cannot resolve bare/relative imports
 * reliably across browsers, so everything (including the inlined WASM) is bundled into
 * one IIFE served from /worklets/rnnoise-worklet.js.
 *
 * Regenerate with: npm run build:worklets (runs automatically before `npm run build`).
 */
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = resolve(root, 'public/worklets/rnnoise-worklet.js');

await mkdir(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(root, 'node_modules/@timephy/rnnoise-wasm/dist/NoiseSuppressorWorklet.js')],
  outfile,
  bundle: true,
  minify: true,
  // IIFE, not ESM: the worklet global scope has no module loader, and registerProcessor
  // runs at top level.
  format: 'iife',
  platform: 'browser',
  target: ['chrome87', 'firefox89', 'safari14.1'],
  legalComments: 'none',
  logLevel: 'info',
});

console.log(`[rnnoise] worklet bundled → ${outfile}`);

// Bundles the renderer (three.js + app code) into dist/renderer.
import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const dev = process.argv.includes('--dev');

await rm('dist/renderer', { recursive: true, force: true });
await mkdir('dist/renderer', { recursive: true });
await build({
  entryPoints: ['src/renderer/app.js'],
  outfile: 'dist/renderer/app.js',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: !dev,
  sourcemap: dev,
  legalComments: 'eof', // keeps the license headers of bundled libraries (three.js, fflate)
});
await cp('src/renderer/index.html', 'dist/renderer/index.html');
await cp('src/renderer/style.css', 'dist/renderer/style.css');
console.log('renderer built');

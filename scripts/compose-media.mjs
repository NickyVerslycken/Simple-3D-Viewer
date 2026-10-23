// Turns the raw captures from docs-media.cjs into docs/images/*.png and docs/demo.gif.
import sharp from 'sharp';
import { mkdir, readdir, readFile, copyFile } from 'node:fs/promises';

const shots = 'test/out/shots';
const frames = 'test/out/frames';
await mkdir('docs/images', { recursive: true });

// single screenshots
const singles = { 'hero.png': 'screenshot-main.png', 'parts.png': 'screenshot-parts.png', 'xray.png': 'screenshot-xray.png', '3mf.png': 'screenshot-3mf.png', 'empty.png': 'screenshot-empty.png' };
for (const [from, to] of Object.entries(singles)) await copyFile(`${shots}/${from}`, `docs/images/${to}`);

// display-mode grid: 3 x 2 tiles
const names = ['solid', 'edges', 'wire', 'xray', 'normals'];
const labels = { solid: 'Solid', edges: 'Edges + flat shading', wire: 'Wireframe', xray: 'X-ray', normals: 'Normals' };
const tw = 560;
const meta = await sharp(`${shots}/tile-solid.png`).metadata();
const th = Math.round((meta.height * tw) / meta.width);
const composites = [];
for (let i = 0; i < names.length; i++) {
  const tile = await sharp(`${shots}/tile-${names[i]}.png`).resize(tw, th).toBuffer();
  const label = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="34"><rect width="${tw}" height="34" fill="#14161a" fill-opacity="0.78"/><text x="14" y="23" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#e6e8ec">${labels[names[i]]}</text></svg>`,
  );
  const col = i % 3;
  const row = Math.floor(i / 3);
  composites.push({ input: tile, left: col * (tw + 8), top: row * (th + 8) });
  composites.push({ input: label, left: col * (tw + 8), top: row * (th + 8) + th - 34 });
}
// sixth cell: the orange single-color variant
composites.push({ input: await sharp(`${shots}/orange.png`).extract({ left: 0, top: 48, width: 936, height: 684 }).resize(tw, th).toBuffer(), left: 2 * (tw + 8), top: th + 8 });
composites.push({
  input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="34"><rect width="${tw}" height="34" fill="#14161a" fill-opacity="0.78"/><text x="14" y="23" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#e6e8ec">Any color you like</text></svg>`),
  left: 2 * (tw + 8),
  top: th + 8 + th - 34,
});
await sharp({ create: { width: tw * 3 + 16, height: th * 2 + 8, channels: 3, background: '#0d0e11' } })
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile('docs/images/display-modes.png');

// demo GIF
const files = (await readdir(frames)).filter((f) => f.endsWith('.png')).sort();
const gw = 800;
const first = await sharp(`${frames}/${files[0]}`).metadata();
const gh = Math.round((first.height * gw) / first.width);
const bufs = [];
const delays = [];
for (const f of files) {
  bufs.push(await sharp(`${frames}/${f}`).resize(gw, gh).ensureAlpha().raw().toBuffer());
  delays.push(Number(await readFile(`${frames}/${f}.delay`, 'utf8')));
}
await sharp(Buffer.concat(bufs), { raw: { width: gw, height: gh * files.length, channels: 4, pageHeight: gh } })
  .gif({ delay: delays, loop: 0, colours: 128, effort: 7, dither: 0.6, interFrameMaxError: 6, interPaletteMaxError: 5 })
  .toFile('docs/demo.gif');
console.log(`docs/images + docs/demo.gif written (${files.length} frames, ${gw}x${gh})`);

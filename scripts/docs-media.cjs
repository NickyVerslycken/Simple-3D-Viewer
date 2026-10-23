// Captures the README screenshots and the frames of the demo animation by driving the real UI.
// Run with `npm run media` (which also assembles the images/GIF via scripts/compose-media.mjs).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const shots = path.join(root, 'test', 'out', 'shots');
const frames = path.join(root, 'test', 'out', 'frames');
for (const d of [shots, frames]) {
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
}

const W = 1200;
const H = 760;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  // In-memory session: starts from default settings and leaves nothing behind. No throttling so hidden-window frames stay fresh.
  const win = new BrowserWindow({ width: W, height: H, useContentSize: true, show: false, webPreferences: { sandbox: true, partition: 'docs-media', backgroundThrottling: false } });
  const wc = win.webContents;
  await win.loadFile(path.join(root, 'dist', 'renderer', 'index.html'));
  await wc.capturePage(); // hidden windows do not paint until first captured
  await wait(800);

  const js = (code) => wc.executeJavaScript(code);
  const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).click()`);
  const open = async (file) => {
    const b64 = fs.readFileSync(path.join(root, 'test', 'samples', file)).toString('base64');
    await js(`(async () => {
      const bin = Uint8Array.from(atob(${JSON.stringify(b64)}), c => c.charCodeAt(0));
      await window.__viewer.loadBuffer(${JSON.stringify(file)}, bin.buffer, '');
    })()`);
    await wait(500);
  };
  const reset = async () => {
    await click('.seg[data-key="display"] [data-v="solid"]');
    await click('.seg[data-key="shading"] [data-v="smooth"]');
    await click('.seg[data-key="colorMode"] [data-v="single"]');
    await click('#colorSwatches button:nth-child(1)');
    await click('#bgSwatches button:nth-child(1)');
    await click('[data-view="iso"]');
    await wait(300);
  };

  // ---------- screenshots ----------
  let n = 0;
  const frame = async (dir, name, delay) => {
    await wc.capturePage(); await wait(150); // flush any pending paint
    const img = await wc.capturePage();
    const file = path.join(dir, name);
    fs.writeFileSync(file, img.toPNG());
    if (delay) fs.writeFileSync(`${file}.delay`, String(delay));
  };

  await frame(shots, 'empty.png');
  await open('gear.stl');
  await frame(shots, 'hero.png');

  // display-mode tiles (cropped to the 3D view; composed into one image later)
  const tile = async (name, setup) => {
    await reset();
    await setup();
    await wait(500);
    const img = await wc.capturePage({ x: 0, y: 48, width: W - 264, height: H - 48 - 28 });
    fs.writeFileSync(path.join(shots, `tile-${name}.png`), img.toPNG());
  };
  await tile('solid', async () => {});
  await tile('edges', async () => { await click('.seg[data-key="display"] [data-v="edges"]'); await click('.seg[data-key="shading"] [data-v="flat"]'); });
  await tile('wire', async () => { await click('.seg[data-key="display"] [data-v="wire"]'); });
  await tile('xray', async () => { await click('.seg[data-key="display"] [data-v="xray"]'); await click('#bgSwatches button:nth-child(4)'); });
  await tile('normals', async () => { await click('.seg[data-key="display"] [data-v="normals"]'); });
  await reset();
  await click('#colorSwatches button:nth-child(2)');
  await wait(400);
  await frame(shots, 'orange.png');

  await open('scene.obj');
  await reset();
  await click('.seg[data-key="colorMode"] [data-v="parts"]');
  await wait(500);
  await frame(shots, 'parts.png');
  await click('#bgSwatches button:nth-child(4)');
  await click('.seg[data-key="display"] [data-v="xray"]');
  await wait(500);
  await frame(shots, 'xray.png');

  await open('two-parts.3mf');
  await reset();
  await click('.seg[data-key="colorMode"] [data-v="original"]');
  await wait(500);
  await frame(shots, '3mf.png');

  // ---------- demo animation ----------
  await open('scene.obj'); // placeholder so the empty state can be re-shown cleanly
  await js('location.reload()');
  await wait(1200);
  await wc.capturePage();
  await wait(500);

  const f = async (delay = 80) => { await wait(70); await frame(frames, `${String(n++).padStart(3, '0')}.png`, delay); };
  const cx = Math.round((W - 264) / 2);
  const cy = Math.round(48 + (H - 76) / 2);

  await f(1400); // empty state
  await open('gear.stl');
  await f(900);

  // rotate with real mouse input: left-drag
  wc.sendInputEvent({ type: 'mouseDown', x: cx, y: cy, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 22; i++) {
    wc.sendInputEvent({ type: 'mouseMove', x: cx + i * 14, y: cy + Math.round(Math.sin(i / 4) * 6), button: 'left' });
    await f(70);
  }
  for (let i = 1; i <= 12; i++) {
    wc.sendInputEvent({ type: 'mouseMove', x: cx + 22 * 14, y: cy + i * 10, button: 'left' });
    await f(70);
  }
  wc.sendInputEvent({ type: 'mouseUp', x: cx + 22 * 14, y: cy + 120, button: 'left', clickCount: 1 });
  await wait(500);
  await f(500);

  // zoom with the wheel, then with the buttons
  for (let i = 0; i < 6; i++) { wc.sendInputEvent({ type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY: 120, canScroll: true }); await f(70); }
  await f(500);
  for (let i = 0; i < 6; i++) { wc.sendInputEvent({ type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY: -120, canScroll: true }); await f(70); }
  await click('[data-view="iso"]');
  await f(700);
  await click('#zoomIn'); await f(300);
  await click('#zoomIn'); await f(300);
  await click('#zoomOut'); await f(300);
  await click('#zoomLevel'); await f(600);

  // colors
  for (const nth of [2, 3, 5, 7, 1]) {
    await click(`#colorSwatches button:nth-child(${nth})`);
    await f(550);
  }
  // display modes
  for (const mode of ['edges', 'xray', 'wire', 'normals', 'solid']) {
    await click(`.seg[data-key="display"] [data-v="${mode}"]`);
    await f(750);
  }
  await click('.seg[data-key="shading"] [data-v="flat"]'); await f(650);
  await click('.seg[data-key="shading"] [data-v="smooth"]'); await f(500);
  await click('#bgSwatches button:nth-child(4)'); await f(650);
  await click('#bgSwatches button:nth-child(1)'); await f(500);

  // multi-part model, colored per part
  await open('scene.obj');
  await f(700);
  await click('.seg[data-key="colorMode"] [data-v="parts"]');
  await f(1500);

  console.log(`screenshots: ${fs.readdirSync(shots).length}, demo frames: ${n}`);
  app.exit(0);
});

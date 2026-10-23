// Captures the Microsoft Store listing screenshots (1920 x 1080 PNG) into store/screenshots by driving the real UI.
// Run with `npm run store:screenshots`.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'store', 'screenshots');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 1920;
const H = 1080;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  // In-memory session so no saved settings leak in; no throttling so hidden-window frames stay fresh.
  const win = new BrowserWindow({ width: W, height: H, useContentSize: true, show: false, webPreferences: { sandbox: true, partition: 'store-shots', backgroundThrottling: false } });
  const wc = win.webContents;
  await win.loadFile(path.join(root, 'dist', 'renderer', 'index.html'));
  await wc.capturePage();
  await wait(800);

  const js = (code) => wc.executeJavaScript(code);
  const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).click()`);
  const open = async (file) => {
    const b64 = fs.readFileSync(path.join(root, 'test', 'samples', file)).toString('base64');
    await js(`(async () => {
      const bin = Uint8Array.from(atob(${JSON.stringify(b64)}), c => c.charCodeAt(0));
      await window.__viewer.loadBuffer(${JSON.stringify(file)}, bin.buffer, '');
    })()`);
    await wait(600);
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
  const shot = async (name) => {
    await wait(500);
    await wc.capturePage(); // flush any pending paint
    await wait(150);
    const img = await wc.capturePage();
    const size = img.getSize();
    if (size.width !== W || size.height !== H) console.warn(`${name}: unexpected size ${size.width}x${size.height}`);
    fs.writeFileSync(path.join(out, name), img.toPNG());
  };

  await open('gear.stl');
  await reset();
  await shot('01-open-and-view.png');

  await click('.seg[data-key="display"] [data-v="edges"]');
  await click('.seg[data-key="shading"] [data-v="flat"]');
  await click('#colorSwatches button:nth-child(2)');
  await shot('02-edges-and-flat-shading.png');

  await reset();
  await click('.seg[data-key="display"] [data-v="wire"]');
  await shot('03-wireframe.png');

  await open('scene.obj');
  await reset();
  await click('.seg[data-key="colorMode"] [data-v="parts"]');
  await shot('04-color-per-part.png');

  await click('#bgSwatches button:nth-child(4)');
  await click('.seg[data-key="display"] [data-v="xray"]');
  await shot('05-xray-light-background.png');

  await open('two-parts.3mf');
  await reset();
  await click('.seg[data-key="colorMode"] [data-v="original"]');
  await click('[data-view="front"]');
  await shot('06-colors-from-3mf-file.png');

  console.log('wrote', fs.readdirSync(out).join(', '));
  app.exit(0);
});

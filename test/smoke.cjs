// Electron smoke test: loads each sample into the real renderer bundle and saves screenshots.
// Usage: npx electron test/smoke.cjs [outDir]
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'test', 'out'));
fs.mkdirSync(outDir, { recursive: true });

// Each case: sample file + settings to apply before the screenshot.
const CASES = [
  { file: 'two-parts.3mf', tag: '3mf-edges', settings: { display: 'edges', colorMode: 'parts' } },
  { file: 'two-parts.3mf', tag: '3mf-flat-normals', settings: { display: 'normals', shading: 'flat' } },
  { file: 'scene.stl', tag: 'stl-solid', settings: {} },
  { file: 'scene.stl', tag: 'stl-edges-flat', settings: { display: 'edges', shading: 'flat' } },
  { file: 'scene.stl', tag: 'stl-wire', settings: { display: 'wire', shading: 'smooth' } },
  { file: 'scene.stl', tag: 'stl-xray-light', settings: { display: 'xray', background: '#d9dde3' } },
  { file: 'scene.stl', tag: 'stl-normals', settings: { display: 'normals', background: '#1b1d22' } },
  { file: 'scene-ascii.stl', tag: 'stl-ascii', settings: { display: 'solid' } },
  { file: 'scene.obj', tag: 'obj-original', settings: { colorMode: 'original' } },
  { file: 'scene.obj', tag: 'obj-parts', settings: { colorMode: 'parts' } },
  { file: 'two-parts.3mf', tag: '3mf-original', settings: { colorMode: 'original' } },
  { file: 'ball-colors.ply', tag: 'ply-original', settings: { colorMode: 'original' } },
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false, webPreferences: { sandbox: true } });
  const logs = [];
  win.webContents.on('console-message', (e) => logs.push(`[${e.level}] ${e.message}`));
  await win.loadFile(path.join(root, 'dist', 'renderer', 'index.html'));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let failed = false;
  await win.webContents.capturePage(); // warm up: hidden windows do not paint until first captured
  await wait(800);

  for (const c of CASES) {
    const buf = fs.readFileSync(path.join(root, 'test', 'samples', c.file));
    const b64 = buf.toString('base64');
    const result = await win.webContents.executeJavaScript(`(async () => {
      const bin = Uint8Array.from(atob(${JSON.stringify(b64)}), ch => ch.charCodeAt(0));
      const { viewer, loadBuffer } = window.__viewer;
      viewer.update({ display: 'solid', shading: 'smooth', colorMode: 'single', background: '#1b1d22' });
      await loadBuffer(${JSON.stringify(c.file)}, bin.buffer, '');
      viewer.update(${JSON.stringify(c.settings)});
      return { toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent,
               size: document.getElementById('stSize').textContent, tris: document.getElementById('stTris').textContent,
               parts: document.getElementById('stParts').textContent, original: viewer.hasOriginal };
    })()`);
    await wait(500);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, `${c.tag}.png`), img.toPNG());
    const ok = !result.toast;
    if (!ok) failed = true;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.tag}: ${result.size} | ${result.tris} | ${result.parts} | original=${result.original} ${result.toast}`);
  }
  logs.filter((l) => !l.startsWith('[info]') && !l.startsWith('[0]')).forEach((l) => console.log('console', l));
  app.exit(failed ? 1 : 0);
});

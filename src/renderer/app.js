import { Viewer, PART_COLORS } from './viewer.js';
import { parseModel, defaultZUp, extOf, EXTENSIONS } from './loaders.js';

const api = window.viewerApi || null; // absent when the page is opened in a plain browser
const $ = (id) => document.getElementById(id);

const BACKGROUNDS = ['#1b1d22', '#343944', '#8a93a3', '#d9dde3', '#ffffff'];
const STORAGE_KEY = 'simple3dviewer.settings';
const DEFAULTS = {
  display: 'solid',
  shading: 'smooth',
  colorMode: 'single',
  color: '#5aa2f0',
  background: '#1b1d22',
  shadows: true,
  grid: true,
  axes: true,
  panel: true,
  zUpByExt: {},
};

// ---------- settings ----------

let settings = { ...DEFAULTS };
try {
  settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
} catch { /* first run or storage unavailable */ }

function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

// ---------- viewer ----------

const viewer = new Viewer($('stage'), (msg) => toast(msg, 'info'));
viewer.update({
  display: settings.display,
  shading: settings.shading,
  colorMode: settings.colorMode,
  color: settings.color,
  background: settings.background,
  shadows: settings.shadows,
  grid: settings.grid,
  axes: settings.axes,
});

// ---------- UI sync ----------

function makeSwatches(container, colors, key) {
  for (const c of colors) {
    const b = document.createElement('button');
    b.style.background = c;
    b.dataset.color = c;
    b.title = c;
    b.addEventListener('click', () => change({ [key]: c }));
    container.appendChild(b);
  }
}
makeSwatches($('colorSwatches'), PART_COLORS, 'color');
makeSwatches($('bgSwatches'), BACKGROUNDS, 'background');

function syncUI() {
  const mode = viewer.effectiveColorMode;
  document.querySelectorAll('.seg').forEach((seg) => {
    const key = seg.dataset.key;
    const value = key === 'colorMode' ? mode : settings[key];
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === value));
  });
  document.querySelector('.seg[data-key="colorMode"] [data-v="original"]').disabled = !viewer.hasOriginal;
  document.querySelectorAll('input[type="checkbox"][data-key]').forEach((el) => { el.checked = !!settings[el.dataset.key]; });
  $('zUp').checked = viewer.s.zUp;

  const match = (el, v) => el.classList.toggle('active', el.dataset.color.toLowerCase() === String(v).toLowerCase());
  $('colorSwatches').querySelectorAll('button').forEach((b) => match(b, settings.color));
  $('colorSwatches').classList.toggle('disabled', mode !== 'single');
  $('bgSwatches').querySelectorAll('button').forEach((b) => match(b, settings.background));
  $('colorCustom').value = settings.color;
  $('bgCustom').value = settings.background;
  $('app').classList.toggle('panel-hidden', !settings.panel);
}

function change(partial) {
  Object.assign(settings, partial);
  const { panel, zUpByExt, ...viewerSettings } = partial;
  if (Object.keys(viewerSettings).length) viewer.update(viewerSettings);
  saveSettings();
  syncUI();
}

document.querySelectorAll('.seg').forEach((seg) => {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && !b.disabled) change({ [seg.dataset.key]: b.dataset.v });
  });
});
document.querySelectorAll('input[type="checkbox"][data-key]').forEach((el) => {
  el.addEventListener('change', () => change({ [el.dataset.key]: el.checked }));
});
$('colorCustom').addEventListener('input', (e) => change({ color: e.target.value }));
$('bgCustom').addEventListener('input', (e) => change({ background: e.target.value }));
$('zUp').addEventListener('change', (e) => {
  const zUp = e.target.checked;
  if (current) settings.zUpByExt = { ...settings.zUpByExt, [current.ext]: zUp };
  viewer.update({ zUp });
  viewer.setView('iso');
  saveSettings();
  syncUI();
});
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => viewer.setView(b.dataset.view)));
$('btnFit').addEventListener('click', () => viewer.fit());

// zoom: 100% is the model fitted to the window
viewer.onZoom = (p) => { $('zoomLevel').textContent = `${p.toLocaleString()}%`; };
const zoom = {
  in: () => viewer.zoomStep(1),
  out: () => viewer.zoomStep(-1),
  reset: () => viewer.setZoom(100),
};
$('zoomIn').addEventListener('click', zoom.in);
$('zoomOut').addEventListener('click', zoom.out);
$('zoomLevel').addEventListener('click', zoom.reset);
$('btnPanel').addEventListener('click', () => change({ panel: !settings.panel }));
$('btnShot').addEventListener('click', saveScreenshot);

// ---------- notices ----------

let toastTimer = 0;
function toast(msg, kind = 'error') {
  const el = $('toast');
  el.textContent = msg;
  el.className = kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'error' ? 7000 : 4000);
}

// ---------- opening files ----------

let current = null; // {name, path, ext}
let neighbors = null;
let loadToken = 0;

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

function fmtNum(n) {
  return String(parseFloat(n >= 100 ? n.toFixed(1) : n >= 1 ? n.toFixed(2) : n.toFixed(3)));
}
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function loadBuffer(name, buffer, path) {
  const token = ++loadToken;
  $('busy').hidden = false;
  await nextFrame();
  await nextFrame(); // let the spinner paint before the (blocking) parse
  try {
    const parsed = await parseModel(name, buffer, async (rel) => (path && api ? api.readSibling(path, rel) : null));
    if (token !== loadToken) return;
    const zUp = settings.zUpByExt[parsed.ext] ?? defaultZUp(parsed.ext);
    const info = viewer.setModel(parsed.root, { ext: parsed.ext, hasMaterials: parsed.hasMaterials, zUp });
    current = { name, path, ext: parsed.ext };

    $('empty').hidden = true;
    $('zoomBar').hidden = false;
    $('btnShot').disabled = false;
    $('fileName').textContent = name;
    document.title = `${name} – Simple 3D Viewer`;
    $('stSize').textContent = `${fmtNum(info.size.x)} × ${fmtNum(info.size.y)} × ${fmtNum(info.size.z)} ${['gltf', 'glb', 'fbx', 'dae'].includes(parsed.ext) ? 'units' : 'mm'}`;
    $('stTris').textContent = info.triangles ? `${info.triangles.toLocaleString()} triangles` : `${info.vertices.toLocaleString()} points`;
    $('stParts').textContent = info.parts > 1 ? `${info.parts} parts` : '';
    $('stGrid').textContent = `Grid ${fmtNum(viewer.gridStep)} ${['gltf', 'glb', 'fbx', 'dae'].includes(parsed.ext) ? 'units' : 'mm'}`;
    $('stFile').textContent = `${path || name} · ${fmtBytes(buffer.byteLength)}`;
    $('toast').hidden = true;
    syncUI();
    refreshNeighbors(path);
  } catch (err) {
    if (token !== loadToken) return;
    console.error(err);
    toast(`Could not open "${name}": ${err.message || err}`);
  } finally {
    if (token === loadToken) $('busy').hidden = true;
  }
}

async function refreshNeighbors(path) {
  neighbors = path && api ? await api.neighbors(path) : null;
  $('btnPrev').disabled = $('btnNext').disabled = !neighbors;
  $('fileCounter').textContent = neighbors ? `${neighbors.index} / ${neighbors.count}` : '';
}

async function openPath(path) {
  try {
    const f = await api.readFile(path);
    const buf = f.data.buffer.slice(f.data.byteOffset, f.data.byteOffset + f.data.byteLength);
    await loadBuffer(f.name, buf, f.path);
  } catch (err) {
    toast(`Could not read the file: ${err.message || err}`);
  }
}

async function openFileObject(file) {
  if (!EXTENSIONS.includes(extOf(file.name))) {
    toast(`"${file.name}" is not a supported 3D format. Supported: ${EXTENSIONS.join(', ').toUpperCase()}.`);
    return;
  }
  const path = api ? api.pathForFile(file) : '';
  await loadBuffer(file.name, await file.arrayBuffer(), path || '');
}

async function openDialog() {
  if (api) {
    const p = await api.openDialog();
    if (p) await openPath(p);
  } else {
    $('fileInput').click();
  }
}

$('fileInput').accept = EXTENSIONS.map((e) => `.${e}`).join(',');
$('fileInput').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) openFileObject(f);
});
$('btnOpen').addEventListener('click', openDialog);
$('btnPrev').addEventListener('click', () => neighbors && openPath(neighbors.prev));
$('btnNext').addEventListener('click', () => neighbors && openPath(neighbors.next));

function saveScreenshot() {
  const a = document.createElement('a');
  a.href = viewer.screenshot();
  a.download = `${(current?.name || 'model').replace(/\.[^.]+$/, '')}.png`;
  a.click();
}

// ---------- drag and drop ----------

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  $('dropOverlay').hidden = false;
});
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) { dragDepth = 0; $('dropOverlay').hidden = true; }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('dropOverlay').hidden = true;
  const f = e.dataTransfer.files[0];
  if (f) openFileObject(f);
});

// ---------- keyboard ----------

const VIEW_KEYS = { 0: 'iso', 1: 'front', 2: 'back', 3: 'left', 4: 'right', 5: 'top', 6: 'bottom' };
window.addEventListener('keydown', (e) => {
  if (e.target.matches?.('input')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); openDialog(); return; }
  if (mod || e.altKey) return;
  if (e.key in VIEW_KEYS) viewer.setView(VIEW_KEYS[e.key]);
  else if (e.key === 'f' || e.key === 'F') viewer.fit();
  else if (e.key === '+' || e.key === '=') zoom.in();
  else if (e.key === '-' || e.key === '_') zoom.out();
  else if (e.key === 'p' || e.key === 'P') { if (current) saveScreenshot(); }
  else if (e.key === 'Tab') { e.preventDefault(); change({ panel: !settings.panel }); }
  else if (e.key === 'ArrowLeft' && neighbors) openPath(neighbors.prev);
  else if (e.key === 'ArrowRight' && neighbors) openPath(neighbors.next);
});

// ---------- startup ----------

syncUI();
if (api) {
  api.onOpenPath(openPath);
  api.onMenuOpen(openDialog);
  api.onMenuZoom((action) => zoom[action]?.());
  api.ready();
}

// Hook for automated tests / debugging.
window.__viewer = { viewer, loadBuffer };

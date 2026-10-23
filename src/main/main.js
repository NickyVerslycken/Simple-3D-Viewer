const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const MODEL_EXTS = ['stl', 'obj', '3mf', 'ply', 'amf', 'glb', 'gltf', 'fbx', 'dae'];
// Companion files a model may reference (materials, buffers, textures).
const SIDECAR_EXTS = ['mtl', 'bin', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

let win = null;
let rendererReady = false;
let pendingPath = null;

const REPO_URL = 'https://github.com/NickyVerslycken/Simple-3D-Viewer';
const COPYRIGHT = 'Copyright © 2026 Nicky Verslycken';
const LICENSE_NAME = 'PolyForm Shield License 1.0.0';

// The license files are shipped next to the app as .txt (see "extraResources" in package.json),
// so every OS can open them with its default text editor.
const bundledFile = (packagedName, devName) =>
  app.isPackaged ? path.join(process.resourcesPath, packagedName) : path.join(__dirname, '..', '..', devName);

function showAbout() {
  dialog
    .showMessageBox(win, {
      type: 'info',
      title: 'About Simple 3D Viewer',
      message: `Simple 3D Viewer ${app.getVersion()}`,
      detail:
        `${COPYRIGHT}\n\nA small offline viewer for STL, OBJ, 3MF and other 3D-print formats.\n\n` +
        `Licensed under the ${LICENSE_NAME}.\nBuilt with three.js and Electron (MIT licensed).\n\n${REPO_URL}`,
      buttons: ['OK', 'Open project page'],
      defaultId: 0,
      noLink: true,
    })
    .then((r) => { if (r.response === 1) shell.openExternal(REPO_URL); });
}

const extOf = (p) => path.extname(p).slice(1).toLowerCase();
const isModel = (p) => MODEL_EXTS.includes(extOf(p));

function fileFromArgv(argv, cwd) {
  // Packaged: [exe, file]. Dev (`electron . file`): [electron, '.', file].
  for (const arg of argv.slice(app.isPackaged ? 1 : 2)) {
    if (arg.startsWith('-')) continue;
    const full = path.resolve(cwd || process.cwd(), arg);
    if (isModel(full) && fs.existsSync(full)) return full;
  }
  return null;
}

function openPath(p) {
  if (!p) return;
  app.addRecentDocument(p);
  if (win && rendererReady) {
    win.webContents.send('open-path', p);
    if (win.isMinimized()) win.restore();
    win.focus();
  } else {
    pendingPath = p;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 640,
    minHeight: 420,
    backgroundColor: '#14161a',
    show: false,
    title: 'Simple 3D Viewer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; rendererReady = false; });
  // The viewer never navigates away or spawns windows (a dropped file must not replace the page).
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html'));
}

const sendZoom = (action) => win && win.webContents.send('menu-zoom', action);

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => win && win.webContents.send('menu-open') },
        { role: 'recentDocuments', submenu: [{ role: 'clearRecentDocuments' }] },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => sendZoom('in') },
        // Ctrl+= is the same key as Ctrl+Plus on most keyboards; keep it working without a second visible entry.
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', visible: false, click: () => sendZoom('in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => sendZoom('out') },
        { label: 'Actual Size (100%)', accelerator: 'CmdOrCtrl+0', click: () => sendZoom('reset') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    // On Windows/Linux the built-in "windowMenu" has a "Zoom" item that just maximizes the window, which is confusing here.
    isMac ? { role: 'windowMenu' } : { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
    {
      role: 'help',
      submenu: [
        { label: 'Project on GitHub', click: () => shell.openExternal(REPO_URL) },
        { label: 'Report a Problem', click: () => shell.openExternal(`${REPO_URL}/issues/new/choose`) },
        { type: 'separator' },
        { label: 'License', click: () => shell.openPath(bundledFile('LICENSE.txt', 'LICENSE')) },
        { label: 'Third-Party Notices', click: () => shell.openPath(bundledFile('THIRD-PARTY-NOTICES.txt', 'THIRD-PARTY-NOTICES.md')) },
        ...(isMac ? [] : [{ type: 'separator' }, { label: 'About Simple 3D Viewer', click: showAbout }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('dialog:open', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: '3D models', extensions: MODEL_EXTS },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('file:read', async (_e, p) => {
  if (typeof p !== 'string' || !isModel(p)) throw new Error('Unsupported file type');
  const data = await fs.promises.readFile(p);
  return { path: p, name: path.basename(p), data };
});

// Reads a file referenced by a model (.mtl, textures, .bin), only from the model's own folder tree.
ipcMain.handle('file:sibling', async (_e, base, rel) => {
  if (typeof base !== 'string' || typeof rel !== 'string' || !SIDECAR_EXTS.includes(extOf(rel))) return null;
  const dir = path.dirname(base);
  const target = path.resolve(dir, rel);
  if (!target.startsWith(dir + path.sep)) return null;
  try {
    return await fs.promises.readFile(target);
  } catch {
    return null;
  }
});

ipcMain.handle('file:neighbors', async (_e, p) => {
  if (typeof p !== 'string') return null;
  try {
    const dir = path.dirname(p);
    const names = (await fs.promises.readdir(dir))
      .filter(isModel)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const idx = names.findIndex((n) => n.toLowerCase() === path.basename(p).toLowerCase());
    if (idx < 0 || names.length < 2) return null;
    const n = names.length;
    return {
      prev: path.join(dir, names[(idx - 1 + n) % n]),
      next: path.join(dir, names[(idx + 1) % n]),
      index: idx + 1,
      count: n,
    };
  } catch {
    return null;
  }
});

ipcMain.on('renderer-ready', () => {
  rendererReady = true;
  if (pendingPath) {
    win.webContents.send('open-path', pendingPath);
    pendingPath = null;
  }
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv, cwd) => openPath(fileFromArgv(argv, cwd)));
  // macOS delivers "open with" / double-clicks here, possibly before the app is ready.
  app.on('open-file', (e, p) => {
    e.preventDefault();
    openPath(p);
  });
  app.setAboutPanelOptions({
    applicationName: 'Simple 3D Viewer',
    applicationVersion: app.getVersion(),
    copyright: `${COPYRIGHT}. Licensed under the ${LICENSE_NAME}.`,
    website: REPO_URL,
  });
  app.whenReady().then(() => {
    pendingPath = pendingPath || fileFromArgv(process.argv);
    buildMenu();
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => app.quit());
}

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('viewerApi', {
  openDialog: () => ipcRenderer.invoke('dialog:open'),
  readFile: (p) => ipcRenderer.invoke('file:read', p),
  readSibling: (base, rel) => ipcRenderer.invoke('file:sibling', base, rel),
  neighbors: (p) => ipcRenderer.invoke('file:neighbors', p),
  pathForFile: (f) => {
    try { return webUtils.getPathForFile(f); } catch { return ''; }
  },
  onOpenPath: (cb) => ipcRenderer.on('open-path', (_e, p) => cb(p)),
  onMenuOpen: (cb) => ipcRenderer.on('menu-open', () => cb()),
  onMenuZoom: (cb) => ipcRenderer.on('menu-zoom', (_e, action) => cb(action)),
  ready: () => ipcRenderer.send('renderer-ready'),
});

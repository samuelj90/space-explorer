const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spaceExplorer', {
  getTheme: () => ipcRenderer.invoke('theme:get'),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme)
});

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { startBackend } = require('./desktop/backend.cjs');
const { readTheme, writeTheme } = require('./desktop/preferences.cjs');

let mainWindow;
let backend;
let quitting = false;

if (process.env.SPACE_EXPLORER_TEST_HIDDEN === '1' && process.env.SPACE_EXPLORER_TEST_DATA) {
  app.setPath('appData', process.env.SPACE_EXPLORER_TEST_DATA);
  app.setPath('userData', path.join(process.env.SPACE_EXPLORER_TEST_DATA, 'electron-state'));
}

function preferencesPath(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Unauthorized preferences request');
  return path.join(app.getPath('userData'), 'preferences.json');
}

ipcMain.handle('theme:get', (event) => readTheme(preferencesPath(event)));
ipcMain.handle('theme:set', (event, theme) => writeTheme(preferencesPath(event), theme));

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: process.env.SPACE_EXPLORER_TEST_HIDDEN !== '1',
    title: 'Space Explorer',
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'branding', 'icon.png')
      : path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'desktop', 'preload.cjs')
    }
  });
  try {
    await mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<!doctype html><title>Space Explorer</title><body style="background:#0d1117;color:#e6edf3;font:16px sans-serif;padding:32px">Starting Space Explorer...</body>'
    ));
    if (!backend) {
      const workspace = path.join(app.getPath('appData'), 'Space Explorer Workspace');
      if (app.isPackaged) fs.mkdirSync(workspace, { recursive: true });
      backend = startBackend({
        packaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        rootPath: __dirname,
        workspace
      });
      const current = backend;
      current.child.once('exit', () => {
        if (!quitting && current.initialized && backend === current) {
          backend = null;
          dialog.showErrorBox('Space Explorer backend stopped', 'The backend stopped unexpectedly. Restart Space Explorer.');
          app.quit();
        }
      });
    }
    const current = backend;
    const port = await current.ready;
    if (current.child.exitCode !== null || current.child.signalCode !== null) throw new Error('Backend exited during startup');
    current.initialized = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(`http://127.0.0.1:${port}`);
    }
  } catch (error) {
    if (!quitting) {
      dialog.showErrorBox('Space Explorer could not start', `${error.message}\n\nCheck the backend installation and try restarting the application.`);
      app.quit();
    }
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  quitting = true;
  if (backend) backend.child.kill();
  backend = null;
});

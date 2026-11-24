const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;
const PORT = 3888;

function getResourcePath(relativePath) {
  if (app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', relativePath);
    if (fs.existsSync(unpacked)) {
      return unpacked;
    }
    const directResource = path.join(process.resourcesPath, relativePath);
    if (fs.existsSync(directResource)) {
      return directResource;
    }
  }
  return path.join(__dirname, relativePath);
}

function startBackend() {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const serverScript = getResourcePath(path.join('server', 'app.py'));
  const cwd = getResourcePath('');

  serverProcess = spawn(pythonCmd, [serverScript, PORT.toString()], {
    cwd,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server] ${data}`);
  });

  serverProcess.on('error', (err) => {
    console.error(`[Server error] ${err.message}`);
  });
}

function killServer() {
  if (serverProcess && !serverProcess.killed) {
    if (process.platform === 'win32' && serverProcess.pid) {
      try {
        spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t']);
      } catch (e) {
        serverProcess.kill();
      }
    } else {
      serverProcess.kill();
    }
    serverProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Space Explorer',
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Wait a moment for server to bind port before loading
  setTimeout(() => {
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  }, 1000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killServer();
});

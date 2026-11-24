const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

function startBackend({ packaged, resourcesPath, rootPath, workspace, timeoutMs = 30000 }) {
  const python = packaged
    ? path.join(resourcesPath, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3')
    : process.platform === 'win32' ? 'python' : 'python3';
  const root = packaged ? path.join(resourcesPath, 'app.asar.unpacked') : rootPath;
  const env = { ...process.env, PYTHONUNBUFFERED: '1' };
  if (packaged) {
    delete env.PYTHONHOME;
    delete env.PYTHONPATH;
    env.SPACE_EXPLORER_WORKSPACE = workspace;
  }
  if (env.SPACE_EXPLORER_TEST_HIDDEN === '1' && env.SPACE_EXPLORER_TEST_DATA) {
    env.HOME = env.SPACE_EXPLORER_TEST_DATA;
    env.USERPROFILE = env.SPACE_EXPLORER_TEST_DATA;
    env.LOCALAPPDATA = env.SPACE_EXPLORER_TEST_DATA;
  }
  const child = spawn(python, [path.join(root, 'server', 'app.py'), '0'], {
    cwd: root,
    env,
    windowsHide: true
  });
  let errors = '';
  child.stderr.on('data', (data) => {
    errors = (errors + data.toString()).slice(-4000);
    console.error(`[Server] ${data}`);
  });
  const ready = new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => fail(new Error('Backend startup timed out')), timeoutMs);
    const lines = readline.createInterface({ input: child.stdout });
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      lines.close();
      child.kill();
      reject(new Error(`${error.message}${errors ? `\n${errors}` : ''}`));
    };
    child.once('error', fail);
    child.once('exit', (code, signal) => fail(new Error(`Backend exited before startup (code ${code}, signal ${signal})`)));
    lines.on('line', (line) => {
      console.log(`[Server] ${line}`);
      const match = /^SPACE_EXPLORER_READY:(\d+)$/.exec(line);
      if (!match || settled) return;
      const port = Number(match[1]);
      if (port < 1 || port > 65535) return fail(new Error('Backend returned an invalid port'));
      settled = true;
      clearTimeout(timer);
      resolve(port);
    });
  });
  return { child, ready };
}

module.exports = { startBackend };

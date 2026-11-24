const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { startBackend } = require('../desktop/backend.cjs');

async function withBackend(script, timeoutMs, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'space-explorer-backend-'));
  fs.mkdirSync(path.join(root, 'server'));
  fs.writeFileSync(path.join(root, 'server', 'app.py'), script);
  const backend = startBackend({ packaged: false, rootPath: root, timeoutMs });
  try {
    await callback(backend);
  } finally {
    backend.child.kill();
    if (backend.child.exitCode === null && backend.child.signalCode === null) {
      await new Promise((resolve) => backend.child.once('exit', resolve));
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('resolves only when backend announces its port', async () => {
  await withBackend('import time\nprint("SPACE_EXPLORER_READY:41234", flush=True)\ntime.sleep(10)\n', 3000, async ({ ready }) => {
    assert.equal(await ready, 41234);
  });
});

test('reports an early backend exit', async () => {
  await withBackend('import sys\nprint("startup failed", file=sys.stderr, flush=True)\nsys.exit(1)\n', 3000, async ({ ready }) => {
    await assert.rejects(ready, /startup failed/);
  });
});

test('reports startup timeouts', async () => {
  await withBackend('import time\ntime.sleep(10)\n', 200, async ({ ready }) => {
    await assert.rejects(ready, /timed out/);
  });
});

test('reports a missing bundled interpreter', async () => {
  const resources = fs.mkdtempSync(path.join(os.tmpdir(), 'space-explorer-runtime-'));
  fs.mkdirSync(path.join(resources, 'app.asar.unpacked'));
  try {
    const backend = startBackend({ packaged: true, resourcesPath: resources, workspace: resources, timeoutMs: 3000 });
    await assert.rejects(backend.ready, /ENOENT/);
  } finally {
    fs.rmSync(resources, { recursive: true, force: true });
  }
});

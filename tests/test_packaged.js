const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');
const { chromium } = require('playwright-core');

async function openPackaged(temp) {
  const child = spawn(process.env.SPACE_TEST_PACKAGED_EXE, ['--remote-debugging-port=0', '--enable-logging=stderr'], {
    env: {
      ...process.env,
      PATH: temp,
      SPACE_EXPLORER_TEST_HIDDEN: '1',
      SPACE_EXPLORER_TEST_DATA: temp
    }
  });
  let browser;
  let output = '';
  async function close() {
    if (browser) {
      const session = await browser.newBrowserCDPSession();
      try { await session.send('Browser.close'); }
      catch (error) { console.error(`Browser close: ${error.message}`); }
      try { await browser.close(); }
      catch (error) { console.error(`Browser disconnect: ${error.message}`); }
    }
    if (child.pid && child.exitCode === null && child.signalCode === null) child.kill();
    if (child.pid && child.exitCode === null && child.signalCode === null) await new Promise((resolve) => child.once('exit', resolve));
  }
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Electron did not start:\n${output}`)), 30000);
      function read(chunk) {
        output += chunk.toString();
        const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(output);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      }
      child.stdout.on('data', read);
      child.stderr.on('data', read);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Electron exited: ${code}\n${output}`)); });
    });
    browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.waitForEvent('page');
    await page.getByRole('heading', { name: 'Space Explorer' }).waitFor({ timeout: 30000 });
    return { page, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('packaged Electron starts without system Python and persists its theme', { skip: !process.env.SPACE_TEST_PACKAGED_EXE, timeout: 120000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'space-explorer-packaged-'));
  const workspace = path.join(temp, 'Space Explorer Workspace');
  fs.mkdirSync(path.join(workspace, 'demo', 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'demo', 'node_modules', 'fixture.txt'), 'fixture');
  let application;
  try {
    application = await openPackaged(temp);
    await application.page.getByText('demo', { exact: true }).waitFor({ timeout: 30000 });
    const info = await application.page.evaluate(async () => (await fetch('/api/info')).json());
    assert.equal(info.workspace, workspace);
    assert.equal((await application.page.locator('main').innerText()).includes(workspace), false);
    await application.page.getByLabel('Theme').selectOption('light');
    const preferences = path.join(temp, 'electron-state', 'preferences.json');
    const deadline = Date.now() + 10000;
    while (!fs.existsSync(preferences) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(JSON.parse(fs.readFileSync(preferences, 'utf8')).theme, 'light');
    await application.close();
    application = null;
    application = await openPackaged(temp);
    await application.page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    assert.equal(await application.page.getByLabel('Theme').inputValue(), 'light');
  } finally {
    if (application) await application.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

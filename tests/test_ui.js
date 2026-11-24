const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const test = require('node:test');
const { chromium } = require('playwright-core');

test('dashboard workflows, themes, and responsive layout', { skip: !process.env.SPACE_TEST_BROWSER, timeout: 60000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'space-explorer-ui-'));
  const workspace = path.join(temp, 'workspace');
  const artifact = path.join(workspace, 'demo', 'node_modules');
  fs.mkdirSync(artifact, { recursive: true });
  fs.writeFileSync(path.join(artifact, 'fixture.txt'), 'fixture');
  const server = spawn(process.env.SPACE_TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [path.join(root, 'server', 'app.py'), '0'], {
    cwd: root,
    env: { ...process.env, HOME: temp, USERPROFILE: temp, APPDATA: temp, LOCALAPPDATA: temp, SPACE_EXPLORER_WORKSPACE: workspace, PYTHONUNBUFFERED: '1' }
  });
  let browser;
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server did not start')), 10000);
      server.once('error', reject);
      server.once('exit', (code) => reject(new Error(`Server exited: ${code}`)));
      readline.createInterface({ input: server.stdout }).on('line', (line) => {
        const match = /^SPACE_EXPLORER_READY:(\d+)$/.exec(line);
        if (match) { clearTimeout(timer); resolve(Number(match[1])); }
      });
    });
    browser = await chromium.launch({ executablePath: process.env.SPACE_TEST_BROWSER, headless: true });
    const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByText('demo', { exact: true }).waitFor();
    const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
    const brand = page.locator('.brand-mark');
    assert.equal(await brand.getAttribute('src'), new URL(favicon, page.url()).href);
    assert.equal(await brand.evaluate((image) => image.complete && image.naturalWidth > 0), true);
    const iconResponse = await page.request.get(new URL(favicon, page.url()).href);
    assert.equal(iconResponse.ok(), true);
    assert.equal(await iconResponse.text(), fs.readFileSync(path.join(root, 'docs', 'space-explorer.svg'), 'utf8'));
    assert.equal((await page.locator('main').innerText()).includes(workspace), false);
    assert.doesNotMatch(await page.locator('body').innerText(), /\bworkspace\b/i);
    await page.getByRole('button', { name: /Scan everything/i }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.getByLabel('Theme').selectOption('light');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    async function checkContrast() {
      const ratios = await page.evaluate(() => {
        const styles = getComputedStyle(document.documentElement);
        const luminance = (name) => {
          const color = styles.getPropertyValue(name).trim().slice(1);
          const values = [0, 2, 4].map((index) => parseInt(color.slice(index, index + 2), 16) / 255)
            .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
        };
        const background = luminance('--surface');
        return ['--text', '--muted', '--primary'].map((name) => {
          const foreground = luminance(name);
          return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        });
      });
      assert.ok(ratios.every((ratio) => ratio >= 4.5), `Insufficient contrast: ${ratios}`);
    }
    await checkContrast();
    await page.reload();
    await page.getByText('demo', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Theme').inputValue(), 'light');
    await page.getByLabel('Theme').selectOption('system');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await checkContrast();
    await page.getByLabel('Filter projects or artifacts').fill('does-not-exist');
    await page.getByText('No projects match your filters.').waitFor();
    await page.getByLabel('Filter projects or artifacts').fill('');
    await page.getByLabel('Select all artifacts in demo').check();
    await page.getByRole('button', { name: /Clean selected/ }).click();
    await page.getByRole('dialog').getByText(artifact, { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.getByRole('button', { name: /Clean selected/ }).evaluate((element) => element === document.activeElement), true);
    await page.route('**/api/clean', (route) => route.fulfill({ json: { results: [{ success: false, error: 'fixture locked', path: artifact }] } }));
    await page.getByRole('button', { name: /Clean selected/ }).click();
    await page.getByLabel('Move to system trash when supported').uncheck();
    await page.getByRole('button', { name: 'Clean now' }).click();
    await page.getByRole('alert').getByText(/fixture locked/).waitFor();
    assert.equal(fs.existsSync(artifact), true);
    await page.unroute('**/api/clean');
    await page.getByRole('button', { name: /Clean selected/ }).click();
    await page.getByLabel('Move to system trash when supported').uncheck();
    await page.getByRole('button', { name: 'Clean now' }).click();
    await page.getByText('Cleanup completed.').waitFor();
    assert.equal(fs.existsSync(artifact), false);
    await page.getByRole('tab', { name: /Projects/ }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: /Caches/ }).getAttribute('aria-selected'), 'true');
    await page.getByText('NPM Cache').waitFor();
    await page.getByRole('tab', { name: /Rules/ }).click();
    await page.getByRole('button', { name: 'Add custom rule' }).click();
    await page.getByLabel('Pattern').fill('ui-test-cache');
    await page.getByRole('button', { name: 'Save rule' }).click();
    await page.getByText('ui-test-cache', { exact: true }).waitFor();
    await page.getByRole('button', { name: '+ .turbo' }).click();
    await page.getByRole('button', { name: 'Save rule' }).click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('td')).filter((cell) => cell.textContent === '.turbo').length === 2);
    await page.setViewportSize({ width: 375, height: 812 });
    assert.ok(await page.getByLabel('Rules configuration').locator('.table-wrap').evaluate((element) => element.scrollWidth > element.clientWidth));
    assert.equal(await page.getByLabel('Rules configuration').getByText('Scroll horizontally to see more').isVisible(), true);
    await page.getByRole('region', { name: 'Rules table' }).focus();
    assert.equal(await page.getByRole('region', { name: 'Rules table' }).evaluate((element) => element === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
    if (server.exitCode === null && server.signalCode === null) await new Promise((resolve) => server.once('exit', resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

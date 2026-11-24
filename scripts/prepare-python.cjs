const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const targets = {
  'win32-x64': ['x86_64-pc-windows-msvc', '93584a7bee14bf6b91a03efdbb128419147279a64934fbc95934c9f53e1191e5'],
  'darwin-x64': ['x86_64-apple-darwin', '4d723f281a8f3e4fec0d1c3efb756986226d66d163c071f550bc65949101222f'],
  'darwin-arm64': ['aarch64-apple-darwin', '4068a8a2355083e29f84138c1c6ce70654e5833424bbe79e63289031a11fd8b2']
};
const platform = process.argv[2] || process.platform;
const arch = process.argv[3] || process.arch;
const target = targets[`${platform}-${arch}`];
const runtimeDir = path.resolve(__dirname, '..', '.runtime');

async function main() {
  if (!target) throw new Error(`No bundled Python runtime for ${platform}-${arch}`);
  const [triple, expectedHash] = target;
  const name = `cpython-3.12.16+20261123-${triple}-install_only.tar.gz`;
  const url = `https://github.com/astral-sh/python-build-standalone/releases/download/20261123/${encodeURIComponent(name)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Python download failed: HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  const hash = crypto.createHash('sha256').update(archive).digest('hex');
  if (hash !== expectedHash) throw new Error(`Python archive checksum mismatch: ${hash}`);

  fs.mkdirSync(runtimeDir, { recursive: true });
  const archivePath = path.join(runtimeDir, 'python.tar.gz');
  fs.writeFileSync(archivePath, archive);
  try {
    fs.rmSync(path.join(runtimeDir, 'python'), { recursive: true, force: true });
    const result = spawnSync('tar', ['-xzf', archivePath, '-C', runtimeDir], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Python extraction failed: ${result.status}`);
  } finally {
    fs.rmSync(archivePath, { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

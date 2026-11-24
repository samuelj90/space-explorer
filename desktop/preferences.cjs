const fs = require('node:fs');
const path = require('node:path');

function isTheme(value) {
  return value === 'system' || value === 'light' || value === 'dark';
}

function readTheme(file) {
  let contents;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const data = JSON.parse(contents);
  if (!isTheme(data.theme)) throw new Error('Invalid saved theme');
  return data.theme;
}

function writeTheme(file, theme) {
  if (!isTheme(theme)) throw new Error('Invalid theme');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ theme }), 'utf8');
}

module.exports = { readTheme, writeTheme };

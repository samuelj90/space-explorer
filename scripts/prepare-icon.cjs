const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');

const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'docs', 'space-explorer.svg'));
const image = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng();
const output = path.join(root, 'build');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'icon.png'), image);

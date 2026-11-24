const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  root: 'ui',
  base: './',
  plugins: [react()],
  build: { outDir: '../ui-dist', emptyOutDir: true }
});

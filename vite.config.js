import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';

// Cada publicación lleva su propia versión del service worker, para que los móviles se actualicen
function versionServiceWorker() {
  return {
    name: 'mesa-version-sw',
    apply: 'build',
    closeBundle() {
      const ruta = 'dist/sw.js';
      const sw = readFileSync(ruta, 'utf8');
      writeFileSync(ruta, sw.replace('__VERSION__', Date.now().toString(36)));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), versionServiceWorker()],
  build: { target: 'es2020' },
});

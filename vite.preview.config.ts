// Build « aperçu » : un seul fichier HTML, mode local, sans service worker
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_NO_SW': '"1"' },
  build: { outDir: 'dist-preview', assetsInlineLimit: 100000000 }
});

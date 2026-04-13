import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/adif/',
  build: {
    outDir: '../adif',
    emptyOutDir: true,
  },
  server: {
    port: 3002,
  },
});

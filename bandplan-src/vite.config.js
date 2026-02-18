import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    open: true
  },
  base: '/bandplan/',
  build: {
    outDir: '../bandplan',
    emptyOutDir: true,
    sourcemap: false
  }
})

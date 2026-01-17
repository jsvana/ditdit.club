import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  base: '/prop/',
  build: {
    outDir: '../prop',
    emptyOutDir: true,
    sourcemap: false
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  base: '/prop/',
  build: {
    outDir: resolve(__dirname, '../prop'),
    emptyOutDir: true,
    sourcemap: false
  }
})

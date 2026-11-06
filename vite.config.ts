import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Las pruebas con mucha interacción (p. ej. el calendario) rondan los 5 s por defecto
    // cuando corren en paralelo; Vercel ejecuta `npm test` antes del build y no debe fallar por lentitud.
    testTimeout: 15_000,
  },
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

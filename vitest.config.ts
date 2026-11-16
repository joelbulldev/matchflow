import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'resources/app/src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./resources/app/src/test/setup.ts'],
    include: ['resources/app/src/**/*.test.{ts,tsx}'],
  },
})

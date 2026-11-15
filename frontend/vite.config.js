import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // the online demo is served from alichaaraoui.com/return-trip/
    base: env.VITE_BASE || '/',
    build: { target: 'es2022' },
    plugins: [react()],
    server: {
      port: 5173,
      // Flask backend. Defaults to 5000; on macOS AirPlay Receiver owns 5000, so set
      // VITE_API_TARGET=http://localhost:5050 in .env.local and run flask on 5050.
      proxy: { '/api': env.VITE_API_TARGET || 'http://localhost:5000' },
    },
  }
})

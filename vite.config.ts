import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, the Vite web build runs on :5173 and the API on :4000. We proxy
// `/api/*` from Vite to the API so the frontend can use a same-origin base
// URL (`/api`) and the browser sends the session cookie without CORS.
//
// In production the same path is served by Caddy (or any reverse proxy), so
// the frontend never has to know about an absolute API URL.
const DEV_API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: DEV_API_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
   css: {
    devSourcemap: true // <-- THIS IS THE MAGIC LINE
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2021',
    minify: !process.env.TAURI_DEBUG,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})



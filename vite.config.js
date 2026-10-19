import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// Dev me browser CORS se bachne ke liye /__base aur /__live proxy use hota hai.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = new URL(env.VITE_API_BASE_URL || 'http://localhost/sss/')
  const live = new URL(env.VITE_API_LIVE_URL || 'https://gateway.streetstylestore.com')
  const strip = (p) => p.replace(/\/+$/, '')
  return {
    plugins: [vue()],
    server: {
      port: 5173,
      proxy: {
        '/__base': { target: base.origin, changeOrigin: true, rewrite: (p) => p.replace(/^\/__base/, strip(base.pathname)) },
        '/__live': { target: live.origin, changeOrigin: true, secure: true, rewrite: (p) => p.replace(/^\/__live/, strip(live.pathname)) }
      }
    }
  }
})

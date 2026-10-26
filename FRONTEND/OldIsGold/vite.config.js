import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  let publicOrigin = ''
  try { publicOrigin = new URL(env.VITE_SITE_URL).origin } catch { /* Use the current origin at runtime. */ }

  return {
    server: {
      proxy: {
        '/api': 'http://localhost:5000',
        '/socket.io': { target: 'http://localhost:5000', ws: true },
      },
    },
    plugins: [
      react(),
      {
        name: 'campusmart-social-image-origin',
        transformIndexHtml(html) {
          return publicOrigin
            ? html.replaceAll('content="/campusmart-512.png"', `content="${publicOrigin}/campusmart-512.png"`)
            : html
        },
      },
      VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['favicon-campusmart.svg', 'offline.html'],
      manifest: {
        id: '/',
        name: 'CampusMart',
        short_name: 'CampusMart',
        description: 'CampusMart: the marketplace and community for your campus.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1d6b4d',
        background_color: '#f5f3ec',
        icons: [
          {
            src: '/campusmart-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/campusmart-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/campusmart-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      }),
    ],
  }
})

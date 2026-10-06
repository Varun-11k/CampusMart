import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'CampusMart',
        short_name: 'CampusMart',
        description: 'Campus marketplace and student community app',
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
          },
          {
            src: '/campusmart-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
      },
    }),
  ],
})

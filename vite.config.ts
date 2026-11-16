import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Repo name on GitHub Pages: https://<username>.github.io/math-notepad/
  base: '/math-notepad/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Math Notepad',
        short_name: 'MathPad',
        description: 'Handwriting math notepad with step-by-step solutions.',
        theme_color: '#1e1e2e',
        background_color: '#1e1e2e',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/math-notepad/',
        scope: '/math-notepad/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
})

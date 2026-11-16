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
        // Not locking orientation to "landscape" here: if the OS rotation
        // lock disagrees with this, Chrome can apply a CSS rotation to the
        // page while touch/pen coordinates stay in the physical (unrotated)
        // frame, producing a sideways pen/ink mismatch. The app can still
        // be designed landscape-first without forcing this at the OS level.
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

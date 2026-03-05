import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'YouTube Tracker',
    description: 'Track your progress on Youtube videos',
    permissions: ['storage'],
    host_permissions: ['*://*.youtube.com/*'],
    icons: {
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    browser_specific_settings: {
      gecko: {
        id: 'youtube-tracker@example.com',
        strict_min_version: '109.0',
      },
    },
  },
})

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
    description: 'Automatically saves your progress on YouTube videos and resumes from where you left off.',
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

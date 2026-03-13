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
    short_name: 'YT Tracker',
    description: 'Automatically saves your progress on YouTube videos and resumes from where you left off.',
    permissions: ['storage'],
    host_permissions: ['*://*.youtube.com/*'],
    icons: {
      16: 'icon-16.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    action: {
      default_title: 'YouTube Tracker — click to view saved progress',
    },
    browser_specific_settings: {
      gecko: {
        id: 'youtube-tracker@franverona.com',
        strict_min_version: '109.0',
      },
    },
  },
})

import { trackingEnabledItem, videoStorageItem } from '@/storage'

export default defineBackground(() => {
  let videoCount = 0
  let trackingEnabled = true

  function updateBadge() {
    if (!trackingEnabled) {
      browser.action.setBadgeText({ text: '❚❚' })
      browser.action.setBadgeBackgroundColor({ color: '#9CA3AF' })
      browser.action.setTitle({ title: 'YouTube Tracker — paused, click to resume' })
      return
    }
    browser.action.setBadgeText({ text: videoCount > 0 ? String(videoCount) : '' })
    browser.action.setBadgeBackgroundColor({ color: '#FF0000' })
    browser.action.setTitle({ title: 'YouTube Tracker — click to view saved progress' })
  }
  browser.action.setBadgeTextColor({ color: '#fff' })

  videoStorageItem.getValue().then((state) => {
    videoCount = Object.keys(state).length
    updateBadge()
  })
  videoStorageItem.watch((state) => {
    videoCount = Object.keys(state).length
    updateBadge()
  })

  trackingEnabledItem.getValue().then((enabled) => {
    trackingEnabled = enabled
    updateBadge()
  })
  trackingEnabledItem.watch((enabled) => {
    trackingEnabled = enabled
    updateBadge()
  })

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'toggle-tracking') return
    const enabled = await trackingEnabledItem.getValue()
    await trackingEnabledItem.setValue(!enabled)
  })
})

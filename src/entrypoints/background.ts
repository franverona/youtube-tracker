import {
  applyVideoStorageWrite,
  isVideoStorageWrite,
  trackingEnabledItem,
  videoStorageItem,
} from '@/storage'

export default defineBackground(() => {
  // Firefox MV2 only has `browserAction`.
  const action = browser.action ?? browser.browserAction
  let videoCount = 0
  let trackingEnabled = true

  function updateBadge() {
    if (!trackingEnabled) {
      action.setBadgeText({ text: '❚❚' })
      action.setBadgeBackgroundColor({ color: '#9CA3AF' })
      action.setTitle({ title: 'YouTube Tracker — paused, click to resume' })
      return
    }
    action.setBadgeText({ text: videoCount > 0 ? String(videoCount) : '' })
    action.setBadgeBackgroundColor({ color: '#FF0000' })
    action.setTitle({ title: 'YouTube Tracker — click to view saved progress' })
  }
  action.setBadgeTextColor({ color: '#fff' })

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isVideoStorageWrite(message)) return
    applyVideoStorageWrite(message).then(
      () => sendResponse(),
      () => sendResponse(),
    )
    return true
  })

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

  // MV3 only wakes the service worker at browser launch if this listener exists;
  // the setup above then restores the badge, which Chrome doesn't persist.
  browser.runtime.onStartup.addListener(() => {})

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'toggle-tracking') return
    const enabled = await trackingEnabledItem.getValue()
    await trackingEnabledItem.setValue(!enabled)
  })
})

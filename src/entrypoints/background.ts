import { videoStorageItem } from '@/storage'

export default defineBackground(() => {
  function updateBadge(count: number) {
    const text = count > 0 ? String(count) : ''
    browser.action.setBadgeText({ text })
    browser.action.setBadgeBackgroundColor({ color: '#FF0000' })
    browser.action.setBadgeTextColor({ color: '#fff' })
  }

  videoStorageItem.getValue().then((state) => {
    updateBadge(Object.keys(state).length)
  })

  videoStorageItem.watch((state) => {
    updateBadge(Object.keys(state).length)
  })
})

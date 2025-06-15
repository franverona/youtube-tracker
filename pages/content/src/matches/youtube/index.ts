import { getVideoElement, getVideoId, loadProgress, saveProgress } from './utils'

let currentVideoId: string | null = null
let currentVideoElement: HTMLVideoElement | null = null
let saveInterval: NodeJS.Timeout | null = null

async function saveCurrent() {
  if (!currentVideoId || !currentVideoElement) {
    return
  }
  await saveProgress(currentVideoId, currentVideoElement.currentTime)
}

async function initializeVideoTracking() {
  if (saveInterval) {
    console.log('Clear current interval when setting a new one')
    clearInterval(saveInterval) // Clear any existing interval
  }

  const newVideoId = getVideoId()
  const newVideoElement = getVideoElement()
  if (!newVideoId || !newVideoElement) {
    console.warn('Could not find video ID or video element on this page.')
    return
  }

  // Only re-initialize if the video ID has actually changed
  if (newVideoId === currentVideoId) {
    return
  }

  currentVideoId = newVideoId
  currentVideoElement = newVideoElement

  // Initial attempt to load progress as soon as the video element is available
  // This is important because YouTube's player might already be loading data.
  await loadProgress(currentVideoId, currentVideoElement)

  currentVideoElement.addEventListener('loadedmetadata', async function listener() {
    if (!currentVideoId || !currentVideoElement) {
      return
    }

    await loadProgress(currentVideoId, currentVideoElement)
    // You might choose to remove this listener after the first successful attempt
    // to avoid redundant calls, but the `trySetCurrentTime` in `loadProgress` handles removal.
  })

  // Determine the save interval based on video duration
  const setSaveInterval = () => {
    if (!currentVideoId || !currentVideoElement) {
      return
    }

    // Get video duration. It might not be available immediately, so wait for loadedmetadata or similar.
    // We can rely on the 'loadedmetadata' event listener further down.
    const durationInSeconds = currentVideoElement.duration

    const shortVideoThreshold = 15 * 60 // 15 minutes in seconds
    let currentSaveDelay = 5000 // Default to 5 seconds (5000ms)

    if (durationInSeconds && durationInSeconds > shortVideoThreshold) {
      currentSaveDelay = 30000 // 30 seconds (30000ms)
      console.log(`Video is long (${durationInSeconds}s > ${shortVideoThreshold}s), saving every 30 seconds.`)
    }

    console.log('Set new interval')
    saveInterval = setInterval(async () => {
      await saveCurrent()
    }, currentSaveDelay)
  }

  currentVideoElement.addEventListener('play', function () {
    setSaveInterval()
  })

  currentVideoElement.addEventListener('pause', async function () {
    if (saveInterval) {
      clearInterval(saveInterval)
      saveInterval = null
    }

    await saveCurrent()
  })

  currentVideoElement.addEventListener('ended', function () {
    if (saveInterval) {
      clearInterval(saveInterval)
      saveInterval = null
    }

    if (!currentVideoId || !currentVideoElement) {
      return
    }

    // Optionally, remove the stored progress for this video when it ends
    chrome.storage.local.remove(currentVideoId, function () {
      if (chrome.runtime.lastError) {
        console.error('Error removing progress:', chrome.runtime.lastError)
      } else {
        console.log(`Progress for video ${currentVideoId} cleared as it ended.`)
      }
    })
  })

  currentVideoElement.addEventListener('loadedmetadata', setSaveInterval)

  // Also save progress when the tab is closed or navigated away from
  window.addEventListener('beforeunload', async function () {
    await saveCurrent()
  })
}

// --- Observe URL Changes and DOM for Video Element ---

// 1. Observe URL changes (YouTube doesn't trigger 'popstate' for internal navigation reliably)
// MutationObserver on the title or body can indicate URL change.
// A simpler way often used is to periodically check the URL or use specific YouTube events.
let lastKnownUrl = window.location.href

const urlChangeObserver = new MutationObserver(() => {
  if (window.location.href !== lastKnownUrl) {
    lastKnownUrl = window.location.href
    // Check if it's still a YouTube watch page
    if (lastKnownUrl.includes('youtube.com/watch')) {
      // Give YouTube a moment to update the DOM with the new video player
      setTimeout(initializeVideoTracking, 500) // Small delay
    } else {
      // If navigated away from YouTube watch page, stop tracking
      if (saveInterval) {
        clearInterval(saveInterval)
        saveInterval = null
      }
      currentVideoId = null
      currentVideoElement = null
      console.log('Navigated away from YouTube watch page, stopping tracking.')
    }
  }
})

// Observe changes in the document title or body attributes, which often change with URL
urlChangeObserver.observe(document.head, { childList: true, subtree: true, attributes: true, characterData: true })
urlChangeObserver.observe(document.body, { childList: true, subtree: true, attributes: true })

//initializeVideoTracking()

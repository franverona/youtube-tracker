import { getVideoElement, getVideoId, loadProgress, saveProgress } from './utils'

async function initContent() {
  const videoId = getVideoId()
  const videoElement = getVideoElement()

  if (!videoId || !videoElement) {
    console.warn('Could not find video ID or video element on this page.')
    return
  }

  // Initial attempt to load progress as soon as the video element is available
  // This is important because YouTube's player might already be loading data.
  await loadProgress(videoId, videoElement)

  videoElement.addEventListener('loadedmetadata', async function listener() {
    await loadProgress(videoId, videoElement)
    // You might choose to remove this listener after the first successful attempt
    // to avoid redundant calls, but the `trySetCurrentTime` in `loadProgress` handles removal.
  })

  // Save progress every few seconds (e.g., every 5 seconds)
  let saveInterval: NodeJS.Timeout | null = null

  // Determine the save interval based on video duration
  const setSaveInterval = () => {
    if (saveInterval) {
      clearInterval(saveInterval) // Clear any existing interval
    }

    // Get video duration. It might not be available immediately, so wait for loadedmetadata or similar.
    // We can rely on the 'loadedmetadata' event listener further down.
    const durationInSeconds = videoElement.duration

    const shortVideoThreshold = 15 * 60 // 15 minutes in seconds
    let currentSaveDelay = 5000 // Default to 5 seconds (5000ms)

    if (durationInSeconds && durationInSeconds > shortVideoThreshold) {
      currentSaveDelay = 30000 // 30 seconds (30000ms)
      console.log(`Video is long (${durationInSeconds}s > ${shortVideoThreshold}s), saving every 30 seconds.`)
    }

    saveInterval = setInterval(async () => {
      await saveProgress(videoId, videoElement.currentTime)
    }, currentSaveDelay)
  }

  videoElement.addEventListener('play', function () {
    setSaveInterval()
  })

  videoElement.addEventListener('pause', async function () {
    if (saveInterval) {
      clearInterval(saveInterval)
      saveInterval = null
    }
    await saveProgress(videoId, videoElement.currentTime) // Save immediately on pause
  })

  videoElement.addEventListener('ended', function () {
    if (saveInterval) {
      clearInterval(saveInterval)
      saveInterval = null
    }
    // Optionally, remove the stored progress for this video when it ends
    chrome.storage.local.remove(videoId, function () {
      if (chrome.runtime.lastError) {
        console.error('Error removing progress:', chrome.runtime.lastError)
      } else {
        console.log(`Progress for video ${videoId} cleared as it ended.`)
      }
    })
  })

  videoElement.addEventListener('loadedmetadata', setSaveInterval)

  // Also save progress when the tab is closed or navigated away from
  window.addEventListener('beforeunload', async function () {
    await saveProgress(videoId, videoElement.currentTime)
  })
}

await initContent()

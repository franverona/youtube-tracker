import { getVideoElement, getVideoId, loadProgress, saveProgress } from './utils'

let currentVideoId: string | null = null
let currentVideoElement: HTMLVideoElement | null = null
let saveInterval: NodeJS.Timeout | null = null
let initializationAttempts = 0
const MAX_INITIALIZATION_ATTEMPTS: number = 20 // Try up to 10 seconds (20 * 500ms)
const INITIALIZATION_RETRY_DELAY: number = 500 // 0.5 seconds

async function saveCurrent() {
  if (!currentVideoId || !currentVideoElement) {
    return
  }
  await saveProgress(currentVideoId, currentVideoElement.currentTime)
}

async function initializeVideoTracking() {
  const newVideoId = getVideoId()
  const newVideoElement = getVideoElement()
  if (!newVideoId || !newVideoElement || !window.location.href.includes('youtube.com/watch')) {
    if (saveInterval) {
      clearInterval(saveInterval)
      saveInterval = null
    }

    if (currentVideoId !== null) {
      console.log('Navigated away from YouTube watch page or elements not found, stopping tracking.')
      currentVideoId = null
      currentVideoElement = null
    }
    initializationAttempts = 0 // Reset attempts if we're off YouTube
    return
  }

  // If the video ID hasn't changed, and we're already tracking it, do nothing.
  // This prevents redundant re-initializations for the same video.
  if (newVideoId === currentVideoId && currentVideoElement === newVideoElement) {
    initializationAttempts = 0 // Reset attempts as we are stable
    return
  }

  // Clear any existing interval and listeners for the *old* video/state
  if (saveInterval) {
    clearInterval(saveInterval)
    saveInterval = null
  }

  currentVideoId = newVideoId
  currentVideoElement = newVideoElement
  initializationAttempts = 0 // Reset attempts on successful (re)initialization

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

// --- Resilient Initialization with Retries ---
function attemptInitializationWithRetry() {
  if (initializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
    initializeVideoTracking()
    initializationAttempts++
    // If not yet tracking a video, retry shortly
    if (currentVideoId === null || currentVideoElement === null) {
      setTimeout(attemptInitializationWithRetry, INITIALIZATION_RETRY_DELAY)
    }
  } else {
    console.warn(`Stopped attempting initialization after ${MAX_INITIALIZATION_ATTEMPTS} attempts.`)
  }
}

// --- Event Listeners for Page Navigation and Initial Load ---

// 1. Listen for YouTube's own custom events (more reliable for SPA navigation)
// YouTube often dispatches custom events when the page or video changes.
// The `yt-navigate-finish` event is commonly used for this.
document.addEventListener('yt-navigate-finish', () => {
  console.log('yt-navigate-finish event detected. Attempting re-initialization.')
  initializationAttempts = 0 // Reset attempts on navigation
  setTimeout(attemptInitializationWithRetry, INITIALIZATION_RETRY_DELAY) // Add a small delay
})

// 2. Fallback: Listen for browser's popstate event (for back/forward button)
window.addEventListener('popstate', () => {
  // This fires on back/forward. Check if we're on a YouTube watch page.
  if (window.location.href.includes('youtube.com/watch')) {
    console.log('Popstate event detected. Attempting re-initialization.')
    initializationAttempts = 0 // Reset attempts on navigation
    setTimeout(attemptInitializationWithRetry, INITIALIZATION_RETRY_DELAY) // Add a small delay
  }
})

// 3. Initial load of the content script
// This handles cases where the user opens a YouTube tab directly.
console.log('Content script loaded. Initializing tracking...')
initializationAttempts = 0 // Ensure attempts are reset on script load
setTimeout(attemptInitializationWithRetry, 500) // Give the page a moment to render

// 4. Save progress on tab/window close
window.addEventListener('beforeunload', async function () {
  await saveCurrent()
  if (saveInterval) {
    clearInterval(saveInterval)
    saveInterval = null
  }
})

import { videoStorage } from '../storage/videoStorage'
import { loadProgress, saveProgress } from './content/videoUtils'
import { getVideoElement, getVideoId } from './content/youtubeUtils'

export default defineContentScript({
  matches: ['*://*.youtube.com/watch*'],
  main() {
    let currentVideoId: string | null = null
    let currentVideoElement: HTMLVideoElement | null = null
    let saveInterval: ReturnType<typeof setInterval> | null = null
    let initializationAttempts = 0
    const MAX_INITIALIZATION_ATTEMPTS = 20
    const INITIALIZATION_RETRY_DELAY = 500

    function teardown() {
      if (saveInterval) {
        clearInterval(saveInterval)
        saveInterval = null
      }
    }

    async function saveCurrent() {
      if (!currentVideoId || !currentVideoElement) return
      await saveProgress(currentVideoId, currentVideoElement.currentTime)
    }

    async function initializeVideoTracking() {
      const newVideoId = getVideoId()
      const newVideoElement = getVideoElement()

      if (!newVideoId || !newVideoElement || !window.location.href.includes('youtube.com/watch')) {
        teardown()
        if (currentVideoId !== null) {
          currentVideoId = null
          currentVideoElement = null
        }
        return
      }

      if (newVideoId === currentVideoId && currentVideoElement === newVideoElement) {
        initializationAttempts = 0
        return
      }

      teardown()

      currentVideoId = newVideoId
      currentVideoElement = newVideoElement
      initializationAttempts = 0

      await loadProgress(currentVideoId, currentVideoElement)

      currentVideoElement.addEventListener('loadedmetadata', async () => {
        if (!currentVideoId || !currentVideoElement) return
        await loadProgress(currentVideoId, currentVideoElement)
      })

      const setSaveInterval = () => {
        teardown()
        if (!currentVideoId || !currentVideoElement) return

        const durationInSeconds = currentVideoElement.duration
        const shortVideoThreshold = 15 * 60
        const currentSaveDelay = durationInSeconds && durationInSeconds > shortVideoThreshold ? 30000 : 5000

        saveInterval = setInterval(async () => {
          await saveCurrent()
        }, currentSaveDelay)
      }

      currentVideoElement.addEventListener('play', () => {
        setSaveInterval()
      })

      currentVideoElement.addEventListener('pause', async () => {
        teardown()
        await saveCurrent()
      })

      currentVideoElement.addEventListener('ended', async () => {
        teardown()
        if (currentVideoId) {
          await videoStorage.remove(currentVideoId)
        }
      })

      currentVideoElement.addEventListener('loadedmetadata', setSaveInterval)
    }

    async function attemptInitializationWithRetry() {
      if (initializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
        await initializeVideoTracking()
        initializationAttempts++
        if (currentVideoId === null || currentVideoElement === null) {
          setTimeout(attemptInitializationWithRetry, INITIALIZATION_RETRY_DELAY)
        }
      }
    }

    document.addEventListener('yt-navigate-finish', () => {
      initializationAttempts = 0
      setTimeout(attemptInitializationWithRetry, INITIALIZATION_RETRY_DELAY)
    })

    window.addEventListener('popstate', () => {
      if (window.location.href.includes('youtube.com/watch')) {
        initializationAttempts = 0
        setTimeout(attemptInitializationWithRetry, INITIALIZATION_RETRY_DELAY)
      }
    })

    setTimeout(attemptInitializationWithRetry, 500)
  },
})

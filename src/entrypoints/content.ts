import { videoStorage } from '../storage/videoStorage'
import { loadProgress, saveProgress } from './content/videoUtils'
import { getVideoElement, getVideoId } from './content/youtubeUtils'

export default defineContentScript({
  matches: ['*://*.youtube.com/watch*'],
  main() {
    let currentVideoId: string | null = null
    let currentVideoElement: HTMLVideoElement | null = null
    let saveInterval: ReturnType<typeof setInterval> | null = null
    let videoListenerController: AbortController | null = null
    let initializationAttempts = 0
    const MAX_INITIALIZATION_ATTEMPTS = 20
    const INITIALIZATION_RETRY_DELAY = 500

    function clearSaveInterval() {
      if (saveInterval) {
        clearInterval(saveInterval)
        saveInterval = null
      }
    }

    function teardown() {
      clearSaveInterval()
      if (videoListenerController) {
        videoListenerController.abort()
        videoListenerController = null
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
      videoListenerController = new AbortController()
      const { signal } = videoListenerController

      await loadProgress(currentVideoId, currentVideoElement)

      const setSaveInterval = () => {
        clearSaveInterval()
        if (!currentVideoId || !currentVideoElement) return

        const durationInSeconds = currentVideoElement.duration
        const shortVideoThreshold = 15 * 60
        const currentSaveDelay = durationInSeconds && durationInSeconds > shortVideoThreshold ? 30000 : 5000

        saveInterval = setInterval(async () => {
          await saveCurrent()
        }, currentSaveDelay)
      }

      currentVideoElement.addEventListener('play', () => setSaveInterval(), { signal })
      currentVideoElement.addEventListener('pause', async () => {
        clearSaveInterval()
        await saveCurrent()
      }, { signal })
      currentVideoElement.addEventListener('ended', async () => {
        clearSaveInterval()
        if (currentVideoId) {
          await videoStorage.remove(currentVideoId)
        }
      }, { signal })
      currentVideoElement.addEventListener('loadedmetadata', setSaveInterval, { signal })
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

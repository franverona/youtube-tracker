import { trackingEnabledItem, videoStorage } from '@/storage'
import { loadProgress, saveProgress } from './content/videoUtils'
import { getVideoElement, getVideoId } from './content/youtubeUtils'

export default defineContentScript({
  // Content scripts are only injected on full page loads, and YouTube reaches
  // most videos via in-page navigation, so match every page and let
  // initializeVideoTracking() bail outside /watch.
  matches: ['https://*.youtube.com/*'],
  async main() {
    // Awaited so a hard-loaded watch page doesn't resume while tracking is paused.
    let isTrackingEnabled = await trackingEnabledItem.getValue()
    trackingEnabledItem.watch((v) => {
      isTrackingEnabled = v
    })

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

    // False when tracking is paused, the extension was reloaded (orphaned
    // script), or YouTube already swapped the reused <video> to the next video
    // but re-init hasn't run yet — saving then would write B's time under A.
    function canWrite(): boolean {
      if (!browser.runtime?.id) {
        teardown()
        return false
      }
      return isTrackingEnabled && !!currentVideoId && getVideoId() === currentVideoId
    }

    async function saveCurrent() {
      if (!canWrite() || !currentVideoId || !currentVideoElement) return
      const { currentTime, duration } = currentVideoElement
      // Live streams have no meaningful offset to resume to.
      if (!isFinite(duration)) return
      try {
        // In the last 5% (capped at 60s, i.e. credits / end screen) treat the
        // video as finished, like `ended`: people often leave without letting
        // it reach the real end, and resume would skip that spot anyway.
        if (duration - currentTime < Math.min(duration * 0.05, 60)) {
          if (await videoStorage.getById(currentVideoId)) await videoStorage.remove(currentVideoId)
          return
        }
        await saveProgress(currentVideoId, currentTime, duration)
      } catch (e) {
        console.warn('saveCurrent: failed to save progress:', e)
      }
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

      if (isTrackingEnabled) {
        await loadProgress(currentVideoId, currentVideoElement, signal)
      }

      const setSaveInterval = () => {
        clearSaveInterval()
        if (!currentVideoId || !currentVideoElement) return

        const durationInSeconds = currentVideoElement.duration
        const shortVideoThreshold = 15 * 60
        const currentSaveDelay =
          durationInSeconds && durationInSeconds > shortVideoThreshold ? 30000 : 5000

        saveInterval = setInterval(async () => {
          await saveCurrent()
        }, currentSaveDelay)
      }

      currentVideoElement.addEventListener('play', () => setSaveInterval(), { signal })
      currentVideoElement.addEventListener(
        'pause',
        async () => {
          clearSaveInterval()
          await saveCurrent()
        },
        { signal },
      )
      currentVideoElement.addEventListener(
        'ended',
        async () => {
          clearSaveInterval()
          if (!canWrite() || !currentVideoId) return
          try {
            await videoStorage.remove(currentVideoId)
          } catch (e) {
            console.warn('ended: failed to remove video:', e)
          }
        },
        { signal },
      )
      currentVideoElement.addEventListener(
        'loadedmetadata',
        () => {
          if (currentVideoElement && !currentVideoElement.paused) setSaveInterval()
        },
        { signal },
      )

      if (!currentVideoElement.paused) {
        setSaveInterval()
      }
    }

    async function attemptInitializationWithRetry() {
      if (!browser.runtime?.id) return
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

    // Handle the case where yt-navigate-finish already fired before this listener
    // was registered (e.g. fresh tab, hard reload, or slow extension injection).
    attemptInitializationWithRetry()
  },
})

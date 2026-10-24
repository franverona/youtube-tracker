import { videoStorage, type VideoDetails } from '@/storage'
import { getVideoId, getVideoTitle } from './youtubeUtils'

// Skip previews and misclicks so they don't clutter the list and badge.
export const MIN_SAVED_PROGRESS = 15

export async function saveProgress(videoId: string, progress: number, duration?: number) {
  if (!videoId || isNaN(progress) || progress < 0) {
    console.warn('saveProgress: Missing video ID or current time.')
    return
  }
  if (progress < MIN_SAVED_PROGRESS) return

  const videoDetails: VideoDetails = {
    id: videoId,
    progress,
    duration: duration && isFinite(duration) ? duration : undefined,
    timestamp: Date.now(),
    title: getVideoTitle(),
    url: `https://www.youtube.com/watch?v=${videoId}`,
  }
  await videoStorage.save(videoId, videoDetails)
}

export async function loadProgress(
  videoId: string,
  videoElement: HTMLVideoElement,
  signal?: AbortSignal,
) {
  if (!videoId || !videoElement) {
    console.warn('loadProgress: Missing video ID or video element.')
    return
  }

  // An explicit start time in the link wins over the saved position.
  const params = new URLSearchParams(window.location.search)
  if (params.has('t') || params.has('start')) return

  const videoDetails = await videoStorage.getById(videoId)
  if (!videoDetails) return

  const { progress } = videoDetails
  if (progress <= 0) return

  const trySetProgress = () => {
    // Stale listener: the tracker moved on, or YouTube already loaded another
    // video into this reused element.
    if (signal?.aborted || getVideoId() !== videoId) return
    // HAVE_CURRENT_DATA: seeking before this is unreliable.
    if (videoElement.readyState < 2) return

    videoElement.removeEventListener('loadeddata', trySetProgress)
    videoElement.removeEventListener('canplaythrough', trySetProgress)
    videoElement.removeEventListener('loadedmetadata', trySetProgress)

    // Live streams: stay at the live edge.
    if (!isFinite(videoElement.duration)) return
    // Within 5s of the end: let it start over instead of landing on the end screen.
    if (videoElement.duration - progress < 5) return

    videoElement.currentTime = progress

    if (videoElement.paused && progress > 1) {
      videoElement.play().catch((e) => {
        console.warn('loadProgress: Autoplay prevented:', e)
      })
    }
  }

  videoElement.addEventListener('loadeddata', trySetProgress, { signal })
  videoElement.addEventListener('canplaythrough', trySetProgress, { signal })
  videoElement.addEventListener('loadedmetadata', trySetProgress, { signal })

  trySetProgress()
}

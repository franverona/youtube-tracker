import { videoStorage, type VideoDetails } from '../../storage/videoStorage'
import { getVideoTitle } from './youtubeUtils'

export async function saveProgress(videoId: string, progress: number) {
  if (!videoId || isNaN(progress) || progress < 0) {
    console.warn('saveProgress: Missing video ID or current time.')
    return
  }

  const videoDetails: VideoDetails = {
    id: videoId,
    progress,
    timestamp: Date.now(),
    title: getVideoTitle(),
    url: `https://www.youtube.com/watch?v=${videoId}`,
  }
  await videoStorage.save(videoId, videoDetails)
}

export async function loadProgress(videoId: string, videoElement: HTMLVideoElement) {
  if (!videoId || !videoElement) {
    console.warn('loadProgress: Missing video ID or video element.')
    return
  }

  const videoDetails = await videoStorage.getById(videoId)
  if (!videoDetails) return

  const { progress } = videoDetails
  if (progress <= 0) return

  const trySetProgress = () => {
    if (videoElement.readyState >= 2) {
      if (videoElement.duration && videoElement.duration - progress < 5) {
        return
      }

      videoElement.currentTime = progress

      if (videoElement.paused && progress > 1) {
        videoElement.play().catch((e) => {
          console.warn('loadProgress: Autoplay prevented:', e)
        })
      }

      videoElement.removeEventListener('loadeddata', trySetProgress)
      videoElement.removeEventListener('canplaythrough', trySetProgress)
      videoElement.removeEventListener('loadedmetadata', trySetProgress)
    }
  }

  videoElement.addEventListener('loadeddata', trySetProgress)
  videoElement.addEventListener('canplaythrough', trySetProgress)
  videoElement.addEventListener('loadedmetadata', trySetProgress)

  trySetProgress()
}

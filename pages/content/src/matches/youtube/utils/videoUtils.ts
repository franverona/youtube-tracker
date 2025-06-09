import { videoStorage } from '@extension/storage'
import type { VideoDetails } from '@extension/storage/lib/base'
import { getVideoTitle } from './youtubeUtils'

// Function to save current progress
export async function saveProgress(videoId: string, progress: number) {
  if (!videoId || progress === null) {
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

// Function to load and set progress
export async function loadProgress(videoId: string, videoElement: HTMLVideoElement) {
  if (!videoId || !videoElement) {
    console.warn('loadProgress: Missing video ID or video element.')
    return
  }

  const videoDetails = await videoStorage.getById(videoId)
  if (!videoDetails) {
    return
  }

  const { progress } = videoDetails
  if (progress <= 0) {
    return
  }

  // We need to wait until the video is ready to be played/seeked
  // loadeddata ensures enough data to play, but canplaythrough is even better for seeking without buffering issues
  const trySetProgress = () => {
    if (videoElement.readyState >= 2) {
      // HTMLMediaElement.HAVE_CURRENT_DATA or higher
      // Check if progress is not very close to the end of the video
      // Prevents resetting to almost finished videos
      if (videoElement.duration && videoElement.duration - progress < 5) {
        // e.g., within 5 seconds of end
        console.log(
          `loadProgress: Saved time (${progress}) is too close to end (${videoElement.duration}), not setting.`,
        )
        return
      }

      videoElement.currentTime = progress
      console.log(`loadProgress: Successfully set currentTime for ${videoId} to ${progress}`)

      // Optional: Try to play the video if it's paused and not at the very beginning
      // This might be blocked by autoplay policies unless user interaction occurs.
      // Consider adding a small delay if it doesn't work immediately.
      if (videoElement.paused && progress > 1) {
        // Don't autoplay from 0
        videoElement.play().catch((e) => {
          console.warn('loadProgress: Autoplay prevented:', e)
          // Inform the user that autoplay was prevented, or show a play button.
        })
      }

      // Remove the event listener once the time is set
      videoElement.removeEventListener('loadeddata', trySetProgress)
      videoElement.removeEventListener('canplaythrough', trySetProgress)
      videoElement.removeEventListener('loadedmetadata', trySetProgress) // Also remove this one
    } else {
      console.log(`loadProgress: Video not ready yet (readyState: ${videoElement.readyState}). Waiting...`)
    }
  }

  // Add listeners to try setting time once the video is ready
  // loadeddata might be sufficient, canplaythrough is safer but might take longer.
  // We add all and let the first one that fires correctly set the time.
  videoElement.addEventListener('loadeddata', trySetProgress)
  videoElement.addEventListener('canplaythrough', trySetProgress)
  videoElement.addEventListener('loadedmetadata', trySetProgress) // Keep this as a first attempt

  // Immediately try if already ready (e.g., if event fired before listener attached)
  trySetProgress()
}

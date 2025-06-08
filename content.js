// Function to get the video ID from the URL
function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('v')
}

// Function to get the video element
function getVideoElement() {
  return document.querySelector('video')
}

// Get the video title from the page
// YouTube typically puts the title in a <title> tag or a specific H1 element.
// We'll try the H1 first, then fallback to document.title
function getVideoTitle() {
  // Modern YouTube selectors
  const titleElement = document.querySelector(
    'h1.ytd-watch-metadata, h1.ytd-video-primary-info-renderer'
  )
  if (titleElement?.innerText) {
    return titleElement.innerText.trim()
  }

  if (document.title) {
    // Fallback to document.title, often includes " - YouTube" which you might want to strip
    return document.title.replace(/ - YouTube$/, '').trim()
  }

  return 'Unknown Title'
}

// Function to save current progress
function saveProgress(videoId, currentTime) {
  if (!videoId || currentTime === null) {
    console.warn('saveProgress: Missing video ID or current time.')
    return
  }

  const videoData = {
    currentTime: currentTime,
    title: getVideoTitle(),
    timestamp: Date.now(),
    url: `https://www.youtube.com/watch?v=${videoId}`
  }
  chrome.storage.local.set({ [videoId]: videoData }, function () {
    if (chrome.runtime.lastError) {
      console.error('Error saving progress:', chrome.runtime.lastError)
    }
  })
}

// Function to load and set progress
function loadProgress(videoId, videoElement) {
  if (!videoId || !videoElement) {
    console.warn('loadProgress: Missing video ID or video element.')
    return
  }

  chrome.storage.local.get([videoId], function (result) {
    if (chrome.runtime.lastError) {
      console.error('Error loading progress:', chrome.runtime.lastError)
      return
    }

    const savedData = result[videoId]
    if (!savedData) {
      return
    }

    const { currentTime } = videoData
    if (currentTime > 0) {
      // We need to wait until the video is ready to be played/seeked
      // loadeddata ensures enough data to play, but canplaythrough is even better for seeking without buffering issues
      const trySetCurrentTime = () => {
        if (videoElement.readyState >= 2) {
          // HTMLMediaElement.HAVE_CURRENT_DATA or higher
          // Check if currentTime is not very close to the end of the video
          // Prevents resetting to almost finished videos
          if (
            videoElement.duration &&
            videoElement.duration - currentTime < 5
          ) {
            // e.g., within 5 seconds of end
            console.log(
              `loadProgress: Saved time (${currentTime}) is too close to end (${videoElement.duration}), not setting.`
            )
            return
          }

          videoElement.currentTime = currentTime
          console.log(
            `loadProgress: Successfully set currentTime for ${videoId} to ${currentTime}`
          )

          // Optional: Try to play the video if it's paused and not at the very beginning
          // This might be blocked by autoplay policies unless user interaction occurs.
          // Consider adding a small delay if it doesn't work immediately.
          if (videoElement.paused && currentTime > 1) {
            // Don't autoplay from 0
            videoElement.play().catch((e) => {
              console.warn('loadProgress: Autoplay prevented:', e)
              // Inform the user that autoplay was prevented, or show a play button.
            })
          }

          // Remove the event listener once the time is set
          videoElement.removeEventListener('loadeddata', trySetCurrentTime)
          videoElement.removeEventListener('canplaythrough', trySetCurrentTime)
          videoElement.removeEventListener('loadedmetadata', trySetCurrentTime) // Also remove this one
        } else {
          console.log(
            `loadProgress: Video not ready yet (readyState: ${videoElement.readyState}). Waiting...`
          )
        }
      }

      // Add listeners to try setting time once the video is ready
      // loadeddata might be sufficient, canplaythrough is safer but might take longer.
      // We add all and let the first one that fires correctly set the time.
      videoElement.addEventListener('loadeddata', trySetCurrentTime)
      videoElement.addEventListener('canplaythrough', trySetCurrentTime)
      videoElement.addEventListener('loadedmetadata', trySetCurrentTime) // Keep this as a first attempt

      // Immediately try if already ready (e.g., if event fired before listener attached)
      trySetCurrentTime()
    } else {
      console.log(
        `loadProgress: No saved time found for ${videoId} or saved time is 0.`
      )
    }
  })
}

// Main logic
;(function () {
  const videoId = getVideoId()
  const videoElement = getVideoElement()

  if (!videoId || !videoElement) {
    console.warn('Could not find video ID or video element on this page.')
    return
  }

  // Initial attempt to load progress as soon as the video element is available
  // This is important because YouTube's player might already be loading data.
  loadProgress(videoId, videoElement)

  videoElement.addEventListener('loadedmetadata', function listener() {
    loadProgress(videoId, videoElement)
    // You might choose to remove this listener after the first successful attempt
    // to avoid redundant calls, but the `trySetCurrentTime` in `loadProgress` handles removal.
  })

  // Save progress every few seconds (e.g., every 5 seconds)
  let saveInterval

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
      console.log(
        `Video is long (${durationInSeconds}s > ${shortVideoThreshold}s), saving every 30 seconds.`
      )
    }

    saveInterval = setInterval(() => {
      saveProgress(videoId, videoElement.currentTime)
    }, currentSaveDelay)
  }

  videoElement.addEventListener('play', function () {
    setSaveInterval()
  })

  videoElement.addEventListener('pause', function () {
    if (saveInterval) {
      clearInterval(saveInterval)
      saveInterval = null
    }
    saveProgress(videoId, videoElement.currentTime) // Save immediately on pause
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
  window.addEventListener('beforeunload', function () {
    saveProgress(videoId, videoElement.currentTime)
  })
})()

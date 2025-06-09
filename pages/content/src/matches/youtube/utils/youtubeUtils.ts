// Function to get the video ID from the URL
export function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('v')
}

// Function to get the video element
export function getVideoElement() {
  return document.querySelector('video')
}

// Get the video title from the page
// YouTube typically puts the title in a <title> tag or a specific H1 element.
// We'll try the H1 first, then fallback to document.title
export function getVideoTitle() {
  // Modern YouTube selectors
  const titleElement = document.querySelector('h1.ytd-watch-metadata, h1.ytd-video-primary-info-renderer')
  if (titleElement instanceof HTMLElement) {
    return titleElement.innerText.trim()
  }

  if (document.title) {
    // Fallback to document.title, often includes " - YouTube" which you might want to strip
    return document.title.replace(/ - YouTube$/, '').trim()
  }

  return 'Unknown Title'
}

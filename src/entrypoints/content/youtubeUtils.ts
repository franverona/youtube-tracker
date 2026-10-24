export function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('v')
}

export function getVideoElement() {
  // Target the main player explicitly: YouTube can insert ad <video> elements
  // before it, so a bare querySelector('video') may pick an ad (#43).
  return (
    document.querySelector<HTMLVideoElement>('video.html5-main-video') ??
    document.querySelector<HTMLVideoElement>('#movie_player video')
  )
}

export function getVideoTitle() {
  const titleElement = document.querySelector(
    'h1.ytd-watch-metadata, h1.ytd-video-primary-info-renderer',
  )
  if (titleElement instanceof HTMLElement) {
    return titleElement.innerText.trim()
  }

  if (document.title) {
    return document.title.replace(/ - YouTube$/, '').trim()
  }

  return 'Unknown Title'
}

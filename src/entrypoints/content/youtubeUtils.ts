export function getVideoId() {
  const id = new URLSearchParams(window.location.search).get('v')
  // Same shape isValidVideoState requires, so every saved entry stays importable.
  return id && /^[\w-]{11}$/.test(id) ? id : null
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

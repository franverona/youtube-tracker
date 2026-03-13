export function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('v')
}

export function getVideoElement() {
  return document.querySelector('video')
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

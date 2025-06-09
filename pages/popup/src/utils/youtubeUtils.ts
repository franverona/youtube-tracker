// Function to get the video ID from the URL
export function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('v')
}

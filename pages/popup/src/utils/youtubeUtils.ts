// Function to get the video ID from the URL
export function getVideoId(url: string) {
  const location = new URL(url)
  const urlParams = new URLSearchParams(location.search)
  return urlParams.get('v')
}

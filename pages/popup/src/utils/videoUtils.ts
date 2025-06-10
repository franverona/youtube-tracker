import type { VideoDetails, VideoStateType } from '@extension/storage/lib/base'

export function sortVideosByTimestamp(videos: VideoStateType): VideoDetails[] {
  const values = Object.values(videos)

  values.sort((a, b) => b.timestamp - a.timestamp)

  return values
}

import { useEffect, useState } from 'react'
import { videoStorageItem, type VideoStateType } from '../../storage/videoStorage'

export function useVideoStorage() {
  const [videos, setVideos] = useState<VideoStateType>({})

  useEffect(() => {
    videoStorageItem.getValue().then(setVideos)
    return videoStorageItem.watch((newValue) => setVideos(newValue))
  }, [])

  return videos
}

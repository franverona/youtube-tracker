import { useEffect, useState } from 'react'
import { ignoredVideosItem, type IgnoredVideosType } from '@/storage'

export function useIgnoredVideos() {
  const [ignored, setIgnored] = useState<IgnoredVideosType>({})

  useEffect(() => {
    ignoredVideosItem.getValue().then(setIgnored)
    return ignoredVideosItem.watch((newValue) => setIgnored(newValue))
  }, [])

  return ignored
}

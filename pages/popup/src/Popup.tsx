import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared'
import { videoStorage } from '@extension/storage'
import { ErrorDisplay, LoadingSpinner } from '@extension/ui'
import '@src/Popup.css'
import { useMemo } from 'react'
import { formatTime, getThumbnail, sortVideosByTimestamp } from './utils'

const Popup = () => {
  const videos = useStorage(videoStorage)
  const sortedVideos = useMemo(() => sortVideosByTimestamp(videos), [videos])

  const onClickRemove = (id: string) => {
    videoStorage.remove(id)
  }

  return (
    <div className="App">
      <h3 className="mb-4 border-b-2 pb-2 text-xs font-medium uppercase">Saved Progress</h3>
      {sortedVideos.map(({ id, progress, timestamp, title, url }) => (
        <div key={id} className="mb-4 flex gap-4">
          <img src={getThumbnail(id)} alt={`Thumbnail for ${title}`} className="h-[90px] w-auto" />
          <div className="flex-1 truncate">
            <p className="mb-1 truncate text-base font-semibold">{title}</p>
            <p className="mb-1 text-blue-600 underline">
              <a href={url} target="_blank">
                {url}
              </a>
            </p>
            <div className="mb-1 flex gap-2">
              <p>Progress: {formatTime(progress)}s</p>
              <p>|</p>
              <p>Last save: {new Date(timestamp).toLocaleString()}</p>
            </div>
            <p className="inline cursor-pointer text-red-600 underline" onClick={() => onClickRemove(id)} aria-hidden>
              Remove
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay)

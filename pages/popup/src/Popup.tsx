import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared'
import { exampleThemeStorage, videoStorage } from '@extension/storage'
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui'
import '@src/Popup.css'
import { formatTime, getVideoId } from './utils'

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage)
  const videos = useStorage(videoStorage)

  const onClickRemove = (url: string) => {
    const id = getVideoId(url)
    if (id) {
      videoStorage.remove(id)
    }
  }

  return (
    <div className={cn('App', isLight ? 'bg-slate-50' : 'bg-gray-800')}>
      <h3 className="mb-2 text-xs font-medium uppercase">Saved Progress</h3>
      {Object.values(videos).map(({ id, progress, timestamp, title, url }) => (
        <div key={id} className="mb-4">
          <p className="mb-2 text-base font-semibold">{title}</p>
          <p className="mb-2 text-blue-600 underline">
            <a href={url} target="_blank">
              {url}
            </a>
          </p>
          <p>Progress: {formatTime(progress)}s</p>
          <p className="mb-2">Last save: {new Date(timestamp).toLocaleString()}</p>
          <p className="cursor-pointer text-red-600 underline" onClick={() => onClickRemove(url)} aria-hidden>
            Remove
          </p>
        </div>
      ))}
    </div>
  )
}

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay)

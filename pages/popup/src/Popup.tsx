import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared'
import { exampleThemeStorage, videoStorage } from '@extension/storage'
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui'
import '@src/Popup.css'
import { formatTime } from './utils'

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage)
  const videos = useStorage(videoStorage)

  return (
    <div className={cn('App', isLight ? 'bg-slate-50' : 'bg-gray-800')}>
      <h3>Saved Progress</h3>
      {Object.values(videos).map(({ progress, title, url }) => (
        <div key={url}>
          <p>{title}</p>
          <p>{url}</p>
          <p>{formatTime(progress)}</p>
        </div>
      ))}
    </div>
  )
}

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay)

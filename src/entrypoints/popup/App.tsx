import { useEffect, useMemo, useState } from 'react'
import { trackingEnabledItem, videoStorage } from '../../storage/videoStorage'
import { useVideoStorage } from './useVideoStorage'

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s]
    .map((v) => (v < 10 ? '0' + v : v))
    .filter((v, i) => v !== '00' || i > 0)
    .join(':')
    .replace(/^0/, '')
}

function timeAgo(timestamp: number) {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
}

const FALLBACK_VIDEO_DURATION = 4 * 60 * 60

export default function App() {
  const [trackingEnabled, setTrackingEnabled] = useState(true)

  useEffect(() => {
    trackingEnabledItem.getValue().then(setTrackingEnabled)
    return trackingEnabledItem.watch(setTrackingEnabled)
  }, [])

  function toggleTracking() {
    const next = !trackingEnabled
    setTrackingEnabled(next)
    trackingEnabledItem.setValue(next)
  }

  const videos = useVideoStorage()
  const sortedVideos = useMemo(
    () => (videos ? Object.values(videos).sort((a, b) => b.timestamp - a.timestamp) : null),
    [videos],
  )

  const trackingToggle = (
    <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2">
      <button
        onClick={toggleTracking}
        className={`flex items-center gap-2 text-xs font-medium transition-colors ${trackingEnabled ? 'text-gray-500 hover:text-gray-700' : 'text-amber-500 hover:text-amber-600'}`}
        title={trackingEnabled ? 'Pause tracking' : 'Resume tracking'}
      >
        <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${trackingEnabled ? 'bg-red-500' : 'bg-gray-300'}`}>
          <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${trackingEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
        </span>
        {trackingEnabled ? 'Tracking' : 'Paused'}
      </button>
    </div>
  )

  if (!sortedVideos) return null

  if (sortedVideos.length === 0) {
    return (
      <div className="App flex h-[360px] flex-col items-start justify-start">
        {trackingToggle}
        <div className="flex flex-1 w-full flex-col items-center justify-center gap-2">
          <svg className="text-gray-300" width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          <p className="text-sm text-gray-400">No videos tracked yet</p>
          <p className="text-xs text-gray-300">Watch a YouTube video to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="App">
      {trackingToggle}
      <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2">
        <h3 className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Saved Progress</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          {sortedVideos.length}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {sortedVideos.map(({ id, progress, duration, timestamp, title, url }) => {
          const progressPercent = Math.min((progress / (duration ?? FALLBACK_VIDEO_DURATION)) * 100, 100)
          return (
            <div key={id} className="group flex gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50">
              {/* Thumbnail */}
              <a href={url} target="_blank" rel="noreferrer" className="relative shrink-0">
                <img
                  src={getThumbnail(id)}
                  alt={title}
                  className="h-[63px] w-[112px] rounded object-cover"
                />
                <span className="absolute right-1 bottom-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">
                  {formatTime(progress)}
                </span>
              </a>

              {/* Info */}
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-1 line-clamp-2 text-sm leading-snug font-medium text-gray-900 hover:text-blue-600"
                  >
                    {title}
                  </a>
                </div>

                {/* Progress bar */}
                <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{timeAgo(timestamp)}</span>
                  <button
                    onClick={() => videoStorage.remove(id)}
                    className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    title="Remove"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

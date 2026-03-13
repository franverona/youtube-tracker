import { useRef, useMemo, useState } from 'react'
import { type VideoStateType, videoStorage, videoStorageItem } from '../../storage/videoStorage'
import { formatTime, timeAgo } from '../../utils'
import { useVideoStorage } from '@/hooks'

function getThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
}

const FALLBACK_VIDEO_DURATION = 4 * 60 * 60

function isValidVideoState(data: unknown): data is VideoStateType {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false
  return Object.values(data).every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).id === 'string' &&
      typeof (entry as Record<string, unknown>).progress === 'number' &&
      typeof (entry as Record<string, unknown>).timestamp === 'number' &&
      typeof (entry as Record<string, unknown>).title === 'string' &&
      typeof (entry as Record<string, unknown>).url === 'string',
  )
}

export default function App() {
  const videos = useVideoStorage()
  const sortedVideos = useMemo(
    () => (videos ? Object.values(videos).sort((a, b) => b.timestamp - a.timestamp) : null),
    [videos],
  )
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function clearAll() {
    await videoStorageItem.setValue({})
  }

  async function exportData() {
    const state = await videoStorageItem.getValue()
    const json = JSON.stringify(state, null, 2)
    const date = new Date().toISOString().slice(0, 10)
    const a = document.createElement('a')
    a.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`
    a.download = `youtube-tracker-backup-${date}.json`
    a.click()
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same file can be re-imported if needed
    e.target.value = ''

    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      if (!isValidVideoState(parsed)) {
        setImportStatus({ ok: false, message: 'Invalid file format.' })
        return
      }
      const current = await videoStorageItem.getValue()
      await videoStorageItem.setValue({ ...current, ...parsed })
      const count = Object.keys(parsed).length
      setImportStatus({ ok: true, message: `Imported ${count} video${count !== 1 ? 's' : ''}.` })
    } catch {
      setImportStatus({ ok: false, message: 'Failed to read file.' })
    }
  }

  if (!sortedVideos) return null

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Tracked Videos</h1>
        <div className="flex items-center gap-2">
          {importStatus && (
            <span className={`text-sm ${importStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
              {importStatus.message}
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={handleImportClick}
            className="rounded-md bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100">
            Import
          </button>
          <button
            onClick={exportData}
            className="rounded-md bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100">
            Export
          </button>
          {sortedVideos.length > 0 && (
            <button
              onClick={clearAll}
              className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100">
              Clear all
            </button>
          )}
        </div>
      </div>

      {sortedVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <svg
            className="text-gray-300"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          <p className="text-sm text-gray-400">No videos tracked yet</p>
          <p className="text-xs text-gray-300">Watch a YouTube video to get started</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {sortedVideos.map(({ id, progress, duration, timestamp, title, url }) => {
            const progressPercent = Math.min(
              (progress / (duration ?? FALLBACK_VIDEO_DURATION)) * 100,
              100,
            )
            return (
              <div
                key={id}
                className="group flex items-center gap-4 p-4 transition-colors hover:bg-gray-50">
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
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-1 text-sm font-medium text-gray-900 hover:text-blue-600">
                    {title}
                  </a>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-red-500 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{timeAgo(timestamp)}</span>
                </div>

                {/* Delete */}
                <button
                  onClick={() => videoStorage.remove(id)}
                  className="rounded p-1.5 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                  title="Remove">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

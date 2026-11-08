import { useRef, useMemo, useState } from 'react'
import { ignoredVideos, isValidVideoState, videoStorage, videoStorageItem } from '@/storage'
import { formatTime, timeAgo } from '../../utils'
import { useIgnoredVideos, useUndo, useVideoStorage } from '@/hooks'

function getThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
}

const FALLBACK_VIDEO_DURATION = 4 * 60 * 60

export default function App() {
  const videos = useVideoStorage()
  const sortedVideos = useMemo(
    () => (videos ? Object.values(videos).sort((a, b) => b.timestamp - a.timestamp) : null),
    [videos],
  )
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { message, remember, undo } = useUndo()
  const ignored = useIgnoredVideos()

  async function stopTracking(id: string, title: string) {
    try {
      await ignoredVideos.add(id, title)
      await videoStorage.remove(id)
    } catch {
      setStatus({ ok: false, message: "Couldn't stop tracking that video." })
    }
  }

  async function trackAgain(id: string) {
    try {
      await ignoredVideos.remove(id)
    } catch {
      setStatus({ ok: false, message: "Couldn't re-enable tracking for that video." })
    }
  }

  async function removeVideo(id: string) {
    const removed = videos?.[id]
    try {
      await videoStorage.remove(id)
      if (removed) remember('Video removed', { [id]: removed })
    } catch {
      setStatus({ ok: false, message: 'Remove failed.' })
    }
  }

  async function clearAll() {
    if (!sortedVideos || sortedVideos.length === 0) return
    const confirmed = window.confirm(
      `Remove all ${sortedVideos.length} tracked video${sortedVideos.length !== 1 ? 's' : ''}?`,
    )
    if (!confirmed || !videos) return
    try {
      await videoStorage.clear()
      remember(
        `Removed ${sortedVideos.length} video${sortedVideos.length !== 1 ? 's' : ''}`,
        videos,
      )
    } catch {
      setStatus({ ok: false, message: 'Clear all failed.' })
    }
  }

  async function exportData() {
    const state = await videoStorageItem.getValue()
    const json = JSON.stringify(state, null, 2)
    const date = new Date().toISOString().slice(0, 10)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `youtube-tracker-backup-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
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
        setStatus({ ok: false, message: 'Invalid file format.' })
        return
      }
      await videoStorage.import(parsed)
      const count = Object.keys(parsed).length
      setStatus({ ok: true, message: `Imported ${count} video${count !== 1 ? 's' : ''}.` })
    } catch {
      setStatus({ ok: false, message: 'Import failed.' })
    }
  }

  if (!sortedVideos) return null

  const undoToast = message && (
    <div className="fixed inset-x-2 bottom-2 flex items-center justify-between rounded-md bg-gray-900 px-3 py-2 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
      <span>{message}</span>
      <button
        onClick={undo}
        className="font-semibold text-red-400 hover:text-red-300 dark:text-red-600 dark:hover:text-red-700">
        Undo
      </button>
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tracked Videos</h1>
        <div className="flex items-center gap-2">
          {status && (
            <span
              className={`text-sm ${status.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {status.message}
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
            className="rounded-md bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
            Import
          </button>
          <button
            onClick={exportData}
            className="rounded-md bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
            Export
          </button>
          {sortedVideos.length > 0 && (
            <button
              onClick={clearAll}
              className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900">
              Clear all
            </button>
          )}
        </div>
      </div>

      {sortedVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <svg
            className="text-gray-300 dark:text-gray-700"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          <p className="text-sm text-gray-400 dark:text-gray-500">No videos tracked yet</p>
          <p className="text-xs text-gray-300 dark:text-gray-600">
            Watch a YouTube video to get started
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          {sortedVideos.map(({ id, progress, duration, timestamp, title, url }) => {
            const progressPercent = Math.min(
              (progress / (duration ?? FALLBACK_VIDEO_DURATION)) * 100,
              100,
            )
            return (
              <div
                key={id}
                className="group flex items-center gap-4 p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                {/* Thumbnail */}
                <a href={url} target="_blank" rel="noreferrer" className="relative w-42 shrink-0">
                  <img
                    src={getThumbnail(id)}
                    alt={title}
                    className="rounded border border-gray-200 object-cover dark:border-gray-700"
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
                    className="line-clamp-1 text-sm font-medium text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400">
                    {title}
                  </a>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-red-500 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {timeAgo(timestamp)}
                  </span>
                </div>

                {/* Don't track */}
                <button
                  onClick={() => stopTracking(id, title)}
                  className="rounded p-1.5 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
                  title="Don't track this video"
                  aria-label="Don't track this video">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                </button>

                {/* Delete */}
                <button
                  onClick={() => removeVideo(id)}
                  className="rounded p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                  title="Remove"
                  aria-label="Remove">
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

      {Object.keys(ignored).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Not tracked
          </h2>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            {Object.entries(ignored).map(([id, title]) => (
              <li key={id} className="flex items-center justify-between gap-4 px-3 py-2">
                <a
                  href={`https://www.youtube.com/watch?v=${id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-1 text-sm text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
                  {title || id}
                </a>
                <button
                  onClick={() => trackAgain(id)}
                  className="shrink-0 rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                  Track again
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {undoToast}
    </div>
  )
}

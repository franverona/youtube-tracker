import { useMemo } from 'react'
import { videoStorage } from '../../storage/videoStorage'
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

function getThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

export default function App() {
  const videos = useVideoStorage()
  const sortedVideos = useMemo(
    () => Object.values(videos).sort((a, b) => b.timestamp - a.timestamp),
    [videos],
  )

  if (sortedVideos.length === 0) {
    return (
      <div className="App flex h-[360px] items-center justify-center">
        <h3 className="text-xs font-medium uppercase text-gray-400">No videos has been tracked.</h3>
      </div>
    )
  }

  return (
    <div className="App">
      <h3 className="mb-4 border-b pb-2 text-xs font-medium uppercase">Saved Progress</h3>
      {sortedVideos.map(({ id, progress, timestamp, title, url }) => (
        <div key={id} className="mb-4 flex gap-4">
          <img src={getThumbnail(id)} alt={`Thumbnail for ${title}`} className="h-[90px] w-auto" />
          <div className="flex-1 truncate">
            <p className="mb-1 truncate text-base font-semibold">{title}</p>
            <p className="mb-1 text-blue-600 underline">
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
            </p>
            <div className="mb-1 flex gap-1">
              <p>Progress: {formatTime(progress)}s</p>
              <p>·</p>
              <p>Last save: {new Date(timestamp).toLocaleString()}</p>
            </div>
            <p
              className="inline cursor-pointer text-red-600 underline"
              onClick={() => videoStorage.remove(id)}
              aria-hidden
            >
              Remove
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

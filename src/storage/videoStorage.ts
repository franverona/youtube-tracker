import { browser } from 'wxt/browser'
import { storage } from 'wxt/utils/storage'

export interface VideoDetails {
  id: string
  progress: number
  duration?: number
  timestamp: number
  title: string
  url: string
}

export type VideoStateType = Record<string, VideoDetails>

export const videoStorageItem = storage.defineItem<VideoStateType>('local:video-storage', {
  defaultValue: {},
})

export const trackingEnabledItem = storage.defineItem<boolean>('local:tracking-enabled', {
  defaultValue: true,
})

export type VideoStorageWrite =
  | { type: 'video-storage:save'; id: string; details: VideoDetails }
  | { type: 'video-storage:remove'; id: string }
  | { type: 'video-storage:clear' }
  | { type: 'video-storage:import'; state: VideoStateType }

export function isVideoStorageWrite(message: unknown): message is VideoStorageWrite {
  const type = (message as { type?: unknown } | null)?.type
  return typeof type === 'string' && type.startsWith('video-storage:')
}

// Every context (content scripts in each tab, popup, options) sends its writes
// to the background, which applies them one at a time through this queue. A
// per-context queue alone can't stop two tabs' read-modify-writes from
// clobbering each other.
let writeQueue = Promise.resolve()

function enqueueWrite(mutate: (current: VideoStateType) => VideoStateType): Promise<void> {
  const result = writeQueue.then(async () => {
    const current = await videoStorageItem.getValue()
    await videoStorageItem.setValue(mutate(current))
  })
  writeQueue = result.catch(() => {})
  return result
}

/** Applies a write in the background context. Other contexts go through `videoStorage`. */
export function applyVideoStorageWrite(write: VideoStorageWrite): Promise<void> {
  switch (write.type) {
    case 'video-storage:save':
      return enqueueWrite((current) => ({ ...current, [write.id]: write.details }))
    case 'video-storage:remove':
      return enqueueWrite((current) => {
        const next = { ...current }
        delete next[write.id]
        return next
      })
    case 'video-storage:clear':
      return enqueueWrite(() => ({}))
    case 'video-storage:import':
      // Per-id merge keeping the newer entry, so re-importing an old backup
      // doesn't roll back progress made since.
      return enqueueWrite((current) => {
        const next = { ...current }
        for (const [id, entry] of Object.entries(write.state)) {
          if (!next[id] || entry.timestamp > next[id].timestamp) next[id] = entry
        }
        return next
      })
  }
}

async function send(write: VideoStorageWrite): Promise<void> {
  await browser.runtime.sendMessage(write)
}

export const videoStorage = {
  getById: async (id: string): Promise<VideoDetails | undefined> => {
    const state = await videoStorageItem.getValue()
    return state[id]
  },
  save: (id: string, details: VideoDetails) => send({ type: 'video-storage:save', id, details }),
  remove: (id: string) => send({ type: 'video-storage:remove', id }),
  clear: () => send({ type: 'video-storage:clear' }),
  import: (state: VideoStateType) => send({ type: 'video-storage:import', state }),
}

const isNonNegativeNumber = (v: unknown) => typeof v === 'number' && isFinite(v) && v >= 0

export function isValidVideoState(data: unknown): data is VideoStateType {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false
  return Object.entries(data).every(([key, entry]) => {
    if (typeof entry !== 'object' || entry === null) return false
    const { id, progress, duration, timestamp, title, url } = entry as Record<string, unknown>
    return (
      id === key &&
      typeof id === 'string' &&
      /^[\w-]{11}$/.test(id) &&
      isNonNegativeNumber(progress) &&
      (duration === undefined || (isNonNegativeNumber(duration) && (duration as number) > 0)) &&
      isNonNegativeNumber(timestamp) &&
      typeof title === 'string' &&
      typeof url === 'string' &&
      url.startsWith('https://www.youtube.com/')
    )
  })
}

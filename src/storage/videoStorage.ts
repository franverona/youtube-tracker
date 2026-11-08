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

/** Videos the user chose not to track, id → title (kept for the options list). */
export type IgnoredVideosType = Record<string, string>

// shortcut: written directly, not through the background queue — only the
// popup/options change it, on a click; route it through the queue if more
// writers appear.
export const ignoredVideosItem = storage.defineItem<IgnoredVideosType>('local:ignored-videos', {
  defaultValue: {},
})

export const ignoredVideos = {
  add: async (id: string, title: string) => {
    await ignoredVideosItem.setValue({ ...(await ignoredVideosItem.getValue()), [id]: title })
  },
  remove: async (id: string) => {
    const next = { ...(await ignoredVideosItem.getValue()) }
    delete next[id]
    await ignoredVideosItem.setValue(next)
  },
}

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

// Validated where the write is applied: content scripts run next to a page we
// don't control, so their messages aren't trusted just for coming from us.
function isValidWrite(write: VideoStorageWrite): boolean {
  switch (write.type) {
    case 'video-storage:save':
      return isValidVideoState({ [write.id]: write.details })
    case 'video-storage:remove':
      return typeof write.id === 'string'
    case 'video-storage:clear':
      return true
    case 'video-storage:import':
      return isValidVideoState(write.state)
    default:
      return false
  }
}

/** Whether an imported entry replaces what's stored: it's new, or newer. */
export function importWins(current: VideoStateType, id: string, entry: VideoDetails): boolean {
  // hasOwn: ids like `constructor` would otherwise hit Object.prototype.
  return !Object.hasOwn(current, id) || entry.timestamp > current[id].timestamp
}

/** Applies a write in the background context. Other contexts go through `videoStorage`. */
export function applyVideoStorageWrite(write: VideoStorageWrite): Promise<void> {
  if (!isValidWrite(write)) return Promise.reject(new Error(`Invalid storage write: ${write.type}`))
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
          if (importWins(next, id, entry)) next[id] = entry
        }
        return next
      })
  }
}

async function send(write: VideoStorageWrite): Promise<void> {
  // The background replies `{ ok: false }` when the write failed (e.g. quota).
  const response = (await browser.runtime.sendMessage(write)) as
    { ok: false; error: string } | undefined
  if (response?.ok === false) throw new Error(response.error)
}

export const videoStorage = {
  getById: async (id: string): Promise<VideoDetails | undefined> => {
    const state = await videoStorageItem.getValue()
    return Object.hasOwn(state, id) ? state[id] : undefined
  },
  save: (id: string, details: VideoDetails) => send({ type: 'video-storage:save', id, details }),
  remove: (id: string) => send({ type: 'video-storage:remove', id }),
  clear: () => send({ type: 'video-storage:clear' }),
  import: (state: VideoStateType) => send({ type: 'video-storage:import', state }),
}

const isNonNegativeNumber = (v: unknown) => typeof v === 'number' && isFinite(v) && v >= 0

// Allows for clock skew between machines; a far-future timestamp would sort
// first forever and win every later import merge.
const MAX_TIMESTAMP_SKEW_MS = 24 * 60 * 60 * 1000

export function isValidVideoState(data: unknown): data is VideoStateType {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false
  const maxTimestamp = Date.now() + MAX_TIMESTAMP_SKEW_MS
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
      (timestamp as number) <= maxTimestamp &&
      typeof title === 'string' &&
      typeof url === 'string' &&
      url.startsWith('https://www.youtube.com/')
    )
  })
}

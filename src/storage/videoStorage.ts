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

// Serializes read-modify-write operations on videoStorageItem so concurrent
// save/remove calls (e.g. a video's `pause` and `ended` handlers firing close
// together) can't race and clobber each other's writes.
let writeQueue = Promise.resolve()

function enqueueWrite(mutate: (current: VideoStateType) => VideoStateType): Promise<void> {
  const result = writeQueue.then(async () => {
    const current = await videoStorageItem.getValue()
    await videoStorageItem.setValue(mutate(current))
  })
  writeQueue = result.catch(() => {})
  return result
}

export const videoStorage = {
  getById: async (id: string): Promise<VideoDetails | undefined> => {
    const state = await videoStorageItem.getValue()
    return state[id]
  },
  save: (id: string, details: VideoDetails): Promise<void> =>
    enqueueWrite((current) => ({ ...current, [id]: details })),
  remove: (id: string): Promise<void> =>
    enqueueWrite((current) => {
      const next = { ...current }
      delete next[id]
      return next
    }),
}

export function isValidVideoState(data: unknown): data is VideoStateType {
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

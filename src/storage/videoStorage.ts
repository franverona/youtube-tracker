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

export const videoStorage = {
  getById: async (id: string): Promise<VideoDetails | undefined> => {
    const state = await videoStorageItem.getValue()
    return state[id]
  },
  save: async (id: string, details: VideoDetails): Promise<void> => {
    const current = await videoStorageItem.getValue()
    await videoStorageItem.setValue({ ...current, [id]: details })
  },
  remove: async (id: string): Promise<void> => {
    const current = await videoStorageItem.getValue()
    const next = { ...current }
    delete next[id]
    await videoStorageItem.setValue(next)
  },
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

import type { VideoDetails, VideoStateType, VideoStorageType } from '../base/index.js'
import { createStorage, StorageEnum } from '../base/index.js'

const storage = createStorage<VideoStateType>(
  'video-storage',
  {},
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
)

export const videoStorage: VideoStorageType = {
  ...storage,
  getById: async (id: string) => {
    const content = await storage.get()
    return content[id]
  },
  save: async (id: string, details: VideoDetails) => {
    await storage.set((currentState) => ({
      ...currentState,
      [id]: details,
    }))
  },
  clear: async () => {
    await storage.set(() => ({}))
    await storage.set(() => ({}))
  },
  remove: async (id) => {
    await storage.set((currentState) => {
      const newState = {
        ...currentState,
      }
      delete newState[id]
      console.log(newState, id)
      return newState
    })
  },
}

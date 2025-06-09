import type { VideoStateType, VideoStorageType } from '../base/index.js'
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
  clear: async () => {
    await storage.set(() => ({}))
  },
  remove: async (id) => {
    // TODO Remove id
    console.log(`Remove ${id}`)
    const content = await storage.get()
    return content
  },
}

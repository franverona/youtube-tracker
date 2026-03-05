import { beforeEach, describe, expect, it, vi } from 'vitest'
import { videoStorage, type VideoDetails } from './videoStorage'

const mockData = vi.hoisted(() => ({ state: {} as Record<string, VideoDetails> }))

vi.mock('wxt/utils/storage', () => ({
  storage: {
    defineItem: () => ({
      getValue: async () => ({ ...mockData.state }),
      setValue: async (val: Record<string, VideoDetails>) => {
        mockData.state = { ...val }
      },
      watch: vi.fn(),
    }),
  },
}))

describe('videoStorage', () => {
  const sample: VideoDetails = {
    id: 'abc123',
    progress: 42,
    timestamp: 1_000_000,
    title: 'Test Video',
    url: 'https://www.youtube.com/watch?v=abc123',
  }

  beforeEach(() => {
    mockData.state = {}
  })

  describe('getById', () => {
    it('returns undefined for a missing id', async () => {
      expect(await videoStorage.getById('missing')).toBeUndefined()
    })

    it('returns stored VideoDetails for an existing id', async () => {
      mockData.state = { abc123: sample }
      expect(await videoStorage.getById('abc123')).toEqual(sample)
    })
  })

  describe('save', () => {
    it('stores a new entry without affecting existing ones', async () => {
      const other: VideoDetails = { ...sample, id: 'other', title: 'Other' }
      mockData.state = { other }
      await videoStorage.save('abc123', sample)
      expect(mockData.state).toEqual({ other, abc123: sample })
    })

    it('overwrites an existing entry', async () => {
      mockData.state = { abc123: sample }
      const updated: VideoDetails = { ...sample, progress: 99 }
      await videoStorage.save('abc123', updated)
      expect(mockData.state.abc123.progress).toBe(99)
    })
  })

  describe('remove', () => {
    it('removes the entry', async () => {
      mockData.state = { abc123: sample }
      await videoStorage.remove('abc123')
      expect(mockData.state.abc123).toBeUndefined()
    })

    it('does not affect other entries', async () => {
      const other: VideoDetails = { ...sample, id: 'other', title: 'Other' }
      mockData.state = { abc123: sample, other }
      await videoStorage.remove('abc123')
      expect(mockData.state).toEqual({ other })
    })
  })
})

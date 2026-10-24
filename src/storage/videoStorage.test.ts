import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyVideoStorageWrite,
  isValidVideoState,
  videoStorage,
  type VideoDetails,
} from './videoStorage'

const mockData = vi.hoisted(() => ({ state: {} as Record<string, VideoDetails> }))
const sendMessage = vi.hoisted(() => vi.fn())

vi.mock('wxt/browser', () => ({ browser: { runtime: { sendMessage } } }))

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

const sample: VideoDetails = {
  id: 'abc123def45',
  progress: 42,
  timestamp: 1_000_000,
  title: 'Test Video',
  url: 'https://www.youtube.com/watch?v=abc123def45',
}
const other: VideoDetails = { ...sample, id: 'other123456', title: 'Other' }

beforeEach(() => {
  mockData.state = {}
  sendMessage.mockReset()
})

describe('videoStorage', () => {
  it('getById returns undefined for a missing id', async () => {
    expect(await videoStorage.getById('missing')).toBeUndefined()
  })

  it('getById returns stored VideoDetails for an existing id', async () => {
    mockData.state = { [sample.id]: sample }
    expect(await videoStorage.getById(sample.id)).toEqual(sample)
  })

  it('routes writes to the background instead of writing directly', async () => {
    await videoStorage.save(sample.id, sample)
    await videoStorage.remove(sample.id)
    expect(sendMessage).toHaveBeenNthCalledWith(1, {
      type: 'video-storage:save',
      id: sample.id,
      details: sample,
    })
    expect(sendMessage).toHaveBeenNthCalledWith(2, { type: 'video-storage:remove', id: sample.id })
    expect(mockData.state).toEqual({})
  })
})

describe('applyVideoStorageWrite', () => {
  it('save stores a new entry without affecting existing ones', async () => {
    mockData.state = { [other.id]: other }
    await applyVideoStorageWrite({ type: 'video-storage:save', id: sample.id, details: sample })
    expect(mockData.state).toEqual({ [other.id]: other, [sample.id]: sample })
  })

  it('remove deletes only that entry', async () => {
    mockData.state = { [sample.id]: sample, [other.id]: other }
    await applyVideoStorageWrite({ type: 'video-storage:remove', id: sample.id })
    expect(mockData.state).toEqual({ [other.id]: other })
  })

  it('serializes concurrent writes', async () => {
    await Promise.all([
      applyVideoStorageWrite({ type: 'video-storage:save', id: sample.id, details: sample }),
      applyVideoStorageWrite({ type: 'video-storage:save', id: other.id, details: other }),
    ])
    expect(Object.keys(mockData.state)).toHaveLength(2)
  })

  it('clear empties storage', async () => {
    mockData.state = { [sample.id]: sample }
    await applyVideoStorageWrite({ type: 'video-storage:clear' })
    expect(mockData.state).toEqual({})
  })

  it('import keeps the newer entry per id', async () => {
    const newer = { ...sample, progress: 2400, timestamp: 2_000_000 }
    mockData.state = { [sample.id]: newer }
    await applyVideoStorageWrite({
      type: 'video-storage:import',
      state: { [sample.id]: sample, [other.id]: other },
    })
    expect(mockData.state).toEqual({ [sample.id]: newer, [other.id]: other })
  })
})

describe('isValidVideoState', () => {
  const valid = (overrides: Record<string, unknown> = {}, key = sample.id) =>
    isValidVideoState({ [key]: { ...sample, ...overrides } })

  it('returns false for non-object type', () => {
    expect(isValidVideoState(null)).toBe(false)
    expect(isValidVideoState([])).toBe(false)
    expect(isValidVideoState(1)).toBe(false)
    expect(isValidVideoState('test')).toBe(false)
  })

  it('accepts valid entries', () => {
    expect(valid()).toBe(true)
    expect(valid({ duration: 300 })).toBe(true)
  })

  it('rejects null, array and empty entries', () => {
    expect(isValidVideoState({ [sample.id]: sample, x: null })).toBe(false)
    expect(isValidVideoState({ [sample.id]: sample, x: [] })).toBe(false)
    expect(isValidVideoState({ [sample.id]: sample, x: {} })).toBe(false)
  })

  it('rejects a key that differs from entry.id', () => {
    expect(valid({}, 'zzzzzzzzzzz')).toBe(false)
  })

  it('rejects malformed ids', () => {
    expect(valid({ id: 'short' }, 'short')).toBe(false)
  })

  it('rejects bad progress, duration and timestamp', () => {
    expect(valid({ progress: -50 })).toBe(false)
    expect(valid({ progress: Infinity })).toBe(false)
    expect(valid({ duration: 'abc' })).toBe(false)
    expect(valid({ duration: 0 })).toBe(false)
    expect(valid({ timestamp: NaN })).toBe(false)
  })

  it('rejects urls outside youtube.com', () => {
    expect(valid({ url: 'https://example.com' })).toBe(false)
    expect(valid({ url: 'https://www.youtube.com.evil.com/' })).toBe(false)
  })
})

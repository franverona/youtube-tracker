import { beforeEach, describe, expect, it, vi } from 'vitest'
import { videoStorage, type VideoDetails } from '../../storage/videoStorage'
import { loadProgress, saveProgress } from './videoUtils'

vi.mock('../../storage/videoStorage', () => ({
  videoStorage: {
    getById: vi.fn(),
    save: vi.fn(),
  },
}))

vi.mock('./youtubeUtils', () => ({
  getVideoTitle: vi.fn(() => 'Test Title'),
}))

function createMockVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  return {
    readyState: 4,
    duration: 300,
    currentTime: 0,
    paused: false,
    play: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as HTMLVideoElement
}

describe('saveProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing if videoId is empty', async () => {
    await saveProgress('', 30)
    expect(videoStorage.save).not.toHaveBeenCalled()
  })

  it('does nothing if progress is NaN', async () => {
    await saveProgress('abc123', NaN)
    expect(videoStorage.save).not.toHaveBeenCalled()
  })

  it('does nothing if progress is negative', async () => {
    await saveProgress('abc123', -1)
    expect(videoStorage.save).not.toHaveBeenCalled()
  })

  it('calls videoStorage.save with the correct data', async () => {
    await saveProgress('abc123', 42)
    expect(videoStorage.save).toHaveBeenCalledWith(
      'abc123',
      expect.objectContaining({
        id: 'abc123',
        progress: 42,
        title: 'Test Title',
        url: 'https://www.youtube.com/watch?v=abc123',
      }),
    )
  })
})

describe('loadProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing if videoId is empty', async () => {
    await loadProgress('', createMockVideo())
    expect(videoStorage.getById).not.toHaveBeenCalled()
  })

  it('does nothing if videoElement is null', async () => {
    await loadProgress('abc123', null as unknown as HTMLVideoElement)
    expect(videoStorage.getById).not.toHaveBeenCalled()
  })

  it('does nothing if no stored progress is found', async () => {
    vi.mocked(videoStorage.getById).mockResolvedValue(undefined)
    const video = createMockVideo()
    await loadProgress('abc123', video)
    expect(video.addEventListener).not.toHaveBeenCalled()
  })

  it('does nothing if stored progress is 0', async () => {
    const stored: VideoDetails = {
      id: 'abc123',
      progress: 0,
      timestamp: 1000,
      title: 'T',
      url: 'u',
    }
    vi.mocked(videoStorage.getById).mockResolvedValue(stored)
    const video = createMockVideo()
    await loadProgress('abc123', video)
    expect(video.addEventListener).not.toHaveBeenCalled()
  })

  it('sets currentTime when readyState is sufficient', async () => {
    const stored: VideoDetails = {
      id: 'abc123',
      progress: 50,
      timestamp: 1000,
      title: 'T',
      url: 'u',
    }
    vi.mocked(videoStorage.getById).mockResolvedValue(stored)
    const video = createMockVideo({ readyState: 4, duration: 300 })
    await loadProgress('abc123', video)
    expect(video.currentTime).toBe(50)
  })

  it('skips setting currentTime when within 5s of the end', async () => {
    const stored: VideoDetails = {
      id: 'abc123',
      progress: 297,
      timestamp: 1000,
      title: 'T',
      url: 'u',
    }
    vi.mocked(videoStorage.getById).mockResolvedValue(stored)
    const video = createMockVideo({ readyState: 4, duration: 300 })
    await loadProgress('abc123', video)
    expect(video.currentTime).toBe(0)
  })

  it('calls play() when paused at a significant position', async () => {
    const stored: VideoDetails = {
      id: 'abc123',
      progress: 50,
      timestamp: 1000,
      title: 'T',
      url: 'u',
    }
    vi.mocked(videoStorage.getById).mockResolvedValue(stored)
    const video = createMockVideo({ readyState: 4, paused: true })
    await loadProgress('abc123', video)
    expect(video.play).toHaveBeenCalled()
  })
})

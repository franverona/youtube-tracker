/** @vitest-environment-options {"url": "https://www.youtube.com/"} */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ignoredVideosItem, trackingEnabledItem, videoStorage } from '@/storage'

vi.mock('@/storage', () => ({
  trackingEnabledItem: { getValue: vi.fn(), watch: vi.fn() },
  ignoredVideosItem: { getValue: vi.fn(), watch: vi.fn() },
  videoStorage: { getById: vi.fn(), save: vi.fn(), remove: vi.fn() },
}))

vi.stubGlobal('defineContentScript', (def: unknown) => def)
const runtime: { id?: string } = {}
vi.stubGlobal('browser', { runtime })

const { default: contentScript } = await import('@/entrypoints/content')

const A = 'AAAAAAAAAAA'
const flush = () => new Promise((r) => setTimeout(r))

async function start(trackingEnabled = true) {
  vi.mocked(trackingEnabledItem.getValue).mockResolvedValue(trackingEnabled)
  window.history.replaceState(null, '', `/watch?v=${A}`)
  const video = document.createElement('video')
  video.className = 'html5-main-video'
  Object.defineProperty(video, 'duration', { value: 300, configurable: true })
  Object.defineProperty(video, 'currentTime', { value: 120, writable: true })
  document.body.append(video)
  await (contentScript as unknown as { main: () => Promise<void> }).main()
  await flush()
  return video
}

beforeEach(() => {
  vi.clearAllMocks()
  runtime.id = 'ext'
  vi.mocked(ignoredVideosItem.getValue).mockResolvedValue({})
  vi.mocked(videoStorage.getById).mockResolvedValue(undefined)
  vi.mocked(videoStorage.save).mockResolvedValue()
  vi.mocked(videoStorage.remove).mockResolvedValue()
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('content script', () => {
  it('saves under the current video id on pause', async () => {
    const video = await start()
    video.dispatchEvent(new Event('pause'))
    await flush()
    expect(videoStorage.save).toHaveBeenCalledWith(A, expect.objectContaining({ id: A }))
  })

  it('saves when navigation starts, before the URL leaves the video', async () => {
    await start()
    document.dispatchEvent(new Event('yt-navigate-start'))
    await flush()
    expect(videoStorage.save).toHaveBeenCalledWith(A, expect.objectContaining({ progress: 120 }))
  })

  it('follows YouTube replacing the main video element', async () => {
    const old = await start()
    old.remove()
    const video = document.createElement('video')
    video.className = 'html5-main-video'
    Object.defineProperty(video, 'duration', { value: 300 })
    Object.defineProperty(video, 'currentTime', { value: 120, writable: true })
    document.body.append(video)
    video.dispatchEvent(new Event('play'))
    await flush()
    video.dispatchEvent(new Event('pause'))
    await flush()
    expect(videoStorage.save).toHaveBeenCalledWith(A, expect.objectContaining({ progress: 120 }))
  })

  it("doesn't re-run resume when the element is replaced for the same video", async () => {
    const old = await start()
    expect(videoStorage.getById).toHaveBeenCalledTimes(1)
    old.remove()
    const video = document.createElement('video')
    video.className = 'html5-main-video'
    document.body.append(video)
    video.dispatchEvent(new Event('play'))
    await flush()
    expect(videoStorage.getById).toHaveBeenCalledTimes(1)
  })

  it("doesn't save or remove while an ad is playing", async () => {
    const video = await start()
    const player = document.createElement('div')
    player.id = 'movie_player'
    player.className = 'ad-showing'
    document.body.append(player)
    video.dispatchEvent(new Event('pause'))
    video.dispatchEvent(new Event('ended'))
    await flush()
    expect(videoStorage.save).not.toHaveBeenCalled()
    expect(videoStorage.remove).not.toHaveBeenCalled()
  })

  it("doesn't save the next video's position under the previous id after SPA nav", async () => {
    const video = await start()
    window.history.pushState(null, '', '/watch?v=BBBBBBBBBBB')
    video.dispatchEvent(new Event('pause'))
    await flush()
    expect(videoStorage.save).not.toHaveBeenCalled()
  })

  it('shows a resume notice whose Start over rewinds and forgets the entry', async () => {
    vi.mocked(videoStorage.getById).mockResolvedValue({
      id: A,
      progress: 100,
      timestamp: 1,
      title: 'T',
      url: 'u',
    })
    const video = await start()
    video.currentTime = 0
    Object.defineProperty(video, 'readyState', { value: 4 })
    video.play = vi.fn().mockResolvedValue(undefined)
    video.dispatchEvent(new Event('loadeddata'))
    const notice = document.getElementById('yt-tracker-resume-notice')
    expect(notice?.textContent).toContain('Resumed at 1:37')
    notice?.querySelector('button')?.click()
    expect(video.currentTime).toBe(0)
    expect(videoStorage.remove).toHaveBeenCalledWith(A)
  })

  it("doesn't resume or save a video on the don't-track list", async () => {
    vi.mocked(ignoredVideosItem.getValue).mockResolvedValue({ [A]: 'T' })
    const video = await start()
    video.dispatchEvent(new Event('pause'))
    await flush()
    expect(videoStorage.getById).not.toHaveBeenCalled()
    expect(videoStorage.save).not.toHaveBeenCalled()
  })

  it("doesn't resume a hard-loaded page while tracking is paused", async () => {
    await start(false)
    expect(videoStorage.getById).not.toHaveBeenCalled()
  })

  it("doesn't remove the entry on ended while tracking is paused", async () => {
    const video = await start(false)
    video.dispatchEvent(new Event('ended'))
    await flush()
    expect(videoStorage.remove).not.toHaveBeenCalled()
  })

  it('removes instead of saving when the video is nearly finished', async () => {
    vi.mocked(videoStorage.getById).mockResolvedValue({
      id: A,
      progress: 100,
      timestamp: 1,
      title: 'T',
      url: 'u',
    })
    const video = await start()
    Object.defineProperty(video, 'currentTime', { value: 290 })
    video.dispatchEvent(new Event('pause'))
    await flush()
    expect(videoStorage.save).not.toHaveBeenCalled()
    expect(videoStorage.remove).toHaveBeenCalledWith(A)
  })

  it("doesn't send a remove when a nearly finished video has no entry", async () => {
    const video = await start()
    Object.defineProperty(video, 'currentTime', { value: 290 })
    video.dispatchEvent(new Event('pause'))
    await flush()
    expect(videoStorage.remove).not.toHaveBeenCalled()
  })

  it("doesn't save live streams", async () => {
    const video = await start()
    Object.defineProperty(video, 'duration', { value: Infinity })
    video.dispatchEvent(new Event('pause'))
    await flush()
    expect(videoStorage.save).not.toHaveBeenCalled()
  })

  it("doesn't start the save interval on loadedmetadata while paused", async () => {
    const video = await start()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    video.dispatchEvent(new Event('loadedmetadata'))
    expect(setIntervalSpy).not.toHaveBeenCalled()
  })

  it('stops writing once the extension context is invalidated', async () => {
    const video = await start()
    runtime.id = undefined
    video.dispatchEvent(new Event('pause'))
    await flush()
    expect(videoStorage.save).not.toHaveBeenCalled()
  })

  it("doesn't throw when a save is rejected", async () => {
    vi.mocked(videoStorage.save).mockRejectedValue(new Error('Extension context invalidated'))
    const video = await start()
    video.dispatchEvent(new Event('pause'))
    await flush()
    expect(videoStorage.save).toHaveBeenCalled()
  })
})

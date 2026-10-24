/** @vitest-environment-options {"url": "https://www.youtube.com/"} */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackingEnabledItem, videoStorage } from '@/storage'

vi.mock('@/storage', () => ({
  trackingEnabledItem: { getValue: vi.fn(), watch: vi.fn() },
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
  document.body.append(video)
  await (contentScript as unknown as { main: () => Promise<void> }).main()
  await flush()
  return video
}

beforeEach(() => {
  vi.clearAllMocks()
  runtime.id = 'ext'
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

  it("doesn't save the next video's position under the previous id after SPA nav", async () => {
    const video = await start()
    window.history.pushState(null, '', '/watch?v=BBBBBBBBBBB')
    video.dispatchEvent(new Event('pause'))
    await flush()
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

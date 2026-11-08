import { describe, expect, it, vi } from 'vitest'
import { applyVideoStorageWrite, isVideoStorageWrite, videoStorageItem } from '@/storage'

vi.mock('@/storage', () => ({
  applyVideoStorageWrite: vi.fn(),
  isVideoStorageWrite: vi.fn(),
  trackingEnabledItem: { getValue: vi.fn(() => new Promise(() => {})), watch: vi.fn() },
  videoStorageItem: { getValue: vi.fn(() => new Promise(() => {})), watch: vi.fn() },
}))

vi.stubGlobal('defineBackground', (fn: () => void) => fn)

describe('background', () => {
  it('falls back to browserAction on Firefox MV2', async () => {
    const browserAction = { setBadgeTextColor: vi.fn() }
    vi.stubGlobal('browser', {
      browserAction,
      runtime: { onMessage: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() } },
      commands: { onCommand: { addListener: vi.fn() } },
    })
    const { default: background } = await import('@/entrypoints/background')
    expect(() => (background as unknown as () => void)()).not.toThrow()
    expect(browserAction.setBadgeTextColor).toHaveBeenCalled()
  })

  it('replies ok: false when a write fails', async () => {
    vi.mocked(isVideoStorageWrite).mockReturnValue(true)
    vi.mocked(applyVideoStorageWrite).mockRejectedValue(new Error('quota'))
    const onMessage = { addListener: vi.fn() }
    vi.stubGlobal('browser', {
      action: { setBadgeTextColor: vi.fn() },
      runtime: { id: 'ext', onMessage, onStartup: { addListener: vi.fn() } },
      commands: { onCommand: { addListener: vi.fn() } },
    })
    const { default: background } = await import('@/entrypoints/background')
    ;(background as unknown as () => void)()
    const listener = onMessage.addListener.mock.calls[0][0]
    const sendResponse = vi.fn()
    expect(listener({ type: 'video-storage:clear' }, { id: 'other-ext' }, sendResponse)).toBe(
      undefined,
    )
    expect(listener({ type: 'video-storage:clear' }, { id: 'ext' }, sendResponse)).toBe(true)
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'Error: quota' }),
    )
  })

  it('opens the most recent video on resume-last-video', async () => {
    const onCommand = { addListener: vi.fn() }
    const tabs = { create: vi.fn() }
    vi.stubGlobal('browser', {
      action: { setBadgeTextColor: vi.fn() },
      runtime: { onMessage: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() } },
      commands: { onCommand },
      tabs,
    })
    const { default: background } = await import('@/entrypoints/background')
    ;(background as unknown as () => void)()
    const entry = (id: string, timestamp: number) => ({
      id,
      timestamp,
      progress: 60,
      title: id,
      url: `https://www.youtube.com/watch?v=${id}`,
    })
    vi.mocked(videoStorageItem.getValue).mockResolvedValue({
      old: entry('old', 1),
      new: entry('new', 2),
    })
    await onCommand.addListener.mock.calls[0][0]('resume-last-video')
    expect(tabs.create).toHaveBeenCalledWith({ url: 'https://www.youtube.com/watch?v=new' })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { applyVideoStorageWrite, isVideoStorageWrite } from '@/storage'

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
})

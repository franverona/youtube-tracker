import { describe, expect, it, vi } from 'vitest'

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
})

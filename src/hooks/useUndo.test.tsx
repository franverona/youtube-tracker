import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { videoStorage, type VideoDetails } from '@/storage'
import { useUndo } from './useUndo'

vi.mock('@/storage', () => ({ videoStorage: { import: vi.fn() } }))

const entry: VideoDetails = { id: 'abc123def45', progress: 60, timestamp: 1, title: 'T', url: 'u' }
let undo: ReturnType<typeof useUndo>

function Probe({ onRender }: { onRender: (value: ReturnType<typeof useUndo>) => void }) {
  onRender(useUndo())
  return null
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  vi.clearAllMocks()
  act(() =>
    createRoot(document.createElement('div')).render(
      <Probe onRender={(value) => (undo = value)} />,
    ),
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('restores the removed entries on undo', async () => {
  act(() => undo.remember('Video removed', { [entry.id]: entry }))
  expect(undo.message).toBe('Video removed')
  await act(() => undo.undo())
  expect(videoStorage.import).toHaveBeenCalledWith({ [entry.id]: entry })
  expect(undo.message).toBeNull()
})

it('expires after the timeout', async () => {
  act(() => undo.remember('Video removed', { [entry.id]: entry }))
  act(() => vi.advanceTimersByTime(5000))
  expect(undo.message).toBeNull()
  await act(() => undo.undo())
  expect(videoStorage.import).not.toHaveBeenCalled()
})

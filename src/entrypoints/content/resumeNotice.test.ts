import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { showResumeNotice } from './resumeNotice'

const notice = () => document.getElementById('yt-tracker-resume-notice')

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

it('shows the resumed time inside the player', () => {
  const player = document.createElement('div')
  player.id = 'movie_player'
  document.body.append(player)
  showResumeNotice(754, vi.fn())
  expect(notice()?.parentElement).toBe(player)
  expect(notice()?.textContent).toContain('Resumed at 12:34')
})

it('calls onStartOver and closes when Start over is clicked', () => {
  const onStartOver = vi.fn()
  showResumeNotice(60, onStartOver)
  notice()?.querySelector('button')?.click()
  expect(onStartOver).toHaveBeenCalled()
  expect(notice()).toBeNull()
})

it('closes after a timeout, or when the signal aborts', () => {
  showResumeNotice(60, vi.fn())
  vi.advanceTimersByTime(6000)
  expect(notice()).toBeNull()

  const controller = new AbortController()
  showResumeNotice(60, vi.fn(), controller.signal)
  controller.abort()
  expect(notice()).toBeNull()
})

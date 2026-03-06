import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatTime, timeAgo } from './utils'

describe('formatTime', () => {
  it('formats seconds below a minute', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(30)).toBe('0:30')
    expect(formatTime(59)).toBe('0:59')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(60)).toBe('1:00')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(90)).toBe('1:30')
    expect(formatTime(599)).toBe('9:59')
  })

  it('pads seconds with leading zero', () => {
    expect(formatTime(61)).toBe('1:01')
    expect(formatTime(3601)).toBe('1:00:01')
  })

  it('formats hours, minutes, and seconds', () => {
    expect(formatTime(3600)).toBe('1:00:00')
    expect(formatTime(3661)).toBe('1:01:01')
    expect(formatTime(5400)).toBe('1:30:00')
    expect(formatTime(7199)).toBe('1:59:59')
  })

  it('omits hours when zero', () => {
    expect(formatTime(3599)).toBe('59:59')
  })
})

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const now = new Date('2024-01-01T12:00:00Z').getTime()

  it('returns "just now" for less than a minute ago', () => {
    expect(timeAgo(now)).toBe('just now')
    expect(timeAgo(now - 59_000)).toBe('just now')
  })

  it('returns minutes for less than an hour ago', () => {
    expect(timeAgo(now - 60_000)).toBe('1m ago')
    expect(timeAgo(now - 5 * 60_000)).toBe('5m ago')
    expect(timeAgo(now - 59 * 60_000)).toBe('59m ago')
  })

  it('returns hours for less than a day ago', () => {
    expect(timeAgo(now - 60 * 60_000)).toBe('1h ago')
    expect(timeAgo(now - 3 * 60 * 60_000)).toBe('3h ago')
    expect(timeAgo(now - 23 * 60 * 60_000)).toBe('23h ago')
  })

  it('returns days for a day or more ago', () => {
    expect(timeAgo(now - 24 * 60 * 60_000)).toBe('1d ago')
    expect(timeAgo(now - 7 * 24 * 60 * 60_000)).toBe('7d ago')
  })
})

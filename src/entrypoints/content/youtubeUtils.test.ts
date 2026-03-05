import { afterEach, describe, expect, it, vi } from 'vitest'
import { getVideoId, getVideoTitle } from './youtubeUtils'

describe('getVideoId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the video id from the v query param', () => {
    vi.stubGlobal('location', { search: '?v=abc123' })
    expect(getVideoId()).toBe('abc123')
  })

  it('returns null when the v param is missing', () => {
    vi.stubGlobal('location', { search: '?list=PLxyz' })
    expect(getVideoId()).toBeNull()
  })

  it('returns null when search is empty', () => {
    vi.stubGlobal('location', { search: '' })
    expect(getVideoId()).toBeNull()
  })
})

describe('getVideoTitle', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.title = ''
  })

  it('returns text from h1.ytd-watch-metadata', () => {
    const h1 = document.createElement('h1')
    h1.className = 'ytd-watch-metadata'
    Object.defineProperty(h1, 'innerText', { get: () => '  My Video Title  ', configurable: true })
    document.body.appendChild(h1)
    expect(getVideoTitle()).toBe('My Video Title')
  })

  it('falls back to document.title stripping the "- YouTube" suffix', () => {
    document.title = 'Cool Video - YouTube'
    expect(getVideoTitle()).toBe('Cool Video')
  })

  it('returns "Unknown Title" when no title source is available', () => {
    expect(getVideoTitle()).toBe('Unknown Title')
  })
})

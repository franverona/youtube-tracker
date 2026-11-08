import { formatTime } from '@/utils'

const NOTICE_ID = 'yt-tracker-resume-notice'
const NOTICE_MS = 6000

/**
 * Shows "Resumed at 12:34 · Start over" over the player, since an automatic
 * seek (plus play) can surprise. Inline styles so YouTube's CSS can't restyle
 * it and ours can't leak into the page.
 */
export function showResumeNotice(time: number, onStartOver: () => void, signal?: AbortSignal) {
  document.getElementById(NOTICE_ID)?.remove()

  const notice = document.createElement('div')
  notice.id = NOTICE_ID
  notice.setAttribute('role', 'status')
  Object.assign(notice.style, {
    position: 'absolute',
    top: '12px',
    left: '12px',
    zIndex: '60',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    borderRadius: '8px',
    background: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    font: '500 13px/1.4 Roboto, Arial, sans-serif',
  })

  const text = document.createElement('span')
  text.textContent = `Resumed at ${formatTime(time)}`

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Start over'
  Object.assign(button.style, {
    padding: '0',
    border: '0',
    background: 'none',
    color: '#3ea6ff',
    font: 'inherit',
    cursor: 'pointer',
  })

  const close = () => {
    clearTimeout(timer)
    notice.remove()
  }
  button.addEventListener('click', () => {
    onStartOver()
    close()
  })
  signal?.addEventListener('abort', close)

  notice.append(text, button)
  ;(document.querySelector('#movie_player') ?? document.body).append(notice)
  const timer = setTimeout(close, NOTICE_MS)
}

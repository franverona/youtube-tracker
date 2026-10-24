import { useEffect, useState } from 'react'
import { videoStorage, type VideoStateType } from '@/storage'

const UNDO_TIMEOUT_MS = 5000

// ponytail: in-memory only — the undo is lost if the popup/options page closes.
export function useUndo() {
  const [pending, setPending] = useState<{ message: string; removed: VideoStateType } | null>(null)

  useEffect(() => {
    if (!pending) return
    const timeout = setTimeout(() => setPending(null), UNDO_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [pending])

  return {
    message: pending?.message ?? null,
    /** Call right before removing `removed` from storage. */
    remember: (message: string, removed: VideoStateType) => setPending({ message, removed }),
    undo: async () => {
      if (!pending) return
      setPending(null)
      // Import merges per id keeping the newer entry, so anything re-saved
      // since the removal isn't rolled back.
      await videoStorage.import(pending.removed)
    },
  }
}

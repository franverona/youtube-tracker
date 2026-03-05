import { vi } from 'vitest'

vi.spyOn(console, 'warn').mockImplementation(() => {})

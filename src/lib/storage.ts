import { STORAGE_KEY } from './constants'
import type { SharePayload } from '../types'

export function loadState(): SharePayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SharePayload
  } catch {
    return null
  }
}

export function saveState(payload: SharePayload): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore quota errors / private-mode storage restrictions.
  }
}

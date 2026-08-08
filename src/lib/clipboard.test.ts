// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.querySelectorAll('textarea').forEach((el) => el.remove())
})

describe('copyText', () => {
  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    await expect(copyText('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to document.execCommand when navigator.clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const execCommand = vi.fn().mockReturnValue(true)
    vi.stubGlobal('document', document)
    document.execCommand = execCommand

    await expect(copyText('fallback text')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    // The offscreen textarea used to stage the selection is cleaned up, not left in the DOM.
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
  })

  it('falls back when navigator.clipboard.writeText rejects (e.g. permission denied)', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    document.execCommand = vi.fn().mockReturnValue(true)

    await expect(copyText('hello')).resolves.toBe(true)
  })

  it('resolves false when both the modern and legacy paths fail', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    document.execCommand = vi.fn().mockReturnValue(false)

    await expect(copyText('nope')).resolves.toBe(false)
  })
})

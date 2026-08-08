// document.execCommand is deprecated, but unlike navigator.clipboard it
// isn't gated behind a secure context — it's the only thing that still works
// for someone self-hosting over plain HTTP on a LAN IP (not localhost/HTTPS,
// so navigator.clipboard is simply undefined there). Selecting real text in
// an offscreen textarea and copying that selection is the standard shape of
// this fallback.
function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  let succeeded = false
  try {
    succeeded = document.execCommand('copy')
  } catch {
    succeeded = false
  }

  document.body.removeChild(textarea)
  return succeeded
}

export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Falls through to the legacy path below (e.g. permission denied).
    }
  }

  return legacyCopy(text)
}

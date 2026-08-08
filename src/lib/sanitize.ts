export const MAX_COLOR_NAME_LENGTH = 32

// Letters, digits, spaces, and a small set of punctuation real paint names
// actually use (Payne's Grey, Burnt Sienna (Natural), Naples Yellow, Light).
// Excludes anything that could look like markup/code (<, >, quotes,
// backticks, braces, slashes) — defense in depth even though Preact already
// escapes rendered text, since names also flow into the share API payload,
// the downloaded recipe image, and copied clipboard text.
const DISALLOWED_NAME_CHARS = /[^a-zA-Z0-9 '&().,-]/g

export function sanitizeColorName(raw: string): string {
  return raw.replace(DISALLOWED_NAME_CHARS, '').slice(0, MAX_COLOR_NAME_LENGTH)
}

const DISALLOWED_HEX_CHARS = /[^0-9a-fA-F#]/g
const MAX_HEX_INPUT_LENGTH = 7 // "#RRGGBB"

// Only constrains the character set/length while typing — a full "is this a
// complete, valid color" check happens downstream in hexToRgb, since the
// field legitimately passes through incomplete values mid-edit (e.g. "#1b").
export function sanitizeHexInput(raw: string): string {
  return raw.replace(DISALLOWED_HEX_CHARS, '').slice(0, MAX_HEX_INPUT_LENGTH)
}

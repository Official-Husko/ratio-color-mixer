import type { JSX } from 'preact'

interface SwatchProps {
  hex: string
  size: number
  radius: number
  editable?: boolean
  onChange?: (hex: string) => void
}

export function Swatch({ hex, size, radius, editable, onChange }: SwatchProps) {
  return (
    <div
      class="swatch"
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        border: '1px solid var(--border-input)',
        background: hex,
        flex: 'none',
      }}
    >
      {editable && (
        <input
          type="color"
          value={hex}
          onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => onChange?.(e.currentTarget.value)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            border: 'none',
            padding: 0,
          }}
        />
      )}
    </div>
  )
}

import type { TargetedEvent } from 'preact'
import type { ColorItem } from '../types'
import { Swatch } from './ui/Swatch'
import { Icon } from './ui/Icon'

interface ColorRowProps {
  color: ColorItem
  /** Shown as the name field's placeholder — matches the "Color N" fallback used elsewhere once a color is left unnamed, so the two labels are recognizably the same row. */
  fallbackName: string
  onHexChange: (hex: string) => void
  onNameChange: (name: string) => void
  onRemove: () => void
}

export function ColorRow({ color, fallbackName, onHexChange, onNameChange, onRemove }: ColorRowProps) {
  const isUnnamed = !color.name.trim()

  return (
    <div
      class="color-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 8,
        borderRadius: 14,
        background: 'var(--row-bg)',
      }}
    >
      <Swatch hex={color.hex} size={38} radius={11} editable onChange={onHexChange} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
          <input
            type="text"
            value={color.name}
            onInput={(e: TargetedEvent<HTMLInputElement>) => onNameChange(e.currentTarget.value)}
            placeholder={fallbackName}
            // Sized to the placeholder text itself (rather than flex:1 filling
            // the row) so the muted hint can sit right after it instead of
            // being pushed off to the far edge of an otherwise-empty input.
            size={isUnnamed ? fallbackName.length : undefined}
            style={{
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--sans)',
              fontWeight: 600,
              fontSize: 13.5,
              background: 'transparent',
              padding: 0,
              flex: isUnnamed ? 'none' : 1,
              minWidth: 0,
              color: 'var(--text)',
            }}
          />
          {isUnnamed && (
            <span
              style={{
                fontSize: 10.5,
                color: 'var(--text-faint)',
                flex: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              (Name this color)
            </span>
          )}
        </div>
        <input
          type="text"
          value={color.hex}
          onInput={(e: TargetedEvent<HTMLInputElement>) => onHexChange(e.currentTarget.value)}
          style={{
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: '#8a8a8a',
            background: 'transparent',
            padding: 0,
            width: '100%',
            textTransform: 'uppercase',
          }}
        />
      </div>
      <button type="button" onClick={onRemove} aria-label="Remove color" class="icon-btn remove-btn">
        <Icon name="xmark" />
      </button>
    </div>
  )
}

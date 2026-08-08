import type { JSX } from 'preact'
import type { ColorItem } from '../types'
import { Swatch } from './ui/Swatch'
import { Icon } from './ui/Icon'

interface ColorRowProps {
  color: ColorItem
  onHexChange: (hex: string) => void
  onNameChange: (name: string) => void
  onRemove: () => void
}

export function ColorRow({ color, onHexChange, onNameChange, onRemove }: ColorRowProps) {
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
        <input
          type="text"
          value={color.name}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => onNameChange(e.currentTarget.value)}
          placeholder="Name this color"
          style={{
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--sans)',
            fontWeight: 600,
            fontSize: 13.5,
            background: 'transparent',
            padding: 0,
            width: '100%',
            color: 'var(--text)',
          }}
        />
        <input
          type="text"
          value={color.hex}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => onHexChange(e.currentTarget.value)}
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

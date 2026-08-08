import type { JSX } from 'preact'
import { useRef } from 'preact/hooks'
import type { ColorItem } from '../types'
import { card } from '../styles'
import { CUSTOM_COLOR_PALETTE } from '../lib/constants'
import { ColorRow } from './ColorRow'
import { Icon } from './ui/Icon'

interface YourColorsCardProps {
  colors: ColorItem[]
  canSimplify: boolean
  addDisabled: boolean
  addButtonLabel: string
  colorCountLabel: string
  onCustomColorPicked: (hex: string) => void
  onSimplify: () => void
  onUpdateHex: (id: string, hex: string) => void
  onUpdateName: (id: string, name: string) => void
  onRemove: (id: string) => void
}

export function YourColorsCard({
  colors,
  canSimplify,
  addDisabled,
  addButtonLabel,
  colorCountLabel,
  onCustomColorPicked,
  onSimplify,
  onUpdateHex,
  onUpdateName,
  onRemove,
}: YourColorsCardProps) {
  const pickerRef = useRef<HTMLInputElement>(null)

  function openCustomColorPicker() {
    if (!pickerRef.current) return
    // Seed the native picker with the next rotation color so it opens on
    // something reasonable rather than black — but nothing is added to the
    // list until the picker's `change` fires (i.e. the user applies a color).
    pickerRef.current.value = CUSTOM_COLOR_PALETTE[colors.length % CUSTOM_COLOR_PALETTE.length]
    pickerRef.current.click()
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>Your colors</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {canSimplify && (
            <button
              type="button"
              onClick={onSimplify}
              class="link-btn"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--accent)',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                cursor: 'pointer',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                textDecoration: 'underline',
              }}
            >
              <Icon name="shuffle" />
              Simplify mix
            </button>
          )}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-muted)' }}>
            {colorCountLabel}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {colors.map((color) => (
          <ColorRow
            key={color.id}
            color={color}
            onHexChange={(hex) => onUpdateHex(color.id, hex)}
            onNameChange={(name) => onUpdateName(color.id, name)}
            onRemove={() => onRemove(color.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={openCustomColorPicker}
        disabled={addDisabled}
        class="dashed-btn"
        style={{
          width: '100%',
          padding: 11,
          borderRadius: 12,
          border: '1.5px dashed var(--border-dashed)',
          background: 'transparent',
          color: 'var(--accent)',
          fontFamily: 'var(--sans)',
          fontWeight: 600,
          fontSize: 13.5,
          cursor: addDisabled ? 'default' : 'pointer',
          opacity: addDisabled ? 0.6 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {!addDisabled && <Icon name="plus" />}
        {addButtonLabel}
      </button>

      <input
        ref={pickerRef}
        type="color"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => onCustomColorPicked(e.currentTarget.value)}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 'none', padding: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}

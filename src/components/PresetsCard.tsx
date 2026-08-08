import { PRESETS } from '../lib/constants'
import { card } from '../styles'

interface PresetsCardProps {
  onAdd: (hex: string, name: string) => void
}

export function PresetsCard({ onAdd }: PresetsCardProps) {
  return (
    <div style={card}>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Presets</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {PRESETS.map((preset) => (
          <button
            key={preset.hex}
            type="button"
            onClick={() => onAdd(preset.hex, preset.name)}
            class="preset-btn"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div
              class="preset-swatch"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: preset.hex,
                border: '1px solid var(--border-dashed)',
              }}
            />
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 9.5,
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              {preset.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

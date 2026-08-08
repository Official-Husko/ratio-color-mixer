import type { JSX } from 'preact'
import { VOLUME_UNIT_LABELS, VOLUME_UNITS, mlToUnit, unitToMl, volumePresetsFor, type VolumeUnit } from '../lib/units'

interface BatchSizeControlProps {
  totalMl: number
  volumeUnit: VolumeUnit
  onVolumeChange: (ml: number) => void
  onUnitChange: (unit: VolumeUnit) => void
}

const MIN_ML = 1
const MAX_ML = 25000

export function BatchSizeControl({ totalMl, volumeUnit, onVolumeChange, onUnitChange }: BatchSizeControlProps) {
  // Rounded to avoid float noise (e.g. an mL<->gallon round trip landing on
  // 1.0000000000000002) without padding with trailing zeros the way a fixed
  // decimal count would.
  const displayValue = Math.round(mlToUnit(totalMl, volumeUnit) * 1e6) / 1e6

  // Fires on blur/Enter rather than per-keystroke (Preact's onChange, not
  // onInput) — the typed value round-trips through a unit conversion back
  // into this same field, and reformatting mid-keystroke on every character
  // would fight the user (e.g. stripping a trailing "." while typing "1.5").
  function handleAmountCommit(e: JSX.TargetedEvent<HTMLInputElement>) {
    const raw = Number(e.currentTarget.value)
    if (!Number.isFinite(raw)) return
    onVolumeChange(Math.min(MAX_ML, Math.max(MIN_ML, unitToMl(raw, volumeUnit))))
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>Batch size</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          type="number"
          min={0}
          step="any"
          value={displayValue}
          onChange={handleAmountCommit}
          style={{
            flex: 1,
            minWidth: 0,
            border: '1px solid var(--border-input)',
            borderRadius: 8,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontFamily: 'var(--mono)',
            fontSize: 13,
            padding: '7px 10px',
          }}
        />
        <select
          value={volumeUnit}
          onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => onUnitChange(e.currentTarget.value as VolumeUnit)}
          style={{
            border: '1px solid var(--border-input)',
            borderRadius: 8,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontFamily: 'var(--mono)',
            fontSize: 13,
            padding: '7px 8px',
            cursor: 'pointer',
          }}
        >
          {VOLUME_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {VOLUME_UNIT_LABELS[unit]}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {volumePresetsFor(volumeUnit).map((preset) => (
          <button
            key={preset.label}
            type="button"
            class="preset-chip"
            onClick={() => onVolumeChange(preset.ml)}
            style={{
              border: '1px solid var(--border-input)',
              borderRadius: 999,
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}

import type { FeedbackKind, UnitMode, ViewModel } from '../types'
import type { VolumeUnit } from '../lib/units'
import { card, segmentedButton, segmentedTrack } from '../styles'
import { Swatch } from './ui/Swatch'
import { RatioBar } from './RatioBar'
import { RecipeList } from './RecipeList'
import { ActionButtons } from './ActionButtons'
import { BatchSizeControl } from './BatchSizeControl'

interface EstimatedMixCardProps {
  vm: ViewModel
  target: string
  totalMl: number
  unitMode: UnitMode
  volumeUnit: VolumeUnit
  feedback: FeedbackKind
  onVolumeChange: (ml: number) => void
  onSetUnitMode: (mode: UnitMode) => void
  onSetVolumeUnit: (unit: VolumeUnit) => void
  onCopyRecipe: () => void
  onDownloadImage: () => void
  onShare: () => void
}

export function EstimatedMixCard({
  vm,
  target,
  totalMl,
  unitMode,
  volumeUnit,
  feedback,
  onVolumeChange,
  onSetUnitMode,
  onSetVolumeUnit,
  onCopyRecipe,
  onDownloadImage,
  onShare,
}: EstimatedMixCardProps) {
  return (
    <div style={{ ...card, padding: 26, position: 'sticky', top: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>Estimated mix</div>
        {vm.hasEnoughColors && (
          <div
            class="match-badge"
            style={{
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              fontSize: 12.5,
              padding: '5px 12px',
              borderRadius: 999,
              background: vm.matchBadge.bg,
              color: vm.matchBadge.text,
            }}
          >
            {vm.match}% match
          </div>
        )}
      </div>

      {!vm.hasEnoughColors && (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#b0b0b0', marginBottom: 6 }}>Add at least 2 colors</div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            Once you've added your colors, we'll estimate the ratio to reach your target.
          </div>
        </div>
      )}

      {vm.hasEnoughColors && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '8px 0 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Swatch hex={target} size={96} radius={20} />
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Target</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                {target.toUpperCase()}
              </div>
            </div>
            <div style={{ fontSize: 22, color: '#4a4a4a' }}>→</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Swatch hex={vm.mixedHex} size={96} radius={20} />
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Your mix</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                {vm.mixedHex.toUpperCase()}
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--divider)', marginBottom: 20 }} />

          <BatchSizeControl
            totalMl={totalMl}
            volumeUnit={volumeUnit}
            onVolumeChange={onVolumeChange}
            onUnitChange={onSetVolumeUnit}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Mix ratio</div>
            <div style={segmentedTrack}>
              <button
                type="button"
                onClick={() => onSetUnitMode('percentage')}
                class="segment-btn"
                style={segmentedButton(unitMode === 'percentage')}
              >
                %
              </button>
              <button type="button" onClick={() => onSetUnitMode('ml')} class="segment-btn" style={segmentedButton(unitMode === 'ml')}>
                Vol
              </button>
            </div>
          </div>

          <RatioBar items={vm.colors} />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {vm.colors.map((row) => (
              <div
                key={row.id}
                class="mix-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--divider-soft)',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    background: row.hex,
                    flex: 'none',
                    border: '1px solid var(--border-input)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.displayName}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{row.hexUpper}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flex: 'none' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 18 }}>{row.displayValue}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    ({row.exactLabel})
                  </div>
                </div>
              </div>
            ))}
          </div>

          <RecipeList items={vm.recipeItems} />

          <div style={{ fontSize: 12, color: 'var(--text-muted-2)', marginTop: 16, lineHeight: 1.5 }}>
            Estimate based on simple color blending — actual mixing results depend on the pigments or materials used.
          </div>

          <ActionButtons feedback={feedback} onCopyRecipe={onCopyRecipe} onDownloadImage={onDownloadImage} onShare={onShare} />
        </div>
      )}
    </div>
  )
}

import type { TargetedEvent } from 'preact'
import { card } from '../styles'
import { Swatch } from './ui/Swatch'
import { ImageSampler } from './ImageSampler'

interface TargetColorCardProps {
  target: string
  targetRgb: { r: number; g: number; b: number }
  image: string | null
  onTargetChange: (hex: string) => void
  onImageUpload: (file: File) => void
  onImageSample: (img: HTMLImageElement, clientX: number, clientY: number) => void
  onImageRemove: () => void
}

export function TargetColorCard({
  target,
  targetRgb,
  image,
  onTargetChange,
  onImageUpload,
  onImageSample,
  onImageRemove,
}: TargetColorCardProps) {
  const channels: Array<{ label: string; value: number; color: string }> = [
    { label: 'R', value: targetRgb.r, color: `rgb(${targetRgb.r},0,0)` },
    { label: 'G', value: targetRgb.g, color: `rgb(0,${targetRgb.g},0)` },
    { label: 'B', value: targetRgb.b, color: `rgb(0,0,${targetRgb.b})` },
  ]
  return (
    <div style={card}>
      <h2 style={{ fontWeight: 600, fontSize: 15, margin: '0 0 16px' }}>Target color</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        <Swatch hex={target} size={64} radius={16} editable onChange={onTargetChange} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              marginBottom: 4,
            }}
          >
            HEX
          </div>
          <input
            type="text"
            value={target}
            onInput={(e: TargetedEvent<HTMLInputElement>) => onTargetChange(e.currentTarget.value)}
            maxLength={7}
            style={{
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--mono)',
              fontSize: 20,
              fontWeight: 600,
              background: 'transparent',
              padding: 0,
              width: '100%',
              textTransform: 'uppercase',
              color: 'var(--text)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            {channels.map(({ label, value, color }) => (
              <div key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: color,
                    border: '1px solid var(--border-input)',
                    flex: 'none',
                  }}
                />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {label} {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>OR</div>
        <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
      </div>

      <ImageSampler image={image} onUpload={onImageUpload} onSample={onImageSample} onRemove={onImageRemove} />
    </div>
  )
}

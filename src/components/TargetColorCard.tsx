import type { JSX } from 'preact'
import { card } from '../styles'
import { Swatch } from './ui/Swatch'
import { ImageSampler } from './ImageSampler'

interface TargetColorCardProps {
  target: string
  targetRgbLabel: string
  image: string | null
  onTargetChange: (hex: string) => void
  onImageUpload: (file: File) => void
  onImageSample: (img: HTMLImageElement, clientX: number, clientY: number) => void
  onImageRemove: () => void
}

export function TargetColorCard({
  target,
  targetRgbLabel,
  image,
  onTargetChange,
  onImageUpload,
  onImageSample,
  onImageRemove,
}: TargetColorCardProps) {
  return (
    <div style={card}>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Target color</div>
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
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => onTargetChange(e.currentTarget.value)}
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
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            {targetRgbLabel}
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

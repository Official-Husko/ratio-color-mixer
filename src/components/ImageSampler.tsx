import type { JSX } from 'preact'
import { dashedBox } from '../styles'
import { Icon } from './ui/Icon'

interface ImageSamplerProps {
  image: string | null
  onUpload: (file: File) => void
  onSample: (img: HTMLImageElement, clientX: number, clientY: number) => void
  onRemove: () => void
}

export function ImageSampler({ image, onUpload, onSample, onRemove }: ImageSamplerProps) {
  if (!image) {
    return (
      <div class="dashed-box" style={{ position: 'relative', ...dashedBox }}>
        <Icon name="image" style={{ fontSize: 18, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Upload an image to sample a color from it</div>
        <input
          type="file"
          accept="image/*"
          onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
            const file = e.currentTarget.files?.[0]
            if (file) onUpload(file)
          }}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
        />
      </div>
    )
  }

  return (
    <div>
      <img
        src={image}
        onClick={(e: JSX.TargetedMouseEvent<HTMLImageElement>) => onSample(e.currentTarget, e.clientX, e.clientY)}
        style={{
          width: '100%',
          maxHeight: 160,
          objectFit: 'contain',
          borderRadius: 12,
          border: '1px solid var(--divider)',
          cursor: 'crosshair',
          background: '#0d0d0d',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="eyedropper" />
          Click the image to sample a color
        </div>
        <button type="button" onClick={onRemove} class="link-btn" style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          fontSize: 12,
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
        }}>
          Remove
        </button>
      </div>
    </div>
  )
}

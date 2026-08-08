import type { JSX } from 'preact'

export const card: JSX.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: 20,
  padding: 22,
}

export const dashedBox: JSX.CSSProperties = {
  border: '1.5px dashed var(--border-dashed)',
  borderRadius: 14,
  padding: 22,
  textAlign: 'center',
}

export const pillButton: JSX.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 10,
  border: '1px solid var(--border-input)',
  background: 'transparent',
  fontFamily: 'var(--sans)',
  fontWeight: 600,
  fontSize: 12.5,
  cursor: 'pointer',
}

export const segmentedTrack: JSX.CSSProperties = {
  display: 'flex',
  background: 'var(--bg)',
  borderRadius: 8,
  padding: 2,
  gap: 2,
}

export function segmentedButton(active: boolean): JSX.CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: 6,
    border: 'none',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    cursor: 'pointer',
    background: active ? 'var(--card-border)' : 'transparent',
    color: active ? 'var(--accent)' : '#8a8a8a',
  }
}

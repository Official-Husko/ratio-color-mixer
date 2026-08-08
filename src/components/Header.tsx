export function Header() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{ position: 'relative', width: 28, height: 28, flex: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '1.5px solid var(--border-dashed)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 8,
              top: 0,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--accent)',
            }}
          />
        </div>
        <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>Ratio</div>
      </div>

      <div style={{ marginBottom: 40, maxWidth: 640 }}>
        <div style={{ fontWeight: 700, fontSize: 38, lineHeight: 1.15, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
          Mix your way to any color
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0 }}>
          Add the colors you have on hand, set a target, and see the ratio to blend.
        </div>
      </div>
    </>
  )
}

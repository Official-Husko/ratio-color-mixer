export function Header() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <img src="/favicon.svg" alt="" width={28} height={28} style={{ flex: 'none' }} />
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

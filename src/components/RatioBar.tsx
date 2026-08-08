interface RatioBarProps {
  items: Array<{ id: string; hex: string; percentWidth: string }>
}

export function RatioBar({ items }: RatioBarProps) {
  return (
    <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
      {items.map((item) => (
        <div class="ratio-segment" key={item.id} style={{ height: '100%', background: item.hex, width: item.percentWidth }} />
      ))}
    </div>
  )
}

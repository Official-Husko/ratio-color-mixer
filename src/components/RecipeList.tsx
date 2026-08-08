import type { RecipeItem } from '../types'

interface RecipeListProps {
  items: RecipeItem[]
}

export function RecipeList({ items }: RecipeListProps) {
  if (items.length === 0) return null

  return (
    <div>
      <h3 style={{ fontWeight: 600, fontSize: 13.5, margin: '20px 0 10px' }}>Recipe</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {items.map((step) => (
          <div key={step.stepNumber} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', width: 16, flex: 'none' }}>
              {step.stepNumber}
            </div>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: step.hex,
                flex: 'none',
                border: '1px solid var(--border-input)',
              }}
            />
            <div style={{ fontSize: 13.5, color: '#d8d8d8' }}>{step.recipeLine}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

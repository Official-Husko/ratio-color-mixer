import type { UnitMode } from '../types'

export interface RecipeImageColor {
  hex: string
  displayName: string
  percent: number
  mlAmount: number
  parts: number
}

export interface RecipeImageParams {
  target: string
  mixedHex: string
  match: number
  totalMl: number
  unitMode: UnitMode
  colors: RecipeImageColor[]
}

const WIDTH = 520
const HEADER_HEIGHT = 190
const ROW_HEIGHT = 42
const PADDING = 28

export function buildRecipeImageCanvas(params: RecipeImageParams): HTMLCanvasElement {
  const rows = params.colors.filter((c) => c.parts > 0)
  const height = HEADER_HEIGHT + rows.length * ROW_HEIGHT + PADDING

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#141414'
  ctx.fillRect(0, 0, WIDTH, height)

  ctx.fillStyle = '#f2f2f2'
  ctx.font = '700 20px "Space Grotesk", sans-serif'
  ctx.fillText('Ratio — mixing recipe', PADDING, 40)

  const swatchY = 62
  const swatchSize = 56
  ctx.fillStyle = params.target
  ctx.fillRect(PADDING, swatchY, swatchSize, swatchSize)
  ctx.fillStyle = params.mixedHex
  ctx.fillRect(PADDING + swatchSize + 16, swatchY, swatchSize, swatchSize)

  ctx.fillStyle = '#9a9a9a'
  ctx.font = '12px "IBM Plex Mono", monospace'
  ctx.fillText('Target', PADDING, swatchY + swatchSize + 16)
  ctx.fillText(params.target.toUpperCase(), PADDING, swatchY + swatchSize + 32)
  ctx.fillText('Your mix', PADDING + swatchSize + 16, swatchY + swatchSize + 16)
  ctx.fillText(params.mixedHex.toUpperCase(), PADDING + swatchSize + 16, swatchY + swatchSize + 32)

  ctx.fillStyle = params.match >= 90 ? '#7de0c9' : '#a0a0a0'
  ctx.font = '600 14px "IBM Plex Mono", monospace'
  ctx.fillText(`${params.match}% match`, PADDING + swatchSize * 2 + 48, swatchY + 16)
  ctx.fillStyle = '#9a9a9a'
  ctx.font = '12px "IBM Plex Mono", monospace'
  ctx.fillText(`Batch: ${params.totalMl} ml`, PADDING + swatchSize * 2 + 48, swatchY + 36)

  let y = HEADER_HEIGHT
  for (const row of rows) {
    ctx.fillStyle = row.hex
    ctx.fillRect(PADDING, y, 20, 20)

    ctx.fillStyle = '#f2f2f2'
    ctx.font = '600 14px "Space Grotesk", sans-serif'
    ctx.fillText(row.displayName, PADDING + 32, y + 15)

    const valueText = params.unitMode === 'ml' ? `${row.mlAmount} ml` : `${row.percent}%`
    ctx.fillStyle = '#7de0c9'
    ctx.font = '600 14px "IBM Plex Mono", monospace'
    ctx.fillText(valueText, WIDTH - PADDING - 90, y + 15)

    y += ROW_HEIGHT
  }

  ctx.fillStyle = '#6a6a6a'
  ctx.font = '11px "Space Grotesk", sans-serif'
  ctx.fillText('Estimate based on simple color blending — actual results depend on materials used.', PADDING, height - 12)

  return canvas
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename = 'ratio-recipe.png'): void {
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

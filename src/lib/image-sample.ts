import { rgbToHex } from './color-math'

/** Converts a click's page coordinates into the image's natural pixel grid. */
export function naturalCoordsFromClick(
  img: HTMLImageElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = img.getBoundingClientRect()
  return {
    x: Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * img.naturalWidth)),
    y: Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * img.naturalHeight)),
  }
}

export function sampleImagePixel(img: HTMLImageElement, x: number, y: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return '#808080'

  ctx.drawImage(img, 0, 0)
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
  return rgbToHex({ r, g, b })
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

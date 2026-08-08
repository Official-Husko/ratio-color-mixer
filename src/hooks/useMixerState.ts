import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { solvePaintMixHex } from '../lib/color-math'
import { buildViewModel, pickSimplifiedColors } from '../lib/recipe'
import { copyText } from '../lib/clipboard'
import { buildShareUrl, decodeShareState } from '../lib/share-link'
import { loadState, saveState } from '../lib/storage'
import { naturalCoordsFromClick, readFileAsDataUrl, sampleImagePixel } from '../lib/image-sample'
import { buildRecipeImageCanvas, downloadCanvasAsPng } from '../lib/image-export'
import {
  DEFAULT_COLORS,
  DEFAULT_TARGET,
  DEFAULT_TOTAL_ML,
  FEEDBACK_DURATION_MS,
  MAX_COLORS,
  PERSIST_DEBOUNCE_MS,
  SHARE_PARAM,
} from '../lib/constants'
import type { ColorItem, FeedbackKind, SharePayload, UnitMode } from '../types'

function withId(color: { hex: string; name: string }): ColorItem {
  return { id: crypto.randomUUID(), hex: color.hex, name: color.name }
}

interface InitialState {
  colors: ColorItem[]
  target: string
  totalMl: number
  unitMode: UnitMode
  fromShareLink: boolean
}

function resolveInitialState(): InitialState {
  const shared = typeof location !== 'undefined' ? decodeShareState(location.search) : null
  if (shared) {
    return {
      colors: shared.colors.slice(0, MAX_COLORS).map(withId),
      target: shared.target,
      totalMl: shared.totalMl,
      unitMode: shared.unitMode,
      fromShareLink: true,
    }
  }

  const stored = loadState()
  if (stored) {
    return {
      colors: stored.colors.slice(0, MAX_COLORS).map(withId),
      target: stored.target,
      totalMl: stored.totalMl,
      unitMode: stored.unitMode,
      fromShareLink: false,
    }
  }

  return {
    colors: DEFAULT_COLORS.map(withId),
    target: DEFAULT_TARGET,
    totalMl: DEFAULT_TOTAL_ML,
    unitMode: 'percentage',
    fromShareLink: false,
  }
}

export function useMixerState() {
  const [initial] = useState(resolveInitialState)
  const [colors, setColors] = useState<ColorItem[]>(initial.colors)
  const [target, setTarget] = useState(initial.target)
  const [image, setImage] = useState<string | null>(null)
  const [totalMl, setTotalMl] = useState(initial.totalMl)
  const [unitMode, setUnitMode] = useState<UnitMode>(initial.unitMode)
  const [feedback, setFeedback] = useState<FeedbackKind>(null)

  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>()
  const persistTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!initial.fromShareLink) return
    const params = new URLSearchParams(location.search)
    params.delete(SHARE_PARAM)
    const query = params.toString()
    history.replaceState(null, '', location.pathname + (query ? `?${query}` : ''))
    // initial.fromShareLink never changes after the initial useState(resolveInitialState)
    // call, so this only needs to run once, right after mount.
  }, [initial.fromShareLink])

  useEffect(() => {
    clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      const payload: SharePayload = {
        v: 1,
        target,
        totalMl,
        unitMode,
        colors: colors.map((c) => ({ hex: c.hex, name: c.name })),
      }
      saveState(payload)
    }, PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(persistTimer.current)
  }, [colors, target, totalMl, unitMode])

  useEffect(() => () => clearTimeout(feedbackTimer.current), [])

  function flashFeedback(kind: FeedbackKind) {
    setFeedback(kind)
    clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS)
  }

  const solveResult = useMemo(
    () => (colors.length ? solvePaintMixHex(colors.map((c) => c.hex), target) : null),
    [colors, target],
  )

  const viewModel = useMemo(
    () => buildViewModel(colors, target, solveResult, totalMl, unitMode, 'percent-desc'),
    [colors, target, solveResult, totalMl, unitMode],
  )

  function addColor(hex: string, name: string): string | null {
    if (colors.length >= MAX_COLORS) return null
    const id = crypto.randomUUID()
    setColors((prev) => [...prev, { id, hex, name }])
    return id
  }

  function addPreset(hex: string, name: string) {
    if (colors.some((c) => c.hex.toLowerCase() === hex.toLowerCase())) return
    addColor(hex, name)
  }

  // Called only once the user has actually confirmed a color in the native
  // picker (the picker's `change` event) — dismissing it without picking
  // never calls this, so nothing gets added in that case.
  function addCustomColor(hex: string) {
    addColor(hex, '')
  }

  function removeColor(id: string) {
    setColors((prev) => prev.filter((c) => c.id !== id))
  }

  function clearAllColors() {
    setColors([])
  }

  function updateColorHex(id: string, hex: string) {
    setColors((prev) => prev.map((c) => (c.id === id ? { ...c, hex } : c)))
  }

  function updateColorName(id: string, name: string) {
    setColors((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
  }

  async function uploadImage(file: File) {
    setImage(await readFileAsDataUrl(file))
  }

  function sampleImageAt(img: HTMLImageElement, clientX: number, clientY: number) {
    const { x, y } = naturalCoordsFromClick(img, clientX, clientY)
    setTarget(sampleImagePixel(img, x, y))
  }

  function removeImage() {
    setImage(null)
  }

  function simplifyMix() {
    if (colors.length <= 2 || !solveResult) return
    const kept = pickSimplifiedColors(colors, solveResult.weights)
    if (kept.length === colors.length) return
    setColors(kept)
  }

  async function copyRecipe() {
    const lines = [
      `Target: ${target.toUpperCase()}`,
      '',
      ...viewModel.recipeItems.map((item) => `${item.recipeLine} (${item.percent}%)`),
    ]
    await copyText(lines.join('\n'))
    flashFeedback('recipe')
  }

  function downloadImage() {
    const canvas = buildRecipeImageCanvas({
      target,
      mixedHex: viewModel.mixedHex,
      match: viewModel.match,
      totalMl,
      unitMode,
      colors: viewModel.colors,
    })
    downloadCanvasAsPng(canvas)
    flashFeedback('image')
  }

  async function copyShareLink() {
    const payload: SharePayload = {
      v: 1,
      target,
      totalMl,
      unitMode,
      colors: colors.map((c) => ({ hex: c.hex, name: c.name })),
    }
    await copyText(buildShareUrl(payload))
    flashFeedback('link')
  }

  return {
    colors,
    target,
    image,
    totalMl,
    unitMode,
    feedback,
    viewModel,
    actions: {
      addPreset,
      addCustomColor,
      removeColor,
      clearAllColors,
      updateColorHex,
      updateColorName,
      setTarget,
      uploadImage,
      sampleImageAt,
      removeImage,
      setTotalMl,
      setUnitMode,
      simplifyMix,
      copyRecipe,
      downloadImage,
      copyShareLink,
    },
  }
}

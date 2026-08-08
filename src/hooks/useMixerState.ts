import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { solvePaintMixHex } from '../lib/solve-paint-mix'
import { buildViewModel, pickSimplifiedColors } from '../lib/recipe'
import { copyText } from '../lib/clipboard'
import { buildShareCodeUrl, createShareCode, decodeShareState, fetchSharedPayload, getShareCodeFromUrl } from '../lib/share-link'
import { loadState, saveState } from '../lib/storage'
import { naturalCoordsFromClick, readFileAsDataUrl, sampleImagePixel } from '../lib/image-sample'
import { buildRecipeImageCanvas, downloadCanvasAsPng } from '../lib/image-export'
import { generateId } from '../lib/id'
import { sanitizeColorName, sanitizeHexInput } from '../lib/sanitize'
import { isVolumeUnit, type VolumeUnit } from '../lib/units'
import {
  DEFAULT_COLORS,
  DEFAULT_TARGET,
  DEFAULT_TOTAL_ML,
  DEFAULT_VOLUME_UNIT,
  FEEDBACK_DURATION_MS,
  PERSIST_DEBOUNCE_MS,
  SHARE_CODE_PARAM,
  SHARE_PARAM,
} from '../lib/constants'
import type { ColorItem, FeedbackKind, ShareCodeStatus, SharePayload, UnitMode } from '../types'

function withId(color: { hex: string; name: string }): ColorItem {
  return { id: generateId(), hex: color.hex, name: color.name }
}

interface InitialState {
  colors: ColorItem[]
  target: string
  totalMl: number
  unitMode: UnitMode
  volumeUnit: VolumeUnit
  fromShareLink: boolean
}

function resolveInitialState(): InitialState {
  const shared = typeof location !== 'undefined' ? decodeShareState(location.search) : null
  if (shared) {
    return {
      colors: shared.colors.map(withId),
      target: shared.target,
      totalMl: shared.totalMl,
      unitMode: shared.unitMode,
      volumeUnit: shared.volumeUnit,
      fromShareLink: true,
    }
  }

  const stored = loadState()
  if (stored) {
    return {
      colors: stored.colors.map(withId),
      target: stored.target,
      totalMl: stored.totalMl,
      unitMode: stored.unitMode,
      // Older stored sessions predate unit selection and won't have this field.
      volumeUnit: isVolumeUnit(stored.volumeUnit) ? stored.volumeUnit : DEFAULT_VOLUME_UNIT,
      fromShareLink: false,
    }
  }

  return {
    colors: DEFAULT_COLORS.map(withId),
    target: DEFAULT_TARGET,
    totalMl: DEFAULT_TOTAL_ML,
    unitMode: 'percentage',
    volumeUnit: DEFAULT_VOLUME_UNIT,
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
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(initial.volumeUnit)
  const [feedback, setFeedback] = useState<FeedbackKind>(null)
  const [isSharing, setIsSharing] = useState(false)
  // Set only when a share link was created successfully but couldn't be
  // auto-copied (e.g. navigator.clipboard is unavailable outside a secure
  // context — plain HTTP on a LAN IP, not localhost/HTTPS) so the link isn't
  // just lost; the user can select and copy it manually instead.
  const [sharedLinkUrl, setSharedLinkUrl] = useState<string | null>(null)
  const [shareCodeStatus, setShareCodeStatus] = useState<ShareCodeStatus>(
    typeof location !== 'undefined' && getShareCodeFromUrl(location.search) ? 'loading' : null,
  )

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

  // A `?c=` short code needs a network round-trip, so it can't be resolved
  // synchronously inside resolveInitialState() like the legacy `?s=` link —
  // the app renders with localStorage/defaults first, then this swaps in the
  // fetched palette (or reports failure) once the request settles.
  useEffect(() => {
    const id = getShareCodeFromUrl(location.search)
    if (!id) return

    let cancelled = false
    fetchSharedPayload(id).then((payload) => {
      if (cancelled) return
      if (payload) {
        setColors(payload.colors.map(withId))
        setTarget(payload.target)
        setTotalMl(payload.totalMl)
        setUnitMode(payload.unitMode)
        setVolumeUnit(payload.volumeUnit)
        setShareCodeStatus(null)
      } else {
        setShareCodeStatus('error')
      }
      const params = new URLSearchParams(location.search)
      params.delete(SHARE_CODE_PARAM)
      const query = params.toString()
      history.replaceState(null, '', location.pathname + (query ? `?${query}` : ''))
    })

    return () => {
      cancelled = true
    }
    // Only ever reads the `?c=` param present on first mount.
  }, [])

  useEffect(() => {
    if (shareCodeStatus === 'loading') return // avoid saving the pre-fetch placeholder state over it
    clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      const payload: SharePayload = {
        v: 1,
        target,
        totalMl,
        unitMode,
        volumeUnit,
        colors: colors.map((c) => ({ hex: c.hex, name: c.name })),
      }
      saveState(payload)
    }, PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(persistTimer.current)
  }, [colors, target, totalMl, unitMode, volumeUnit, shareCodeStatus])

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
    () => buildViewModel(colors, target, solveResult, totalMl, unitMode, volumeUnit, 'percent-desc'),
    [colors, target, solveResult, totalMl, unitMode, volumeUnit],
  )

  function addColor(hex: string, name: string): void {
    setColors((prev) => [...prev, { id: generateId(), hex, name }])
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
    const clean = sanitizeHexInput(hex)
    setColors((prev) => prev.map((c) => (c.id === id ? { ...c, hex: clean } : c)))
  }

  function updateColorName(id: string, name: string) {
    const clean = sanitizeColorName(name)
    setColors((prev) => prev.map((c) => (c.id === id ? { ...c, name: clean } : c)))
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

  // Wraps the raw setTarget setter for the free-text hex field specifically —
  // sampleImageAt above calls setTarget directly with an already-trusted
  // value computed from actual pixel data, so it doesn't need this.
  function setTargetHex(hex: string) {
    setTarget(sanitizeHexInput(hex))
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
    // navigator.clipboard is only available in secure contexts (HTTPS, or
    // localhost) — e.g. it's silently absent when testing over `vite --host`
    // from another device's plain-HTTP LAN address. Only claim success if it
    // actually copied, instead of always flashing "Copied!".
    if (await copyText(lines.join('\n'))) flashFeedback('recipe')
  }

  function downloadImage() {
    const canvas = buildRecipeImageCanvas({
      target,
      mixedHex: viewModel.mixedHex,
      match: viewModel.match,
      totalMl,
      volumeUnit,
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
      volumeUnit,
      colors: colors.map((c) => ({ hex: c.hex, name: c.name })),
    }

    setIsSharing(true)
    setSharedLinkUrl(null)
    try {
      const id = await createShareCode(payload)
      const url = buildShareCodeUrl(id)
      // The link was created successfully either way — copyText failing just
      // means the browser wouldn't let us write to the clipboard for you.
      if (await copyText(url)) {
        flashFeedback('link')
      } else {
        setSharedLinkUrl(url)
        flashFeedback('link-fallback')
      }
    } catch {
      flashFeedback('link-error')
    } finally {
      setIsSharing(false)
    }
  }

  function dismissSharedLink() {
    setSharedLinkUrl(null)
  }

  return {
    colors,
    target,
    image,
    totalMl,
    unitMode,
    volumeUnit,
    feedback,
    isSharing,
    shareCodeStatus,
    sharedLinkUrl,
    viewModel,
    actions: {
      addPreset,
      addCustomColor,
      removeColor,
      clearAllColors,
      updateColorHex,
      updateColorName,
      setTarget: setTargetHex,
      uploadImage,
      sampleImageAt,
      removeImage,
      setTotalMl,
      setUnitMode,
      setVolumeUnit,
      simplifyMix,
      dismissSharedLink,
      copyRecipe,
      downloadImage,
      copyShareLink,
    },
  }
}

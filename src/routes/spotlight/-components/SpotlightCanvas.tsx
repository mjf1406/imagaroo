import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Upload } from 'lucide-react'

import type { ImageFile } from '@/components/ImagePreview'
import type {
  SpotlightEffect,
  SpotlightFocusArea,
  SpotlightShape,
  SpotlightShapeFillStyle,
  SpotlightShapeOutlineStyle,
} from '@/lib/image-spotlight'
import {
  clampSpotlightFillOpacityPct,
  clampSpotlightOutlineWidthPx,
  renderSpotlight,
  spotlightFillToRgbaString,
} from '@/lib/image-spotlight'
import type { MagnifierFrame, MagnifierRect } from '@/lib/image-magnifier'
import {
  computeConnectorSegments,
  magnifierExtent,
} from '@/lib/image-magnifier'
import { isValidImageType } from '@/lib/image-converter'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export type SpotlightTool = 'rect' | 'ellipse' | 'magnifier'

export type SpotlightSelection =
  | { kind: 'shape'; id: string }
  | { kind: 'magnifier'; target: 'source' | 'inset' }
  | null

type ResizeHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'

type DraftShape = {
  kind: 'rect' | 'ellipse'
  x: number
  y: number
  w: number
  h: number
}

const MIN_SIZE_SHAPE = 4
const MIN_SIZE_MAG = 6

function isCornerHandle(id: ResizeHandle): boolean {
  return id === 'nw' || id === 'ne' || id === 'se' || id === 'sw'
}

function normalizeRect(x0: number, y0: number, x1: number, y1: number) {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)
  return { x, y, w, h }
}

function applyResizeShape(
  shape: SpotlightShape,
  handle: ResizeHandle,
  dx: number,
  dy: number,
): SpotlightShape {
  let { x, y, w, h } = shape
  switch (handle) {
    case 'nw':
      x += dx
      y += dy
      w -= dx
      h -= dy
      break
    case 'n':
      y += dy
      h -= dy
      break
    case 'ne':
      y += dy
      w += dx
      h -= dy
      break
    case 'e':
      w += dx
      break
    case 'se':
      w += dx
      h += dy
      break
    case 's':
      h += dy
      break
    case 'sw':
      x += dx
      w -= dx
      h += dy
      break
    case 'w':
      x += dx
      w -= dx
      break
    default:
      break
  }
  if (w < MIN_SIZE_SHAPE) {
    const deficit = MIN_SIZE_SHAPE - w
    if (handle === 'nw' || handle === 'w' || handle === 'sw') {
      x -= deficit
    }
    w = MIN_SIZE_SHAPE
  }
  if (h < MIN_SIZE_SHAPE) {
    const deficit = MIN_SIZE_SHAPE - h
    if (handle === 'nw' || handle === 'n' || handle === 'ne') {
      y -= deficit
    }
    h = MIN_SIZE_SHAPE
  }
  return { ...shape, x, y, w, h }
}

function clampMagSourceRect(r: MagnifierRect, iw: number, ih: number): MagnifierRect {
  let { x, y, w, h } = r
  x = Math.max(0, Math.min(x, iw - MIN_SIZE_MAG))
  y = Math.max(0, Math.min(y, ih - MIN_SIZE_MAG))
  w = Math.max(MIN_SIZE_MAG, Math.min(w, iw - x))
  h = Math.max(MIN_SIZE_MAG, Math.min(h, ih - y))
  return { x, y, w, h }
}

function clampInsetRect(r: MagnifierRect, iw: number, ih: number): MagnifierRect {
  let { x, y, w, h } = r
  w = Math.max(MIN_SIZE_MAG, Math.min(w, 3 * iw))
  h = Math.max(MIN_SIZE_MAG, Math.min(h, 3 * ih))
  x = Math.max(-iw, Math.min(x, 2 * iw - w))
  y = Math.max(-ih, Math.min(y, 2 * ih - h))
  return { x, y, w, h }
}

function applyResizeMagRect(
  r: MagnifierRect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
): MagnifierRect {
  let { x, y, w, h } = r
  switch (handle) {
    case 'nw':
      x += dx
      y += dy
      w -= dx
      h -= dy
      break
    case 'n':
      y += dy
      h -= dy
      break
    case 'ne':
      y += dy
      w += dx
      h -= dy
      break
    case 'e':
      w += dx
      break
    case 'se':
      w += dx
      h += dy
      break
    case 's':
      h += dy
      break
    case 'sw':
      x += dx
      w -= dx
      h += dy
      break
    case 'w':
      x += dx
      w -= dx
      break
    default:
      break
  }

  if (w < MIN_SIZE_MAG) {
    const deficit = MIN_SIZE_MAG - w
    if (handle === 'nw' || handle === 'w' || handle === 'sw') x -= deficit
    w = MIN_SIZE_MAG
  }
  if (h < MIN_SIZE_MAG) {
    const deficit = MIN_SIZE_MAG - h
    if (handle === 'nw' || handle === 'n' || handle === 'ne') y -= deficit
    h = MIN_SIZE_MAG
  }

  return { x, y, w, h }
}

function autoInsetForSource(
  source: MagnifierRect,
  iw: number,
  ih: number,
): MagnifierRect {
  const margin = Math.max(12, Math.min(iw, ih) * 0.03)
  const targetW = Math.min(iw * 0.45, Math.max(MIN_SIZE_MAG, source.w * 2))
  const targetH = Math.min(ih * 0.45, Math.max(MIN_SIZE_MAG, source.h * 2))

  const sourceCx = source.x + source.w / 2
  const sourceCy = source.y + source.h / 2
  const right = sourceCx < iw / 2
  const bottom = sourceCy < ih / 2

  const x = right ? iw - margin - targetW : margin
  const y = bottom ? ih - margin - targetH : margin
  return clampMagSourceRect({ x, y, w: targetW, h: targetH }, iw, ih)
}

function corners(r: MagnifierRect) {
  return [
    { id: 'nw' as const, cx: r.x, cy: r.y },
    { id: 'n' as const, cx: r.x + r.w / 2, cy: r.y },
    { id: 'ne' as const, cx: r.x + r.w, cy: r.y },
    { id: 'e' as const, cx: r.x + r.w, cy: r.y + r.h / 2 },
    { id: 'se' as const, cx: r.x + r.w, cy: r.y + r.h },
    { id: 's' as const, cx: r.x + r.w / 2, cy: r.y + r.h },
    { id: 'sw' as const, cx: r.x, cy: r.y + r.h },
    { id: 'w' as const, cx: r.x, cy: r.y + r.h / 2 },
  ]
}

const DRAFT_PREVIEW_ID = '__draft__'

function draftToPreviewShape(
  draft: DraftShape,
  extras: {
    outline?: SpotlightShapeOutlineStyle
    fill?: SpotlightShapeFillStyle
  },
): SpotlightShape {
  const w = Math.max(1, draft.w)
  const h = Math.max(1, draft.h)
  if (draft.kind === 'rect') {
    const base = {
      id: DRAFT_PREVIEW_ID,
      kind: 'rect' as const,
      x: draft.x,
      y: draft.y,
      w,
      h,
    }
    return { ...base, ...extras }
  }
  const base = {
    id: DRAFT_PREVIEW_ID,
    kind: 'ellipse' as const,
    x: draft.x,
    y: draft.y,
    w,
    h,
  }
  return { ...base, ...extras }
}

function svgShapeStroke(
  shape: SpotlightShape,
  isSelected: boolean,
): { stroke: string; strokeWidth: number } {
  if (isSelected) {
    return { stroke: 'hsl(var(--primary))', strokeWidth: 3 }
  }
  if (shape.outline) {
    return {
      stroke: shape.outline.color,
      strokeWidth: clampSpotlightOutlineWidthPx(shape.outline.widthPx),
    }
  }
  return { stroke: 'white', strokeWidth: 1.5 }
}

function svgShapeFill(shape: SpotlightShape): string {
  if (shape.fill) return spotlightFillToRgbaString(shape.fill)
  return 'rgba(255,255,255,0.06)'
}

function clampShapeToImage(s: SpotlightShape, iw: number, ih: number): SpotlightShape {
  let { x, y, w, h } = s
  x = Math.max(0, Math.min(x, iw - MIN_SIZE_SHAPE))
  y = Math.max(0, Math.min(y, ih - MIN_SIZE_SHAPE))
  w = Math.max(MIN_SIZE_SHAPE, Math.min(w, iw - x))
  h = Math.max(MIN_SIZE_SHAPE, Math.min(h, ih - y))
  return { ...s, x, y, w, h }
}

export type SpotlightInteractionPayload = {
  shapes: Array<SpotlightShape>
  magnifier: MagnifierFrame | null
}

interface SpotlightCanvasProps {
  image: ImageFile | null
  shapes: Array<SpotlightShape>
  magnifier: MagnifierFrame | null
  selection: SpotlightSelection
  tool: SpotlightTool
  effect: SpotlightEffect
  darkenStrength: number
  blurStrength: number
  focusArea: SpotlightFocusArea
  attachOutlineToNewShapes: boolean
  defaultOutlineColor: string
  defaultOutlineWidthPx: number
  attachFillToNewShapes: boolean
  defaultFillColor: string
  defaultFillOpacityPct: number
  onShapesChange: (next: Array<SpotlightShape>) => void
  onMagnifierChange: (next: MagnifierFrame | null) => void
  onSelectionChange: (next: SpotlightSelection) => void
  onInteractionStart: () => void
  onInteractionEnd: (payload: SpotlightInteractionPayload) => void
  onImageReplace: (file: File) => void
}

export function SpotlightCanvas({
  image,
  shapes,
  magnifier,
  selection,
  tool,
  effect,
  darkenStrength,
  blurStrength,
  focusArea,
  attachOutlineToNewShapes,
  defaultOutlineColor,
  defaultOutlineWidthPx,
  attachFillToNewShapes,
  defaultFillColor,
  defaultFillOpacityPct,
  onShapesChange,
  onMagnifierChange,
  onSelectionChange,
  onInteractionStart,
  onInteractionEnd,
  onImageReplace,
}: SpotlightCanvasProps) {
  const connectorMaskId = useId().replace(/:/g, '')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const nudgeActiveRef = useRef(false)
  const nudgeEndTimerRef = useRef<number | null>(null)

  const [draft, setDraft] = useState<DraftShape | null>(null)
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)

  const magnifierDraftRef = useRef<{
    start: { x: number; y: number }
    rect: { x: number; y: number; w: number; h: number }
  } | null>(null)

  const moveRef = useRef<{
    shapeId: string
    startShapes: Array<SpotlightShape>
    originX: number
    originY: number
    pointerStartX: number
    pointerStartY: number
  } | null>(null)

  const resizeRef = useRef<{
    shapeId: string
    handle: ResizeHandle
    startShapes: Array<SpotlightShape>
    pointerStartX: number
    pointerStartY: number
  } | null>(null)

  const magMoveRef = useRef<{
    target: 'source' | 'inset'
    startFrame: MagnifierFrame
    originX: number
    originY: number
    pointerStartX: number
    pointerStartY: number
  } | null>(null)

  const magResizeRef = useRef<{
    target: 'source' | 'inset'
    handle: ResizeHandle
    startFrame: MagnifierFrame
    pointerStartX: number
    pointerStartY: number
  } | null>(null)

  const shapesRef = useRef(shapes)
  shapesRef.current = shapes
  const magnifierRef = useRef(magnifier)
  magnifierRef.current = magnifier

  const pointerCaptureElRef = useRef<Element | null>(null)

  const iw = loadedImg?.naturalWidth ?? 0
  const ih = loadedImg?.naturalHeight ?? 0

  const extentRef = useRef({
    canvasW: iw,
    canvasH: ih,
    offsetX: 0,
    offsetY: 0,
  })

  const selectedShapeId = selection?.kind === 'shape' ? selection.id : null

  useEffect(() => {
    if (!image) {
      setLoadedImg(null)
      return
    }
    const img = new Image()
    img.onload = () => setLoadedImg(img)
    img.onerror = () => setLoadedImg(null)
    img.src = image.preview
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [image])

  const buildPreviewMagnifier = useCallback((): MagnifierFrame | null => {
    const fr = magnifierRef.current
    const d = magnifierDraftRef.current?.rect ?? null
    if (fr && d === null) return fr
    if (d !== null) {
      const source = clampMagSourceRect(d, iw, ih)
      return {
        id: '__draft__',
        source,
        inset: clampMagSourceRect(autoInsetForSource(source, iw, ih), iw, ih),
        sourceOutline: fr?.sourceOutline ?? { color: '#2563eb', widthPx: 3 },
        insetOutline: fr?.insetOutline ?? { color: '#2563eb', widthPx: 3 },
        insetBackgroundColor: fr?.insetBackgroundColor ?? '#111827',
        connector: fr?.connector ?? {
          enabled: true,
          color: '#2563eb',
          widthPx: 2,
        },
      }
    }
    return fr
  }, [iw, ih])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = loadedImg
    if (!canvas || !img || iw === 0 || ih === 0) return

    const previewMag = buildPreviewMagnifier()
    const ext = magnifierExtent(previewMag, iw, ih)
    extentRef.current = ext
    canvas.width = ext.canvasW
    canvas.height = ext.canvasH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draftExtras: {
      outline?: SpotlightShapeOutlineStyle
      fill?: SpotlightShapeFillStyle
    } = {}
    if (attachOutlineToNewShapes) {
      draftExtras.outline = {
        color: defaultOutlineColor,
        widthPx: clampSpotlightOutlineWidthPx(defaultOutlineWidthPx),
      }
    }
    if (attachFillToNewShapes) {
      draftExtras.fill = {
        color: defaultFillColor,
        opacityPct: clampSpotlightFillOpacityPct(defaultFillOpacityPct),
      }
    }
    const previewShapes =
      draft !== null
        ? [...shapes, draftToPreviewShape(draft, draftExtras)]
        : shapes

    renderSpotlight(ctx, img, iw, ih, {
      shapes: previewShapes,
      effect,
      darkenStrength,
      blurStrength,
      focusArea,
      magnifier: previewMag,
    })
  }, [
    loadedImg,
    iw,
    ih,
    shapes,
    draft,
    effect,
    darkenStrength,
    blurStrength,
    focusArea,
    attachOutlineToNewShapes,
    defaultOutlineColor,
    defaultOutlineWidthPx,
    attachFillToNewShapes,
    defaultFillColor,
    defaultFillOpacityPct,
    magnifier,
    buildPreviewMagnifier,
  ])

  useEffect(() => {
    if (!loadedImg || iw === 0) return
    if (effect === 'blur') {
      const t = window.setTimeout(() => redraw(), 120)
      return () => window.clearTimeout(t)
    }
    redraw()
  }, [redraw, effect, loadedImg, iw])

  const clientToImage = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasRef.current
      if (!el || iw === 0 || ih === 0) return { x: 0, y: 0 }
      const r = el.getBoundingClientRect()
      const ext = extentRef.current
      const canvasX = ((clientX - r.left) / r.width) * ext.canvasW
      const canvasY = ((clientY - r.top) / r.height) * ext.canvasH
      return { x: canvasX - ext.offsetX, y: canvasY - ext.offsetY }
    },
    [iw, ih],
  )

  const flushNudgeBurst = useCallback(() => {
    if (nudgeEndTimerRef.current !== null) {
      window.clearTimeout(nudgeEndTimerRef.current)
      nudgeEndTimerRef.current = null
    }
    if (!nudgeActiveRef.current) return
    nudgeActiveRef.current = false
    onInteractionEnd({
      shapes: shapesRef.current,
      magnifier: magnifierRef.current,
    })
  }, [onInteractionEnd])

  const releasePointerCaptureSafe = (pointerId: number) => {
    const cap = pointerCaptureElRef.current
    if (cap?.releasePointerCapture) {
      try {
        cap.releasePointerCapture(pointerId)
      } catch {
        /* not capturing */
      }
    }
    pointerCaptureElRef.current = null
  }

  const finishMagnifierDraft = (pointerId: number) => {
    const d = magnifierDraftRef.current
    if (!d || iw === 0 || ih === 0) return
    magnifierDraftRef.current = null
    const r = clampMagSourceRect(d.rect, iw, ih)
    if (r.w < MIN_SIZE_MAG || r.h < MIN_SIZE_MAG) {
      releasePointerCaptureSafe(pointerId)
      onInteractionEnd({
        shapes: shapesRef.current,
        magnifier: magnifierRef.current,
      })
      redraw()
      return
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const prev = magnifierRef.current
    const next: MagnifierFrame = {
      id,
      source: r,
      inset: autoInsetForSource(r, iw, ih),
      sourceOutline: prev?.sourceOutline ?? { color: '#2563eb', widthPx: 3 },
      insetOutline: prev?.insetOutline ?? { color: '#2563eb', widthPx: 3 },
      insetBackgroundColor: prev?.insetBackgroundColor ?? '#111827',
      connector: prev?.connector ?? {
        enabled: true,
        color: '#2563eb',
        widthPx: 2,
      },
    }
    magnifierRef.current = next
    onMagnifierChange(next)
    onSelectionChange({ kind: 'magnifier', target: 'source' })
    onInteractionEnd({
      shapes: shapesRef.current,
      magnifier: next,
    })
    releasePointerCaptureSafe(pointerId)
    redraw()
  }

  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    if (!loadedImg || iw === 0 || ih === 0) return
    if (e.button !== 0) return
    flushNudgeBurst()

    if (tool === 'magnifier') {
      onInteractionStart()
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const ix = Math.max(0, Math.min(x, iw))
      const iy = Math.max(0, Math.min(y, ih))
      onSelectionChange(null)
      magnifierDraftRef.current = {
        start: { x: ix, y: iy },
        rect: { x: ix, y: iy, w: 0, h: 0 },
      }
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      pointerCaptureElRef.current = el
      e.preventDefault()
      return
    }

    const { x, y } = clientToImage(e.clientX, e.clientY)
    const ix = Math.max(0, Math.min(x, iw))
    const iy = Math.max(0, Math.min(y, ih))

    onSelectionChange(null)

    onInteractionStart()
    drawStartRef.current = { x: ix, y: iy }
    setDraft({
      kind: tool === 'ellipse' ? 'ellipse' : 'rect',
      x: ix,
      y: iy,
      w: 0,
      h: 0,
    })
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureElRef.current = el
    e.preventDefault()
  }

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (!loadedImg || iw === 0) return

    if (magnifierDraftRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const n = normalizeRect(
        magnifierDraftRef.current.start.x,
        magnifierDraftRef.current.start.y,
        x,
        y,
      )
      magnifierDraftRef.current = { ...magnifierDraftRef.current, rect: n }
      redraw()
      e.preventDefault()
      return
    }

    if (draft && drawStartRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const n = normalizeRect(drawStartRef.current.x, drawStartRef.current.y, x, y)
      setDraft({ ...draft, ...n })
      e.preventDefault()
      return
    }

    if (magMoveRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const dx = x - magMoveRef.current.pointerStartX
      const dy = y - magMoveRef.current.pointerStartY
      const startFrame = magMoveRef.current.startFrame
      const target = magMoveRef.current.target
      const movedRect = target === 'source' ? startFrame.source : startFrame.inset

      const proposed = {
        ...movedRect,
        x: magMoveRef.current.originX + dx,
        y: magMoveRef.current.originY + dy,
      }
      const clamped =
        target === 'source'
          ? clampMagSourceRect(proposed, iw, ih)
          : clampInsetRect(proposed, iw, ih)

      const next: MagnifierFrame = {
        ...startFrame,
        source: target === 'source' ? clamped : startFrame.source,
        inset: target === 'inset' ? clamped : startFrame.inset,
      }
      magnifierRef.current = next
      onMagnifierChange(next)
      redraw()
      e.preventDefault()
      return
    }

    if (magResizeRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const dx = x - magResizeRef.current.pointerStartX
      const dy = y - magResizeRef.current.pointerStartY
      const startFrame = magResizeRef.current.startFrame
      const target = magResizeRef.current.target
      const base = target === 'source' ? startFrame.source : startFrame.inset
      const proposed = applyResizeMagRect(base, magResizeRef.current.handle, dx, dy)
      const resized =
        target === 'source'
          ? clampMagSourceRect(proposed, iw, ih)
          : clampInsetRect(proposed, iw, ih)

      const next: MagnifierFrame = {
        ...startFrame,
        source: target === 'source' ? resized : startFrame.source,
        inset: target === 'inset' ? resized : startFrame.inset,
      }
      magnifierRef.current = next
      onMagnifierChange(next)
      redraw()
      e.preventDefault()
      return
    }

    if (moveRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const dx = x - moveRef.current.pointerStartX
      const dy = y - moveRef.current.pointerStartY
      const next = moveRef.current.startShapes.map((s) => {
        if (s.id !== moveRef.current!.shapeId) return s
        let nx = moveRef.current!.originX + dx
        let ny = moveRef.current!.originY + dy
        nx = Math.max(0, Math.min(nx, iw - s.w))
        ny = Math.max(0, Math.min(ny, ih - s.h))
        return { ...s, x: nx, y: ny }
      })
      onShapesChange(next)
      shapesRef.current = next
      e.preventDefault()
      return
    }

    if (resizeRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const dx = x - resizeRef.current.pointerStartX
      const dy = y - resizeRef.current.pointerStartY
      const next = resizeRef.current.startShapes.map((s) => {
        if (s.id !== resizeRef.current!.shapeId) return s
        const resized = applyResizeShape(s, resizeRef.current!.handle, dx, dy)
        return clampShapeToImage(resized, iw, ih)
      })
      onShapesChange(next)
      shapesRef.current = next
      e.preventDefault()
    }
  }

  const finishDraw = (pointerId: number) => {
    if (!draft || !drawStartRef.current) return
    drawStartRef.current = null
    if (draft.w < MIN_SIZE_SHAPE || draft.h < MIN_SIZE_SHAPE) {
      setDraft(null)
      releasePointerCaptureSafe(pointerId)
      onInteractionEnd({
        shapes: shapesRef.current,
        magnifier: magnifierRef.current,
      })
      return
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const outline =
      attachOutlineToNewShapes
        ? {
            outline: {
              color: defaultOutlineColor,
              widthPx: clampSpotlightOutlineWidthPx(defaultOutlineWidthPx),
            },
          }
        : {}
    const fill =
      attachFillToNewShapes
        ? {
            fill: {
              color: defaultFillColor,
              opacityPct: clampSpotlightFillOpacityPct(defaultFillOpacityPct),
            },
          }
        : {}
    const newShape: SpotlightShape =
      draft.kind === 'rect'
        ? {
            id,
            kind: 'rect',
            x: draft.x,
            y: draft.y,
            w: draft.w,
            h: draft.h,
            ...outline,
            ...fill,
          }
        : {
            id,
            kind: 'ellipse',
            x: draft.x,
            y: draft.y,
            w: draft.w,
            h: draft.h,
            ...outline,
            ...fill,
          }
    const next = [...shapesRef.current, newShape]
    shapesRef.current = next
    onShapesChange(next)
    onSelectionChange({ kind: 'shape', id })
    setDraft(null)
    onInteractionEnd({
      shapes: next,
      magnifier: magnifierRef.current,
    })
    releasePointerCaptureSafe(pointerId)
  }

  const handleSvgPointerUp = (e: React.PointerEvent) => {
    if (magnifierDraftRef.current) {
      finishMagnifierDraft(e.pointerId)
      e.preventDefault()
      return
    }
    if (draft) {
      finishDraw(e.pointerId)
      e.preventDefault()
      return
    }
    if (magMoveRef.current) {
      magMoveRef.current = null
      releasePointerCaptureSafe(e.pointerId)
      onInteractionEnd({
        shapes: shapesRef.current,
        magnifier: magnifierRef.current,
      })
      e.preventDefault()
      return
    }
    if (magResizeRef.current) {
      magResizeRef.current = null
      releasePointerCaptureSafe(e.pointerId)
      onInteractionEnd({
        shapes: shapesRef.current,
        magnifier: magnifierRef.current,
      })
      e.preventDefault()
      return
    }
    if (moveRef.current) {
      moveRef.current = null
      releasePointerCaptureSafe(e.pointerId)
      onInteractionEnd({
        shapes: shapesRef.current,
        magnifier: magnifierRef.current,
      })
      e.preventDefault()
      return
    }
    if (resizeRef.current) {
      resizeRef.current = null
      releasePointerCaptureSafe(e.pointerId)
      onInteractionEnd({
        shapes: shapesRef.current,
        magnifier: magnifierRef.current,
      })
      e.preventDefault()
    }
  }

  const beginMagMove = (
    e: React.PointerEvent,
    target: 'source' | 'inset',
  ) => {
    const fr = magnifierRef.current
    if (!fr || !loadedImg || iw === 0 || ih === 0) return
    e.stopPropagation()
    onInteractionStart()
    onSelectionChange({ kind: 'magnifier', target })
    const r = target === 'source' ? fr.source : fr.inset
    const { x, y } = clientToImage(e.clientX, e.clientY)
    magMoveRef.current = {
      target,
      startFrame: structuredClone(fr),
      originX: r.x,
      originY: r.y,
      pointerStartX: x,
      pointerStartY: y,
    }
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureElRef.current = el
    e.preventDefault()
  }

  const beginMagResize = (
    e: React.PointerEvent,
    target: 'source' | 'inset',
    handle: ResizeHandle,
  ) => {
    const fr = magnifierRef.current
    if (!fr || !loadedImg || iw === 0 || ih === 0) return
    e.stopPropagation()
    onInteractionStart()
    onSelectionChange({ kind: 'magnifier', target })
    const { x, y } = clientToImage(e.clientX, e.clientY)
    magResizeRef.current = {
      target,
      handle,
      startFrame: structuredClone(fr),
      pointerStartX: x,
      pointerStartY: y,
    }
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureElRef.current = el
    e.preventDefault()
  }

  const handleShapePointerDown = (
    e: React.PointerEvent,
    shape: SpotlightShape,
  ) => {
    e.stopPropagation()
    flushNudgeBurst()
    onInteractionStart()
    onSelectionChange({ kind: 'shape', id: shape.id })
    moveRef.current = {
      shapeId: shape.id,
      startShapes: shapes.map((s) => ({ ...s })),
      originX: shape.x,
      originY: shape.y,
      pointerStartX: clientToImage(e.clientX, e.clientY).x,
      pointerStartY: clientToImage(e.clientX, e.clientY).y,
    }
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureElRef.current = el
    e.preventDefault()
  }

  const handleHandlePointerDown = (
    e: React.PointerEvent,
    shape: SpotlightShape,
    handle: ResizeHandle,
  ) => {
    e.stopPropagation()
    flushNudgeBurst()
    onInteractionStart()
    onSelectionChange({ kind: 'shape', id: shape.id })
    const { x, y } = clientToImage(e.clientX, e.clientY)
    resizeRef.current = {
      shapeId: shape.id,
      handle,
      startShapes: shapes.map((s) => ({ ...s })),
      pointerStartX: x,
      pointerStartY: y,
    }
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureElRef.current = el
    e.preventDefault()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (
        t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.isContentEditable
      ) {
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection?.kind === 'magnifier') {
          e.preventDefault()
          flushNudgeBurst()
          onInteractionStart()
          onMagnifierChange(null)
          magnifierRef.current = null
          onSelectionChange(null)
          onInteractionEnd({
            shapes: shapesRef.current,
            magnifier: null,
          })
          return
        }
        if (!selectedShapeId) return
        e.preventDefault()
        flushNudgeBurst()
        onInteractionStart()
        const next = shapesRef.current.filter((s) => s.id !== selectedShapeId)
        shapesRef.current = next
        onShapesChange(next)
        onSelectionChange(null)
        onInteractionEnd({
          shapes: next,
          magnifier: magnifierRef.current,
        })
        return
      }

      if (
        e.key !== 'ArrowUp' &&
        e.key !== 'ArrowDown' &&
        e.key !== 'ArrowLeft' &&
        e.key !== 'ArrowRight'
      ) {
        return
      }

      if (iw === 0 || ih === 0) return

      if (selection?.kind === 'magnifier') {
        const fr = magnifierRef.current
        if (!fr) return
        const step = e.shiftKey ? 10 : 1
        const dx =
          e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        if (dx === 0 && dy === 0) return
        e.preventDefault()

        if (!nudgeActiveRef.current) {
          nudgeActiveRef.current = true
          onInteractionStart()
        }

        const target = selection.target
        const rect = target === 'source' ? fr.source : fr.inset
        const proposed = { ...rect, x: rect.x + dx, y: rect.y + dy }
        const clamped =
          target === 'source'
            ? clampMagSourceRect(proposed, iw, ih)
            : clampInsetRect(proposed, iw, ih)
        const next: MagnifierFrame = {
          ...fr,
          source: target === 'source' ? clamped : fr.source,
          inset: target === 'inset' ? clamped : fr.inset,
        }
        magnifierRef.current = next
        onMagnifierChange(next)

        if (nudgeEndTimerRef.current !== null) {
          window.clearTimeout(nudgeEndTimerRef.current)
        }
        nudgeEndTimerRef.current = window.setTimeout(() => {
          nudgeEndTimerRef.current = null
          if (!nudgeActiveRef.current) return
          nudgeActiveRef.current = false
          onInteractionEnd({
            shapes: shapesRef.current,
            magnifier: magnifierRef.current,
          })
        }, 400)
        return
      }

      if (!selectedShapeId) return

      const step = e.shiftKey ? 10 : 1
      const dx =
        e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      if (dx === 0 && dy === 0) return

      e.preventDefault()

      if (!nudgeActiveRef.current) {
        nudgeActiveRef.current = true
        onInteractionStart()
      }

      const next = shapesRef.current.map((s) => {
        if (s.id !== selectedShapeId) return s
        const nx = Math.max(0, Math.min(s.x + dx, iw - s.w))
        const ny = Math.max(0, Math.min(s.y + dy, ih - s.h))
        return { ...s, x: nx, y: ny }
      })
      shapesRef.current = next
      onShapesChange(next)

      if (nudgeEndTimerRef.current !== null) {
        window.clearTimeout(nudgeEndTimerRef.current)
      }
      nudgeEndTimerRef.current = window.setTimeout(() => {
        nudgeEndTimerRef.current = null
        if (!nudgeActiveRef.current) return
        nudgeActiveRef.current = false
        onInteractionEnd({
          shapes: shapesRef.current,
          magnifier: magnifierRef.current,
        })
      }, 400)
    }
    window.addEventListener('keydown', onKey)
    const onBlur = () => flushNudgeBurst()
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
    }
  }, [
    selection,
    selectedShapeId,
    iw,
    ih,
    onShapesChange,
    onMagnifierChange,
    onSelectionChange,
    onInteractionStart,
    onInteractionEnd,
    flushNudgeBurst,
  ])

  const handleFileList = (files: FileList | null) => {
    if (!files?.length) return
    const f = Array.from(files).find(isValidImageType)
    if (f) onImageReplace(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    handleFileList(e.dataTransfer.files)
  }

  const shapeHandleSize = Math.max(10, Math.min(16, iw > 0 ? iw * 0.02 : 12))

  const emptyUpload = (
    <Card className="mb-0">
      <CardContent className="p-8">
        <div
          ref={wrapRef}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDraggingFile(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setIsDraggingFile(false)
          }}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-lg p-12 text-center transition-colors',
            isDraggingFile
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25',
          )}
        >
          <Upload className="size-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">
            Drag and drop an image here, or click to browse
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Supports JPG, PNG, WEBP, AVIF, and ICO formats
          </p>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
          >
            Select Image
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/avif,image/x-icon,image/vnd.microsoft.icon"
            onChange={(e) => {
              handleFileList(e.target.files)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  )

  if (!image || !loadedImg || iw === 0) {
    return emptyUpload
  }

  const selected = shapes.find((s) => s.id === selectedShapeId)
  const previewMag = buildPreviewMagnifier()
  const ext = magnifierExtent(previewMag, iw, ih)
  const connectorSegs = previewMag ? computeConnectorSegments(previewMag) : []

  const magSelectionTarget =
    selection?.kind === 'magnifier' ? selection.target : null

  const selectionRectMag: MagnifierRect | null =
    magSelectionTarget === 'source'
      ? magnifier?.source ?? null
      : magSelectionTarget === 'inset'
        ? magnifier?.inset ?? null
        : null

  const draftSvgFill =
    attachFillToNewShapes
      ? spotlightFillToRgbaString({
          color: defaultFillColor,
          opacityPct: clampSpotlightFillOpacityPct(defaultFillOpacityPct),
        })
      : 'rgba(34,197,94,0.15)'

  const magHandleSize = Math.max(10, Math.min(16, iw > 0 ? iw * 0.02 : 12))
  const hr = magHandleSize / 2
  const edgeLong = magHandleSize * 2.35
  const edgeShort = Math.max(magHandleSize * 0.48, 2)

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-lg border bg-muted overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring"
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDraggingFile(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setIsDraggingFile(false)
      }}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary pointer-events-none rounded-lg">
          <p className="text-sm font-medium text-primary">Drop to replace image</p>
        </div>
      )}
      <div className="relative mx-auto flex w-full max-w-full justify-center">
        <div className="relative inline-block max-w-full max-h-[min(70vh,900px)] leading-none">
          <canvas
            ref={canvasRef}
            width={iw}
            height={ih}
            className="block h-auto max-h-[min(70vh,900px)] w-auto max-w-full"
            aria-label="Spotlight preview"
          />
          <svg
            className="absolute left-0 top-0 h-full w-full touch-none"
            viewBox={`0 0 ${ext.canvasW} ${ext.canvasH}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerUp}
          >
            <rect
              x={0}
              y={0}
              width={ext.canvasW}
              height={ext.canvasH}
              fill="transparent"
              className="cursor-crosshair"
              onPointerDown={handleBackgroundPointerDown}
            />

            <g transform={`translate(${ext.offsetX}, ${ext.offsetY})`}>
              {previewMag &&
                previewMag.connector.enabled &&
                connectorSegs.length > 0 && (
                <defs>
                  <mask id={connectorMaskId}>
                    <rect
                      x={-ext.offsetX}
                      y={-ext.offsetY}
                      width={ext.canvasW}
                      height={ext.canvasH}
                      fill="white"
                    />
                    <rect
                      x={previewMag.inset.x}
                      y={previewMag.inset.y}
                      width={previewMag.inset.w}
                      height={previewMag.inset.h}
                      fill="black"
                    />
                  </mask>
                </defs>
              )}

              {previewMag && previewMag.id !== '__draft__' && (
                <>
                  <rect
                    x={previewMag.source.x}
                    y={previewMag.source.y}
                    width={previewMag.source.w}
                    height={previewMag.source.h}
                    fill="rgba(37,99,235,0.08)"
                    stroke={
                      magSelectionTarget === 'source'
                        ? 'hsl(var(--primary))'
                        : previewMag.sourceOutline.color
                    }
                    strokeWidth={
                      magSelectionTarget === 'source'
                        ? 3
                        : previewMag.sourceOutline.widthPx
                    }
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: 'move', pointerEvents: 'auto' }}
                    onPointerDown={(e) => beginMagMove(e, 'source')}
                  />

                  {previewMag.connector.enabled && connectorSegs.length > 0 && (
                    <g pointerEvents="none" mask={`url(#${connectorMaskId})`}>
                      {connectorSegs.map((s, idx) => (
                        <line
                          key={idx}
                          x1={s.x0}
                          y1={s.y0}
                          x2={s.x1}
                          y2={s.y1}
                          stroke={previewMag.connector.color}
                          strokeWidth={previewMag.connector.widthPx}
                          vectorEffect="non-scaling-stroke"
                          opacity={0.95}
                        />
                      ))}
                    </g>
                  )}

                  <rect
                    x={previewMag.inset.x}
                    y={previewMag.inset.y}
                    width={previewMag.inset.w}
                    height={previewMag.inset.h}
                    fill="rgba(255,255,255,0.04)"
                    stroke={
                      magSelectionTarget === 'inset'
                        ? 'hsl(var(--primary))'
                        : previewMag.insetOutline.color
                    }
                    strokeWidth={
                      magSelectionTarget === 'inset'
                        ? 3
                        : previewMag.insetOutline.widthPx
                    }
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: 'move', pointerEvents: 'auto' }}
                    onPointerDown={(e) => beginMagMove(e, 'inset')}
                  />
                </>
              )}

              {shapes.map((s) => {
                const isSel = s.id === selectedShapeId
                const { stroke, strokeWidth } = svgShapeStroke(s, isSel)
                const fillPaint = svgShapeFill(s)
                if (s.kind === 'rect') {
                  return (
                    <rect
                      key={s.id}
                      x={s.x}
                      y={s.y}
                      width={s.w}
                      height={s.h}
                      fill={fillPaint}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      vectorEffect="non-scaling-stroke"
                      style={{
                        cursor: 'move',
                        pointerEvents: 'auto',
                      }}
                      onPointerDown={(e) => handleShapePointerDown(e, s)}
                    />
                  )
                }
                const rx = s.w / 2
                const ry = s.h / 2
                return (
                  <ellipse
                    key={s.id}
                    cx={s.x + rx}
                    cy={s.y + ry}
                    rx={rx}
                    ry={ry}
                    fill={fillPaint}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    vectorEffect="non-scaling-stroke"
                    style={{
                      cursor: 'move',
                      pointerEvents: 'auto',
                    }}
                    onPointerDown={(e) => handleShapePointerDown(e, s)}
                  />
                )
              })}

              {draft && draft.kind === 'rect' && (
                <rect
                  x={draft.x}
                  y={draft.y}
                  width={draft.w}
                  height={draft.h}
                  fill={draftSvgFill}
                  stroke={
                    attachOutlineToNewShapes
                      ? defaultOutlineColor
                      : 'hsl(var(--primary))'
                  }
                  strokeWidth={
                    attachOutlineToNewShapes
                      ? clampSpotlightOutlineWidthPx(defaultOutlineWidthPx)
                      : 2
                  }
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              )}
              {draft && draft.kind === 'ellipse' && (
                <ellipse
                  cx={draft.x + draft.w / 2}
                  cy={draft.y + draft.h / 2}
                  rx={Math.max(0, draft.w / 2)}
                  ry={Math.max(0, draft.h / 2)}
                  fill={draftSvgFill}
                  stroke={
                    attachOutlineToNewShapes
                      ? defaultOutlineColor
                      : 'hsl(var(--primary))'
                  }
                  strokeWidth={
                    attachOutlineToNewShapes
                      ? clampSpotlightOutlineWidthPx(defaultOutlineWidthPx)
                      : 2
                  }
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              )}

              {selected &&
                (() => {
                  const { x, y, w, h } = selected
                  const handles: Array<{ id: ResizeHandle; cx: number; cy: number }> = [
                    { id: 'nw', cx: x, cy: y },
                    { id: 'n', cx: x + w / 2, cy: y },
                    { id: 'ne', cx: x + w, cy: y },
                    { id: 'e', cx: x + w, cy: y + h / 2 },
                    { id: 'se', cx: x + w, cy: y + h },
                    { id: 's', cx: x + w / 2, cy: y + h },
                    { id: 'sw', cx: x, cy: y + h },
                    { id: 'w', cx: x, cy: y + h / 2 },
                  ]
                  const shr = shapeHandleSize / 2
                  const sEdgeLong = shapeHandleSize * 2.35
                  const sEdgeShort = Math.max(shapeHandleSize * 0.48, 2)
                  return handles.map((hi) => {
                    if (isCornerHandle(hi.id)) {
                      return (
                        <circle
                          key={hi.id}
                          cx={hi.cx}
                          cy={hi.cy}
                          r={shr}
                          fill="white"
                          stroke="#2563eb"
                          strokeWidth={2}
                          vectorEffect="non-scaling-stroke"
                          style={{ cursor: `${hi.id}-resize` }}
                          onPointerDown={(e) =>
                            handleHandlePointerDown(e, selected, hi.id)
                          }
                        />
                      )
                    }
                    const horiz = hi.id === 'n' || hi.id === 's'
                    const pw = horiz ? sEdgeLong : sEdgeShort
                    const ph = horiz ? sEdgeShort : sEdgeLong
                    const pr = Math.min(pw, ph) / 2
                    return (
                      <rect
                        key={hi.id}
                        x={hi.cx - pw / 2}
                        y={hi.cy - ph / 2}
                        width={pw}
                        height={ph}
                        rx={pr}
                        ry={pr}
                        fill="white"
                        stroke="#2563eb"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: `${hi.id}-resize` }}
                        onPointerDown={(e) =>
                          handleHandlePointerDown(e, selected, hi.id)
                        }
                      />
                    )
                  })
                })()}

              {selectionRectMag &&
                corners(selectionRectMag).map((hi) => {
                  if (isCornerHandle(hi.id)) {
                    return (
                      <circle
                        key={`mag-${hi.id}`}
                        cx={hi.cx}
                        cy={hi.cy}
                        r={hr}
                        fill="white"
                        stroke="#2563eb"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: `${hi.id}-resize` }}
                        onPointerDown={(e) =>
                          beginMagResize(
                            e,
                            magSelectionTarget ?? 'source',
                            hi.id,
                          )
                        }
                      />
                    )
                  }
                  const horiz = hi.id === 'n' || hi.id === 's'
                  const pw = horiz ? edgeLong : edgeShort
                  const ph = horiz ? edgeShort : edgeLong
                  const pr = Math.min(pw, ph) / 2
                  return (
                    <rect
                      key={`mag-${hi.id}`}
                      x={hi.cx - pw / 2}
                      y={hi.cy - ph / 2}
                      width={pw}
                      height={ph}
                      rx={pr}
                      ry={pr}
                      fill="white"
                      stroke="#2563eb"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      style={{ cursor: `${hi.id}-resize` }}
                      onPointerDown={(e) =>
                        beginMagResize(
                          e,
                          magSelectionTarget ?? 'source',
                          hi.id,
                        )
                      }
                    />
                  )
                })}
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { isValidImageType } from '@/lib/image-converter'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export type SpotlightTool = 'rect' | 'ellipse'

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

const MIN_SIZE = 4

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

function applyResize(
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
  if (w < MIN_SIZE) {
    const deficit = MIN_SIZE - w
    if (handle === 'nw' || handle === 'w' || handle === 'sw') {
      x -= deficit
    }
    w = MIN_SIZE
  }
  if (h < MIN_SIZE) {
    const deficit = MIN_SIZE - h
    if (handle === 'nw' || handle === 'n' || handle === 'ne') {
      y -= deficit
    }
    h = MIN_SIZE
  }
  return { ...shape, x, y, w, h }
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
  x = Math.max(0, Math.min(x, iw - MIN_SIZE))
  y = Math.max(0, Math.min(y, ih - MIN_SIZE))
  w = Math.max(MIN_SIZE, Math.min(w, iw - x))
  h = Math.max(MIN_SIZE, Math.min(h, ih - y))
  return { ...s, x, y, w, h }
}

interface SpotlightCanvasProps {
  image: ImageFile | null
  shapes: Array<SpotlightShape>
  selectedId: string | null
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
  onSelectedIdChange: (id: string | null) => void
  onInteractionStart: () => void
  /** Called with the final shape list after a drag/draw/resize completes (for undo). */
  onInteractionEnd: (finalShapes: Array<SpotlightShape>) => void
  onImageReplace: (file: File) => void
}

export function SpotlightCanvas({
  image,
  shapes,
  selectedId,
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
  onSelectedIdChange,
  onInteractionStart,
  onInteractionEnd,
  onImageReplace,
}: SpotlightCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const [draft, setDraft] = useState<DraftShape | null>(null)
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)

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

  const shapesRef = useRef(shapes)
  shapesRef.current = shapes

  const pointerCaptureElRef = useRef<Element | null>(null)

  const iw = loadedImg?.naturalWidth ?? 0
  const ih = loadedImg?.naturalHeight ?? 0

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

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = loadedImg
    if (!canvas || !img || iw === 0 || ih === 0) return
    canvas.width = iw
    canvas.height = ih
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
  ])

  // Debounced redraw for blur (expensive)
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
      const x = ((clientX - r.left) / r.width) * iw
      const y = ((clientY - r.top) / r.height) * ih
      return { x, y }
    },
    [iw, ih],
  )

  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    if (!loadedImg || iw === 0 || ih === 0) return
    if (e.button !== 0) return

    const { x, y } = clientToImage(e.clientX, e.clientY)
    const ix = Math.max(0, Math.min(x, iw))
    const iy = Math.max(0, Math.min(y, ih))

    onSelectedIdChange(null)

    onInteractionStart()
    drawStartRef.current = { x: ix, y: iy }
    setDraft({ kind: tool, x: ix, y: iy, w: 0, h: 0 })
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureElRef.current = el
    e.preventDefault()
  }

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (!loadedImg || iw === 0) return

    if (draft && drawStartRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const n = normalizeRect(drawStartRef.current.x, drawStartRef.current.y, x, y)
      setDraft({ ...draft, ...n })
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
        const resized = applyResize(s, resizeRef.current!.handle, dx, dy)
        return clampShapeToImage(resized, iw, ih)
      })
      onShapesChange(next)
      shapesRef.current = next
      e.preventDefault()
    }
  }

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

  const finishDraw = (pointerId: number) => {
    if (!draft || !drawStartRef.current) return
    drawStartRef.current = null
    if (draft.w < MIN_SIZE || draft.h < MIN_SIZE) {
      setDraft(null)
      releasePointerCaptureSafe(pointerId)
      onInteractionEnd(shapesRef.current)
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
    onSelectedIdChange(id)
    setDraft(null)
    onInteractionEnd(next)
    releasePointerCaptureSafe(pointerId)
  }

  const handleSvgPointerUp = (e: React.PointerEvent) => {
    if (draft) {
      finishDraw(e.pointerId)
      e.preventDefault()
      return
    }
    if (moveRef.current) {
      moveRef.current = null
      releasePointerCaptureSafe(e.pointerId)
      onInteractionEnd(shapesRef.current)
      e.preventDefault()
      return
    }
    if (resizeRef.current) {
      resizeRef.current = null
      releasePointerCaptureSafe(e.pointerId)
      onInteractionEnd(shapesRef.current)
      e.preventDefault()
    }
  }

  const handleShapePointerDown = (
    e: React.PointerEvent,
    shape: SpotlightShape,
  ) => {
    e.stopPropagation()
    onInteractionStart()
    onSelectedIdChange(shape.id)
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
    onInteractionStart()
    onSelectedIdChange(shape.id)
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

  // Delete / Backspace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const t = e.target as HTMLElement
      if (
        t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.isContentEditable
      ) {
        return
      }
      if (!selectedId) return
      e.preventDefault()
      onInteractionStart()
      const next = shapesRef.current.filter((s) => s.id !== selectedId)
      shapesRef.current = next
      onShapesChange(next)
      onSelectedIdChange(null)
      onInteractionEnd(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    selectedId,
    shapes,
    onShapesChange,
    onSelectedIdChange,
    onInteractionStart,
    onInteractionEnd,
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

  const handleSize = Math.max(10, Math.min(16, iw > 0 ? iw * 0.02 : 12))

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

  const selected = shapes.find((s) => s.id === selectedId)

  const draftSvgFill =
    attachFillToNewShapes
      ? spotlightFillToRgbaString({
          color: defaultFillColor,
          opacityPct: clampSpotlightFillOpacityPct(defaultFillOpacityPct),
        })
      : 'rgba(34,197,94,0.15)'

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
            viewBox={`0 0 ${iw} ${ih}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerUp}
          >
            <rect
              x={0}
              y={0}
              width={iw}
              height={ih}
              fill="transparent"
              className="cursor-crosshair"
              onPointerDown={handleBackgroundPointerDown}
            />

          {shapes.map((s) => {
            const isSel = s.id === selectedId
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
              const hr = handleSize / 2
              const edgeLong = handleSize * 2.35
              const edgeShort = Math.max(handleSize * 0.48, 2)
              return handles.map((hi) => {
                if (isCornerHandle(hi.id)) {
                  return (
                    <circle
                      key={hi.id}
                      cx={hi.cx}
                      cy={hi.cy}
                      r={hr}
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
                const pw = horiz ? edgeLong : edgeShort
                const ph = horiz ? edgeShort : edgeLong
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
          </svg>
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload } from 'lucide-react'

import type { ImageFile } from '@/components/ImagePreview'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { isValidImageType } from '@/lib/image-converter'
import type { MagnifierFrame, MagnifierRect } from '@/lib/image-magnifier'
import {
  computeConnectorSegments,
  magnifierExtent,
  renderMagnifier,
} from '@/lib/image-magnifier'
import { cn } from '@/lib/utils'

type ResizeHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'

type DraftRect = { x: number; y: number; w: number; h: number }

const MIN_SIZE = 6

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

function clampRectToImage(r: MagnifierRect, iw: number, ih: number): MagnifierRect {
  let { x, y, w, h } = r
  x = Math.max(0, Math.min(x, iw - MIN_SIZE))
  y = Math.max(0, Math.min(y, ih - MIN_SIZE))
  w = Math.max(MIN_SIZE, Math.min(w, iw - x))
  h = Math.max(MIN_SIZE, Math.min(h, ih - y))
  return { x, y, w, h }
}

function clampInsetRect(r: MagnifierRect, iw: number, ih: number): MagnifierRect {
  let { x, y, w, h } = r
  w = Math.max(MIN_SIZE, Math.min(w, 3 * iw))
  h = Math.max(MIN_SIZE, Math.min(h, 3 * ih))
  x = Math.max(-iw, Math.min(x, 2 * iw - w))
  y = Math.max(-ih, Math.min(y, 2 * ih - h))
  return { x, y, w, h }
}

function applyResize(
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

  if (w < MIN_SIZE) {
    const deficit = MIN_SIZE - w
    if (handle === 'nw' || handle === 'w' || handle === 'sw') x -= deficit
    w = MIN_SIZE
  }
  if (h < MIN_SIZE) {
    const deficit = MIN_SIZE - h
    if (handle === 'nw' || handle === 'n' || handle === 'ne') y -= deficit
    h = MIN_SIZE
  }

  return { x, y, w, h }
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

function autoInsetForSource(
  source: MagnifierRect,
  iw: number,
  ih: number,
): MagnifierRect {
  const margin = Math.max(12, Math.min(iw, ih) * 0.03)
  const targetW = Math.min(iw * 0.45, Math.max(MIN_SIZE, source.w * 2))
  const targetH = Math.min(ih * 0.45, Math.max(MIN_SIZE, source.h * 2))

  const sourceCx = source.x + source.w / 2
  const sourceCy = source.y + source.h / 2
  const right = sourceCx < iw / 2
  const bottom = sourceCy < ih / 2

  const x = right ? iw - margin - targetW : margin
  const y = bottom ? ih - margin - targetH : margin
  return clampRectToImage({ x, y, w: targetW, h: targetH }, iw, ih)
}

export type MagnifierSelection = 'source' | 'inset' | null

interface MagnifierCanvasProps {
  image: ImageFile | null
  frame: MagnifierFrame | null
  selectedTarget: MagnifierSelection
  onFrameChange: (next: MagnifierFrame | null) => void
  onSelectedTargetChange: (v: MagnifierSelection) => void
  onInteractionStart: () => void
  onInteractionEnd: (finalFrame: MagnifierFrame | null) => void
  onImageReplace: (file: File) => void
}

export function MagnifierCanvas({
  image,
  frame,
  selectedTarget,
  onFrameChange,
  onSelectedTargetChange,
  onInteractionStart,
  onInteractionEnd,
  onImageReplace,
}: MagnifierCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const iw = loadedImg?.naturalWidth ?? 0
  const ih = loadedImg?.naturalHeight ?? 0

  const frameRef = useRef<MagnifierFrame | null>(frame)
  frameRef.current = frame

  const extentRef = useRef<{ canvasW: number; canvasH: number; offsetX: number; offsetY: number }>({
    canvasW: iw,
    canvasH: ih,
    offsetX: 0,
    offsetY: 0,
  })

  const pointerCaptureElRef = useRef<Element | null>(null)

  const draftRef = useRef<{
    start: { x: number; y: number }
    rect: DraftRect
  } | null>(null)

  const moveRef = useRef<{
    target: Exclude<MagnifierSelection, null>
    startFrame: MagnifierFrame
    originX: number
    originY: number
    pointerStartX: number
    pointerStartY: number
  } | null>(null)

  const resizeRef = useRef<{
    target: Exclude<MagnifierSelection, null>
    handle: ResizeHandle
    startFrame: MagnifierFrame
    pointerStartX: number
    pointerStartY: number
  } | null>(null)

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

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = loadedImg
    if (!canvas || !img || iw === 0 || ih === 0) return
    canvas.width = iw
    canvas.height = ih
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draft = draftRef.current?.rect ?? null
    const previewFrame: MagnifierFrame | null =
      frameRef.current && draft === null
        ? frameRef.current
        : draft !== null
          ? {
              id: '__draft__',
              source: clampRectToImage(draft, iw, ih),
              inset: clampRectToImage(autoInsetForSource(draft, iw, ih), iw, ih),
              sourceOutline: frameRef.current?.sourceOutline ?? {
                color: '#2563eb',
                widthPx: 3,
              },
              insetOutline: frameRef.current?.insetOutline ?? {
                color: '#2563eb',
                widthPx: 3,
              },
              insetBackgroundColor:
                frameRef.current?.insetBackgroundColor ?? '#111827',
              connector: frameRef.current?.connector ?? {
                enabled: true,
                color: '#2563eb',
                widthPx: 2,
              },
            }
          : frameRef.current

    const ext = magnifierExtent(previewFrame, iw, ih)
    extentRef.current = ext
    canvas.width = ext.canvasW
    canvas.height = ext.canvasH
    renderMagnifier(ctx, img, {
      frame: previewFrame,
      imageWidth: iw,
      imageHeight: ih,
      canvasWidth: ext.canvasW,
      canvasHeight: ext.canvasH,
      offsetX: ext.offsetX,
      offsetY: ext.offsetY,
    })
  }, [loadedImg, iw, ih])

  useEffect(() => {
    redraw()
  }, [redraw, frame])

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

  const finishDraft = (pointerId: number) => {
    const d = draftRef.current
    if (!d || iw === 0 || ih === 0) return
    draftRef.current = null
    const r = clampRectToImage(d.rect, iw, ih)
    if (r.w < MIN_SIZE || r.h < MIN_SIZE) {
      releasePointerCaptureSafe(pointerId)
      onInteractionEnd(frameRef.current)
      redraw()
      return
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const next: MagnifierFrame = {
      id,
      source: r,
      inset: autoInsetForSource(r, iw, ih),
      sourceOutline: frameRef.current?.sourceOutline ?? { color: '#2563eb', widthPx: 3 },
      insetOutline: frameRef.current?.insetOutline ?? { color: '#2563eb', widthPx: 3 },
      insetBackgroundColor: frameRef.current?.insetBackgroundColor ?? '#111827',
      connector: frameRef.current?.connector ?? {
        enabled: true,
        color: '#2563eb',
        widthPx: 2,
      },
    }
    frameRef.current = next
    onFrameChange(next)
    onSelectedTargetChange('source')
    onInteractionEnd(next)
    releasePointerCaptureSafe(pointerId)
  }

  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    if (!loadedImg || iw === 0 || ih === 0) return
    if (e.button !== 0) return

    const { x, y } = clientToImage(e.clientX, e.clientY)
    const ix = Math.max(0, Math.min(x, iw))
    const iy = Math.max(0, Math.min(y, ih))

    // If there's a frame already, background click clears selection.
    if (frameRef.current) {
      onSelectedTargetChange(null)
      e.preventDefault()
      return
    }

    onSelectedTargetChange(null)
    onInteractionStart()
    draftRef.current = { start: { x: ix, y: iy }, rect: { x: ix, y: iy, w: 0, h: 0 } }

    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureElRef.current = el
    e.preventDefault()
  }

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (!loadedImg || iw === 0 || ih === 0) return

    if (draftRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const n = normalizeRect(draftRef.current.start.x, draftRef.current.start.y, x, y)
      draftRef.current = { ...draftRef.current, rect: n }
      redraw()
      e.preventDefault()
      return
    }

    if (moveRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const dx = x - moveRef.current.pointerStartX
      const dy = y - moveRef.current.pointerStartY
      const startFrame = moveRef.current.startFrame
      const target = moveRef.current.target
      const movedRect = target === 'source' ? startFrame.source : startFrame.inset

      const proposed = {
        ...movedRect,
        x: moveRef.current.originX + dx,
        y: moveRef.current.originY + dy,
      }
      const clamped =
        target === 'source'
          ? clampRectToImage(proposed, iw, ih)
          : clampInsetRect(proposed, iw, ih)

      const next: MagnifierFrame = {
        ...startFrame,
        source: target === 'source' ? clamped : startFrame.source,
        inset: target === 'inset' ? clamped : startFrame.inset,
      }
      frameRef.current = next
      onFrameChange(next)
      redraw()
      e.preventDefault()
      return
    }

    if (resizeRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const dx = x - resizeRef.current.pointerStartX
      const dy = y - resizeRef.current.pointerStartY
      const startFrame = resizeRef.current.startFrame
      const target = resizeRef.current.target
      const base = target === 'source' ? startFrame.source : startFrame.inset
      const proposed = applyResize(base, resizeRef.current.handle, dx, dy)
      const resized =
        target === 'source'
          ? clampRectToImage(proposed, iw, ih)
          : clampInsetRect(proposed, iw, ih)

      const next: MagnifierFrame = {
        ...startFrame,
        source: target === 'source' ? resized : startFrame.source,
        inset: target === 'inset' ? resized : startFrame.inset,
      }
      frameRef.current = next
      onFrameChange(next)
      redraw()
      e.preventDefault()
    }
  }

  const handleSvgPointerUp = (e: React.PointerEvent) => {
    if (draftRef.current) {
      finishDraft(e.pointerId)
      e.preventDefault()
      return
    }
    if (moveRef.current) {
      moveRef.current = null
      releasePointerCaptureSafe(e.pointerId)
      onInteractionEnd(frameRef.current)
      e.preventDefault()
      return
    }
    if (resizeRef.current) {
      resizeRef.current = null
      releasePointerCaptureSafe(e.pointerId)
      onInteractionEnd(frameRef.current)
      e.preventDefault()
    }
  }

  const beginMove = (
    e: React.PointerEvent,
    target: Exclude<MagnifierSelection, null>,
  ) => {
    const fr = frameRef.current
    if (!fr || !loadedImg || iw === 0 || ih === 0) return
    e.stopPropagation()
    onInteractionStart()
    onSelectedTargetChange(target)
    const r = target === 'source' ? fr.source : fr.inset
    const { x, y } = clientToImage(e.clientX, e.clientY)
    moveRef.current = {
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

  const beginResize = (
    e: React.PointerEvent,
    target: Exclude<MagnifierSelection, null>,
    handle: ResizeHandle,
  ) => {
    const fr = frameRef.current
    if (!fr || !loadedImg || iw === 0 || ih === 0) return
    e.stopPropagation()
    onInteractionStart()
    onSelectedTargetChange(target)
    const { x, y } = clientToImage(e.clientX, e.clientY)
    resizeRef.current = {
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
            isDraggingFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
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

  if (!image || !loadedImg || iw === 0 || ih === 0) {
    return emptyUpload
  }

  const hasFrame = frame !== null
  const ext = magnifierExtent(frame, iw, ih)

  const handleSize = Math.max(10, Math.min(16, iw > 0 ? iw * 0.02 : 12))
  const hr = handleSize / 2
  const edgeLong = handleSize * 2.35
  const edgeShort = Math.max(handleSize * 0.48, 2)

  const selectionRect =
    selectedTarget === 'source'
      ? frame?.source ?? null
      : selectedTarget === 'inset'
        ? frame?.inset ?? null
        : null

  const connectorSegs = frame ? computeConnectorSegments(frame) : []

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
            aria-label="Magnifier preview"
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
              className={cn(hasFrame ? 'cursor-default' : 'cursor-crosshair')}
              onPointerDown={handleBackgroundPointerDown}
            />

            <g transform={`translate(${ext.offsetX}, ${ext.offsetY})`}>
              {frame && frame.connector.enabled && connectorSegs.length > 0 && (
                <defs>
                  <mask id="magnifier-connector-mask">
                    <rect
                      x={-ext.offsetX}
                      y={-ext.offsetY}
                      width={ext.canvasW}
                      height={ext.canvasH}
                      fill="white"
                    />
                    <rect
                      x={frame.inset.x}
                      y={frame.inset.y}
                      width={frame.inset.w}
                      height={frame.inset.h}
                      fill="black"
                    />
                  </mask>
                </defs>
              )}

              {frame && (
                <>
                  <rect
                    x={frame.source.x}
                    y={frame.source.y}
                    width={frame.source.w}
                    height={frame.source.h}
                    fill="rgba(37,99,235,0.08)"
                    stroke={
                      selectedTarget === 'source'
                        ? 'hsl(var(--primary))'
                        : frame.sourceOutline.color
                    }
                    strokeWidth={
                      selectedTarget === 'source' ? 3 : frame.sourceOutline.widthPx
                    }
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: 'move', pointerEvents: 'auto' }}
                    onPointerDown={(e) => beginMove(e, 'source')}
                  />

                  {frame.connector.enabled && connectorSegs.length > 0 && (
                    <g pointerEvents="none" mask="url(#magnifier-connector-mask)">
                      {connectorSegs.map((s, idx) => (
                        <line
                          key={idx}
                          x1={s.x0}
                          y1={s.y0}
                          x2={s.x1}
                          y2={s.y1}
                          stroke={frame.connector.color}
                          strokeWidth={frame.connector.widthPx}
                          vectorEffect="non-scaling-stroke"
                          opacity={0.95}
                        />
                      ))}
                    </g>
                  )}

                  <rect
                    x={frame.inset.x}
                    y={frame.inset.y}
                    width={frame.inset.w}
                    height={frame.inset.h}
                    fill="rgba(255,255,255,0.04)"
                    stroke={
                      selectedTarget === 'inset'
                        ? 'hsl(var(--primary))'
                        : frame.insetOutline.color
                    }
                    strokeWidth={
                      selectedTarget === 'inset' ? 3 : frame.insetOutline.widthPx
                    }
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: 'move', pointerEvents: 'auto' }}
                    onPointerDown={(e) => beginMove(e, 'inset')}
                  />
                </>
              )}

              {selectionRect &&
                corners(selectionRect).map((hi) => {
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
                          beginResize(
                            e,
                            selectedTarget === null ? 'source' : selectedTarget,
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
                        beginResize(
                          e,
                          selectedTarget === null ? 'source' : selectedTarget,
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


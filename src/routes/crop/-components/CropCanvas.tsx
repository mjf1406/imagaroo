import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Upload } from 'lucide-react'

import type { ImageFile } from '@/components/ImagePreview'
import type { CropRect } from '@/lib/image-cropper'
import { isValidImageType } from '@/lib/image-converter'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

type ResizeLoupeState = {
  handle: ResizeHandle
  imageX: number
  imageY: number
  clientX: number
  clientY: number
}

const MIN_SIZE = 4
const LOUPE_ZOOM = 8
const LOUPE_EDGE_PER_SIDE = 10
const LOUPE_EDGE_THIN = LOUPE_EDGE_PER_SIDE * 2
const MAX_H_STRIP_WIDTH = 520
const MAX_H_STRIP_HEIGHT = LOUPE_EDGE_THIN * LOUPE_ZOOM
const MAX_V_STRIP_WIDTH = LOUPE_EDGE_THIN * LOUPE_ZOOM
const MAX_V_STRIP_HEIGHT = 520
const MAX_CORNER_LOUPE = LOUPE_EDGE_THIN * LOUPE_ZOOM
const HANDLE_HIT_SCREEN_PX = 36

function isCornerHandle(id: ResizeHandle): boolean {
  return id === 'nw' || id === 'ne' || id === 'se' || id === 'sw'
}

function normalizeRect(x0: number, y0: number, x1: number, y1: number): CropRect {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)
  return { x, y, w, h }
}

function applyResizeRect(
  rect: CropRect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
): CropRect {
  let { x, y, w, h } = rect
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
  return { x, y, w, h }
}

function clampRectToImage(rect: CropRect, iw: number, ih: number): CropRect {
  let { x, y, w, h } = rect
  x = Math.max(0, Math.min(x, iw - MIN_SIZE))
  y = Math.max(0, Math.min(y, ih - MIN_SIZE))
  w = Math.max(MIN_SIZE, Math.min(w, iw - x))
  h = Math.max(MIN_SIZE, Math.min(h, ih - y))
  return { x, y, w, h }
}

function handleHitBox(
  handle: ResizeHandle,
  cx: number,
  cy: number,
  hitHalf: number,
): { x: number; y: number; w: number; h: number } {
  const corner = hitHalf * 2
  const edgeLong = hitHalf * 2.8
  const edgeShort = hitHalf * 1.6

  if (isCornerHandle(handle)) {
    return { x: cx - hitHalf, y: cy - hitHalf, w: corner, h: corner }
  }
  if (handle === 'n' || handle === 's') {
    return {
      x: cx - edgeLong / 2,
      y: cy - edgeShort / 2,
      w: edgeLong,
      h: edgeShort,
    }
  }
  return {
    x: cx - edgeShort / 2,
    y: cy - edgeLong / 2,
    w: edgeShort,
    h: edgeLong,
  }
}

function handlePositions(rect: CropRect) {
  const { x, y, w, h } = rect
  return [
    { id: 'nw' as const, cx: x, cy: y },
    { id: 'n' as const, cx: x + w / 2, cy: y },
    { id: 'ne' as const, cx: x + w, cy: y },
    { id: 'e' as const, cx: x + w, cy: y + h / 2 },
    { id: 'se' as const, cx: x + w, cy: y + h },
    { id: 's' as const, cx: x + w / 2, cy: y + h },
    { id: 'sw' as const, cx: x, cy: y + h },
    { id: 'w' as const, cx: x, cy: y + h / 2 },
  ]
}

type EdgeLoupeSpec = {
  srcX: number
  srcY: number
  srcW: number
  srcH: number
  cropLine: 'horizontal' | 'vertical' | 'both'
  cropLineX?: number
  cropLineY?: number
  maxCanvasW: number
  maxCanvasH: number
  placement: 'horizontal' | 'vertical' | 'corner'
}

function thinStripAroundLine(
  linePos: number,
  maxExtent: number,
): { start: number; size: number } {
  let start = linePos - LOUPE_EDGE_PER_SIDE
  if (start < 0) start = 0
  let end = linePos + LOUPE_EDGE_PER_SIDE
  if (end > maxExtent) end = maxExtent
  if (end - start < LOUPE_EDGE_THIN) {
    if (start === 0) end = Math.min(maxExtent, LOUPE_EDGE_THIN)
    else if (end === maxExtent) start = Math.max(0, maxExtent - LOUPE_EDGE_THIN)
  }
  return { start, size: Math.max(1, end - start) }
}

function getEdgeLoupeSpec(
  handle: ResizeHandle,
  crop: CropRect,
  iw: number,
  ih: number,
): EdgeLoupeSpec {
  const { x, y, w, h } = crop

  if (handle === 'n') {
    const strip = thinStripAroundLine(y, ih)
    return {
      srcX: x,
      srcY: strip.start,
      srcW: w,
      srcH: strip.size,
      cropLine: 'horizontal',
      cropLineY: y,
      maxCanvasW: MAX_H_STRIP_WIDTH,
      maxCanvasH: MAX_H_STRIP_HEIGHT,
      placement: 'horizontal',
    }
  }
  if (handle === 's') {
    const lineY = y + h
    const strip = thinStripAroundLine(lineY, ih)
    return {
      srcX: x,
      srcY: strip.start,
      srcW: w,
      srcH: strip.size,
      cropLine: 'horizontal',
      cropLineY: lineY,
      maxCanvasW: MAX_H_STRIP_WIDTH,
      maxCanvasH: MAX_H_STRIP_HEIGHT,
      placement: 'horizontal',
    }
  }
  if (handle === 'w') {
    const strip = thinStripAroundLine(x, iw)
    return {
      srcX: strip.start,
      srcY: y,
      srcW: strip.size,
      srcH: h,
      cropLine: 'vertical',
      cropLineX: x,
      maxCanvasW: MAX_V_STRIP_WIDTH,
      maxCanvasH: MAX_V_STRIP_HEIGHT,
      placement: 'vertical',
    }
  }
  if (handle === 'e') {
    const lineX = x + w
    const strip = thinStripAroundLine(lineX, iw)
    return {
      srcX: strip.start,
      srcY: y,
      srcW: strip.size,
      srcH: h,
      cropLine: 'vertical',
      cropLineX: lineX,
      maxCanvasW: MAX_V_STRIP_WIDTH,
      maxCanvasH: MAX_V_STRIP_HEIGHT,
      placement: 'vertical',
    }
  }

  const cornerSpec = (
    srcX: number,
    srcY: number,
    cropLineX: number,
    cropLineY: number,
  ): EdgeLoupeSpec => ({
    srcX,
    srcY,
    srcW: LOUPE_EDGE_THIN,
    srcH: LOUPE_EDGE_THIN,
    cropLine: 'both',
    cropLineX,
    cropLineY,
    maxCanvasW: MAX_CORNER_LOUPE,
    maxCanvasH: MAX_CORNER_LOUPE,
    placement: 'corner',
  })

  switch (handle) {
    case 'nw': {
      const hStrip = thinStripAroundLine(y, ih)
      const vStrip = thinStripAroundLine(x, iw)
      return cornerSpec(vStrip.start, hStrip.start, x, y)
    }
    case 'ne': {
      const hStrip = thinStripAroundLine(y, ih)
      const vStrip = thinStripAroundLine(x + w, iw)
      return cornerSpec(vStrip.start, hStrip.start, x + w, y)
    }
    case 'sw': {
      const hStrip = thinStripAroundLine(y + h, ih)
      const vStrip = thinStripAroundLine(x, iw)
      return cornerSpec(vStrip.start, hStrip.start, x, y + h)
    }
    case 'se': {
      const hStrip = thinStripAroundLine(y + h, ih)
      const vStrip = thinStripAroundLine(x + w, iw)
      return cornerSpec(vStrip.start, hStrip.start, x + w, y + h)
    }
    default: {
      const strip = thinStripAroundLine(y, ih)
      return {
        srcX: x,
        srcY: strip.start,
        srcW: w,
        srcH: strip.size,
        cropLine: 'horizontal',
        cropLineY: y,
        maxCanvasW: MAX_H_STRIP_WIDTH,
        maxCanvasH: MAX_H_STRIP_HEIGHT,
        placement: 'horizontal',
      }
    }
  }
}

function fitLoupeCanvas(spec: EdgeLoupeSpec): {
  canvasW: number
  canvasH: number
  scaleX: number
  scaleY: number
} {
  const { srcW, srcH, maxCanvasW, maxCanvasH, placement } = spec

  if (placement === 'horizontal') {
    const scaleY = LOUPE_ZOOM
    const scaleX = Math.min(LOUPE_ZOOM, maxCanvasW / srcW)
    return {
      canvasW: Math.max(1, Math.round(srcW * scaleX)),
      canvasH: Math.max(1, Math.round(srcH * scaleY)),
      scaleX,
      scaleY,
    }
  }

  if (placement === 'vertical') {
    const scaleX = LOUPE_ZOOM
    const scaleY = Math.min(LOUPE_ZOOM, maxCanvasH / srcH)
    return {
      canvasW: Math.max(1, Math.round(srcW * scaleX)),
      canvasH: Math.max(1, Math.round(srcH * scaleY)),
      scaleX,
      scaleY,
    }
  }

  const scale = Math.min(
    LOUPE_ZOOM,
    maxCanvasW / srcW,
    maxCanvasH / srcH,
  )
  return {
    canvasW: Math.round(srcW * scale),
    canvasH: Math.round(srcH * scale),
    scaleX: scale,
    scaleY: scale,
  }
}

function loupeStripPlacement(
  container: DOMRect,
  clientX: number,
  clientY: number,
  canvasW: number,
  canvasH: number,
  placement: EdgeLoupeSpec['placement'],
): { left: number; top: number } {
  const margin = 12
  let left = clientX - container.left - canvasW / 2
  let top = clientY - container.top - canvasH - margin

  if (placement === 'vertical') {
    left = clientX - container.left + margin
    top = clientY - container.top - canvasH / 2
  }

  if (placement === 'corner') {
    left = clientX - container.left + margin
    top = clientY - container.top - canvasH - margin
  }

  left = Math.max(margin, Math.min(left, container.width - canvasW - margin))
  top = Math.max(margin, Math.min(top, container.height - canvasH - margin))

  if (top < margin && placement === 'horizontal') {
    top = clientY - container.top + margin
  }
  if (left + canvasW > container.width - margin && placement === 'vertical') {
    left = clientX - container.left - canvasW - margin
  }

  return { left, top }
}

function drawResizeLoupe(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  cropRect: CropRect,
  handle: ResizeHandle,
  iw: number,
  ih: number,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const spec = getEdgeLoupeSpec(handle, cropRect, iw, ih)
  const { canvasW, canvasH, scaleX, scaleY } = fitLoupeCanvas(spec)

  canvas.width = canvasW
  canvas.height = canvasH

  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, canvasW, canvasH)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    img,
    spec.srcX,
    spec.srcY,
    spec.srcW,
    spec.srcH,
    0,
    0,
    canvasW,
    canvasH,
  )

  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1
  for (let px = 0; px <= spec.srcW; px++) {
    const offset = px * scaleX + 0.5
    ctx.beginPath()
    ctx.moveTo(offset, 0)
    ctx.lineTo(offset, canvasH)
    ctx.stroke()
  }
  for (let py = 0; py <= spec.srcH; py++) {
    const offset = py * scaleY + 0.5
    ctx.beginPath()
    ctx.moveTo(0, offset)
    ctx.lineTo(canvasW, offset)
    ctx.stroke()
  }

  ctx.save()
  ctx.strokeStyle = 'hsl(221 83% 53%)'
  ctx.lineWidth = 2
  ctx.setLineDash([4, 3])

  if (
    (spec.cropLine === 'horizontal' || spec.cropLine === 'both') &&
    spec.cropLineY !== undefined
  ) {
    const cropY = (spec.cropLineY - spec.srcY) * scaleY + 0.5
    ctx.beginPath()
    ctx.moveTo(0, cropY)
    ctx.lineTo(canvasW, cropY)
    ctx.stroke()
  }

  if (
    (spec.cropLine === 'vertical' || spec.cropLine === 'both') &&
    spec.cropLineX !== undefined
  ) {
    const cropX = (spec.cropLineX - spec.srcX) * scaleX + 0.5
    ctx.beginPath()
    ctx.moveTo(cropX, 0)
    ctx.lineTo(cropX, canvasH)
    ctx.stroke()
  }

  ctx.restore()

  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 2
  ctx.strokeRect(0.5, 0.5, canvasW - 1, canvasH - 1)
}

type CropResizeLoupeProps = {
  img: HTMLImageElement
  cropRect: CropRect
  loupe: ResizeLoupeState
  iw: number
  ih: number
  containerRef: RefObject<HTMLDivElement | null>
}

function CropResizeLoupe({
  img,
  cropRect,
  loupe,
  iw,
  ih,
  containerRef,
}: CropResizeLoupeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const spec = getEdgeLoupeSpec(loupe.handle, cropRect, iw, ih)
  const { canvasW, canvasH } = fitLoupeCanvas(spec)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawResizeLoupe(canvas, img, cropRect, loupe.handle, iw, ih)
  }, [img, cropRect, loupe, iw, ih])

  const container = containerRef.current?.getBoundingClientRect()
  if (!container) return null

  const { left, top } = loupeStripPlacement(
    container,
    loupe.clientX,
    loupe.clientY,
    canvasW,
    canvasH,
    spec.placement,
  )

  return (
    <div
      className="pointer-events-none absolute z-30 overflow-hidden rounded-md border-2 border-primary bg-background shadow-lg"
      style={{ left, top, width: canvasW, height: canvasH }}
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="block size-full"
      />
      <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white">
        {LOUPE_ZOOM}×
      </span>
    </div>
  )
}

interface CropCanvasProps {
  image: ImageFile | null
  rect: CropRect | null
  onRectChange: (rect: CropRect) => void
  onImageReplace: (file: File) => void
}

export function CropCanvas({
  image,
  rect,
  onRectChange,
  onImageReplace,
}: CropCanvasProps) {
  const dimMaskId = useId().replace(/:/g, '')
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [resizeLoupe, setResizeLoupe] = useState<ResizeLoupeState | null>(null)
  const [displayScale, setDisplayScale] = useState(1)

  const [draft, setDraft] = useState<CropRect | null>(null)
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)

  const moveRef = useRef<{
    originX: number
    originY: number
    pointerStartX: number
    pointerStartY: number
    startRect: CropRect
  } | null>(null)

  const resizeRef = useRef<{
    handle: ResizeHandle
    pointerStartX: number
    pointerStartY: number
    startRect: CropRect
  } | null>(null)

  const rectRef = useRef(rect)
  rectRef.current = rect

  const pointerCaptureElRef = useRef<Element | null>(null)

  const nudgeActiveRef = useRef(false)
  const nudgeEndTimerRef = useRef<number | null>(null)

  const iw = loadedImg?.naturalWidth ?? 0
  const ih = loadedImg?.naturalHeight ?? 0

  const displayRect = draft ?? rect

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

  useEffect(() => {
    const updateScale = () => {
      const el = wrapRef.current?.querySelector('[data-crop-image]')
      if (!el || iw === 0) return
      const { width } = el.getBoundingClientRect()
      if (width > 0) setDisplayScale(width / iw)
    }

    updateScale()
    const el = wrapRef.current?.querySelector('[data-crop-image]')
    if (!el) return

    const observer = new ResizeObserver(updateScale)
    observer.observe(el)
    return () => observer.disconnect()
  }, [iw, image, loadedImg])

  const clientToImage = useCallback(
    (clientX: number, clientY: number) => {
      const el = wrapRef.current?.querySelector('[data-crop-image]')
      if (!el || iw === 0 || ih === 0) return { x: 0, y: 0 }
      const r = el.getBoundingClientRect()
      const x = ((clientX - r.left) / r.width) * iw
      const y = ((clientY - r.top) / r.height) * ih
      return { x, y }
    },
    [iw, ih],
  )

  const updateResizeLoupe = (
    handle: ResizeHandle,
    crop: CropRect,
    clientX: number,
    clientY: number,
  ) => {
    const pos = handlePositions(crop).find((h) => h.id === handle)
    if (!pos) return
    setResizeLoupe({
      handle,
      imageX: pos.cx,
      imageY: pos.cy,
      clientX,
      clientY,
    })
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

  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    if (!loadedImg || iw === 0 || ih === 0) return
    if (e.button !== 0) return

    const { x, y } = clientToImage(e.clientX, e.clientY)
    const ix = Math.max(0, Math.min(x, iw))
    const iy = Math.max(0, Math.min(y, ih))

    drawStartRef.current = { x: ix, y: iy }
    setDraft({ x: ix, y: iy, w: 0, h: 0 })

    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureElRef.current = el
    e.preventDefault()
  }

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (!loadedImg || iw === 0) return

    if (draft && drawStartRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const n = normalizeRect(
        drawStartRef.current.x,
        drawStartRef.current.y,
        x,
        y,
      )
      setDraft(clampRectToImage(n, iw, ih))
      e.preventDefault()
      return
    }

    if (moveRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const dx = x - moveRef.current.pointerStartX
      const dy = y - moveRef.current.pointerStartY
      const start = moveRef.current.startRect
      let nx = moveRef.current.originX + dx
      let ny = moveRef.current.originY + dy
      nx = Math.max(0, Math.min(nx, iw - start.w))
      ny = Math.max(0, Math.min(ny, ih - start.h))
      onRectChange({ ...start, x: nx, y: ny })
      e.preventDefault()
      return
    }

    if (resizeRef.current) {
      const { x, y } = clientToImage(e.clientX, e.clientY)
      const dx = x - resizeRef.current.pointerStartX
      const dy = y - resizeRef.current.pointerStartY
      const resized = applyResizeRect(
        resizeRef.current.startRect,
        resizeRef.current.handle,
        dx,
        dy,
      )
      const clamped = clampRectToImage(resized, iw, ih)
      onRectChange(clamped)
      updateResizeLoupe(
        resizeRef.current.handle,
        clamped,
        e.clientX,
        e.clientY,
      )
      e.preventDefault()
    }
  }

  const finishDraw = (pointerId: number) => {
    if (!draft || !drawStartRef.current) return
    drawStartRef.current = null

    if (draft.w < MIN_SIZE || draft.h < MIN_SIZE) {
      setDraft(null)
      releasePointerCaptureSafe(pointerId)
      return
    }

    onRectChange(clampRectToImage(draft, iw, ih))
    setDraft(null)
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
      e.preventDefault()
      return
    }
    if (resizeRef.current) {
      resizeRef.current = null
      setResizeLoupe(null)
      releasePointerCaptureSafe(e.pointerId)
      e.preventDefault()
    }
  }

  const handleRectPointerDown = (e: React.PointerEvent) => {
    if (!rect || iw === 0 || ih === 0) return
    e.stopPropagation()
    const { x, y } = clientToImage(e.clientX, e.clientY)
    moveRef.current = {
      originX: rect.x,
      originY: rect.y,
      pointerStartX: x,
      pointerStartY: y,
      startRect: rect,
    }
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureElRef.current = el
    e.preventDefault()
  }

  const handleHandlePointerDown = (
    e: React.PointerEvent,
    handle: ResizeHandle,
  ) => {
    if (!rect || iw === 0 || ih === 0) return
    e.stopPropagation()
    const { x, y } = clientToImage(e.clientX, e.clientY)
    resizeRef.current = {
      handle,
      pointerStartX: x,
      pointerStartY: y,
      startRect: rect,
    }
    updateResizeLoupe(handle, rect, e.clientX, e.clientY)
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureElRef.current = el
    e.preventDefault()
  }

  const flushNudgeBurst = useCallback(() => {
    if (nudgeEndTimerRef.current !== null) {
      window.clearTimeout(nudgeEndTimerRef.current)
      nudgeEndTimerRef.current = null
    }
    nudgeActiveRef.current = false
  }, [])

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

      if (
        e.key !== 'ArrowUp' &&
        e.key !== 'ArrowDown' &&
        e.key !== 'ArrowLeft' &&
        e.key !== 'ArrowRight'
      ) {
        return
      }

      const current = rectRef.current
      if (!current || iw === 0 || ih === 0) return

      const step = e.shiftKey ? 10 : 1
      const dx =
        e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      if (dx === 0 && dy === 0) return

      e.preventDefault()
      nudgeActiveRef.current = true

      const nx = Math.max(0, Math.min(current.x + dx, iw - current.w))
      const ny = Math.max(0, Math.min(current.y + dy, ih - current.h))
      onRectChange({ ...current, x: nx, y: ny })

      if (nudgeEndTimerRef.current !== null) {
        window.clearTimeout(nudgeEndTimerRef.current)
      }
      nudgeEndTimerRef.current = window.setTimeout(() => {
        nudgeEndTimerRef.current = null
        nudgeActiveRef.current = false
      }, 400)
    }

    window.addEventListener('keydown', onKey)
    const onBlur = () => flushNudgeBurst()
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
    }
  }, [iw, ih, onRectChange, flushNudgeBurst])

  const handleSize = Math.max(10, Math.min(16, iw > 0 ? iw * 0.02 : 12))
  const hr = handleSize / 2
  const edgeLong = handleSize * 2.35
  const edgeShort = Math.max(handleSize * 0.48, 2)
  const handleHitHalf = Math.max(
    HANDLE_HIT_SCREEN_PX / displayScale / 2,
    handleSize,
  )

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
      {resizeLoupe && displayRect && (
        <CropResizeLoupe
          img={loadedImg}
          cropRect={displayRect}
          loupe={resizeLoupe}
          iw={iw}
          ih={ih}
          containerRef={wrapRef}
        />
      )}
      <div className="relative mx-auto flex w-full max-w-full justify-center">
        <div className="relative inline-block max-w-full max-h-[min(70vh,900px)] leading-none">
          <img
            data-crop-image
            src={image.preview}
            alt={image.file.name}
            width={iw}
            height={ih}
            className="block h-auto max-h-[min(70vh,900px)] w-auto max-w-full select-none"
            draggable={false}
          />
          <svg
            className="absolute left-0 top-0 h-full w-full touch-none"
            viewBox={`0 0 ${iw} ${ih}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerUp}
          >
            <defs>
              <mask id={dimMaskId}>
                <rect x={0} y={0} width={iw} height={ih} fill="white" />
                {displayRect && (
                  <rect
                    x={displayRect.x}
                    y={displayRect.y}
                    width={displayRect.w}
                    height={displayRect.h}
                    fill="black"
                  />
                )}
              </mask>
            </defs>

            <rect
              x={0}
              y={0}
              width={iw}
              height={ih}
              fill="rgba(0,0,0,0.45)"
              mask={`url(#${dimMaskId})`}
              pointerEvents="none"
            />

            <rect
              x={0}
              y={0}
              width={iw}
              height={ih}
              fill="transparent"
              className="cursor-crosshair"
              onPointerDown={handleBackgroundPointerDown}
            />

            {displayRect && (
              <>
                <rect
                  x={displayRect.x}
                  y={displayRect.y}
                  width={displayRect.w}
                  height={displayRect.h}
                  fill="transparent"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: 'move', pointerEvents: 'auto' }}
                  onPointerDown={handleRectPointerDown}
                />

                {!draft &&
                  handlePositions(displayRect).map((hi) => {
                    const hit = handleHitBox(hi.id, hi.cx, hi.cy, handleHitHalf)
                    const cursor = `${hi.id}-resize`
                    const horiz = hi.id === 'n' || hi.id === 's'
                    const pw = horiz ? edgeLong : edgeShort
                    const ph = horiz ? edgeShort : edgeLong
                    const pr = Math.min(pw, ph) / 2
                    return (
                      <g key={hi.id}>
                        <rect
                          x={hit.x}
                          y={hit.y}
                          width={hit.w}
                          height={hit.h}
                          fill="transparent"
                          style={{ cursor, pointerEvents: 'auto' }}
                          onPointerDown={(e) =>
                            handleHandlePointerDown(e, hi.id)
                          }
                        />
                        {isCornerHandle(hi.id) ? (
                          <circle
                            cx={hi.cx}
                            cy={hi.cy}
                            r={hr}
                            fill="white"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            vectorEffect="non-scaling-stroke"
                            style={{ cursor, pointerEvents: 'none' }}
                          />
                        ) : (
                          <rect
                            x={hi.cx - pw / 2}
                            y={hi.cy - ph / 2}
                            width={pw}
                            height={ph}
                            rx={pr}
                            ry={pr}
                            fill="white"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            vectorEffect="non-scaling-stroke"
                            style={{ cursor, pointerEvents: 'none' }}
                          />
                        )}
                      </g>
                    )
                  })}
              </>
            )}
          </svg>
        </div>
      </div>
    </div>
  )
}

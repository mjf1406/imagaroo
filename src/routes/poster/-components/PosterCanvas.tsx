import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload } from 'lucide-react'

import type { ImageFile } from '@/components/ImagePreview'
import type { PosterLayout, PrimaryAxis } from '@/lib/image-poster'
import { pageCoordLabel, pagePosterRect } from '@/lib/image-poster'
import { isValidImageType } from '@/lib/image-converter'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const POSTER_ACCEPT =
  'image/jpeg,image/jpg,image/png,image/webp,image/avif'

interface PosterCanvasProps {
  image: ImageFile | null
  loadedImg: HTMLImageElement | null
  layout: PosterLayout | null
  primaryAxis: PrimaryAxis
  offsetMm: number
  onOffsetChange: (v: number) => void
  showCropMarks: boolean
  showPageCoords: boolean
  onImageReplace: (file: File) => void
}

const CROP_TICK_MM = 5

export function PosterCanvas({
  image,
  loadedImg,
  layout,
  primaryAxis,
  offsetMm,
  onOffsetChange,
  showCropMarks,
  showPageCoords,
  onImageReplace,
}: PosterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const dragRef = useRef<{
    startOffset: number
    pointerStart: number
  } | null>(null)

  const pointerCaptureElRef = useRef<Element | null>(null)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = loadedImg
    if (!canvas || !img || !layout) return

    const scale = 2
    const cw = Math.max(1, Math.round(layout.posterW * scale))
    const ch = Math.max(1, Math.round(layout.posterH * scale))
    canvas.width = cw
    canvas.height = ch

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const mmToPxX = (mm: number) => (mm / layout.posterW) * cw
    const mmToPxY = (mm: number) => (mm / layout.posterH) * ch

    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(0, 0, cw, ch)

    for (let row = 0; row < layout.sheetsTall; row++) {
      for (let col = 0; col < layout.sheetsWide; col++) {
        const page = pagePosterRect(col, row, layout)
        const px = mmToPxX(page.x)
        const py = mmToPxY(page.y)
        const pw = mmToPxX(page.w)
        const ph = mmToPxY(page.h)

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(px, py, pw, ph)
        ctx.strokeStyle = '#94a3b8'
        ctx.lineWidth = 1
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1)

        const marginPxX = mmToPxX((layout.paperW - layout.printableW) / 2)
        const marginPxY = mmToPxY((layout.paperH - layout.printableH) / 2)
        ctx.strokeStyle = '#cbd5e1'
        ctx.setLineDash([4, 4])
        ctx.strokeRect(
          px + marginPxX,
          py + marginPxY,
          pw - 2 * marginPxX,
          ph - 2 * marginPxY,
        )
        ctx.setLineDash([])

        if (showPageCoords) {
          ctx.fillStyle = '#64748b'
          ctx.font = `${Math.max(10, mmToPxY(3))}px sans-serif`
          ctx.fillText(
            pageCoordLabel(col, row),
            px + mmToPxX(2),
            py + mmToPxY(5),
          )
        }

        if (showCropMarks) {
          const tickX = mmToPxX(CROP_TICK_MM)
          const tickY = mmToPxY(CROP_TICK_MM)
          const left = px + marginPxX
          const top = py + marginPxY
          const right = px + pw - marginPxX
          const bottom = py + ph - marginPxY
          ctx.strokeStyle = '#1e293b'
          ctx.lineWidth = 1
          ctx.setLineDash([])
          // top-left
          ctx.beginPath()
          ctx.moveTo(left - tickX, top)
          ctx.lineTo(left, top)
          ctx.moveTo(left, top - tickY)
          ctx.lineTo(left, top)
          ctx.stroke()
          // top-right
          ctx.beginPath()
          ctx.moveTo(right, top - tickY)
          ctx.lineTo(right, top)
          ctx.moveTo(right, top)
          ctx.lineTo(right + tickX, top)
          ctx.stroke()
          // bottom-left
          ctx.beginPath()
          ctx.moveTo(left - tickX, bottom)
          ctx.lineTo(left, bottom)
          ctx.moveTo(left, bottom)
          ctx.lineTo(left, bottom + tickY)
          ctx.stroke()
          // bottom-right
          ctx.beginPath()
          ctx.moveTo(right, bottom)
          ctx.lineTo(right + tickX, bottom)
          ctx.moveTo(right, bottom)
          ctx.lineTo(right, bottom + tickY)
          ctx.stroke()
        }
      }
    }

    const ir = layout.imageRect
    const ix = mmToPxX(ir.x)
    const iy = mmToPxY(ir.y)
    const iw = mmToPxX(ir.w)
    const ih = mmToPxY(ir.h)

    ctx.drawImage(img, ix, iy, iw, ih)
    ctx.strokeStyle = 'hsl(var(--primary))'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(ix + 1, iy + 1, iw - 2, ih - 2)
    ctx.setLineDash([])
  }, [loadedImg, layout, showCropMarks, showPageCoords])

  useEffect(() => {
    redraw()
  }, [redraw])

  const clientToPosterMm = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const el = canvasRef.current
      if (!el || !layout) return { x: 0, y: 0 }
      const r = el.getBoundingClientRect()
      const x = ((clientX - r.left) / r.width) * layout.posterW
      const y = ((clientY - r.top) / r.height) * layout.posterH
      return { x, y }
    },
    [layout],
  )

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

  const handleImagePointerDown = (e: React.PointerEvent) => {
    if (!layout || e.button !== 0) return
    e.preventDefault()
    const pos = clientToPosterMm(e.clientX, e.clientY)
    dragRef.current = {
      startOffset: offsetMm,
      pointerStart: primaryAxis === 'wide' ? pos.y : pos.x,
    }
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    pointerCaptureElRef.current = el
  }

  const handleImagePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !layout) return
    const pos = clientToPosterMm(e.clientX, e.clientY)
    const current = primaryAxis === 'wide' ? pos.y : pos.x
    const delta = current - dragRef.current.pointerStart
    const next = dragRef.current.startOffset + delta
    onOffsetChange(Math.max(0, Math.min(next, layout.slackMm)))
    e.preventDefault()
  }

  const handleImagePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    dragRef.current = null
    releasePointerCaptureSafe(e.pointerId)
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
            Supports AVIF, JPG, JPEG, WEBP, and PNG
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
            accept={POSTER_ACCEPT}
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

  if (!image || !loadedImg || !layout) {
    return emptyUpload
  }

  const ir = layout.imageRect

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-lg border bg-muted overflow-hidden"
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
      <div className="relative mx-auto flex w-full max-w-full justify-center p-2">
        <div className="relative inline-block max-w-full max-h-[min(70vh,900px)] leading-none">
          <canvas
            ref={canvasRef}
            className="block h-auto max-h-[min(70vh,900px)] w-auto max-w-full"
            aria-label="Poster preview"
          />
          <svg
            className="absolute left-0 top-0 h-full w-full touch-none"
            viewBox={`0 0 ${layout.posterW} ${layout.posterH}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerMove={handleImagePointerMove}
            onPointerUp={handleImagePointerUp}
            onPointerCancel={handleImagePointerUp}
          >
            <rect
              x={ir.x}
              y={ir.y}
              width={ir.w}
              height={ir.h}
              fill="transparent"
              className="cursor-move"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={handleImagePointerDown}
            />
          </svg>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center pb-2 px-2">
        Drag the image to reposition it on the page grid
      </p>
    </div>
  )
}

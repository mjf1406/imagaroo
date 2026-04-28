export type MagnifierRect = { x: number; y: number; w: number; h: number }

export type MagnifierFrame = {
  id: string
  source: MagnifierRect
  inset: MagnifierRect
  sourceOutline: { color: string; widthPx: number }
  insetOutline: { color: string; widthPx: number }
  /** Used to paint inset bars when letterboxing. */
  insetBackgroundColor: string
  connector: { enabled: boolean; color: string; widthPx: number }
}

export type MagnifierRenderOptions = {
  frame: MagnifierFrame | null
  imageWidth: number
  imageHeight: number
  canvasWidth: number
  canvasHeight: number
  /** Where the image's (0,0) lands on the canvas. */
  offsetX: number
  offsetY: number
  /**
   * If false, skips clearRect so callers can pre-fill the canvas (e.g. JPG background).
   * @default true
   */
  clearBeforeDraw?: boolean
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function rectsOverlap(a: MagnifierRect, b: MagnifierRect): boolean {
  const ax2 = a.x + a.w
  const ay2 = a.y + a.h
  const bx2 = b.x + b.w
  const by2 = b.y + b.h
  return a.x < bx2 && ax2 > b.x && a.y < by2 && ay2 > b.y
}

function strokeRect(
  ctx: CanvasRenderingContext2D,
  r: MagnifierRect,
  style: { color: string; widthPx: number },
): void {
  ctx.save()
  ctx.strokeStyle = style.color
  ctx.lineWidth = clamp(style.widthPx, 1, 32)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeRect(r.x, r.y, r.w, r.h)
  ctx.restore()
}

/**
 * Returns four corner-to-corner connector segments:
 * NW↔NW, NE↔NE, SE↔SE, SW↔SW.
 */
export function computeConnectorSegments(frame: MagnifierFrame): Array<{
  x0: number
  y0: number
  x1: number
  y1: number
}> {
  const src = frame.source
  const ins = frame.inset
  if (src.w <= 0 || src.h <= 0 || ins.w <= 0 || ins.h <= 0) return []
  if (rectsOverlap(src, ins)) return []

  return [
    { x0: src.x, y0: src.y, x1: ins.x, y1: ins.y }, // NW↔NW
    { x0: src.x + src.w, y0: src.y, x1: ins.x + ins.w, y1: ins.y }, // NE↔NE
    {
      x0: src.x + src.w,
      y0: src.y + src.h,
      x1: ins.x + ins.w,
      y1: ins.y + ins.h,
    }, // SE↔SE
    { x0: src.x, y0: src.y + src.h, x1: ins.x, y1: ins.y + ins.h }, // SW↔SW
  ]
}

export type MagnifierExtent = {
  canvasW: number
  canvasH: number
  offsetX: number
  offsetY: number
}

export function magnifierExtent(
  frame: MagnifierFrame | null,
  imgW: number,
  imgH: number,
): MagnifierExtent {
  if (!frame) return { canvasW: imgW, canvasH: imgH, offsetX: 0, offsetY: 0 }
  const i = frame.inset
  const left = Math.max(0, -i.x)
  const top = Math.max(0, -i.y)
  const right = Math.max(0, i.x + i.w - imgW)
  const bottom = Math.max(0, i.y + i.h - imgH)
  return {
    canvasW: imgW + left + right,
    canvasH: imgH + top + bottom,
    offsetX: left,
    offsetY: top,
  }
}

function drawConnectors(ctx: CanvasRenderingContext2D, frame: MagnifierFrame): void {
  if (!frame.connector.enabled) return
  const segs = computeConnectorSegments(frame)
  if (segs.length === 0) return
  ctx.save()
  ctx.strokeStyle = frame.connector.color
  ctx.lineWidth = clamp(frame.connector.widthPx, 1, 32)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const s of segs) {
    ctx.beginPath()
    ctx.moveTo(s.x0, s.y0)
    ctx.lineTo(s.x1, s.y1)
    ctx.stroke()
  }
  ctx.restore()
}

function letterboxDraw(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  source: MagnifierRect,
  inset: MagnifierRect,
): void {
  const srcW = source.w
  const srcH = source.h
  const insW = inset.w
  const insH = inset.h
  if (srcW <= 0 || srcH <= 0 || insW <= 0 || insH <= 0) return

  const scale = Math.min(insW / srcW, insH / srcH)
  const drawW = srcW * scale
  const drawH = srcH * scale
  const offX = (insW - drawW) / 2
  const offY = (insH - drawH) / 2

  ctx.save()
  ctx.beginPath()
  ctx.rect(inset.x, inset.y, inset.w, inset.h)
  ctx.clip()
  ctx.drawImage(
    img,
    source.x,
    source.y,
    source.w,
    source.h,
    inset.x + offX,
    inset.y + offY,
    drawW,
    drawH,
  )
  ctx.restore()
}

export function renderMagnifier(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  options: MagnifierRenderOptions,
): void {
  const {
    frame,
    imageWidth,
    imageHeight,
    canvasWidth,
    canvasHeight,
    offsetX,
    offsetY,
    clearBeforeDraw = true,
  } = options

  if (clearBeforeDraw) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  }
  ctx.drawImage(img, offsetX, offsetY, imageWidth, imageHeight)

  if (!frame) return

  ctx.save()
  ctx.translate(offsetX, offsetY)

  // Source outline + connectors beneath inset box to match inset-map feel.
  strokeRect(ctx, frame.source, frame.sourceOutline)
  drawConnectors(ctx, frame)

  // Inset: background fill (letterbox bars), clipped letterboxed content, then outline.
  ctx.save()
  ctx.fillStyle = frame.insetBackgroundColor
  ctx.fillRect(frame.inset.x, frame.inset.y, frame.inset.w, frame.inset.h)
  ctx.restore()

  letterboxDraw(ctx, img, frame.source, frame.inset)
  strokeRect(ctx, frame.inset, frame.insetOutline)
  ctx.restore()
}

export type MagnifierExportFormat = 'jpg' | 'png' | 'webp'

export type ExportMagnifierOptions = {
  frame: MagnifierFrame | null
  format: MagnifierExportFormat
  /** Used when format is jpg — fills canvas before drawing (transparency → solid) */
  jpgBackgroundColor?: string
  quality?: number
}

export function exportMagnifier(
  img: HTMLImageElement,
  options: ExportMagnifierOptions,
): Promise<Blob> {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (w === 0 || h === 0) {
    return Promise.reject(new Error('Image has no dimensions'))
  }

  const canvas = document.createElement('canvas')
  const ext = magnifierExtent(options.frame, w, h)
  canvas.width = ext.canvasW
  canvas.height = ext.canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return Promise.reject(new Error('Failed to get canvas context'))
  }

  const { format, jpgBackgroundColor, quality = 0.92, frame } = options

  if (format === 'jpg') {
    const bg = jpgBackgroundColor ?? '#ffffff'
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, ext.canvasW, ext.canvasH)
    renderMagnifier(ctx, img, {
      frame,
      imageWidth: w,
      imageHeight: h,
      canvasWidth: ext.canvasW,
      canvasHeight: ext.canvasH,
      offsetX: ext.offsetX,
      offsetY: ext.offsetY,
      clearBeforeDraw: false,
    })
  } else {
    renderMagnifier(ctx, img, {
      frame,
      imageWidth: w,
      imageHeight: h,
      canvasWidth: ext.canvasW,
      canvasHeight: ext.canvasH,
      offsetX: ext.offsetX,
      offsetY: ext.offsetY,
    })
  }

  const mime =
    format === 'jpg'
      ? 'image/jpeg'
      : format === 'webp'
        ? 'image/webp'
        : 'image/png'

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to encode image'))
      },
      mime,
      format === 'png' ? undefined : quality,
    )
  })
}


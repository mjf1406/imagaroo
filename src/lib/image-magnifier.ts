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

/**
 * Draws magnifier outlines, connectors, inset background, and letterboxed zoom
 * on top of an image already drawn at `(offsetX, offsetY)`.
 * `frame` coordinates are in image space.
 */
export function drawMagnifierOverlay(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  frame: MagnifierFrame,
  offsetX: number,
  offsetY: number,
): void {
  ctx.save()
  ctx.translate(offsetX, offsetY)
  strokeRect(ctx, frame.source, frame.sourceOutline)
  drawConnectors(ctx, frame)
  ctx.save()
  ctx.fillStyle = frame.insetBackgroundColor
  ctx.fillRect(frame.inset.x, frame.inset.y, frame.inset.w, frame.inset.h)
  ctx.restore()
  letterboxDraw(ctx, img, frame.source, frame.inset)
  strokeRect(ctx, frame.inset, frame.insetOutline)
  ctx.restore()
}


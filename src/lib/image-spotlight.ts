/**
 * Spotlight / vignette-by-shapes: draw rectangles and ellipses in image space,
 * then either darken or blur everywhere except the chosen focus side of the union.
 * Optional magnifier frame adds an inset zoom; its source rect joins the focus mask.
 */

import type { MagnifierFrame, MagnifierRect } from './image-magnifier'
import { drawMagnifierOverlay, magnifierExtent } from './image-magnifier'

export type SpotlightShapeKind = 'rect' | 'ellipse'

/** Per-shape outline; when set, this shape is stroked on canvas/export. */
export type SpotlightShapeOutlineStyle = {
  color: string
  widthPx: number
}

/** Per-shape interior fill over the image; when set, fill is drawn on canvas/export. */
export type SpotlightShapeFillStyle = {
  /** Hex color, e.g. #rrggbb */
  color: string
  /** 0–100, opacity of the fill over the image */
  opacityPct: number
}

export type SpotlightShape =
  | {
      id: string
      kind: 'rect'
      x: number
      y: number
      w: number
      h: number
      outline?: SpotlightShapeOutlineStyle
      fill?: SpotlightShapeFillStyle
    }
  | {
      id: string
      kind: 'ellipse'
      x: number
      y: number
      w: number
      h: number
      outline?: SpotlightShapeOutlineStyle
      fill?: SpotlightShapeFillStyle
    }

export type SpotlightEffect = 'darken' | 'blur'

export type SpotlightFocusArea = 'inside' | 'outside'

export const SPOTLIGHT_DEFAULT_OUTLINE_COLOR = '#000000'
export const SPOTLIGHT_DEFAULT_OUTLINE_WIDTH_PX = 3

export function getShapeOutlineColor(shape: SpotlightShape): string {
  return shape.outline?.color ?? SPOTLIGHT_DEFAULT_OUTLINE_COLOR
}

export function getShapeOutlineWidthPx(shape: SpotlightShape): number {
  return clamp(
    shape.outline?.widthPx ?? SPOTLIGHT_DEFAULT_OUTLINE_WIDTH_PX,
    1,
    32,
  )
}

/** For UI / persisted values: integer width in [1, 32]. */
export function clampSpotlightOutlineWidthPx(n: number): number {
  return clamp(Math.round(n), 1, 32)
}

export function clampSpotlightFillOpacityPct(n: number): number {
  return clamp(Math.round(n), 0, 100)
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const t = hex.trim()
  const m = /^#([0-9a-f]{6})$/i.exec(t)
  if (!m) return null
  const n = Number.parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** CSS `rgba(...)` for canvas/SVG from stored fill. */
export function spotlightFillToRgbaString(fill: SpotlightShapeFillStyle): string {
  const rgb = parseHexRgb(fill.color)
  const a = clamp(fill.opacityPct, 0, 100) / 100
  if (!rgb) return `rgba(0,0,0,${a})`
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`
}

export type SpotlightRenderOptions = {
  shapes: Array<SpotlightShape>
  effect: SpotlightEffect
  /** 0–100, opacity of black overlay on the treated layer (darken mode) */
  darkenStrength: number
  /** 0–50, CSS blur px (blur mode) */
  blurStrength: number
  focusArea: SpotlightFocusArea
  /** Inset zoom frame; source rect is included in the spotlight mask. */
  magnifier?: MagnifierFrame | null
  /**
   * If false, skips clearRect so callers can pre-fill the canvas (e.g. JPG background).
   * @default true
   */
  clearBeforeDraw?: boolean
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function fillShapePath(
  ctx: CanvasRenderingContext2D,
  shape: SpotlightShape,
): void {
  const { x, y, w, h } = shape
  if (w <= 0 || h <= 0) return
  if (shape.kind === 'rect') {
    ctx.rect(x, y, w, h)
  } else {
    const rx = w / 2
    const ry = h / 2
    const cx = x + rx
    const cy = y + ry
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  }
}

/**
 * Opaque white where the effect should be applied; transparent elsewhere.
 * - focus `inside`: sharp inside union → effect outside union
 * - focus `outside`: sharp outside union → effect inside union
 * Shapes and magnifier source are in image space; mask is canvas-sized with `offsetX/Y`.
 */
function buildEffectAlphaMask(
  canvasW: number,
  canvasH: number,
  shapes: Array<SpotlightShape>,
  magnifierSource: MagnifierRect | null,
  focusArea: SpotlightFocusArea,
  offsetX: number,
  offsetY: number,
): HTMLCanvasElement {
  const mask = document.createElement('canvas')
  mask.width = canvasW
  mask.height = canvasH
  const m = mask.getContext('2d')
  if (!m) return mask

  const hasMagSrc =
    magnifierSource !== null &&
    magnifierSource.w > 0 &&
    magnifierSource.h > 0
  if (shapes.length === 0 && !hasMagSrc) {
    return mask
  }

  if (focusArea === 'inside') {
    m.fillStyle = '#ffffff'
    m.fillRect(0, 0, canvasW, canvasH)
    m.globalCompositeOperation = 'destination-out'
    m.fillStyle = '#ffffff'
    m.save()
    m.translate(offsetX, offsetY)
    for (const s of shapes) {
      m.beginPath()
      fillShapePath(m, s)
      m.fill()
    }
    if (hasMagSrc && magnifierSource) {
      m.fillRect(
        magnifierSource.x,
        magnifierSource.y,
        magnifierSource.w,
        magnifierSource.h,
      )
    }
    m.restore()
    m.globalCompositeOperation = 'source-over'
  } else {
    m.clearRect(0, 0, canvasW, canvasH)
    m.fillStyle = '#ffffff'
    m.save()
    m.translate(offsetX, offsetY)
    for (const s of shapes) {
      m.beginPath()
      fillShapePath(m, s)
      m.fill()
    }
    if (hasMagSrc && magnifierSource) {
      m.fillRect(
        magnifierSource.x,
        magnifierSource.y,
        magnifierSource.w,
        magnifierSource.h,
      )
    }
    m.restore()
  }

  return mask
}

function drawTreatedLayerExtended(
  canvasW: number,
  canvasH: number,
  img: CanvasImageSource,
  offsetX: number,
  offsetY: number,
  iw: number,
  ih: number,
  effect: SpotlightEffect,
  darkenStrength: number,
  blurStrength: number,
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = canvasW
  c.height = canvasH
  const ctx = c.getContext('2d')
  if (!ctx) return c

  if (effect === 'darken') {
    ctx.drawImage(img, offsetX, offsetY, iw, ih)
    const a = clamp(darkenStrength, 0, 100) / 100
    if (a > 0) {
      ctx.fillStyle = `rgba(0,0,0,${a})`
      ctx.fillRect(offsetX, offsetY, iw, ih)
    }
  } else {
    const px = clamp(blurStrength, 0, 50)
    ctx.filter = px > 0 ? `blur(${px}px)` : 'none'
    ctx.drawImage(img, offsetX, offsetY, iw, ih)
    ctx.filter = 'none'
  }

  return c
}

function fillShapeFills(
  ctx: CanvasRenderingContext2D,
  shapes: Array<SpotlightShape>,
  offsetX: number,
  offsetY: number,
): void {
  ctx.save()
  ctx.translate(offsetX, offsetY)
  for (const s of shapes) {
    if (s.w <= 0 || s.h <= 0 || !s.fill) continue
    ctx.fillStyle = spotlightFillToRgbaString(s.fill)
    ctx.beginPath()
    fillShapePath(ctx, s)
    ctx.fill()
  }
  ctx.restore()
}

function strokeShapeOutlines(
  ctx: CanvasRenderingContext2D,
  shapes: Array<SpotlightShape>,
  offsetX: number,
  offsetY: number,
): void {
  ctx.save()
  ctx.translate(offsetX, offsetY)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const s of shapes) {
    if (s.w <= 0 || s.h <= 0 || !s.outline) continue
    ctx.strokeStyle = s.outline.color
    ctx.lineWidth = clamp(s.outline.widthPx, 1, 32)
    ctx.beginPath()
    fillShapePath(ctx, s)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Renders the spotlight result into `ctx`.
 * `width`/`height` are the image's natural dimensions (image space).
 * The canvas backing store must match `magnifierExtent(magnifier, width, height)`.
 */
export function renderSpotlight(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  width: number,
  height: number,
  options: SpotlightRenderOptions,
): void {
  const {
    shapes,
    effect,
    darkenStrength,
    blurStrength,
    focusArea,
    magnifier = null,
    clearBeforeDraw = true,
  } = options

  const iw = width
  const ih = height
  const ext = magnifierExtent(magnifier, iw, ih)
  const { canvasW, canvasH, offsetX, offsetY } = ext

  if (clearBeforeDraw) {
    ctx.clearRect(0, 0, canvasW, canvasH)
  }
  ctx.drawImage(img, offsetX, offsetY, iw, ih)

  const hasMag = magnifier !== null
  const hasUnion = shapes.length > 0 || hasMag

  if (!hasUnion) {
    return
  }

  const hasEffect =
    effect === 'darken'
      ? clamp(darkenStrength, 0, 100) > 0
      : clamp(blurStrength, 0, 50) > 0

  if (hasEffect) {
    const treated = drawTreatedLayerExtended(
      canvasW,
      canvasH,
      img,
      offsetX,
      offsetY,
      iw,
      ih,
      effect,
      darkenStrength,
      blurStrength,
    )

    const mask = buildEffectAlphaMask(
      canvasW,
      canvasH,
      shapes,
      magnifier !== null ? magnifier.source : null,
      focusArea,
      offsetX,
      offsetY,
    )

    const masked = document.createElement('canvas')
    masked.width = canvasW
    masked.height = canvasH
    const mctx = masked.getContext('2d')
    if (!mctx) return

    mctx.drawImage(treated, 0, 0)
    mctx.globalCompositeOperation = 'destination-in'
    mctx.drawImage(mask, 0, 0)
    mctx.globalCompositeOperation = 'source-over'

    ctx.drawImage(masked, 0, 0)
  }

  if (hasMag && magnifier) {
    drawMagnifierOverlay(ctx, img, magnifier, offsetX, offsetY)
  }

  fillShapeFills(ctx, shapes, offsetX, offsetY)
  strokeShapeOutlines(ctx, shapes, offsetX, offsetY)
}

export type SpotlightExportFormat = 'jpg' | 'png' | 'webp'

export type ExportSpotlightOptions = SpotlightRenderOptions & {
  format: SpotlightExportFormat
  /** Used when format is jpg — fills canvas before drawing (transparency → solid) */
  jpgBackgroundColor?: string
  quality?: number
}

/**
 * Renders at natural image size and returns an encoded blob.
 */
export function exportSpotlight(
  img: HTMLImageElement,
  options: ExportSpotlightOptions,
): Promise<Blob> {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (w === 0 || h === 0) {
    return Promise.reject(new Error('Image has no dimensions'))
  }

  const ext = magnifierExtent(options.magnifier ?? null, w, h)
  const canvas = document.createElement('canvas')
  canvas.width = ext.canvasW
  canvas.height = ext.canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return Promise.reject(new Error('Failed to get canvas context'))
  }

  const { format, jpgBackgroundColor, quality = 0.92, ...rest } = options

  if (format === 'jpg') {
    const bg = jpgBackgroundColor ?? '#ffffff'
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, ext.canvasW, ext.canvasH)
    renderSpotlight(ctx, img, w, h, { ...rest, clearBeforeDraw: false })
  } else {
    renderSpotlight(ctx, img, w, h, rest)
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

import { jsPDF } from 'jspdf'

export type PaperSize = 'a4' | 'a3' | 'letter'
export type Orientation = 'portrait' | 'landscape'
export type PrimaryAxis = 'wide' | 'tall'
export type LengthUnit = 'mm' | 'in'

export const MM_PER_IN = 25.4
export const OPTIMUM_DPI = 300
export const PDF_RENDER_DPI = 150

export const PAPER_SIZES_MM: Record<
  PaperSize,
  { width: number; height: number; label: string }
> = {
  a4: { width: 210, height: 297, label: 'A4' },
  a3: { width: 297, height: 420, label: 'A3' },
  letter: { width: 215.9, height: 279.4, label: 'Letter' },
}

export type PosterSettings = {
  paperSize: PaperSize
  orientation: Orientation
  marginMm: number
  overlapMm: number
  primaryAxis: PrimaryAxis
  sheetsWide: number
  sheetsTall: number
  /** Offset along the non-driver axis, in mm. */
  offsetMm: number
  showCropMarks: boolean
  showPageCoords: boolean
}

export type PosterRect = { x: number; y: number; w: number; h: number }

export type PosterLayout = {
  paperW: number
  paperH: number
  printableW: number
  printableH: number
  stepW: number
  stepH: number
  posterW: number
  posterH: number
  imageRect: PosterRect
  slackMm: number
  sheetsWide: number
  sheetsTall: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function getPaperDims(
  paperSize: PaperSize,
  orientation: Orientation,
): { width: number; height: number } {
  const base = PAPER_SIZES_MM[paperSize]
  if (orientation === 'portrait') {
    return { width: base.width, height: base.height }
  }
  return { width: base.height, height: base.width }
}

export function posterLen(
  sheets: number,
  printable: number,
  step: number,
): number {
  const n = Math.max(1, Math.round(sheets))
  return printable + (n - 1) * step
}

export function minSheetsToCover(
  needed: number,
  printable: number,
  step: number,
): number {
  if (needed <= printable) return 1
  if (step <= 0) return Math.ceil(needed / printable)
  return Math.ceil((needed - printable) / step) + 1
}

export function computePrintableDims(
  paperSize: PaperSize,
  orientation: Orientation,
  marginMm: number,
): { paperW: number; paperH: number; printableW: number; printableH: number } {
  const { width: paperW, height: paperH } = getPaperDims(paperSize, orientation)
  const margin = clamp(marginMm, 0, Math.min(paperW, paperH) / 2 - 1)
  return {
    paperW,
    paperH,
    printableW: Math.max(1, paperW - 2 * margin),
    printableH: Math.max(1, paperH - 2 * margin),
  }
}

export function computeSheetsForAxis(
  driverSheets: number,
  primaryAxis: PrimaryAxis,
  imageWidthPx: number,
  imageHeightPx: number,
  paperSize: PaperSize,
  orientation: Orientation,
  marginMm: number,
  overlapMm: number,
): { sheetsWide: number; sheetsTall: number } {
  const aspect = imageHeightPx / imageWidthPx
  const { printableW, printableH } = computePrintableDims(
    paperSize,
    orientation,
    marginMm,
  )
  const overlap = clamp(overlapMm, 0, Math.min(printableW, printableH) - 0.1)
  const stepW = Math.max(0.1, printableW - overlap)
  const stepH = Math.max(0.1, printableH - overlap)
  const driver = Math.max(1, Math.round(driverSheets))

  if (primaryAxis === 'wide') {
    const sheetsWide = driver
    const posterW = posterLen(sheetsWide, printableW, stepW)
    const needH = posterW * aspect
    const sheetsTall = minSheetsToCover(needH, printableH, stepH)
    return { sheetsWide, sheetsTall }
  }

  const sheetsTall = driver
  const posterH = posterLen(sheetsTall, printableH, stepH)
  const needW = posterH / aspect
  const sheetsWide = minSheetsToCover(needW, printableW, stepW)
  return { sheetsWide, sheetsTall }
}

export function optimumSheetsForPrintDpi(
  imageWidthPx: number,
  imageHeightPx: number,
  paperSize: PaperSize,
  orientation: Orientation,
  marginMm: number,
  overlapMm: number,
): { sheetsWide: number; sheetsTall: number; primaryAxis: PrimaryAxis } {
  const targetPosterWmm = (imageWidthPx / OPTIMUM_DPI) * MM_PER_IN
  const { printableW } = computePrintableDims(paperSize, orientation, marginMm)
  const overlap = clamp(
    overlapMm,
    0,
    Math.max(0, printableW - 0.1),
  )
  const stepW = Math.max(0.1, printableW - overlap)

  let bestSheets = 1
  let bestDiff = Infinity
  const maxSheets = 50

  for (let n = 1; n <= maxSheets; n++) {
    const len = posterLen(n, printableW, stepW)
    const diff = Math.abs(len - targetPosterWmm)
    if (diff < bestDiff) {
      bestDiff = diff
      bestSheets = n
    }
  }

  const derived = computeSheetsForAxis(
    bestSheets,
    'wide',
    imageWidthPx,
    imageHeightPx,
    paperSize,
    orientation,
    marginMm,
    overlapMm,
  )

  return { ...derived, primaryAxis: 'wide' as const }
}

export function computePosterLayout(
  imageWidthPx: number,
  imageHeightPx: number,
  settings: PosterSettings,
): PosterLayout {
  const aspect = imageHeightPx / imageWidthPx
  const { paperW, paperH, printableW, printableH } = computePrintableDims(
    settings.paperSize,
    settings.orientation,
    settings.marginMm,
  )
  const overlap = clamp(
    settings.overlapMm,
    0,
    Math.min(printableW, printableH) - 0.1,
  )
  const stepW = Math.max(0.1, printableW - overlap)
  const stepH = Math.max(0.1, printableH - overlap)

  const sheets = computeSheetsForAxis(
    settings.primaryAxis === 'wide'
      ? settings.sheetsWide
      : settings.sheetsTall,
    settings.primaryAxis,
    imageWidthPx,
    imageHeightPx,
    settings.paperSize,
    settings.orientation,
    settings.marginMm,
    settings.overlapMm,
  )

  const posterW = posterLen(sheets.sheetsWide, printableW, stepW)
  const posterH = posterLen(sheets.sheetsTall, printableH, stepH)

  let imageRect: PosterRect
  let slackMm: number

  if (settings.primaryAxis === 'wide') {
    const imgH = posterW * aspect
    slackMm = Math.max(0, posterH - imgH)
    const offsetY = clamp(settings.offsetMm, 0, slackMm)
    imageRect = { x: 0, y: offsetY, w: posterW, h: imgH }
  } else {
    const imgW = posterH / aspect
    slackMm = Math.max(0, posterW - imgW)
    const offsetX = clamp(settings.offsetMm, 0, slackMm)
    imageRect = { x: offsetX, y: 0, w: imgW, h: posterH }
  }

  return {
    paperW,
    paperH,
    printableW,
    printableH,
    stepW,
    stepH,
    posterW,
    posterH,
    imageRect,
    slackMm,
    sheetsWide: sheets.sheetsWide,
    sheetsTall: sheets.sheetsTall,
  }
}

export function clampOffsetMm(
  offsetMm: number,
  slackMm: number,
): number {
  return clamp(offsetMm, 0, slackMm)
}

function intersectRects(a: PosterRect, b: PosterRect): PosterRect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.w, b.x + b.w)
  const bottom = Math.min(a.y + a.h, b.y + b.h)
  const w = right - x
  const h = bottom - y
  if (w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

export function pagePosterRect(
  col: number,
  row: number,
  layout: PosterLayout,
): PosterRect {
  return {
    x: col * layout.stepW,
    y: row * layout.stepH,
    w: layout.printableW,
    h: layout.printableH,
  }
}

function drawCropMarks(
  doc: jsPDF,
  margin: number,
  printableW: number,
  printableH: number,
  tickLen = 5,
): void {
  const left = margin
  const top = margin
  const right = margin + printableW
  const bottom = margin + printableH

  doc.setDrawColor(0)
  doc.setLineWidth(0.2)

  // top-left
  doc.line(left - tickLen, top, left, top)
  doc.line(left, top - tickLen, left, top)
  // top-right
  doc.line(right, top - tickLen, right, top)
  doc.line(right, top, right + tickLen, top)
  // bottom-left
  doc.line(left - tickLen, bottom, left, bottom)
  doc.line(left, bottom, left, bottom + tickLen)
  // bottom-right
  doc.line(right, bottom, right + tickLen, bottom)
  doc.line(right, bottom, right, bottom + tickLen)
}

function renderPageSlice(
  image: HTMLImageElement,
  layout: PosterLayout,
  col: number,
  row: number,
): string | null {
  const pageRect = pagePosterRect(col, row, layout)
  const intersect = intersectRects(pageRect, layout.imageRect)
  if (!intersect) return null

  const pxPerMm = PDF_RENDER_DPI / MM_PER_IN
  const canvasW = Math.max(1, Math.round(layout.printableW * pxPerMm))
  const canvasH = Math.max(1, Math.round(layout.printableH * pxPerMm))

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasW, canvasH)

  const img = layout.imageRect
  const srcX =
    ((intersect.x - img.x) / img.w) * image.naturalWidth
  const srcY =
    ((intersect.y - img.y) / img.h) * image.naturalHeight
  const srcW = (intersect.w / img.w) * image.naturalWidth
  const srcH = (intersect.h / img.h) * image.naturalHeight

  const destX = ((intersect.x - pageRect.x) / layout.printableW) * canvasW
  const destY = ((intersect.y - pageRect.y) / layout.printableH) * canvasH
  const destW = (intersect.w / layout.printableW) * canvasW
  const destH = (intersect.h / layout.printableH) * canvasH

  ctx.drawImage(
    image,
    srcX,
    srcY,
    srcW,
    srcH,
    destX,
    destY,
    destW,
    destH,
  )

  return canvas.toDataURL('image/jpeg', 0.92)
}

export async function generatePosterPdf(
  image: HTMLImageElement,
  settings: PosterSettings,
): Promise<Blob> {
  const layout = computePosterLayout(
    image.naturalWidth,
    image.naturalHeight,
    settings,
  )
  const margin = clamp(
    settings.marginMm,
    0,
    Math.min(layout.paperW, layout.paperH) / 2 - 1,
  )

  const doc = new jsPDF({
    unit: 'mm',
    format: [layout.paperW, layout.paperH],
    orientation:
      settings.orientation === 'landscape' ? 'landscape' : 'portrait',
  })

  let pageIndex = 0

  for (let row = 0; row < layout.sheetsTall; row++) {
    for (let col = 0; col < layout.sheetsWide; col++) {
      if (pageIndex > 0) {
        doc.addPage(
          [layout.paperW, layout.paperH],
          settings.orientation === 'landscape' ? 'landscape' : 'portrait',
        )
      }

      const dataUrl = renderPageSlice(image, layout, col, row)
      if (dataUrl) {
        doc.addImage(
          dataUrl,
          'JPEG',
          margin,
          margin,
          layout.printableW,
          layout.printableH,
        )
      }

      if (settings.showCropMarks) {
        drawCropMarks(doc, margin, layout.printableW, layout.printableH)
      }

      if (settings.showPageCoords) {
        doc.setFontSize(8)
        doc.setTextColor(80)
        doc.text(
          `C${col + 1}-R${row + 1}`,
          margin,
          margin - 2,
        )
      }

      pageIndex++
    }
  }

  return doc.output('blob')
}

export function mmToDisplay(mm: number, unit: LengthUnit): number {
  if (unit === 'mm') return mm
  return mm / MM_PER_IN
}

export function displayToMm(value: number, unit: LengthUnit): number {
  if (unit === 'mm') return value
  return value * MM_PER_IN
}

export function pageCoordLabel(col: number, row: number): string {
  return `C${col + 1}-R${row + 1}`
}

import type { MaskActivation } from './types'

export function spatialDims(dims: Array<number>): {
  width: number
  height: number
} {
  if (dims.length < 2) {
    throw new Error('Mask tensor must have at least 2 dimensions')
  }
  const height = dims[dims.length - 2]
  const width = dims[dims.length - 1]
  return { width, height }
}

export function floatMaskToUint8(
  data: ArrayLike<number>,
  activation: MaskActivation,
): Uint8Array {
  let max = 0
  for (const value of Array.from(data)) {
    max = Math.max(max, value)
  }
  const looksLikeBytes = activation === 'none' && max > 1.5
  const out = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    let value = data[i] ?? 0
    if (looksLikeBytes) {
      value = value / 255
    }
    if (activation === 'sigmoid') {
      value = 1 / (1 + Math.exp(-value))
    }
    out[i] = Math.round(Math.min(1, Math.max(0, value)) * 255)
  }
  return out
}

export function applyAlphaMask(
  imageData: ImageData,
  mask: Uint8Array,
): ImageData {
  const pixelCount = imageData.width * imageData.height
  if (mask.length !== pixelCount) {
    throw new Error(
      `Mask size mismatch: expected ${pixelCount} pixels, got ${mask.length}`,
    )
  }

  const out = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
  )
  const pixels = out.data
  for (let i = 0; i < mask.length; i++) {
    const alphaIndex = i * 4 + 3
    const sourceAlpha = pixels[alphaIndex] ?? 255
    const maskValue = mask[i] ?? 0
    pixels[alphaIndex] = Math.round((sourceAlpha * maskValue) / 255)
  }
  return out
}

type Canvas2D = {
  width: number
  height: number
  getContext: (
    id: '2d',
    options?: { willReadFrequently?: boolean },
  ) => {
    createImageData: (width: number, height: number) => ImageData
    putImageData: (imageData: ImageData, x: number, y: number) => void
    drawImage: (
      image: CanvasImageSource,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ) => void
    getImageData: (x: number, y: number, w: number, h: number) => ImageData
    imageSmoothingEnabled: boolean
    imageSmoothingQuality: ImageSmoothingQuality
  } | null
}

function createResizeCanvas(width: number, height: number): Canvas2D {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height) as unknown as Canvas2D
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
  throw new Error('No canvas implementation is available to resize the mask')
}

export function resizeGrayscaleMask(
  mask: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Uint8Array {
  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return mask
  }
  if (mask.length !== sourceWidth * sourceHeight) {
    throw new Error(
      `Mask size mismatch: expected ${sourceWidth * sourceHeight}, got ${mask.length}`,
    )
  }

  const source = createResizeCanvas(sourceWidth, sourceHeight)
  const sourceCtx = source.getContext('2d', { willReadFrequently: true })
  if (!sourceCtx) {
    throw new Error('Failed to get canvas context')
  }

  const sourceImage = sourceCtx.createImageData(sourceWidth, sourceHeight)
  for (let i = 0; i < mask.length; i++) {
    const pixel = i * 4
    const value = mask[i] ?? 0
    sourceImage.data[pixel] = value
    sourceImage.data[pixel + 1] = value
    sourceImage.data[pixel + 2] = value
    sourceImage.data[pixel + 3] = 255
  }
  sourceCtx.putImageData(sourceImage, 0, 0)

  const target = createResizeCanvas(targetWidth, targetHeight)
  const targetCtx = target.getContext('2d', { willReadFrequently: true })
  if (!targetCtx) {
    throw new Error('Failed to get canvas context')
  }
  targetCtx.imageSmoothingEnabled = true
  targetCtx.imageSmoothingQuality = 'high'
  targetCtx.drawImage(
    source as unknown as CanvasImageSource,
    0,
    0,
    targetWidth,
    targetHeight,
  )
  const resized = targetCtx.getImageData(0, 0, targetWidth, targetHeight)
  const out = new Uint8Array(targetWidth * targetHeight)
  for (let i = 0; i < out.length; i++) {
    out[i] = resized.data[i * 4] ?? 0
  }
  return out
}

export async function fileToImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }
    ctx.drawImage(bitmap, 0, 0)
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

export async function imageDataToBlob(
  imageData: ImageData,
  outputFormat: 'png' | 'webp',
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }
  ctx.putImageData(imageData, 0, 0)
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert image'))
        }
      },
      outputFormat === 'png' ? 'image/png' : 'image/webp',
      outputFormat === 'png' ? undefined : 0.92,
    )
  })
}

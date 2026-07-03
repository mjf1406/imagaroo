export type CropRect = { x: number; y: number; w: number; h: number }
export type CropOutputFormat = 'jpg' | 'png' | 'webp'

function fillJpgBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  backgroundColor: string,
): void {
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, width, height)
}

function blobFromCanvas(
  canvas: HTMLCanvasElement,
  outputFormat: CropOutputFormat,
): Promise<Blob> {
  const mime =
    outputFormat === 'jpg'
      ? 'image/jpeg'
      : outputFormat === 'webp'
        ? 'image/webp'
        : 'image/png'
  const quality = outputFormat === 'png' ? undefined : 0.92

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Failed to convert image')),
      mime,
      quality,
    )
  })
}

function clampCropRect(
  rect: CropRect,
  imageWidth: number,
  imageHeight: number,
): CropRect {
  const x = Math.max(0, Math.min(rect.x, imageWidth - 1))
  const y = Math.max(0, Math.min(rect.y, imageHeight - 1))
  const w = Math.max(1, Math.min(rect.w, imageWidth - x))
  const h = Math.max(1, Math.min(rect.h, imageHeight - y))
  return { x, y, w, h }
}

export function fullImageCropRect(
  imageWidth: number,
  imageHeight: number,
): CropRect {
  return { x: 0, y: 0, w: imageWidth, h: imageHeight }
}

const EDITOR_MIN_SIZE = 4

export function clampCropRectForEditor(
  rect: CropRect,
  imageWidth: number,
  imageHeight: number,
  minSize = EDITOR_MIN_SIZE,
): CropRect {
  let { x, y, w, h } = rect
  x = Math.max(0, Math.min(x, imageWidth - minSize))
  y = Math.max(0, Math.min(y, imageHeight - minSize))
  w = Math.max(minSize, Math.min(w, imageWidth - x))
  h = Math.max(minSize, Math.min(h, imageHeight - y))
  return { x, y, w, h }
}

export function resizeCropRectCentered(
  rect: CropRect,
  newW: number,
  newH: number,
  imageWidth: number,
  imageHeight: number,
  minSize = EDITOR_MIN_SIZE,
): CropRect {
  const w = Math.max(minSize, Math.min(newW, imageWidth))
  const h = Math.max(minSize, Math.min(newH, imageHeight))
  let x = rect.x + (rect.w - w) / 2
  let y = rect.y + (rect.h - h) / 2
  return clampCropRectForEditor({ x, y, w, h }, imageWidth, imageHeight, minSize)
}

export async function cropImageToRect(
  file: File,
  rect: CropRect,
  outputFormat: CropOutputFormat,
  jpgBackgroundColor = '#ffffff',
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const crop = clampCropRect(rect, img.naturalWidth, img.naturalHeight)
        const cropWidth = Math.round(crop.w)
        const cropHeight = Math.round(crop.h)

        const croppedCanvas = document.createElement('canvas')
        croppedCanvas.width = cropWidth
        croppedCanvas.height = cropHeight

        const croppedCtx = croppedCanvas.getContext('2d')
        if (!croppedCtx) {
          reject(new Error('Failed to get cropped canvas context'))
          return
        }

        if (outputFormat === 'jpg') {
          fillJpgBackground(croppedCtx, cropWidth, cropHeight, jpgBackgroundColor)
        }

        croppedCtx.drawImage(
          img,
          crop.x,
          crop.y,
          crop.w,
          crop.h,
          0,
          0,
          cropWidth,
          cropHeight,
        )

        blobFromCanvas(croppedCanvas, outputFormat).then(resolve).catch(reject)
      }

      img.onerror = () => reject(new Error('Failed to load image'))

      if (e.target?.result) {
        img.src = e.target.result as string
      } else {
        reject(new Error('Failed to read file'))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function autoCropImage(
  file: File,
  outputFormat: CropOutputFormat,
  jpgBackgroundColor = '#ffffff',
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height

        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // Sample background color from corners
        const bgColor = detectBackgroundColor(data, canvas.width, canvas.height)
        const tolerance = 30 // Color distance tolerance

        let minX = canvas.width
        let minY = canvas.height
        let maxX = 0
        let maxY = 0

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const index = (y * canvas.width + x) * 4
            const r = data[index]
            const g = data[index + 1]
            const b = data[index + 2]
            const a = data[index + 3]

            if (!isBackground(r, g, b, a, bgColor, tolerance)) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          }
        }

        if (minX > maxX || minY > maxY) {
          if (outputFormat === 'jpg') {
            const exportCanvas = document.createElement('canvas')
            exportCanvas.width = canvas.width
            exportCanvas.height = canvas.height
            const exportCtx = exportCanvas.getContext('2d')
            if (!exportCtx) {
              reject(new Error('Failed to get canvas context'))
              return
            }
            fillJpgBackground(
              exportCtx,
              exportCanvas.width,
              exportCanvas.height,
              jpgBackgroundColor,
            )
            exportCtx.drawImage(canvas, 0, 0)
            blobFromCanvas(exportCanvas, outputFormat).then(resolve).catch(reject)
          } else {
            blobFromCanvas(canvas, outputFormat).then(resolve).catch(reject)
          }
          return
        }

        // Add 1px padding
        minX = Math.max(0, minX - 1)
        minY = Math.max(0, minY - 1)
        maxX = Math.min(canvas.width - 1, maxX + 1)
        maxY = Math.min(canvas.height - 1, maxY + 1)

        const cropWidth = maxX - minX + 1
        const cropHeight = maxY - minY + 1

        const croppedCanvas = document.createElement('canvas')
        croppedCanvas.width = cropWidth
        croppedCanvas.height = cropHeight

        const croppedCtx = croppedCanvas.getContext('2d')
        if (!croppedCtx) {
          reject(new Error('Failed to get cropped canvas context'))
          return
        }

        if (outputFormat === 'jpg') {
          fillJpgBackground(
            croppedCtx,
            cropWidth,
            cropHeight,
            jpgBackgroundColor,
          )
        }

        croppedCtx.drawImage(
          canvas,
          minX,
          minY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight,
        )

        blobFromCanvas(croppedCanvas, outputFormat).then(resolve).catch(reject)
      }

      img.onerror = () => reject(new Error('Failed to load image'))

      if (e.target?.result) {
        img.src = e.target.result as string
      } else {
        reject(new Error('Failed to read file'))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function detectBackgroundColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { r: number; g: number; b: number; a: number } {
  // Sample corners
  const corners = [
    0, // top-left
    (width - 1) * 4, // top-right
    (height - 1) * width * 4, // bottom-left
    ((height - 1) * width + (width - 1)) * 4, // bottom-right
  ]

  const samples = corners.map((i) => ({
    r: data[i],
    g: data[i + 1],
    b: data[i + 2],
    a: data[i + 3],
  }))

  // Return most common corner color (simple mode)
  // For most images, corners are background
  return samples[0]
}

function isBackground(
  r: number,
  g: number,
  b: number,
  a: number,
  bg: { r: number; g: number; b: number; a: number },
  tolerance: number,
): boolean {
  // Fully transparent is always background
  if (a < 10) return true

  // If background is transparent, only transparent pixels are background
  if (bg.a < 10) return a < 10

  // Color distance check
  const distance = Math.sqrt(
    (r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2,
  )

  return distance <= tolerance
}

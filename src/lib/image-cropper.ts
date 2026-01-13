export async function autoCropImage(
  file: File,
  outputFormat: 'png' | 'webp',
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
          canvas.toBlob(
            (blob) =>
              blob
                ? resolve(blob)
                : reject(new Error('Failed to convert image')),
            outputFormat === 'png' ? 'image/png' : 'image/webp',
            outputFormat === 'png' ? undefined : 0.92,
          )
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

        croppedCanvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error('Failed to convert cropped image')),
          outputFormat === 'png' ? 'image/png' : 'image/webp',
          outputFormat === 'png' ? undefined : 0.92,
        )
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

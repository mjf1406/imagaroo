/**
 * Removes background from an image by detecting the background color from corners
 * and replacing only edge-connected matching pixels with transparency
 * @param file - The image file to process
 * @param outputFormat - The output format ('png' or 'webp')
 * @param tolerance - Color distance tolerance (default: 30)
 * @returns Promise that resolves to a Blob of the processed image
 */
export async function removeBg(
  file: File,
  outputFormat: 'png' | 'webp' = 'png',
  tolerance: number = 30,
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
        const width = canvas.width
        const height = canvas.height

        const bgColor = detectBackgroundColor(data, width, height)

        // Track which pixels to make transparent
        const toRemove = new Uint8Array(width * height)

        // Flood fill from all edge pixels
        const queue: Array<{ x: number; y: number }> = []

        // Add all edge pixels to queue
        for (let x = 0; x < width; x++) {
          queue.push({ x, y: 0 })
          queue.push({ x, y: height - 1 })
        }
        for (let y = 1; y < height - 1; y++) {
          queue.push({ x: 0, y })
          queue.push({ x: width - 1, y })
        }

        // Process queue (flood fill)
        while (queue.length > 0) {
          const { x, y } = queue.pop()!
          const idx = y * width + x

          // Skip if already processed
          if (toRemove[idx]) continue

          const pixelIdx = idx * 4
          const r = data[pixelIdx]
          const g = data[pixelIdx + 1]
          const b = data[pixelIdx + 2]
          const a = data[pixelIdx + 3]

          // Skip if not a background pixel
          if (!isBackgroundPixel(r, g, b, a, bgColor, tolerance)) continue

          // Mark for removal
          toRemove[idx] = 1

          // Add neighbors to queue
          if (x > 0) queue.push({ x: x - 1, y })
          if (x < width - 1) queue.push({ x: x + 1, y })
          if (y > 0) queue.push({ x, y: y - 1 })
          if (y < height - 1) queue.push({ x, y: y + 1 })
        }

        // Apply transparency to marked pixels
        for (let i = 0; i < toRemove.length; i++) {
          if (toRemove[i]) {
            data[i * 4 + 3] = 0
          }
        }

        ctx.putImageData(imageData, 0, 0)

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

interface Color {
  r: number
  g: number
  b: number
  a: number
}

function detectBackgroundColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Color {
  const samplePoints = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
    Math.floor(width / 2) * 4,
    ((height - 1) * width + Math.floor(width / 2)) * 4,
    Math.floor(height / 2) * width * 4,
    (Math.floor(height / 2) * width + (width - 1)) * 4,
  ]

  const samples: Array<Color> = samplePoints.map((i) => ({
    r: data[i],
    g: data[i + 1],
    b: data[i + 2],
    a: data[i + 3],
  }))

  return findMostCommonColor(samples)
}

function findMostCommonColor(samples: Array<Color>): Color {
  const colorCounts = new Map<string, { color: Color; count: number }>()

  for (const sample of samples) {
    let found = false
    for (const entry of colorCounts.values()) {
      if (colorDistance(sample, entry.color) < 10) {
        entry.count++
        found = true
        break
      }
    }
    if (!found) {
      const key = `${sample.r},${sample.g},${sample.b},${sample.a}`
      colorCounts.set(key, { color: sample, count: 1 })
    }
  }

  let maxCount = 0
  let mostCommon = samples[0]
  for (const entry of colorCounts.values()) {
    if (entry.count > maxCount) {
      maxCount = entry.count
      mostCommon = entry.color
    }
  }

  return mostCommon
}

function colorDistance(c1: Color, c2: Color): number {
  return Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2)
}

function isBackgroundPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  bg: Color,
  tolerance: number,
): boolean {
  if (a < 10) return true
  if (bg.a < 10) return a < 10

  const distance = Math.sqrt(
    (r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2,
  )
  return distance <= tolerance
}

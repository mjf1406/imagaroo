/**
 * Removes background from an image by detecting the background color from corners
 * and replacing matching pixels with transparency
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

        const bgColor = detectBackgroundColor(data, canvas.width, canvas.height)

        // Replace background pixels with transparent
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]

          if (isBackgroundPixel(r, g, b, a, bgColor, tolerance)) {
            data[i + 3] = 0 // Set alpha to 0 (transparent)
          }
        }

        // Write modified data back to canvas
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
  // Sample from corners and edges
  const samplePoints = [
    0, // top-left
    (width - 1) * 4, // top-right
    (height - 1) * width * 4, // bottom-left
    ((height - 1) * width + (width - 1)) * 4, // bottom-right
    Math.floor(width / 2) * 4, // top-center
    ((height - 1) * width + Math.floor(width / 2)) * 4, // bottom-center
    Math.floor(height / 2) * width * 4, // left-center
    (Math.floor(height / 2) * width + (width - 1)) * 4, // right-center
  ]

  const samples: Array<Color> = samplePoints.map((i) => ({
    r: data[i],
    g: data[i + 1],
    b: data[i + 2],
    a: data[i + 3],
  }))

  // Find most common color among samples
  return findMostCommonColor(samples)
}

function findMostCommonColor(samples: Array<Color>): Color {
  const colorCounts = new Map<string, { color: Color; count: number }>()

  for (const sample of samples) {
    // Group similar colors together (within tolerance of 10)
    let found = false
    for (const [key, entry] of colorCounts) {
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

  // Return color with highest count
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
  // Already transparent
  if (a < 10) return true

  // If background is transparent, only transparent pixels match
  if (bg.a < 10) return a < 10

  const distance = Math.sqrt(
    (r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2,
  )
  return distance <= tolerance
}

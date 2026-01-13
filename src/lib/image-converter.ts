/**
 * Checks if an image has transparency by examining its pixel data
 * @param file - The image file to check
 * @returns Promise that resolves to true if the image has transparency
 */
export async function hasTransparency(file: File): Promise<boolean> {
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

        // Check if any pixel has alpha < 255
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            resolve(true)
            return
          }
        }

        resolve(false)
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      if (e.target?.result) {
        img.src = e.target.result as string
      } else {
        reject(new Error('Failed to read file'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Converts an image file to a different format using the Canvas API
 * @param file - The image file to convert
 * @param targetFormat - The target format (jpg, jpeg, webp, avif, png, ico)
 * @param quality - Quality for lossy formats (0-1, default: 0.92)
 * @param backgroundColor - Optional background color in hex format (e.g., '#ffffff') for formats that don't support transparency
 * @returns Promise that resolves to a Blob of the converted image
 */
export async function convertImage(
  file: File,
  targetFormat: string,
  quality: number = 0.92,
  backgroundColor?: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Normalize format
        const format = targetFormat.toLowerCase()
        let mimeType: string
        let outputFormat: string

        switch (format) {
          case 'jpg':
          case 'jpeg':
            mimeType = 'image/jpeg'
            outputFormat = 'jpeg'
            break
          case 'webp':
            mimeType = 'image/webp'
            outputFormat = 'webp'
            break
          case 'avif':
            mimeType = 'image/avif'
            outputFormat = 'avif'
            break
          case 'png':
            mimeType = 'image/png'
            outputFormat = 'png'
            break
          case 'ico':
            // ICO files use PNG format internally for single-size icons
            mimeType = 'image/png'
            outputFormat = 'png'
            break
          default:
            reject(new Error(`Unsupported format: ${targetFormat}`))
            return
        }

        // If converting to a format that doesn't support transparency and a background color is provided,
        // fill the canvas with the background color first
        if (backgroundColor && (format === 'jpg' || format === 'jpeg')) {
          ctx.fillStyle = backgroundColor
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        // Draw the image onto the canvas
        ctx.drawImage(img, 0, 0)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to convert image'))
            }
          },
          mimeType,
          outputFormat === 'png' ? undefined : quality
        )
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      if (e.target?.result) {
        img.src = e.target.result as string
      } else {
        reject(new Error('Failed to read file'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Gets the file extension from a filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

/**
 * Changes the file extension in a filename
 */
export function changeFileExtension(
  filename: string,
  newExtension: string
): string {
  const parts = filename.split('.')
  parts[parts.length - 1] = newExtension
  return parts.join('.')
}

/**
 * Validates if a file is a supported image type
 */
export function isValidImageType(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif', 'image/x-icon', 'image/vnd.microsoft.icon']
  const extension = getFileExtension(file.name).toLowerCase()
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'ico']

  return validTypes.includes(file.type) || validExtensions.includes(extension)
}

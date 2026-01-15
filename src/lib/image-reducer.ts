/**
 * Reduces image resolution by resizing to target dimensions
 * @param file - The image file to process
 * @param outputFormat - The output format ('png' or 'webp')
 * @param width - Target width in pixels
 * @param height - Target height in pixels
 * @returns Promise that resolves to a Blob of the resized image
 */
export async function reduceImage(
  file: File,
  outputFormat: 'png' | 'webp',
  width: number,
  height: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Use high-quality image scaling
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to convert resized image'))
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

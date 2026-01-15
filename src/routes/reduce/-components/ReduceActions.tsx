import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ImageFile } from '@/components/ImagePreview'
import { reduceImage } from '@/lib/image-reducer'
import { changeFileExtension } from '@/lib/image-converter'
import { createZip, downloadBlob } from '@/lib/zip-utils'

interface ReduceActionsProps {
  images: ImageFile[]
  outputFormat: 'png' | 'webp'
  reduceWidth: number | null
  reduceHeight: number | null
  onClear: () => void
}

export function ReduceActions({
  images,
  outputFormat,
  reduceWidth,
  reduceHeight,
  onClear,
}: ReduceActionsProps) {
  const [isReducing, setIsReducing] = useState(false)

  const handleReduce = async () => {
    if (images.length === 0) return

    // Validate dimensions
    if (reduceWidth === null || reduceHeight === null || reduceWidth < 1 || reduceHeight < 1) {
      alert('Please set valid width and height for reduction.')
      return
    }

    setIsReducing(true)

    try {
      const processedFiles: Array<{ name: string; blob: Blob }> = []

      for (const image of images) {
        const blob = await reduceImage(
          image.file,
          outputFormat,
          reduceWidth,
          reduceHeight,
        )
        const newFilename = changeFileExtension(image.file.name, outputFormat)
        processedFiles.push({ name: newFilename, blob })
      }

      if (processedFiles.length === 1) {
        // Single file download
        downloadBlob(processedFiles[0].blob, processedFiles[0].name)
      } else {
        // Multiple files - create ZIP
        const zipBlob = await createZip(processedFiles)
        downloadBlob(zipBlob, 'reduced-images.zip')
      }

      onClear()
    } catch (error) {
      console.error('Reduction error:', error)
      alert('An error occurred during reduction. Please try again.')
    } finally {
      setIsReducing(false)
    }
  }

  const isValidDimensions =
    reduceWidth !== null &&
    reduceHeight !== null &&
    reduceWidth >= 1 &&
    reduceHeight >= 1

  return (
    <div className="flex gap-4">
      <Button
        onClick={handleReduce}
        disabled={isReducing || images.length === 0 || !isValidDimensions}
        size="lg"
        className="flex-1"
      >
        {isReducing ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Reducing...
          </>
        ) : (
          <>
            <Download className="mr-2 size-4" />
            Reduce & Download{' '}
            {images.length > 1 ? `(${images.length} files)` : ''}
          </>
        )}
      </Button>
      <Button
        onClick={onClear}
        variant="outline"
        size="lg"
        disabled={isReducing || images.length === 0}
      >
        Clear
      </Button>
    </div>
  )
}

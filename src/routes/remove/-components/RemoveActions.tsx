import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ImageFile } from '@/components/ImagePreview'
import { removeBg } from '@/lib/image-remove-bg'
import { changeFileExtension } from '@/lib/image-converter'
import { createZip, downloadBlob } from '@/lib/zip-utils'

interface RemoveActionsProps {
  images: ImageFile[]
  outputFormat: 'png' | 'webp'
  tolerance: number
  onClear: () => void
}

export function RemoveActions({
  images,
  outputFormat,
  tolerance,
  onClear,
}: RemoveActionsProps) {
  const [isRemoving, setIsRemoving] = useState(false)

  const handleRemoveBg = async () => {
    if (images.length === 0) return

    setIsRemoving(true)

    try {
      const processedFiles: Array<{ name: string; blob: Blob }> = []

      for (const image of images) {
        const blob = await removeBg(image.file, outputFormat, tolerance)
        const newFilename = changeFileExtension(image.file.name, outputFormat)
        processedFiles.push({ name: newFilename, blob })
      }

      if (processedFiles.length === 1) {
        // Single file download
        downloadBlob(processedFiles[0].blob, processedFiles[0].name)
      } else {
        // Multiple files - create ZIP
        const zipBlob = await createZip(processedFiles)
        downloadBlob(zipBlob, 'removed-background-images.zip')
      }

      onClear()
    } catch (error) {
      console.error('Background removal error:', error)
      alert('An error occurred during background removal. Please try again.')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="flex gap-4">
      <Button
        onClick={handleRemoveBg}
        disabled={isRemoving || images.length === 0}
        size="lg"
        className="flex-1"
      >
        {isRemoving ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Removing...
          </>
        ) : (
          <>
            <Download className="mr-2 size-4" />
            Remove & Download{' '}
            {images.length > 1 ? `(${images.length} files)` : ''}
          </>
        )}
      </Button>
      <Button
        onClick={onClear}
        variant="outline"
        size="lg"
        disabled={isRemoving || images.length === 0}
      >
        Clear All
      </Button>
    </div>
  )
}

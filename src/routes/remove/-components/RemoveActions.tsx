import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import type { ImageFile } from '@/components/ImagePreview'
import type {
  BackgroundRemovalModelId,
  BackgroundRemovalProgress,
} from '@/lib/background-removal'
import { Button } from '@/components/ui/button'
import { removeBg } from '@/lib/image-remove-bg'
import { changeFileExtension } from '@/lib/image-converter'
import { createZip, downloadBlob } from '@/lib/zip-utils'
import { formatProgress } from '@/lib/background-removal'

interface RemoveActionsProps {
  images: Array<ImageFile>
  outputFormat: 'png' | 'webp'
  modelId: BackgroundRemovalModelId
  onClear: () => void
}

export function RemoveActions({
  images,
  outputFormat,
  modelId,
  onClear,
}: RemoveActionsProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const [progressLabel, setProgressLabel] = useState<string | null>(null)

  const handleRemoveBg = async () => {
    if (images.length === 0) return

    setIsRemoving(true)
    setProgressLabel(null)

    try {
      const processedFiles: Array<{ name: string; blob: Blob }> = []

      for (const [index, image] of images.entries()) {
        const blob = await removeBg(image.file, outputFormat, {
          modelId,
          onProgress: (progress: BackgroundRemovalProgress) => {
            const fileLabel =
              images.length > 1 ? ` (${index + 1}/${images.length})` : ''
            setProgressLabel(`${formatProgress(progress)}${fileLabel}`)
          },
        })
        const newFilename = changeFileExtension(image.file.name, outputFormat)
        processedFiles.push({ name: newFilename, blob })
      }

      if (processedFiles.length === 1) {
        downloadBlob(processedFiles[0].blob, processedFiles[0].name)
      } else {
        const zipBlob = await createZip(processedFiles)
        downloadBlob(zipBlob, 'removed-background-images.zip')
      }

      onClear()
    } catch (error) {
      console.error('Background removal error:', error)
      alert('An error occurred during background removal. Please try again.')
    } finally {
      setIsRemoving(false)
      setProgressLabel(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
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
          Clear
        </Button>
      </div>
      {progressLabel && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {progressLabel}
        </p>
      )}
    </div>
  )
}

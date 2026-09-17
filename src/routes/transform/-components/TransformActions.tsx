import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import type { ImageFile } from '@/components/ImagePreview'
import type {
  BackgroundRemovalModelId,
  BackgroundRemovalProgress,
} from '@/lib/background-removal'
import { Button } from '@/components/ui/button'
import { autoCropImage } from '@/lib/image-cropper'
import { removeBg } from '@/lib/image-remove-bg'
import { reduceImage } from '@/lib/image-reducer'
import { changeFileExtension } from '@/lib/image-converter'
import { createZip, downloadBlob } from '@/lib/zip-utils'
import { formatProgress } from '@/lib/background-removal'

interface TransformActionsProps {
  images: Array<ImageFile>
  outputFormat: 'png' | 'webp'
  modelId: BackgroundRemovalModelId
  crop: boolean
  remove: boolean
  reduce: boolean
  reduceWidth: number | null
  reduceHeight: number | null
  onClear: () => void
}

export function TransformActions({
  images,
  outputFormat,
  modelId,
  crop,
  remove,
  reduce,
  reduceWidth,
  reduceHeight,
  onClear,
}: TransformActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressLabel, setProgressLabel] = useState<string | null>(null)

  const handleTransform = async () => {
    if (images.length === 0 || (!crop && !remove && !reduce)) return

    if (
      reduce &&
      (reduceWidth === null ||
        reduceHeight === null ||
        reduceWidth < 1 ||
        reduceHeight < 1)
    ) {
      alert('Please set valid width and height for reduction.')
      return
    }

    setIsProcessing(true)
    setProgressLabel(null)

    try {
      const processedFiles: Array<{ name: string; blob: Blob }> = []

      for (const [index, image] of images.entries()) {
        let currentFile: File = image.file
        let finalBlob: Blob

        if (remove) {
          const removedBgBlob = await removeBg(currentFile, outputFormat, {
            modelId,
            onProgress: (progress: BackgroundRemovalProgress) => {
              const fileLabel =
                images.length > 1 ? ` (${index + 1}/${images.length})` : ''
              setProgressLabel(`${formatProgress(progress)}${fileLabel}`)
            },
          })
          currentFile = new File([removedBgBlob], image.file.name, {
            type: outputFormat === 'png' ? 'image/png' : 'image/webp',
          })
          finalBlob = removedBgBlob
        }

        if (crop) {
          finalBlob = await autoCropImage(currentFile, outputFormat)
          currentFile = new File([finalBlob], image.file.name, {
            type: outputFormat === 'png' ? 'image/png' : 'image/webp',
          })
        }

        if (reduce && reduceWidth !== null && reduceHeight !== null) {
          finalBlob = await reduceImage(
            currentFile,
            outputFormat,
            reduceWidth,
            reduceHeight,
          )
        }

        const newFilename = changeFileExtension(image.file.name, outputFormat)
        processedFiles.push({ name: newFilename, blob: finalBlob! })
      }

      if (processedFiles.length === 1) {
        downloadBlob(processedFiles[0].blob, processedFiles[0].name)
      } else {
        const zipBlob = await createZip(processedFiles)
        const operations: Array<string> = []
        if (crop) operations.push('cropped')
        if (remove) operations.push('removed-bg')
        if (reduce) operations.push('reduced')
        const zipName =
          operations.length > 0
            ? `${operations.join('-')}-images.zip`
            : 'transformed-images.zip'
        downloadBlob(zipBlob, zipName)
      }

      onClear()
    } catch (error) {
      console.error('Transformation error:', error)
      alert('An error occurred during transformation. Please try again.')
    } finally {
      setIsProcessing(false)
      setProgressLabel(null)
    }
  }

  const getButtonText = () => {
    if (isProcessing) {
      return 'Processing...'
    }
    const operations: Array<string> = []
    if (crop) operations.push('Crop')
    if (remove) operations.push('Remove BG')
    if (reduce) operations.push('Reduce')
    const opText = operations.join(' & ')
    const countText = images.length > 1 ? ` (${images.length} files)` : ''
    return `${opText} & Download${countText}`
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4">
        <Button
          onClick={handleTransform}
          disabled={
            isProcessing || images.length === 0 || (!crop && !remove && !reduce)
          }
          size="lg"
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Download className="mr-2 size-4" />
              {getButtonText()}
            </>
          )}
        </Button>
        <Button
          onClick={onClear}
          variant="outline"
          size="lg"
          disabled={isProcessing || images.length === 0}
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

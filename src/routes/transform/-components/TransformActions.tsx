import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import type { ImageFile } from '@/components/ImagePreview'
import { Button } from '@/components/ui/button'
import { autoCropImage } from '@/lib/image-cropper'
import { removeBg } from '@/lib/image-remove-bg'
import { changeFileExtension } from '@/lib/image-converter'
import { createZip, downloadBlob } from '@/lib/zip-utils'

interface TransformActionsProps {
  images: Array<ImageFile>
  outputFormat: 'png' | 'webp'
  tolerance: number
  crop: boolean
  remove: boolean
  onClear: () => void
}

export function TransformActions({
  images,
  outputFormat,
  tolerance,
  crop,
  remove,
  onClear,
}: TransformActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleTransform = async () => {
    if (images.length === 0 || (!crop && !remove)) return

    setIsProcessing(true)

    try {
      const processedFiles: Array<{ name: string; blob: Blob }> = []

      for (const image of images) {
        let currentFile: File = image.file
        let finalBlob: Blob

        // Apply remove background first (if selected)
        // This makes cropping more accurate since background is already transparent
        if (remove) {
          const removedBgBlob = await removeBg(
            currentFile,
            outputFormat,
            tolerance,
          )
          // Convert blob to file for next operation
          currentFile = new File([removedBgBlob], image.file.name, {
            type: outputFormat === 'png' ? 'image/png' : 'image/webp',
          })
          finalBlob = removedBgBlob
        }

        // Apply crop (if selected)
        if (crop) {
          finalBlob = await autoCropImage(currentFile, outputFormat)
        }
        // If only remove was selected, finalBlob is already set above

        const newFilename = changeFileExtension(image.file.name, outputFormat)
        processedFiles.push({ name: newFilename, blob: finalBlob! })
      }

      if (processedFiles.length === 1) {
        // Single file download
        downloadBlob(processedFiles[0].blob, processedFiles[0].name)
      } else {
        // Multiple files - create ZIP
        const zipBlob = await createZip(processedFiles)
        const zipName =
          crop && remove
            ? 'transformed-images.zip'
            : crop
              ? 'cropped-images.zip'
              : 'removed-background-images.zip'
        downloadBlob(zipBlob, zipName)
      }

      onClear()
    } catch (error) {
      console.error('Transformation error:', error)
      alert('An error occurred during transformation. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const getButtonText = () => {
    if (isProcessing) {
      return 'Processing...'
    }
    const operations: Array<string> = []
    if (crop) operations.push('Crop')
    if (remove) operations.push('Remove BG')
    const opText = operations.join(' & ')
    const countText = images.length > 1 ? ` (${images.length} files)` : ''
    return `${opText} & Download${countText}`
  }

  return (
    <div className="flex gap-4">
      <Button
        onClick={handleTransform}
        disabled={isProcessing || images.length === 0 || (!crop && !remove)}
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
  )
}

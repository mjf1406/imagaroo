import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ImageFile } from '@/components/ImagePreview'
import { autoCropImage } from '@/lib/image-cropper'
import { changeFileExtension } from '@/lib/image-converter'
import { createZip, downloadBlob } from '@/lib/zip-utils'

interface CropActionsProps {
  images: ImageFile[]
  outputFormat: 'png' | 'webp'
  onClear: () => void
}

export function CropActions({
  images,
  outputFormat,
  onClear,
}: CropActionsProps) {
  const [isCropping, setIsCropping] = useState(false)

  const handleCrop = async () => {
    if (images.length === 0) return

    setIsCropping(true)

    try {
      const croppedFiles: Array<{ name: string; blob: Blob }> = []

      for (const image of images) {
        const blob = await autoCropImage(image.file, outputFormat)
        const newFilename = changeFileExtension(image.file.name, outputFormat)
        croppedFiles.push({ name: newFilename, blob })
      }

      if (croppedFiles.length === 1) {
        // Single file download
        downloadBlob(croppedFiles[0].blob, croppedFiles[0].name)
      } else {
        // Multiple files - create ZIP
        const zipBlob = await createZip(croppedFiles)
        downloadBlob(zipBlob, 'cropped-images.zip')
      }

      onClear()
    } catch (error) {
      console.error('Cropping error:', error)
      alert('An error occurred during cropping. Please try again.')
    } finally {
      setIsCropping(false)
    }
  }

  return (
    <div className="flex gap-4">
      <Button
        onClick={handleCrop}
        disabled={isCropping || images.length === 0}
        size="lg"
        className="flex-1"
      >
        {isCropping ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Cropping...
          </>
        ) : (
          <>
            <Download className="mr-2 size-4" />
            Crop & Download{' '}
            {images.length > 1 ? `(${images.length} files)` : ''}
          </>
        )}
      </Button>
      <Button
        onClick={onClear}
        variant="outline"
        size="lg"
        disabled={isCropping || images.length === 0}
      >
        Clear
      </Button>
    </div>
  )
}

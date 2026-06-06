import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ImageFile } from '@/components/ImagePreview'
import type { CropRect, CropOutputFormat } from '@/lib/image-cropper'
import { cropImageToRect } from '@/lib/image-cropper'
import { changeFileExtension } from '@/lib/image-converter'
import { downloadBlob } from '@/lib/zip-utils'

interface ManualCropActionsProps {
  image: ImageFile | null
  cropRect: CropRect | null
  outputFormat: CropOutputFormat
  jpgBackgroundColor: string
  onClear: () => void
}

export function ManualCropActions({
  image,
  cropRect,
  outputFormat,
  jpgBackgroundColor,
  onClear,
}: ManualCropActionsProps) {
  const [isCropping, setIsCropping] = useState(false)

  const canCrop =
    !!image &&
    !!cropRect &&
    cropRect.w >= 1 &&
    cropRect.h >= 1

  const handleCrop = async () => {
    if (!image || !cropRect || !canCrop) return

    setIsCropping(true)

    try {
      const blob = await cropImageToRect(
        image.file,
        cropRect,
        outputFormat,
        outputFormat === 'jpg' ? jpgBackgroundColor : undefined,
      )
      const newFilename = changeFileExtension(image.file.name, outputFormat)
      downloadBlob(blob, newFilename)
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
        disabled={isCropping || !canCrop}
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
            Crop & Download
          </>
        )}
      </Button>
      <Button
        onClick={onClear}
        variant="outline"
        size="lg"
        disabled={isCropping || !image}
      >
        Clear
      </Button>
    </div>
  )
}

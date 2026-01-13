import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ImageFile } from '@/components/ImagePreview'
import { convertImage, changeFileExtension } from '@/lib/image-converter'
import { createZip, downloadBlob } from '@/lib/zip-utils'

interface ConvertActionsProps {
  images: ImageFile[]
  globalFormat: string
  onClear: () => void
}

export function ConvertActions({
  images,
  globalFormat,
  onClear,
}: ConvertActionsProps) {
  const [isConverting, setIsConverting] = useState(false)

  const handleConvert = async () => {
    if (images.length === 0) return

    setIsConverting(true)

    try {
      const convertedFiles: Array<{ name: string; blob: Blob }> = []

      for (const image of images) {
        const targetFormat = image.outputFormat ?? globalFormat
        const blob = await convertImage(image.file, targetFormat)
        const newFilename = changeFileExtension(
          image.file.name,
          targetFormat === 'jpeg' ? 'jpg' : targetFormat
        )
        convertedFiles.push({ name: newFilename, blob })
      }

      if (convertedFiles.length === 1) {
        // Single file download
        downloadBlob(convertedFiles[0].blob, convertedFiles[0].name)
      } else {
        // Multiple files - create ZIP
        const zipBlob = await createZip(convertedFiles)
        downloadBlob(zipBlob, 'converted-images.zip')
      }

      onClear()
    } catch (error) {
      console.error('Conversion error:', error)
      alert('An error occurred during conversion. Please try again.')
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <div className="flex gap-4">
      <Button
        onClick={handleConvert}
        disabled={isConverting || images.length === 0}
        size="lg"
        className="flex-1"
      >
        {isConverting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Converting...
          </>
        ) : (
          <>
            <Download className="mr-2 size-4" />
            Convert & Download {images.length > 1 ? `(${images.length} files)` : ''}
          </>
        )}
      </Button>
      <Button
        onClick={onClear}
        variant="outline"
        size="lg"
        disabled={isConverting || images.length === 0}
      >
        Clear All
      </Button>
    </div>
  )
}

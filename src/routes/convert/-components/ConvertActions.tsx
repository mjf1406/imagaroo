import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ImageFile } from '@/components/ImagePreview'
import { convertImage, changeFileExtension, hasTransparency, getFileExtension } from '@/lib/image-converter'
import { createZip, downloadBlob } from '@/lib/zip-utils'

interface ConvertActionsProps {
  images: ImageFile[]
  globalFormat: string
  backgroundColor?: string
  onClear: () => void
}

export function ConvertActions({
  images,
  globalFormat,
  backgroundColor,
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
        const formatLower = targetFormat.toLowerCase()
        
        // Determine if we need to use background color
        let bgColor: string | undefined
        if (backgroundColor && (formatLower === 'jpg' || formatLower === 'jpeg')) {
          // Check if image has transparency and is from WebP/PNG
          const originalExt = getFileExtension(image.file.name).toLowerCase()
          if (originalExt === 'webp' || originalExt === 'png') {
            try {
              const hasAlpha = await hasTransparency(image.file)
              if (hasAlpha) {
                bgColor = backgroundColor
              }
            } catch (error) {
              console.error('Error checking transparency:', error)
              // Default to using background color if check fails
              bgColor = backgroundColor
            }
          }
        }
        
        const blob = await convertImage(image.file, targetFormat, 0.92, bgColor)
        const newFilename = changeFileExtension(
          image.file.name,
          targetFormat === 'jpeg' ? 'jpg' : targetFormat,
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
            Convert & Download{' '}
            {images.length > 1 ? `(${images.length} files)` : ''}
          </>
        )}
      </Button>
      <Button
        onClick={onClear}
        variant="outline"
        size="lg"
        disabled={isConverting || images.length === 0}
      >
        Clear
      </Button>
    </div>
  )
}

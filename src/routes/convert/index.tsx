import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ConvertImagePageHeader } from './-components/ConvertImagePageHeader'
import { FileUploadArea } from './-components/FileUploadArea'
import { GlobalFormatSelector } from './-components/GlobalFormatSelector'
import { ImagePreviewGrid } from './-components/ImagePreviewGrid'
import { ConvertActions } from './-components/ConvertActions'
import { BackgroundColorPicker } from './-components/BackgroundColorPicker'
import type { ImageFile } from '@/components/ImagePreview'
import { getFileExtension, hasTransparency } from '@/lib/image-converter'
import { Button } from '@/components/ui/button'

const SUPPORTED_FORMATS = ['webp', 'png', 'jpg']

export const Route = createFileRoute('/convert/')({
  component: ConvertImagePage,
})

function ConvertImagePage() {
  const [images, setImages] = useState<Array<ImageFile>>([])
  const [globalFormat, setGlobalFormat] = useState('webp')
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [imagesWithTransparency, setImagesWithTransparency] = useState<
    Set<string>
  >(new Set())

  const handleFilesAdded = async (newImages: Array<ImageFile>) => {
    setImages((prev) => [...prev, ...newImages])

    // Check for transparency in new images
    const transparencySet = new Set(imagesWithTransparency)
    for (const image of newImages) {
      try {
        const hasAlpha = await hasTransparency(image.file)
        if (hasAlpha) {
          transparencySet.add(image.id)
        }
      } catch (error) {
        console.error('Error checking transparency:', error)
      }
    }
    setImagesWithTransparency(transparencySet)
  }

  const handleRemove = (id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.preview)
      }
      return prev.filter((img) => img.id !== id)
    })
    setImagesWithTransparency((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleFormatChange = (id: string, format: string | null) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, outputFormat: format } : img,
      ),
    )
  }

  const handleClear = () => {
    images.forEach((image) => {
      URL.revokeObjectURL(image.preview)
    })
    setImages([])
    setImagesWithTransparency(new Set())
  }

  // Check if we need to show the background color picker
  const shouldShowBackgroundColorPicker = () => {
    if (images.length === 0) return false

    // Check if any image is being converted to JPG and has transparency
    const targetFormat = globalFormat.toLowerCase()
    if (targetFormat !== 'jpg' && targetFormat !== 'jpeg') return false

    // Check if any image has transparency and is from WebP/PNG
    for (const image of images) {
      const imageFormat = image.outputFormat ?? globalFormat
      if (
        (imageFormat === 'jpg' || imageFormat === 'jpeg') &&
        imagesWithTransparency.has(image.id)
      ) {
        const originalExt = getFileExtension(image.file.name).toLowerCase()
        if (originalExt === 'webp' || originalExt === 'png') {
          return true
        }
      }
    }

    return false
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <ConvertImagePageHeader />
      {/* Flex row layout on md+ screens */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left side: File upload area */}
        <div className="flex-1">
          <FileUploadArea onFilesAdded={handleFilesAdded} />
        </div>
        {/* Right side: Controls (always visible) */}
        <div className="md:w-80 md:shrink-0">
          <div className="space-y-4">
            <GlobalFormatSelector
              value={globalFormat}
              onChange={setGlobalFormat}
              supportedFormats={SUPPORTED_FORMATS}
            />
            {shouldShowBackgroundColorPicker() && (
              <BackgroundColorPicker
                value={backgroundColor}
                onChange={setBackgroundColor}
              />
            )}
            <ConvertActions
              images={images}
              globalFormat={globalFormat}
              backgroundColor={
                shouldShowBackgroundColorPicker() ? backgroundColor : undefined
              }
              onClear={handleClear}
            />
          </div>
        </div>
      </div>
      {/* Image preview grid (only show when images exist) */}
      {images.length > 0 && (
        <div className="mt-6">
          <ImagePreviewGrid
            images={images}
            globalFormat={globalFormat}
            onRemove={handleRemove}
            onFormatChange={handleFormatChange}
            supportedFormats={SUPPORTED_FORMATS}
          />
        </div>
      )}
    </div>
  )
}

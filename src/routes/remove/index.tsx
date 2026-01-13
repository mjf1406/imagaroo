import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileUploadArea } from '../convert/-components/FileUploadArea'
import { ImagePreviewGrid } from '../convert/-components/ImagePreviewGrid'
import { RemoveImagePageHeader } from './-components/RemoveImagePageHeader'
import { RemoveActions } from './-components/RemoveActions'
import { OutputFormatSelector } from './-components/OutputFormatSelector'
import { ToleranceSlider } from './-components/ToleranceSlider'
import { BackgroundRemovedPreview } from './-components/BackgroundRemovedPreview'
import type { ImageFile } from '@/components/ImagePreview'

const SUPPORTED_FORMATS = ['webp', 'png', 'jpg', 'avif', 'ico']

export const Route = createFileRoute('/remove/')({
  component: RemoveImagePage,
})

function RemoveImagePage() {
  const [images, setImages] = useState<Array<ImageFile>>([])
  const [outputFormat, setOutputFormat] = useState<'png' | 'webp'>('webp')
  const [tolerance, setTolerance] = useState(30)

  const handleFilesAdded = (newImages: Array<ImageFile>) => {
    setImages((prev) => [...prev, ...newImages])
  }

  const handleRemove = (id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.preview)
      }
      return prev.filter((img) => img.id !== id)
    })
  }

  const handleFormatChange = (_id: string, _format: string | null) => {
    // Not used in remove page, but required by ImagePreviewGrid interface
    // We keep it for compatibility but it won't affect the output
  }

  const handleClear = () => {
    images.forEach((image) => {
      URL.revokeObjectURL(image.preview)
    })
    setImages([])
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <RemoveImagePageHeader />
      {/* Flex row layout on md+ screens */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left side: File upload area */}
        <div className="flex-1">
          <FileUploadArea onFilesAdded={handleFilesAdded} />
        </div>
        {/* Right side: Controls (always visible) */}
        <div className="md:w-80 md:shrink-0">
          <div className="space-y-4">
            <OutputFormatSelector
              value={outputFormat}
              onChange={setOutputFormat}
            />
            <ToleranceSlider
              value={tolerance}
              onChange={setTolerance}
              min={0}
              max={100}
              step={1}
            />
            <RemoveActions
              images={images}
              outputFormat={outputFormat}
              tolerance={tolerance}
              onClear={handleClear}
            />
          </div>
        </div>
      </div>
      {/* Preview section - shows first image with background removed */}
      {images.length > 0 && (
        <div className="mt-6">
          <BackgroundRemovedPreview
            image={images[0]}
            outputFormat={outputFormat}
            tolerance={tolerance}
          />
        </div>
      )}
      {/* Image preview grid */}
      {images.length > 0 && (
        <div className="mt-6">
          <ImagePreviewGrid
            images={images}
            globalFormat={outputFormat}
            onRemove={handleRemove}
            onFormatChange={handleFormatChange}
            supportedFormats={SUPPORTED_FORMATS}
          />
        </div>
      )}
    </div>
  )
}

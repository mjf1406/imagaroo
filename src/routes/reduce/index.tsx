import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileUploadArea } from '../convert/-components/FileUploadArea'
import { ImagePreviewGrid } from '../convert/-components/ImagePreviewGrid'
import { OutputFormatSelector } from '../crop/-components/OutputFormatSelector'
import { ReduceImagePageHeader } from './-components/ReduceImagePageHeader'
import { ReduceActions } from './-components/ReduceActions'
import { ReduceControls } from '../transform/-components/ReduceControls'
import type { ImageFile } from '@/components/ImagePreview'

const SUPPORTED_FORMATS = ['webp', 'png', 'jpg', 'avif', 'ico']

export const Route = createFileRoute('/reduce/')({
  component: ReduceImagePage,
})

function ReduceImagePage() {
  const [images, setImages] = useState<Array<ImageFile>>([])
  const [outputFormat, setOutputFormat] = useState<'png' | 'webp'>('webp')
  const [reduceWidth, setReduceWidth] = useState<number | null>(null)
  const [reduceHeight, setReduceHeight] = useState<number | null>(null)
  const [dimensionsLinked, setDimensionsLinked] = useState(true)

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
    // Not used in reduce page, but required by ImagePreviewGrid interface
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
      <ReduceImagePageHeader />
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
            <ReduceControls
              images={images}
              width={reduceWidth}
              height={reduceHeight}
              dimensionsLinked={dimensionsLinked}
              onWidthChange={setReduceWidth}
              onHeightChange={setReduceHeight}
              onDimensionsLinkedChange={setDimensionsLinked}
            />
            <ReduceActions
              images={images}
              outputFormat={outputFormat}
              reduceWidth={reduceWidth}
              reduceHeight={reduceHeight}
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

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileUploadArea } from '../convert/-components/FileUploadArea'
import { ImagePreviewGrid } from '../convert/-components/ImagePreviewGrid'
import { RemoveImagePageHeader } from './-components/RemoveImagePageHeader'
import { RemoveActions } from './-components/RemoveActions'
import { OutputFormatSelector } from './-components/OutputFormatSelector'
import { BackgroundRemovedPreview } from './-components/BackgroundRemovedPreview'
import { ModelSelector } from './-components/ModelSelector'
import { BackgroundRemovalAttribution } from './-components/BackgroundRemovalAttribution'
import { useBackgroundRemovalSession } from './-components/useBackgroundRemovalSession'
import type { ImageFile } from '@/components/ImagePreview'

const SUPPORTED_FORMATS = ['webp', 'png', 'jpg', 'avif', 'ico']

export const Route = createFileRoute('/remove/')({
  component: RemoveImagePage,
})

function RemoveImagePage() {
  const [images, setImages] = useState<Array<ImageFile>>([])
  const [outputFormat, setOutputFormat] = useState<'png' | 'webp'>('webp')
  const session = useBackgroundRemovalSession(images.length > 0)

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
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <FileUploadArea onFilesAdded={handleFilesAdded} />
        </div>
        {images.length > 0 && (
          <div className="md:w-80 md:shrink-0">
            <BackgroundRemovedPreview
              image={images[0]}
              outputFormat={outputFormat}
              modelId={session.modelId}
              crop={false}
            />
          </div>
        )}
        <div className="md:w-80 md:shrink-0">
          <div className="space-y-4">
            <OutputFormatSelector
              value={outputFormat}
              onChange={setOutputFormat}
            />
            <ModelSelector
              value={session.modelId}
              onChange={session.setModelId}
              qualityAvailability={session.qualityAvailability}
              capabilities={session.capabilities}
              runtime={session.runtime}
              progress={session.progress}
              error={session.error}
            />
            <RemoveActions
              images={images}
              outputFormat={outputFormat}
              modelId={session.modelId}
              onClear={handleClear}
            />
            <BackgroundRemovalAttribution />
          </div>
        </div>
      </div>
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

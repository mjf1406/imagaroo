import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ConvertImagePageHeader } from './-components/ConvertImagePageHeader'
import { FileUploadArea } from './-components/FileUploadArea'
import { GlobalFormatSelector } from './-components/GlobalFormatSelector'
import { ImagePreviewGrid } from './-components/ImagePreviewGrid'
import { ConvertActions } from './-components/ConvertActions'
import type { ImageFile } from '@/components/ImagePreview'

const SUPPORTED_FORMATS = ['jpg', 'png', 'webp', 'avif', 'ico']

export const Route = createFileRoute('/convert-image/')({
  component: ConvertImagePage,
})

function ConvertImagePage() {
  const [images, setImages] = useState<Array<ImageFile>>([])
  const [globalFormat, setGlobalFormat] = useState('webp')

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
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <ConvertImagePageHeader />
      <FileUploadArea onFilesAdded={handleFilesAdded} />
      {images.length > 0 && (
        <>
          <GlobalFormatSelector
            value={globalFormat}
            onChange={setGlobalFormat}
            supportedFormats={SUPPORTED_FORMATS}
          />
          <ImagePreviewGrid
            images={images}
            globalFormat={globalFormat}
            onRemove={handleRemove}
            onFormatChange={handleFormatChange}
            supportedFormats={SUPPORTED_FORMATS}
          />
          <ConvertActions
            images={images}
            globalFormat={globalFormat}
            onClear={handleClear}
          />
        </>
      )}
    </div>
  )
}

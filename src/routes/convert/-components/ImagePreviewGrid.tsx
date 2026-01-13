import { ImagePreview, type ImageFile } from '@/components/ImagePreview'

interface ImagePreviewGridProps {
  images: ImageFile[]
  globalFormat: string
  onRemove: (id: string) => void
  onFormatChange: (id: string, format: string | null) => void
  supportedFormats: string[]
}

export function ImagePreviewGrid({
  images,
  globalFormat,
  onRemove,
  onFormatChange,
  supportedFormats,
}: ImagePreviewGridProps) {
  if (images.length === 0) {
    return null
  }

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-4">
        Images ({images.length})
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {images.map((image) => (
          <ImagePreview
            key={image.id}
            image={image}
            globalFormat={globalFormat}
            onRemove={onRemove}
            onFormatChange={onFormatChange}
            supportedFormats={supportedFormats}
          />
        ))}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileUploadArea } from '../convert/-components/FileUploadArea'
import { ImagePreviewGrid } from '../convert/-components/ImagePreviewGrid'
import { CropActions } from './-components/CropActions'
import { CropCanvas } from './-components/CropCanvas'
import { CropImagePageHeader } from './-components/CropImagePageHeader'
import { CropModeToggle } from './-components/CropModeToggle'
import type { CropMode } from './-components/CropModeToggle'
import { ManualCropActions } from './-components/ManualCropActions'
import { ManualCropSizeControls } from './-components/ManualCropSizeControls'
import { OutputFormatSelector } from './-components/OutputFormatSelector'
import type { ImageFile } from '@/components/ImagePreview'
import type { CropRect, CropOutputFormat } from '@/lib/image-cropper'
import { fullImageCropRect } from '@/lib/image-cropper'

const SUPPORTED_FORMATS = ['webp', 'png', 'jpg', 'avif', 'ico']

function createImageFile(file: File): ImageFile {
  return {
    id: `${Date.now()}-${Math.random()}`,
    file,
    preview: URL.createObjectURL(file),
    outputFormat: null,
  }
}

function syncImagesWithManualReplace(
  images: ImageFile[],
  oldManualId: string | undefined,
  newImage: ImageFile,
): ImageFile[] {
  if (images.length === 0) return [newImage]
  if (oldManualId && images[0]?.id === oldManualId) {
    return [newImage, ...images.slice(1)]
  }
  if (oldManualId) {
    const idx = images.findIndex((img) => img.id === oldManualId)
    if (idx >= 0) {
      const next = [...images]
      next[idx] = newImage
      return next
    }
  }
  return [newImage, ...images]
}

export const Route = createFileRoute('/crop/')({
  component: CropImagePage,
})

function CropImagePage() {
  const [mode, setMode] = useState<CropMode>('auto')
  const [images, setImages] = useState<Array<ImageFile>>([])
  const [manualImage, setManualImage] = useState<ImageFile | null>(null)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [outputFormat, setOutputFormat] = useState<CropOutputFormat>('webp')
  const [jpgBackgroundColor, setJpgBackgroundColor] = useState('#ffffff')

  useEffect(() => {
    if (!manualImage) {
      setCropRect(null)
      return
    }
    const img = new Image()
    img.onload = () => {
      setCropRect(
        fullImageCropRect(img.naturalWidth, img.naturalHeight),
      )
    }
    img.onerror = () => setCropRect(null)
    img.src = manualImage.preview
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [manualImage])

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
    // Not used in crop page, but required by ImagePreviewGrid interface
  }

  const handleClear = () => {
    const clearedIds = new Set(images.map((image) => image.id))
    const clearsManual =
      manualImage !== null && clearedIds.has(manualImage.id)
    images.forEach((image) => {
      URL.revokeObjectURL(image.preview)
    })
    setImages([])
    if (clearsManual) {
      setManualImage(null)
      setCropRect(null)
    }
  }

  const handleManualImage = useCallback(
    (file: File) => {
      const newImage = createImageFile(file)
      const oldId = manualImage?.id
      if (manualImage) URL.revokeObjectURL(manualImage.preview)
      setManualImage(newImage)
      setImages((current) =>
        syncImagesWithManualReplace(current, oldId, newImage),
      )
    },
    [manualImage],
  )

  const handleManualClear = useCallback(() => {
    if (!manualImage) return
    const id = manualImage.id
    URL.revokeObjectURL(manualImage.preview)
    setManualImage(null)
    setImages((current) => current.filter((img) => img.id !== id))
    setCropRect(null)
  }, [manualImage])

  const handleModeChange = useCallback(
    (nextMode: CropMode) => {
      if (nextMode === mode) return

      if (nextMode === 'manual') {
        if (images.length > 0) {
          setManualImage(images[0])
        }
      } else if (manualImage) {
        setImages((prev) => {
          if (prev.some((img) => img.id === manualImage.id)) return prev
          if (prev.length === 0) return [manualImage]
          return [manualImage, ...prev]
        })
      }

      setMode(nextMode)
    },
    [mode, images, manualImage],
  )

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <CropImagePageHeader />

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {mode === 'auto' ? (
            <FileUploadArea onFilesAdded={handleFilesAdded} />
          ) : (
            <CropCanvas
              image={manualImage}
              rect={cropRect}
              onRectChange={setCropRect}
              onImageReplace={handleManualImage}
            />
          )}
        </div>
        <div className="md:w-80 md:shrink-0">
          <div className="space-y-4">
            <CropModeToggle value={mode} onChange={handleModeChange} />
            <OutputFormatSelector<CropOutputFormat>
              value={outputFormat}
              onChange={setOutputFormat}
              formats={['webp', 'png', 'jpg']}
              jpgBackgroundColor={jpgBackgroundColor}
              onJpgBackgroundColorChange={setJpgBackgroundColor}
            />
            {mode === 'auto' ? (
              <CropActions
                images={images}
                outputFormat={outputFormat}
                jpgBackgroundColor={jpgBackgroundColor}
                onClear={handleClear}
              />
            ) : (
              <>
                <ManualCropSizeControls
                  image={manualImage}
                  cropRect={cropRect}
                  onRectChange={setCropRect}
                />
                <ManualCropActions
                  image={manualImage}
                  cropRect={cropRect}
                  outputFormat={outputFormat}
                  jpgBackgroundColor={jpgBackgroundColor}
                  onClear={handleManualClear}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {mode === 'auto' && images.length > 0 && (
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

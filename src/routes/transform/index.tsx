import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileUploadArea } from '../convert/-components/FileUploadArea'
import { ImagePreviewGrid } from '../convert/-components/ImagePreviewGrid'
import { OutputFormatSelector } from '../crop/-components/OutputFormatSelector'
import { ToleranceSlider } from '../remove/-components/ToleranceSlider'
import { BackgroundRemovedPreview } from '../remove/-components/BackgroundRemovedPreview'
import { TransformPageHeader } from './-components/TransformPageHeader'
import { ModeToggle } from './-components/ModeToggle'
import { TransformActions } from './-components/TransformActions'
import { ReduceControls } from './-components/ReduceControls'
import type { ImageFile } from '@/components/ImagePreview'

const SUPPORTED_FORMATS = ['webp', 'png', 'jpg', 'avif', 'ico']

export const Route = createFileRoute('/transform/')({
  component: TransformImagePage,
})

function TransformImagePage() {
  const [images, setImages] = useState<Array<ImageFile>>([])
  const [outputFormat, setOutputFormat] = useState<'png' | 'webp'>('webp')
  const [tolerance, setTolerance] = useState(30)
  const [crop, setCrop] = useState(true)
  const [remove, setRemove] = useState(true)
  const [reduce, setReduce] = useState(false)
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
    // Not used in transform page, but required by ImagePreviewGrid interface
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
      <TransformPageHeader />
      {/* Flex row layout on md+ screens */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left side: File upload area */}
        <div className="flex-1">
          <FileUploadArea onFilesAdded={handleFilesAdded} />
        </div>
        {/* Middle: Preview section - show if crop, remove, or reduce is selected */}
        {(crop || remove || reduce) && images.length > 0 && (
          <div className="md:w-80 md:shrink-0">
            <BackgroundRemovedPreview
              image={images[0]}
              outputFormat={outputFormat}
              tolerance={tolerance}
              crop={crop}
              remove={remove}
            />
          </div>
        )}
        {/* Right side: Controls (always visible) */}
        <div className="md:w-80 md:shrink-0">
          <div className="space-y-4">
            <ModeToggle
              crop={crop}
              remove={remove}
              reduce={reduce}
              onCropChange={setCrop}
              onRemoveChange={setRemove}
              onReduceChange={setReduce}
            />
            <OutputFormatSelector
              value={outputFormat}
              onChange={setOutputFormat}
            />
            {remove && (
              <ToleranceSlider
                value={tolerance}
                onChange={setTolerance}
                min={0}
                max={100}
                step={1}
              />
            )}
            {reduce && (
              <ReduceControls
                images={images}
                width={reduceWidth}
                height={reduceHeight}
                dimensionsLinked={dimensionsLinked}
                onWidthChange={setReduceWidth}
                onHeightChange={setReduceHeight}
                onDimensionsLinkedChange={setDimensionsLinked}
              />
            )}
            <TransformActions
              images={images}
              outputFormat={outputFormat}
              tolerance={tolerance}
              crop={crop}
              remove={remove}
              reduce={reduce}
              reduceWidth={reduceWidth}
              reduceHeight={reduceHeight}
              onClear={handleClear}
            />
          </div>
        </div>
      </div>
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

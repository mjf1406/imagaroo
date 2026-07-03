import { useEffect, useState } from 'react'

import type { ImageFile } from '@/components/ImagePreview'
import { SteppedNumberInput } from '@/components/SteppedNumberInput'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { CropRect } from '@/lib/image-cropper'
import { resizeCropRectCentered } from '@/lib/image-cropper'

const MIN_CROP_SIZE = 4

interface ManualCropSizeControlsProps {
  image: ImageFile | null
  cropRect: CropRect | null
  onRectChange: (rect: CropRect) => void
}

export function ManualCropSizeControls({
  image,
  cropRect,
  onRectChange,
}: ManualCropSizeControlsProps) {
  const [imageDimensions, setImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  const [dimensionsLinked, setDimensionsLinked] = useState(true)

  useEffect(() => {
    if (!image) {
      setImageDimensions(null)
      return
    }
    const img = new Image()
    let isMounted = true
    img.onload = () => {
      if (!isMounted) return
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
    }
    img.onerror = () => {
      if (!isMounted) return
      setImageDimensions(null)
    }
    img.src = image.preview
    return () => {
      isMounted = false
    }
  }, [image])

  const showControls =
    imageDimensions !== null && cropRect !== null && cropRect.w >= MIN_CROP_SIZE

  const handleWidthChange = (newWidth: number) => {
    if (!cropRect || !imageDimensions) return

    let newHeight = Math.round(cropRect.h)
    if (dimensionsLinked && cropRect.h > 0) {
      const aspectRatio = cropRect.h / cropRect.w
      newHeight = Math.max(
        MIN_CROP_SIZE,
        Math.round(newWidth * aspectRatio),
      )
    }

    onRectChange(
      resizeCropRectCentered(
        cropRect,
        newWidth,
        newHeight,
        imageDimensions.width,
        imageDimensions.height,
        MIN_CROP_SIZE,
      ),
    )
  }

  const handleHeightChange = (newHeight: number) => {
    if (!cropRect || !imageDimensions) return

    let newWidth = Math.round(cropRect.w)
    if (dimensionsLinked && cropRect.w > 0) {
      const aspectRatio = cropRect.w / cropRect.h
      newWidth = Math.max(
        MIN_CROP_SIZE,
        Math.round(newHeight * aspectRatio),
      )
    }

    onRectChange(
      resizeCropRectCentered(
        cropRect,
        newWidth,
        newHeight,
        imageDimensions.width,
        imageDimensions.height,
        MIN_CROP_SIZE,
      ),
    )
  }

  if (!image) return null

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium">Crop size</Label>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="crop-width" className="text-xs w-12 shrink-0">
            Width:
          </Label>
          {showControls ? (
            <>
              <SteppedNumberInput
                id="crop-width"
                value={Math.round(cropRect.w)}
                onChange={handleWidthChange}
                min={MIN_CROP_SIZE}
                max={imageDimensions.width}
                step={1}
                aria-label="Crop width in pixels"
                className="min-w-0 max-w-[14rem] flex-1"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Loading…</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="crop-height" className="text-xs w-12 shrink-0">
            Height:
          </Label>
          {showControls ? (
            <>
              <SteppedNumberInput
                id="crop-height"
                value={Math.round(cropRect.h)}
                onChange={handleHeightChange}
                min={MIN_CROP_SIZE}
                max={imageDimensions.height}
                step={1}
                aria-label="Crop height in pixels"
                className="min-w-0 max-w-[14rem] flex-1"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Loading…</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="crop-dimensions-linked" className="text-xs">
          Maintain aspect ratio:
        </Label>
        <Switch
          id="crop-dimensions-linked"
          checked={dimensionsLinked}
          onCheckedChange={setDimensionsLinked}
        />
      </div>

      {imageDimensions && (
        <span className="text-xs text-muted-foreground">
          Image: {imageDimensions.width} × {imageDimensions.height}px
        </span>
      )}
    </div>
  )
}

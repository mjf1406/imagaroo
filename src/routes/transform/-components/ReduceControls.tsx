import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'

import type { ImageFile } from '@/components/ImagePreview'
import { SteppedNumberInput } from '@/components/SteppedNumberInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface ReduceControlsProps {
  images: Array<ImageFile>
  width: number | null
  height: number | null
  dimensionsLinked: boolean
  onWidthChange: (width: number | null) => void
  onHeightChange: (height: number | null) => void
  onDimensionsLinkedChange: (linked: boolean) => void
}

export function ReduceControls({
  images,
  width,
  height,
  dimensionsLinked,
  onWidthChange,
  onHeightChange,
  onDimensionsLinkedChange,
}: ReduceControlsProps) {
  const [originalDimensions, setOriginalDimensions] = useState<{
    width: number
    height: number
  } | null>(null)

  const widthRef = useRef(width)
  const heightRef = useRef(height)
  widthRef.current = width
  heightRef.current = height

  // Load dimensions from first image (runs when `images` changes only)
  useEffect(() => {
    if (images.length === 0) {
      setOriginalDimensions(null)
      return
    }
    const img = new Image()
    let isMounted = true
    img.onload = () => {
      if (!isMounted) return
      const newDimensions = { width: img.width, height: img.height }
      setOriginalDimensions(newDimensions)
      if (widthRef.current === null && heightRef.current === null) {
        onWidthChange(newDimensions.width)
        onHeightChange(newDimensions.height)
      }
    }
    img.src = images[0].preview
    return () => {
      isMounted = false
    }
  }, [images, onHeightChange, onWidthChange])

  const handlePreset = (percentage: number) => {
    if (!originalDimensions) return
    const newWidth = Math.round(originalDimensions.width * (percentage / 100))
    const newHeight = Math.round(originalDimensions.height * (percentage / 100))
    onWidthChange(newWidth)
    onHeightChange(newHeight)
  }

  const handleWidthChange = (value: string) => {
    const numValue = value === '' ? null : Number.parseInt(value, 10)
    if (numValue !== null && (isNaN(numValue) || numValue < 1)) return

    onWidthChange(numValue)

    // If linked, adjust height to maintain aspect ratio
    if (dimensionsLinked && numValue !== null && originalDimensions) {
      const aspectRatio = originalDimensions.height / originalDimensions.width
      const newHeight = Math.round(numValue * aspectRatio)
      onHeightChange(newHeight)
    }
  }

  const handleHeightChange = (value: string) => {
    const numValue = value === '' ? null : Number.parseInt(value, 10)
    if (numValue !== null && (isNaN(numValue) || numValue < 1)) return

    onHeightChange(numValue)

    // If linked, adjust width to maintain aspect ratio
    if (dimensionsLinked && numValue !== null && originalDimensions) {
      const aspectRatio = originalDimensions.width / originalDimensions.height
      const newWidth = Math.round(numValue * aspectRatio)
      onWidthChange(newWidth)
    }
  }

  const handleResetDimensions = () => {
    if (!originalDimensions) return
    onWidthChange(originalDimensions.width)
    onHeightChange(originalDimensions.height)
  }

  const showSteppers =
    originalDimensions !== null && width !== null && height !== null

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Resolution:</Label>
        {originalDimensions && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-6 w-6 shrink-0"
            onClick={handleResetDimensions}
            aria-label="Reset width and height to original image dimensions"
          >
            <RotateCcw className="size-3" aria-hidden />
          </Button>
        )}
      </div>

      {/* Preset buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handlePreset(75)}
          className="flex-1 text-xs"
        >
          75%
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handlePreset(50)}
          className="flex-1 text-xs"
        >
          50%
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handlePreset(25)}
          className="flex-1 text-xs"
        >
          25%
        </Button>
      </div>

      {/* Custom dimensions */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="reduce-width" className="text-xs w-12 shrink-0">
            Width:
          </Label>
          {showSteppers ? (
            <>
              <SteppedNumberInput
                id="reduce-width"
                value={width}
                onChange={(n) => handleWidthChange(String(n))}
                min={1}
                max={50000}
                step={1}
                aria-label="Output width in pixels"
                className="min-w-0 max-w-[14rem] flex-1"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Loading…</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="reduce-height" className="text-xs w-12 shrink-0">
            Height:
          </Label>
          {showSteppers ? (
            <>
              <SteppedNumberInput
                id="reduce-height"
                value={height}
                onChange={(n) => handleHeightChange(String(n))}
                min={1}
                max={50000}
                step={1}
                aria-label="Output height in pixels"
                className="min-w-0 max-w-[14rem] flex-1"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Loading…</span>
          )}
        </div>
      </div>

      {/* Linked dimensions toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="dimensions-linked" className="text-xs">
          Maintain aspect ratio:
        </Label>
        <Switch
          id="dimensions-linked"
          checked={dimensionsLinked}
          onCheckedChange={onDimensionsLinkedChange}
        />
      </div>

      {/* Show original dimensions if available */}
      {originalDimensions && (
        <span className="text-xs text-muted-foreground">
          Original: {originalDimensions.width} × {originalDimensions.height}px
        </span>
      )}
    </div>
  )
}

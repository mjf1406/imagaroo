import { useEffect, useState } from 'react'
import type { ImageFile } from '@/components/ImagePreview'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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

  // Load dimensions from first image
  useEffect(() => {
    if (images.length > 0) {
      const img = new Image()
      let isMounted = true
      img.onload = () => {
        if (!isMounted) return
        const newDimensions = { width: img.width, height: img.height }
        setOriginalDimensions(newDimensions)
        // Initialize dimensions if not set (only when images change)
        if (width === null && height === null) {
          onWidthChange(newDimensions.width)
          onHeightChange(newDimensions.height)
        }
      }
      img.src = images[0].preview
      return () => {
        isMounted = false
      }
    } else {
      setOriginalDimensions(null)
    }
    // Only depend on images array, check width/height from closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images])

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

  return (
    <div className="mb-6 flex flex-col gap-3">
      <Label className="text-sm font-medium">Resolution:</Label>

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
        <div className="flex items-center gap-2">
          <Label htmlFor="reduce-width" className="text-xs w-12">
            Width:
          </Label>
          <Input
            id="reduce-width"
            type="number"
            min="1"
            value={width ?? ''}
            onChange={(e) => handleWidthChange(e.target.value)}
            placeholder="Width"
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground">px</span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="reduce-height" className="text-xs w-12">
            Height:
          </Label>
          <Input
            id="reduce-height"
            type="number"
            min="1"
            value={height ?? ''}
            onChange={(e) => handleHeightChange(e.target.value)}
            placeholder="Height"
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground">px</span>
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

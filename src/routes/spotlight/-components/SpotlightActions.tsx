import { useState } from 'react'
import { Download, Loader2, Undo2 } from 'lucide-react'

import type { SpotlightOutputFormat } from './SpotlightControls'
import type { ImageFile } from '@/components/ImagePreview'
import type { MagnifierFrame } from '@/lib/image-magnifier'
import type {
  SpotlightEffect,
  SpotlightFocusArea,
  SpotlightShape,
} from '@/lib/image-spotlight'
import { exportSpotlight } from '@/lib/image-spotlight'
import { Button } from '@/components/ui/button'
import { downloadBlob } from '@/lib/zip-utils'

function spotlightFilename(originalName: string, format: SpotlightOutputFormat): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName
  const ext = format === 'jpg' ? 'jpg' : format
  return `${base}-spotlight.${ext}`
}

interface SpotlightActionsProps {
  image: ImageFile | null
  shapes: Array<SpotlightShape>
  magnifier: MagnifierFrame | null
  effect: SpotlightEffect
  darkenStrength: number
  blurStrength: number
  focusArea: SpotlightFocusArea
  outputFormat: SpotlightOutputFormat
  jpgBackgroundColor: string
  canUndo: boolean
  onUndo: () => void
  onClearShapes: () => void
  onClearMagnifier: () => void
  onClearAll: () => void
}

export function SpotlightActions({
  image,
  shapes,
  magnifier,
  effect,
  darkenStrength,
  blurStrength,
  focusArea,
  outputFormat,
  jpgBackgroundColor,
  canUndo,
  onUndo,
  onClearShapes,
  onClearMagnifier,
  onClearAll,
}: SpotlightActionsProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (!image) return

    setIsExporting(true)
    try {
      const img = new Image()
      img.decoding = 'async'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = image.preview
      })

      const blob = await exportSpotlight(img, {
        shapes,
        magnifier,
        effect,
        darkenStrength,
        blurStrength,
        focusArea,
        format: outputFormat,
        jpgBackgroundColor:
          outputFormat === 'jpg' ? jpgBackgroundColor : undefined,
        quality: 0.92,
      })

      downloadBlob(blob, spotlightFilename(image.file.name, outputFormat))
    } catch (e) {
      console.error(e)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={handleExport}
        disabled={!image || isExporting}
        size="lg"
        className="w-full"
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Exporting…
          </>
        ) : (
          <>
            <Download className="mr-2 size-4" />
            Export
          </>
        )}
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex-1 min-w-[5rem]"
        >
          <Undo2 className="mr-1 size-3" />
          Undo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearShapes}
          disabled={!image || shapes.length === 0}
          className="flex-1 min-w-[5rem]"
        >
          Clear shapes
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearMagnifier}
          disabled={!image || !magnifier}
          className="flex-1 min-w-[5rem]"
        >
          Clear magnifier
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearAll}
          disabled={!image}
          className="flex-1 min-w-[5rem]"
        >
          Clear all
        </Button>
      </div>
    </div>
  )
}

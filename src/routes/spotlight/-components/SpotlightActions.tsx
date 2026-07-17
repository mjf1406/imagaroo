import { useState } from 'react'
import { Download, Film, Loader2, Undo2 } from 'lucide-react'

import type {
  SpotlightAnimationFormat,
  SpotlightOutputFormat,
} from './SpotlightControls'
import type { ImageFile } from '@/components/ImagePreview'
import type { MagnifierFrame } from '@/lib/image-magnifier'
import {
  exportSpotlightAnimation,
  spotlightAnimationFilename,
} from '@/lib/image-spotlight-animation'
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

async function loadImageFromPreview(preview: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = preview
  })
  return img
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
  animationFormat: SpotlightAnimationFormat
  transitionDurationSec: number
  holdDurationSec: number
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
  animationFormat,
  transitionDurationSec,
  holdDurationSec,
  canUndo,
  onUndo,
  onClearShapes,
  onClearMagnifier,
  onClearAll,
}: SpotlightActionsProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingAnimation, setIsExportingAnimation] = useState(false)
  const [animationProgress, setAnimationProgress] = useState(0)

  const canExportAnimation =
    image !== null && (shapes.length > 0 || magnifier !== null)
  const isBusy = isExporting || isExportingAnimation

  const handleExport = async () => {
    if (!image) return

    setIsExporting(true)
    try {
      const img = await loadImageFromPreview(image.preview)

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

  const handleExportAnimation = async () => {
    if (!image || !canExportAnimation) return

    setIsExportingAnimation(true)
    setAnimationProgress(0)
    try {
      const img = await loadImageFromPreview(image.preview)

      const result = await exportSpotlightAnimation(img, {
        shapes,
        magnifier,
        effect,
        darkenStrength,
        blurStrength,
        focusArea,
        format: animationFormat,
        transitionDurationSec,
        holdDurationSec,
        onProgress: setAnimationProgress,
      })

      downloadBlob(
        result.blob,
        spotlightAnimationFilename(image.file.name, result.fileExtension),
      )

      if (animationFormat === 'mp4' && result.usedWebmFallback) {
        alert(
          'MP4 recording is not supported in this browser. Downloaded WebM instead.',
        )
      }
    } catch (e) {
      console.error(e)
      alert(
        e instanceof Error
          ? e.message
          : 'Animation export failed. Please try again.',
      )
    } finally {
      setIsExportingAnimation(false)
      setAnimationProgress(0)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={handleExport}
        disabled={!image || isBusy}
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
      <Button
        type="button"
        onClick={handleExportAnimation}
        disabled={!canExportAnimation || isBusy}
        size="lg"
        variant="secondary"
        className="w-full"
      >
        {isExportingAnimation ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Exporting animation… {Math.round(animationProgress)}%
          </>
        ) : (
          <>
            <Film className="mr-2 size-4" />
            Export animation
          </>
        )}
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo || isBusy}
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
          disabled={!image || shapes.length === 0 || isBusy}
          className="flex-1 min-w-[5rem]"
        >
          Clear shapes
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearMagnifier}
          disabled={!image || !magnifier || isBusy}
          className="flex-1 min-w-[5rem]"
        >
          Clear magnifier
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearAll}
          disabled={!image || isBusy}
          className="flex-1 min-w-[5rem]"
        >
          Clear all
        </Button>
      </div>
    </div>
  )
}

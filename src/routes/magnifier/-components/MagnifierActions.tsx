import { useState } from 'react'
import { Download, Loader2, Undo2 } from 'lucide-react'

import type { ImageFile } from '@/components/ImagePreview'
import type { MagnifierFrame } from '@/lib/image-magnifier'
import { exportMagnifier } from '@/lib/image-magnifier'
import { downloadBlob } from '@/lib/zip-utils'
import { Button } from '@/components/ui/button'
import type { MagnifierOutputFormat } from './MagnifierControls'

function magnifierFilename(originalName: string, format: MagnifierOutputFormat): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName
  const ext = format === 'jpg' ? 'jpg' : format
  return `${base}-magnifier.${ext}`
}

interface MagnifierActionsProps {
  image: ImageFile | null
  frame: MagnifierFrame | null
  outputFormat: MagnifierOutputFormat
  jpgBackgroundColor: string
  canUndo: boolean
  onUndo: () => void
  onClearFrame: () => void
  onClearAll: () => void
}

export function MagnifierActions({
  image,
  frame,
  outputFormat,
  jpgBackgroundColor,
  canUndo,
  onUndo,
  onClearFrame,
  onClearAll,
}: MagnifierActionsProps) {
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

      const blob = await exportMagnifier(img, {
        frame,
        format: outputFormat,
        jpgBackgroundColor: outputFormat === 'jpg' ? jpgBackgroundColor : undefined,
        quality: 0.92,
      })

      downloadBlob(blob, magnifierFilename(image.file.name, outputFormat))
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
          onClick={onClearFrame}
          disabled={!image || !frame}
          className="flex-1 min-w-[5rem]"
        >
          Clear frame
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


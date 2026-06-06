import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

import type { ImageFile } from '@/components/ImagePreview'
import type { PosterSettings } from '@/lib/image-poster'
import { generatePosterPdf } from '@/lib/image-poster'
import { Button } from '@/components/ui/button'
import { downloadBlob } from '@/lib/zip-utils'

function posterFilename(originalName: string): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName
  return `${base}-poster.pdf`
}

interface PosterActionsProps {
  image: ImageFile | null
  settings: PosterSettings
  onClear: () => void
}

export function PosterActions({
  image,
  settings,
  onClear,
}: PosterActionsProps) {
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

      const blob = await generatePosterPdf(img, settings)
      downloadBlob(blob, posterFilename(image.file.name))
    } catch (e) {
      console.error(e)
      alert('PDF export failed. Please try again.')
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
            Generating PDF…
          </>
        ) : (
          <>
            <Download className="mr-2 size-4" />
            Download PDF
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClear}
        disabled={!image}
        className="w-full"
      >
        Clear
      </Button>
    </div>
  )
}

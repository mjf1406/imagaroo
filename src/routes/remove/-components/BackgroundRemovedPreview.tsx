import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { removeBg } from '@/lib/image-remove-bg'
import type { ImageFile } from '@/components/ImagePreview'

interface BackgroundRemovedPreviewProps {
  image: ImageFile | null
  outputFormat: 'png' | 'webp'
  tolerance: number
}

export function BackgroundRemovedPreview({
  image,
  outputFormat,
  tolerance,
}: BackgroundRemovedPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null)
      return
    }

    let cancelled = false

    const generatePreview = async () => {
      setIsLoading(true)
      try {
        const blob = await removeBg(image.file, outputFormat, tolerance)
        if (!cancelled) {
          const url = URL.createObjectURL(blob)
          // Clean up previous preview URL before setting new one
          setPreviewUrl((prev) => {
            if (prev) {
              URL.revokeObjectURL(prev)
            }
            return url
          })
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Preview generation error:', error)
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    generatePreview()

    return () => {
      cancelled = true
    }
  }, [image, outputFormat, tolerance])

  // Cleanup on unmount or when previewUrl changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  if (!image) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Preview</CardTitle>
        <p className="text-sm text-muted-foreground">
          Preview of "{image.file.name}" with background removed
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-square overflow-hidden rounded-md bg-muted border-2 border-dashed border-border">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={`Preview of ${image.file.name} with background removed`}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Failed to generate preview
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useDebouncer } from '@tanstack/react-pacer'
import type { ImageFile } from '@/components/ImagePreview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { removeBg } from '@/lib/image-remove-bg'

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
  const cancelledRef = useRef<{ cancelled: boolean } | null>(null)

  const debouncer = useDebouncer(
    async (params: {
      image: ImageFile
      outputFormat: 'png' | 'webp'
      tolerance: number
    }) => {
      const currentOperation = { cancelled: false }
      cancelledRef.current = currentOperation
      setIsLoading(true)

      try {
        const blob = await removeBg(
          params.image.file,
          params.outputFormat,
          params.tolerance,
        )
        if (!currentOperation.cancelled) {
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
        if (!currentOperation.cancelled) {
          setIsLoading(false)
        }
      }
    },
    { wait: 300 },
  )

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null)
      setIsLoading(false)
      debouncer.cancel() // Cancel any pending debounced execution
      if (cancelledRef.current) {
        cancelledRef.current.cancelled = true
      }
      return
    }

    // Cancel previous operation and any pending debounced execution
    debouncer.cancel()
    if (cancelledRef.current) {
      cancelledRef.current.cancelled = true
    }
    debouncer.maybeExecute({ image, outputFormat, tolerance })
  }, [image, outputFormat, tolerance, debouncer])

  // Cleanup on unmount or when previewUrl changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Cleanup debouncer on unmount
  useEffect(() => {
    return () => {
      debouncer.cancel()
      if (cancelledRef.current) {
        cancelledRef.current.cancelled = true
      }
    }
  }, [debouncer])

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

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useDebouncer } from '@tanstack/react-pacer'
import type { ImageFile } from '@/components/ImagePreview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { removeBg } from '@/lib/image-remove-bg'
import { autoCropImage } from '@/lib/image-cropper'

interface BackgroundRemovedPreviewProps {
  image: ImageFile | null
  outputFormat: 'png' | 'webp'
  tolerance: number
  crop?: boolean
  remove?: boolean
}

export function BackgroundRemovedPreview({
  image,
  outputFormat,
  tolerance,
  crop = true,
  remove = true,
}: BackgroundRemovedPreviewProps) {
  const [bgRemovedPreviewUrl, setBgRemovedPreviewUrl] = useState<string | null>(
    null,
  )
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const cancelledRef = useRef<{ cancelled: boolean } | null>(null)

  const debouncer = useDebouncer(
    async (params: {
      image: ImageFile
      outputFormat: 'png' | 'webp'
      tolerance: number
      crop: boolean
      remove: boolean
    }) => {
      const currentOperation = { cancelled: false }
      cancelledRef.current = currentOperation
      setIsLoading(true)

      try {
        let bgRemovedBlob: Blob | null = null
        let croppedBlob: Blob | null = null

        // Remove background if selected
        if (params.remove) {
          bgRemovedBlob = await removeBg(
            params.image.file,
            params.outputFormat,
            params.tolerance,
          )

          if (currentOperation.cancelled) {
            return
          }
        }

        // Crop if selected - always crop the original image for independent preview
        if (params.crop) {
          croppedBlob = await autoCropImage(
            params.image.file,
            params.outputFormat,
          )

          // Check cancellation again after async operation
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (currentOperation.cancelled) {
            return
          }
        }

        // Set background removed preview if available
        if (bgRemovedBlob) {
          const bgRemovedUrl = URL.createObjectURL(bgRemovedBlob)
          setBgRemovedPreviewUrl((prev) => {
            if (prev) {
              URL.revokeObjectURL(prev)
            }
            return bgRemovedUrl
          })
        } else {
          setBgRemovedPreviewUrl(null)
        }

        // Set cropped preview if available
        if (croppedBlob) {
          const croppedUrl = URL.createObjectURL(croppedBlob)
          setCroppedPreviewUrl((prev) => {
            if (prev) {
              URL.revokeObjectURL(prev)
            }
            return croppedUrl
          })
        } else {
          setCroppedPreviewUrl(null)
        }

        setIsLoading(false)
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
      setBgRemovedPreviewUrl(null)
      setCroppedPreviewUrl(null)
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
    debouncer.maybeExecute({ image, outputFormat, tolerance, crop, remove })
  }, [image, outputFormat, tolerance, crop, remove, debouncer])

  // Cleanup on unmount or when preview URLs change
  useEffect(() => {
    return () => {
      if (bgRemovedPreviewUrl) {
        URL.revokeObjectURL(bgRemovedPreviewUrl)
      }
      if (croppedPreviewUrl) {
        URL.revokeObjectURL(croppedPreviewUrl)
      }
    }
  }, [bgRemovedPreviewUrl, croppedPreviewUrl])

  // Cleanup debouncer on unmount
  useEffect(() => {
    return () => {
      debouncer.cancel()
      if (cancelledRef.current) {
        cancelledRef.current.cancelled = true
      }
    }
  }, [debouncer])

  if (!image || (!crop && !remove)) {
    return null
  }

  const previews = []
  if (remove) {
    previews.push({
      label: 'Background Removed',
      url: bgRemovedPreviewUrl,
      alt: `Preview of ${image.file.name} with background removed`,
    })
  }
  if (crop) {
    previews.push({
      label: 'Cropped',
      url: croppedPreviewUrl,
      alt: `Preview of ${image.file.name} cropped`,
    })
  }

  const getPreviewDescription = () => {
    if (crop && remove) {
      return 'Preview of "{image.file.name}" with background removed and cropped'
    } else if (remove) {
      return 'Preview of "{image.file.name}" with background removed'
    } else if (crop) {
      return 'Preview of "{image.file.name}" cropped'
    }
    return ''
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Preview</CardTitle>
        <p className="text-sm text-muted-foreground">
          {getPreviewDescription().replace('{image.file.name}', image.file.name)}
        </p>
      </CardHeader>
      <CardContent>
        <div
          className={`grid gap-4 ${
            previews.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {previews.map((preview) => (
            <div key={preview.label}>
              <p className="text-xs text-muted-foreground mb-2 text-center">
                {preview.label}
              </p>
              <div className="relative aspect-square overflow-hidden rounded-md bg-muted border-2 border-dashed border-border">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : preview.url ? (
                  <img
                    src={preview.url}
                    alt={preview.alt}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                    Failed to generate preview
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

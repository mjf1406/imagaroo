import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useDebouncer } from '@tanstack/react-pacer'
import type { ImageFile } from '@/components/ImagePreview'
import type {
  BackgroundRemovalModelId,
  BackgroundRemovalProgress,
} from '@/lib/background-removal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { removeBg } from '@/lib/image-remove-bg'
import { autoCropImage } from '@/lib/image-cropper'
import { formatProgress } from '@/lib/background-removal'

interface BackgroundRemovedPreviewProps {
  image: ImageFile | null
  outputFormat: 'png' | 'webp'
  modelId: BackgroundRemovalModelId
  crop?: boolean
  remove?: boolean
}

export function BackgroundRemovedPreview({
  image,
  outputFormat,
  modelId,
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
  const [progress, setProgress] = useState<BackgroundRemovalProgress | null>(
    null,
  )
  const cancelledRef = useRef<{ cancelled: boolean } | null>(null)

  const debouncer = useDebouncer(
    async (params: {
      image: ImageFile
      outputFormat: 'png' | 'webp'
      modelId: BackgroundRemovalModelId
      crop: boolean
      remove: boolean
    }) => {
      const currentOperation = { cancelled: false }
      cancelledRef.current = currentOperation
      const abortController = new AbortController()
      setIsLoading(true)
      setProgress(null)

      try {
        let bgRemovedBlob: Blob | null = null
        let croppedBlob: Blob | null = null

        if (params.remove) {
          bgRemovedBlob = await removeBg(
            params.image.file,
            params.outputFormat,
            {
              modelId: params.modelId,
              signal: abortController.signal,
              onProgress: (nextProgress) => {
                if (!currentOperation.cancelled) {
                  setProgress(nextProgress)
                }
              },
            },
          )

          if (currentOperation.cancelled) {
            abortController.abort()
            return
          }
        }

        if (params.crop) {
          croppedBlob = await autoCropImage(
            params.image.file,
            params.outputFormat,
          )

          if (currentOperation.cancelled) {
            abortController.abort()
            return
          }
        }

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
        setProgress(null)
      } catch (caught) {
        if (currentOperation.cancelled) {
          return
        }
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return
        }
        console.error('Preview generation error:', caught)
        setIsLoading(false)
        setProgress(null)
      }
    },
    { wait: 300 },
  )

  useEffect(() => {
    if (!image) {
      setBgRemovedPreviewUrl(null)
      setCroppedPreviewUrl(null)
      setIsLoading(false)
      setProgress(null)
      debouncer.cancel()
      if (cancelledRef.current) {
        cancelledRef.current.cancelled = true
      }
      return
    }

    debouncer.cancel()
    if (cancelledRef.current) {
      cancelledRef.current.cancelled = true
    }
    debouncer.maybeExecute({ image, outputFormat, modelId, crop, remove })
  }, [image, outputFormat, modelId, crop, remove, debouncer])

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
          {getPreviewDescription().replace(
            '{image.file.name}',
            image.file.name,
          )}
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
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    {progress && (
                      <p className="text-xs text-muted-foreground">
                        {formatProgress(progress)}
                      </p>
                    )}
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

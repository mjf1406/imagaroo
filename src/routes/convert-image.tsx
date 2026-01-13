import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileImage, Loader2, Upload } from 'lucide-react'
import type { ImageFile } from '@/components/ImagePreview'
import { ImagePreview } from '@/components/ImagePreview'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  changeFileExtension,
  convertImage,
  isValidImageType,
} from '@/lib/image-converter'
import { createZip, downloadBlob } from '@/lib/zip-utils'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/convert-image')({
  component: ConvertImagePage,
})

const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'webp', 'avif', 'png']

function ConvertImagePage() {
  const [images, setImages] = useState<Array<ImageFile>>([])
  const [globalFormat, setGlobalFormat] = useState<string>('webp')
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionProgress, setConversionProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return

    const validFiles = Array.from(files).filter(isValidImageType)
    const newImages: Array<ImageFile> = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      outputFormat: null, // Use global format by default
    }))

    setImages((prev) => [...prev, ...newImages])
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFiles(files)
      }
      // Reset input after a short delay to allow the file dialog to fully close
      // This prevents interference with the dialog's Open button
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }, 0)
    },
    [handleFiles],
  )

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.preview)
      }
      return prev.filter((img) => img.id !== id)
    })
  }, [])

  const handleFormatChange = useCallback(
    (id: string, format: string | null) => {
      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, outputFormat: format } : img,
        ),
      )
    },
    [],
  )

  const handleConvert = useCallback(async () => {
    if (images.length === 0) return

    setIsConverting(true)
    setConversionProgress(0)

    try {
      const convertedFiles: Array<{ name: string; blob: Blob }> = []

      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        const targetFormat = image.outputFormat ?? globalFormat

        try {
          const blob = await convertImage(image.file, targetFormat)
          const newName = changeFileExtension(image.file.name, targetFormat)
          convertedFiles.push({ name: newName, blob })
        } catch (error) {
          console.error(`Failed to convert ${image.file.name}:`, error)
          // Continue with other images even if one fails
        }

        setConversionProgress(((i + 1) / images.length) * 100)
      }

      // Auto-download
      if (convertedFiles.length === 1) {
        // Single file: download directly
        downloadBlob(convertedFiles[0].blob, convertedFiles[0].name)
      } else if (convertedFiles.length > 1) {
        // Multiple files: create ZIP
        const zipBlob = await createZip(convertedFiles)
        downloadBlob(zipBlob, 'converted-images.zip')
      }
    } catch (error) {
      console.error('Conversion failed:', error)
      alert('Failed to convert images. Please try again.')
    } finally {
      setIsConverting(false)
      setConversionProgress(0)
    }
  }, [images, globalFormat])

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.preview))
    }
  }, [images])

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Convert Images</h1>
        <p className="text-muted-foreground">
          Upload images and convert them to your desired format
        </p>
      </div>

      {/* Global Format Selector */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Output Format</CardTitle>
            <Select value={globalFormat} onValueChange={setGlobalFormat}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_FORMATS.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Drag & Drop Zone */}
      <Card
        className={cn(
          'mb-6 border-2 border-dashed transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-muted p-4">
              <Upload className="size-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">
                Drag & drop images here
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                or click to select files
              </p>
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                variant="outline"
                type="button"
              >
                <FileImage className="size-4 mr-2" />
                Select Images
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Supported formats: JPG, JPEG, PNG, WEBP, AVIF
            </p>
          </div>
        </CardContent>
      </Card>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*"
      />

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {images.length} image{images.length !== 1 ? 's' : ''} ready
            </h2>
            <Button onClick={handleConvert} disabled={isConverting} size="lg">
              {isConverting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Converting... {Math.round(conversionProgress)}%
                </>
              ) : (
                'Convert & Download'
              )}
            </Button>
          </div>

          {isConverting && (
            <div className="mb-4">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${conversionProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {images.map((image) => (
              <ImagePreview
                key={image.id}
                image={image}
                globalFormat={globalFormat}
                onRemove={removeImage}
                onFormatChange={handleFormatChange}
                supportedFormats={SUPPORTED_FORMATS}
              />
            ))}
          </div>
        </>
      )}

      {images.length === 0 && !isConverting && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              No images uploaded yet. Drag and drop or select images to get
              started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

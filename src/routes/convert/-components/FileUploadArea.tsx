import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ImageFile } from '@/components/ImagePreview'
import { isValidImageType } from '@/lib/image-converter'

interface FileUploadAreaProps {
  onFilesAdded: (files: ImageFile[]) => void
}

export function FileUploadArea({ onFilesAdded }: FileUploadAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files) return

    const imageFiles: ImageFile[] = []
    const validFiles = Array.from(files).filter(isValidImageType)

    validFiles.forEach((file) => {
      const id = `${Date.now()}-${Math.random()}`
      const preview = URL.createObjectURL(file)
      imageFiles.push({
        id,
        file,
        preview,
        outputFormat: null,
      })
    })

    if (imageFiles.length > 0) {
      onFilesAdded(imageFiles)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-8">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25'
          }`}
        >
          <Upload className="size-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">
            Drag and drop images here, or click to browse
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Supports JPG, PNG, WEBP, AVIF, and ICO formats
          </p>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
          >
            Select Images
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp,image/avif,image/x-icon,image/vnd.microsoft.icon"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  )
}

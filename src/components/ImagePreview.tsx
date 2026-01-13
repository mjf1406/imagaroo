import { X } from 'lucide-react'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Card, CardContent } from './ui/card'

export type ImageFile = {
  id: string
  file: File
  preview: string
  outputFormat: string | null // null means use global format
}

interface ImagePreviewProps {
  image: ImageFile
  globalFormat: string
  onRemove: (id: string) => void
  onFormatChange: (id: string, format: string | null) => void
  supportedFormats: Array<string>
}

export function ImagePreview({
  image,
  globalFormat,
  onRemove,
  onFormatChange,
  supportedFormats,
}: ImagePreviewProps) {
  const currentFormat = image.outputFormat ?? globalFormat
  const originalFormat = image.file.name.split('.').pop()?.toLowerCase() || ''

  return (
    <Card className="relative group">
      <CardContent className="p-2">
        <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
          <img
            src={image.preview}
            alt={image.file.name}
            className="w-full h-full object-contain"
          />
          <Button
            variant="destructive"
            size="icon-xs"
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(image.id)}
            aria-label="Remove image"
          >
            <X className="size-3" />
          </Button>
        </div>
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium truncate" title={image.file.name}>
            {image.file.name}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {originalFormat.toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground">→</span>
            <Select
              value={image.outputFormat ?? 'global'}
              onValueChange={(value) =>
                onFormatChange(image.id, value === 'global' ? null : value)
              }
            >
              <SelectTrigger className="h-6 text-xs w-24">
                <SelectValue>
                  {image.outputFormat === null
                    ? 'Global'
                    : currentFormat.toUpperCase()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">
                  Global ({globalFormat.toUpperCase()})
                </SelectItem>
                {supportedFormats.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

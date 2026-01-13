import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface ModeToggleProps {
  crop: boolean
  remove: boolean
  onCropChange: (value: boolean) => void
  onRemoveChange: (value: boolean) => void
}

export function ModeToggle({
  crop,
  remove,
  onCropChange,
  onRemoveChange,
}: ModeToggleProps) {
  const getDescription = () => {
    if (crop && remove) {
      return 'Crop images and remove backgrounds. Both operations will be applied.'
    } else if (crop) {
      return 'Automatically crop images by detecting content boundaries.'
    } else if (remove) {
      return 'Remove backgrounds from images. Works best with single solid backgrounds.'
    }
    return 'Select at least one transformation to apply.'
  }

  const handleCropToggle = () => {
    // Prevent unchecking if it's the only selected option
    if (crop && !remove) {
      return // Don't allow unchecking the last option
    }
    onCropChange(!crop)
  }

  const handleRemoveToggle = () => {
    // Prevent unchecking if it's the only selected option
    if (remove && !crop) {
      return // Don't allow unchecking the last option
    }
    onRemoveChange(!remove)
  }

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Label className="text-sm font-medium">Transformations:</Label>
        <div className="inline-flex w-auto items-center gap-0.5 rounded-md border border-input bg-background p-0.5 shadow-sm">
          <button
            type="button"
            onClick={handleCropToggle}
            disabled={crop && !remove}
            className={cn(
              'relative flex h-8 cursor-pointer items-center justify-center rounded-sm px-3 text-xs font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              crop && 'bg-accent text-accent-foreground shadow-sm',
            )}
          >
            Crop
          </button>
          <button
            type="button"
            onClick={handleRemoveToggle}
            disabled={remove && !crop}
            className={cn(
              'relative flex h-8 cursor-pointer items-center justify-center rounded-sm px-3 text-xs font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              remove && 'bg-accent text-accent-foreground shadow-sm',
            )}
          >
            Remove BG
          </button>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">{getDescription()}</span>
    </div>
  )
}

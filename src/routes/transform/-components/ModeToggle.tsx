import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface ModeToggleProps {
  crop: boolean
  remove: boolean
  reduce: boolean
  onCropChange: (value: boolean) => void
  onRemoveChange: (value: boolean) => void
  onReduceChange: (value: boolean) => void
}

export function ModeToggle({
  crop,
  remove,
  reduce,
  onCropChange,
  onRemoveChange,
  onReduceChange,
}: ModeToggleProps) {
  const getDescription = () => {
    const operations: Array<string> = []
    if (crop) operations.push('crop')
    if (remove) operations.push('remove backgrounds')
    if (reduce) operations.push('reduce resolution')

    if (operations.length === 0) {
      return 'Select at least one transformation to apply.'
    } else if (operations.length === 1) {
      const op = operations[0]
      if (op === 'crop') {
        return 'Automatically crop images by detecting content boundaries.'
      } else if (op === 'remove backgrounds') {
        return 'Remove backgrounds from images. Works best with single solid backgrounds.'
      } else if (op === 'reduce resolution') {
        return 'Reduce image resolution to decrease file size.'
      }
    } else if (operations.length === 2) {
      return `${operations[0]} and ${operations[1]}. Both operations will be applied.`
    } else {
      return `${operations.slice(0, -1).join(', ')}, and ${operations[operations.length - 1]}. All operations will be applied.`
    }
    return 'Select at least one transformation to apply.'
  }

  const handleCropToggle = () => {
    // Prevent unchecking if it's the only selected option
    if (crop && !remove && !reduce) {
      return // Don't allow unchecking the last option
    }
    onCropChange(!crop)
  }

  const handleRemoveToggle = () => {
    // Prevent unchecking if it's the only selected option
    if (remove && !crop && !reduce) {
      return // Don't allow unchecking the last option
    }
    onRemoveChange(!remove)
  }

  const handleReduceToggle = () => {
    // Prevent unchecking if it's the only selected option
    if (reduce && !crop && !remove) {
      return // Don't allow unchecking the last option
    }
    onReduceChange(!reduce)
  }

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Label className="text-sm font-medium">Transformations:</Label>
        <div className="inline-flex w-auto items-center gap-0.5 rounded-md border border-input bg-background p-0.5 shadow-sm">
          <button
            type="button"
            onClick={handleCropToggle}
            disabled={crop && !remove && !reduce}
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
            disabled={remove && !crop && !reduce}
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
          <button
            type="button"
            onClick={handleReduceToggle}
            disabled={reduce && !crop && !remove}
            className={cn(
              'relative flex h-8 cursor-pointer items-center justify-center rounded-sm px-3 text-xs font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              reduce && 'bg-accent text-accent-foreground shadow-sm',
            )}
          >
            Reduce
          </button>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">{getDescription()}</span>
    </div>
  )
}

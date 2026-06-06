import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type CropMode = 'auto' | 'manual'

interface CropModeToggleProps {
  value: CropMode
  onChange: (value: CropMode) => void
}

const MODES: Array<{ value: CropMode; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'manual', label: 'Manual' },
]

export function CropModeToggle({ value, onChange }: CropModeToggleProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">Crop Mode</Label>
        <RadioGroup
          value={value}
          onValueChange={(val) => onChange(val as CropMode)}
          className="inline-flex w-full items-center gap-0.5 rounded-md border border-input bg-background p-0.5 shadow-sm"
          aria-label="Crop mode selection"
          role="radiogroup"
        >
          {MODES.map((mode) => {
            const isSelected = value === mode.value
            return (
              <label
                key={mode.value}
                htmlFor={`crop-mode-${mode.value}`}
                className={cn(
                  'relative flex h-8 flex-1 cursor-pointer items-center justify-center rounded-sm px-3 text-xs font-medium',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
                  isSelected && 'bg-accent text-accent-foreground shadow-sm',
                )}
              >
                <RadioGroupItem
                  value={mode.value}
                  id={`crop-mode-${mode.value}`}
                  className="sr-only absolute"
                />
                {mode.label}
              </label>
            )
          })}
        </RadioGroup>
      </div>
      <span className="text-sm text-muted-foreground">
        {value === 'auto'
          ? 'Automatically detect content boundaries and crop whitespace.'
          : 'Draw a crop region on a single image.'}
      </span>
    </div>
  )
}

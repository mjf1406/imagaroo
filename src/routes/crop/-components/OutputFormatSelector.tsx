import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { CropOutputFormat } from '@/lib/image-cropper'
import { BackgroundColorPicker } from '@/routes/convert/-components/BackgroundColorPicker'

interface OutputFormatSelectorProps<
  F extends CropOutputFormat = CropOutputFormat,
> {
  value: F
  onChange: (value: F) => void
  formats?: Array<F>
  jpgBackgroundColor?: string
  onJpgBackgroundColorChange?: (value: string) => void
}

const DEFAULT_FORMATS = ['webp', 'png'] as const satisfies Array<CropOutputFormat>

export function OutputFormatSelector<
  F extends CropOutputFormat = CropOutputFormat,
>({
  value,
  onChange,
  formats = DEFAULT_FORMATS as unknown as Array<F>,
  jpgBackgroundColor = '#ffffff',
  onJpgBackgroundColorChange,
}: OutputFormatSelectorProps<F>) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">Output Format</Label>
        <RadioGroup
          value={value}
          onValueChange={(val) => onChange(val as F)}
          className="inline-flex w-full items-center gap-0.5 rounded-md border border-input bg-background p-0.5 shadow-sm"
          aria-label="Output format selection"
          role="radiogroup"
        >
          {formats.map((format) => {
            const formatUpper = format.toUpperCase()
            const isSelected = value === format
            return (
              <label
                key={format}
                htmlFor={`format-${format}`}
                className={cn(
                  'relative flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-sm px-2 text-xs font-medium',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
                  isSelected && 'bg-accent text-accent-foreground shadow-sm',
                )}
              >
                <RadioGroupItem
                  value={format}
                  id={`format-${format}`}
                  className="sr-only absolute"
                />
                {formatUpper}
              </label>
            )
          })}
        </RadioGroup>
      </div>
      <span className="text-sm text-muted-foreground">
        WEBP for smaller files, PNG for lossless, JPG for broad compatibility.
      </span>
      {value === 'jpg' && onJpgBackgroundColorChange && (
        <BackgroundColorPicker
          value={jpgBackgroundColor}
          onChange={onJpgBackgroundColorChange}
        />
      )}
    </div>
  )
}

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface GlobalFormatSelectorProps {
  value: string
  onChange: (value: string) => void
  supportedFormats: Array<string>
}

export function GlobalFormatSelector({
  value,
  onChange,
  supportedFormats,
}: GlobalFormatSelectorProps) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Label className="text-sm font-medium">Output Format:</Label>
        <RadioGroup
          value={value}
          onValueChange={onChange}
          className="inline-flex w-auto items-center gap-0.5 rounded-md border border-input bg-background p-0.5 shadow-sm"
          aria-label="Output format selection"
          role="radiogroup"
        >
          {supportedFormats.map((format) => {
            const formatUpper = format.toUpperCase()
            const isSelected = value === format
            return (
              <label
                key={format}
                htmlFor={`format-${format}`}
                className={cn(
                  'relative flex h-8 cursor-pointer items-center justify-center rounded-sm px-3 text-xs font-medium',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
                  'data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground',
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
        Choose PNG for the best quality, JPG for compatibility, or WEBP for
        smaller file sizes.
      </span>
    </div>
  )
}

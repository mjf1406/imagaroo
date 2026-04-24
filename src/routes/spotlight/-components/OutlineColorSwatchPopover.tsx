import { useState } from 'react'

import { SlidesColorPicker } from './SlidesColorPicker'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface OutlineColorSwatchPopoverProps {
  id?: string
  value: string
  onChange: (hex: string) => void
  swatchAriaLabel?: string
  disabled?: boolean
}

export function OutlineColorSwatchPopover({
  id,
  value,
  onChange,
  swatchAriaLabel = 'Open color picker',
  disabled = false,
}: OutlineColorSwatchPopoverProps) {
  const [open, setOpen] = useState(false)

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        id={id ? `${id}-swatch` : undefined}
        aria-label={swatchAriaLabel}
        className={cn(
          'flex size-10 shrink-0 cursor-not-allowed items-center justify-center rounded-md border border-input bg-background opacity-50 shadow-sm',
        )}
      >
        <span
          className="size-7 rounded-sm border border-border/80 shadow-inner"
          style={{ backgroundColor: value }}
        />
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id ? `${id}-swatch` : undefined}
          aria-label={swatchAriaLabel}
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md border border-input bg-background shadow-sm',
            'ring-offset-background transition-[box-shadow,transform] hover:opacity-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            open && 'ring-2 ring-ring ring-offset-2',
          )}
        >
          <span
            className="size-7 rounded-sm border border-border/80 shadow-inner"
            style={{ backgroundColor: value }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(100vw-2rem,18rem)] p-0">
        <SlidesColorPicker
          id={id}
          variant="plain"
          value={value}
          onChange={(hex) => {
            onChange(hex)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

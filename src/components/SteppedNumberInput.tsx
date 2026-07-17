import { Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Δ for +/- clicks: Ctrl 5, Shift 10, Ctrl+Shift 25; else `baseStep`. Meta counts as Ctrl (macOS). */
function steppedDeltaFromPointer(
  e: MouseEvent,
  baseStep: number,
): number {
  const ctrl = e.ctrlKey || e.metaKey
  if (ctrl && e.shiftKey) return 25
  if (e.shiftKey) return 10
  if (ctrl) return 5
  return baseStep
}

function parseRaw(
  raw: string,
  integerMode: boolean,
): number | null {
  if (raw === '') return null
  const n = integerMode
    ? Number.parseInt(raw, 10)
    : Number.parseFloat(raw)
  return Number.isNaN(n) ? null : n
}

export type SteppedNumberInputProps = {
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  step?: number
  /** When true, values are rounded with parseInt; otherwise parseFloat. */
  integerMode?: boolean
  id?: string
  'aria-label'?: string
  className?: string
  /** e.g. max-w-[12rem] on the bordered group */
  inputClassName?: string
  disabled?: boolean
}

export function SteppedNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  integerMode = true,
  id,
  'aria-label': ariaLabel,
  className,
  inputClassName,
  disabled = false,
}: SteppedNumberInputProps) {
  const [editingText, setEditingText] = useState<string | null>(null)
  const isFocusedRef = useRef(false)

  const clamp = (n: number) => {
    const x = integerMode ? Math.round(n) : n
    return Math.min(max, Math.max(min, x))
  }

  const displayValue = editingText ?? String(value)

  useEffect(() => {
    if (!isFocusedRef.current) {
      setEditingText(null)
    }
  }, [value])

  const handleFocus = () => {
    isFocusedRef.current = true
    setEditingText(String(value))
  }

  const handleBlur = () => {
    isFocusedRef.current = false
    if (editingText === null) return

    const n = parseRaw(editingText, integerMode)
    if (n !== null) {
      onChange(clamp(n))
    }
    setEditingText(null)
  }

  const handleInput = (raw: string) => {
    setEditingText(raw)
    if (raw === '') return
    const n = parseRaw(raw, integerMode)
    if (n === null) return
    onChange(clamp(n))
  }

  const handleStep = (delta: number) => {
    setEditingText(null)
    onChange(clamp(value + delta))
  }

  return (
    <div
      className={cn(
        'flex h-8 max-w-[12rem] items-stretch overflow-hidden rounded-lg border border-input bg-background shadow-sm',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        className="h-auto w-9 shrink-0 rounded-none rounded-l-lg border-0 border-r border-input"
        aria-label="Decrease value (Ctrl ±5, Shift ±10, Ctrl+Shift ±25)"
        onClick={(e) =>
          handleStep(-steppedDeltaFromPointer(e, step))
        }
      >
        <Minus className="size-3.5" aria-hidden />
      </Button>
      <Input
        id={id}
        type="text"
        inputMode={integerMode ? 'numeric' : 'decimal'}
        value={displayValue}
        disabled={disabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e) => handleInput(e.target.value)}
        className={cn(
          'h-8 min-w-0 flex-1 rounded-none border-0 text-center font-mono text-xs shadow-none focus-visible:z-10 focus-visible:ring-0 focus-visible:ring-offset-0',
          inputClassName,
        )}
        aria-label={ariaLabel}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        className="h-auto w-9 shrink-0 rounded-none rounded-r-lg border-0 border-l border-input"
        aria-label="Increase value (Ctrl ±5, Shift ±10, Ctrl+Shift ±25)"
        onClick={(e) =>
          handleStep(steppedDeltaFromPointer(e, step))
        }
      >
        <Plus className="size-3.5" aria-hidden />
      </Button>
    </div>
  )
}

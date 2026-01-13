import { useState, useRef, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface BackgroundColorPickerProps {
  value: string
  onChange: (value: string) => void
}

export function BackgroundColorPicker({
  value,
  onChange,
}: BackgroundColorPickerProps) {
  const [localValue, setLocalValue] = useState(value)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const rafRef = useRef<number | null>(null)

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Throttled update to parent
  const handleColorChange = (newValue: string) => {
    setLocalValue(newValue)

    // Cancel any pending updates
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    // Use requestAnimationFrame for smooth updates during drag
    rafRef.current = requestAnimationFrame(() => {
      // Then debounce with a small delay to batch rapid changes
      timeoutRef.current = setTimeout(() => {
        onChange(newValue)
      }, 50)
    })
  }

  // Update immediately on mouse up for color input
  const handleColorInputMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    const newValue = e.currentTarget.value
    setLocalValue(newValue)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    onChange(newValue)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Background Color:</Label>
      <div className="flex items-center gap-3">
        <Input
          type="color"
          value={localValue}
          onChange={(e) => handleColorChange(e.target.value)}
          onMouseUp={handleColorInputMouseUp}
          onPointerUp={handleColorInputMouseUp}
          className="h-10 w-20 cursor-pointer"
          aria-label="Background color picker"
        />
        <Input
          type="text"
          value={localValue}
          onChange={(e) => {
            const newValue = e.target.value
            setLocalValue(newValue)
            // Update immediately for text input (typing is less frequent)
            onChange(newValue)
          }}
          className="flex-1 font-mono text-xs"
          placeholder="#ffffff"
          pattern="^#[0-9A-Fa-f]{6}$"
          aria-label="Background color hex value"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        JPG format doesn't support transparency. Choose a background color to
        replace transparent areas.
      </p>
    </div>
  )
}

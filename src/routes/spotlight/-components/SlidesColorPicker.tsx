import { useEffect, useState } from 'react'
import { HexColorPicker } from 'react-colorful'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const HEX_RE = /^#[0-9A-Fa-f]{6}$/i

function normalizeHex(raw: string): string | null {
  const t = raw.trim()
  if (!HEX_RE.test(t)) return null
  return `#${t.slice(1).toLowerCase()}`
}

interface SlidesColorPickerProps {
  id?: string
  value: string
  onChange: (hex: string) => void
  /** `plain`: no outer card (e.g. inside a popover that already has a border). */
  variant?: 'default' | 'plain'
}

/**
 * Saturation/lightness field + hue strip (same interaction model as Google Slides
 * custom color), via react-colorful.
 */
export function SlidesColorPicker({
  id,
  value,
  onChange,
  variant = 'default',
}: SlidesColorPickerProps) {
  const [text, setText] = useState(value)

  useEffect(() => {
    setText(value)
  }, [value])

  const pickerColor = normalizeHex(text) ?? '#000000'
  const hexInputId = id ? `${id}-hex` : 'slides-color-hex'

  const shell =
    variant === 'plain'
      ? 'space-y-2 p-2'
      : 'space-y-2 rounded-md border border-border bg-popover p-2 shadow-sm'

  return (
    <div className={shell}>
      <HexColorPicker
        color={pickerColor}
        onChange={(hex) => {
          setText(hex)
          onChange(hex)
        }}
        className="w-full max-w-full shadow-none"
        style={{ width: '100%' }}
      />
      <div className="flex items-center gap-2">
        <Label htmlFor={hexInputId} className="text-xs shrink-0">
          Hex
        </Label>
        <Input
          id={hexInputId}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = normalizeHex(text) ?? pickerColor
            setText(n)
            onChange(n)
          }}
          className="h-8 flex-1 font-mono text-xs"
          placeholder="#000000"
          spellCheck={false}
        />
      </div>
    </div>
  )
}

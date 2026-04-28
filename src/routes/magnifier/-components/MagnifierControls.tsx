import type { ReactNode } from 'react'
import { ZoomIn } from 'lucide-react'

import { OutlineColorSwatchPopover } from '@/routes/spotlight/-components/OutlineColorSwatchPopover'
import { SteppedNumberInput } from '@/components/SteppedNumberInput'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { BackgroundColorPicker } from '@/routes/convert/-components/BackgroundColorPicker'
import type { MagnifierFrame } from '@/lib/image-magnifier'

export type MagnifierOutputFormat = 'jpg' | 'png' | 'webp'
export type MagnifierSelection = 'source' | 'inset'

function SegmentedTool<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; icon?: ReactNode }>
}) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <Label className="text-sm font-medium">{label}</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as T)}
        className="inline-flex w-full flex-wrap items-center gap-0.5 rounded-md border border-input bg-background p-0.5 shadow-sm"
        aria-label={label}
      >
        {options.map((opt) => {
          const isSelected = value === opt.value
          return (
            <label
              key={opt.value}
              htmlFor={`${label}-${opt.value}`}
              className={cn(
                'relative flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-2 text-xs font-medium',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
                isSelected && 'bg-accent text-accent-foreground shadow-sm',
              )}
            >
              <RadioGroupItem
                value={opt.value}
                id={`${label}-${opt.value}`}
                className="sr-only absolute"
              />
              {opt.icon}
              <span>{opt.label}</span>
            </label>
          )
        })}
      </RadioGroup>
    </div>
  )
}

interface MagnifierControlsProps {
  frame: MagnifierFrame | null
  editing: MagnifierSelection
  onEditingChange: (v: MagnifierSelection) => void

  outputFormat: MagnifierOutputFormat
  onOutputFormatChange: (v: MagnifierOutputFormat) => void
  jpgBackgroundColor: string
  onJpgBackgroundColorChange: (v: string) => void

  onFramePatch: (patch: Partial<MagnifierFrame>) => void
  onSourceOutlinePatch: (patch: Partial<MagnifierFrame['sourceOutline']>) => void
  onInsetOutlinePatch: (patch: Partial<MagnifierFrame['insetOutline']>) => void
  onConnectorPatch: (patch: Partial<MagnifierFrame['connector']>) => void
  onInsetBackgroundColorChange: (v: string) => void
}

export function MagnifierControls({
  frame,
  editing,
  onEditingChange,
  outputFormat,
  onOutputFormatChange,
  jpgBackgroundColor,
  onJpgBackgroundColorChange,
  onFramePatch,
  onSourceOutlinePatch,
  onInsetOutlinePatch,
  onConnectorPatch,
  onInsetBackgroundColorChange,
}: MagnifierControlsProps) {
  const canEditFrame = frame !== null

  const sourceOutline = frame?.sourceOutline ?? { color: '#2563eb', widthPx: 3 }
  const insetOutline = frame?.insetOutline ?? { color: '#2563eb', widthPx: 3 }
  const connector = frame?.connector ?? { enabled: true, color: '#2563eb', widthPx: 2 }
  const insetBg = frame?.insetBackgroundColor ?? '#111827'

  const outlineWidthMin = 1
  const outlineWidthMax = 32

  const connectorWidthMin = 1
  const connectorWidthMax = 32

  return (
    <div className="space-y-2">
      <SegmentedTool
        label="Editing"
        value={editing}
        onChange={onEditingChange}
        options={[
          { value: 'source', label: 'Source', icon: <ZoomIn className="size-3.5" aria-hidden /> },
          { value: 'inset', label: 'Inset', icon: <ZoomIn className="size-3.5" aria-hidden /> },
        ]}
      />

      <div className="mb-6 flex flex-col gap-3">
        <Label className="text-sm font-medium">Source outline</Label>
        <div className="flex h-8 min-h-8 max-w-full items-center gap-2">
          <OutlineColorSwatchPopover
            id="magnifier-source-outline"
            value={sourceOutline.color}
            onChange={(c) => onSourceOutlinePatch({ color: c })}
            swatchAriaLabel="Choose source outline color"
            disabled={!canEditFrame}
          />
          <SteppedNumberInput
            value={sourceOutline.widthPx}
            onChange={(w) => onSourceOutlinePatch({ widthPx: w })}
            min={outlineWidthMin}
            max={outlineWidthMax}
            step={1}
            aria-label="Source outline width in pixels"
            disabled={!canEditFrame}
            className="w-[min(100%,10rem)] shrink-0"
          />
          <span
            className={cn(
              'shrink-0 text-xs tabular-nums',
              canEditFrame ? 'text-muted-foreground' : 'text-muted-foreground/60',
            )}
          >
            px
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          The source rectangle selects what to zoom into the inset.
        </span>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <Label className="text-sm font-medium">Inset outline</Label>
        <div className="flex h-8 min-h-8 max-w-full items-center gap-2">
          <OutlineColorSwatchPopover
            id="magnifier-inset-outline"
            value={insetOutline.color}
            onChange={(c) => onInsetOutlinePatch({ color: c })}
            swatchAriaLabel="Choose inset outline color"
            disabled={!canEditFrame}
          />
          <SteppedNumberInput
            value={insetOutline.widthPx}
            onChange={(w) => onInsetOutlinePatch({ widthPx: w })}
            min={outlineWidthMin}
            max={outlineWidthMax}
            step={1}
            aria-label="Inset outline width in pixels"
            disabled={!canEditFrame}
            className="w-[min(100%,10rem)] shrink-0"
          />
          <span
            className={cn(
              'shrink-0 text-xs tabular-nums',
              canEditFrame ? 'text-muted-foreground' : 'text-muted-foreground/60',
            )}
          >
            px
          </span>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <Label className="text-sm font-medium">Connector</Label>
        <div className="flex h-8 min-h-8 max-w-full items-center gap-2">
          <Switch
            id="magnifier-connector-toggle"
            checked={connector.enabled}
            onCheckedChange={(on) => onConnectorPatch({ enabled: on })}
            disabled={!canEditFrame}
            className="shrink-0"
            aria-label="Show connector lines"
          />
          <OutlineColorSwatchPopover
            id="magnifier-connector-color"
            value={connector.color}
            onChange={(c) => onConnectorPatch({ color: c })}
            swatchAriaLabel="Choose connector line color"
            disabled={!canEditFrame || !connector.enabled}
          />
          <SteppedNumberInput
            value={connector.widthPx}
            onChange={(w) => onConnectorPatch({ widthPx: w })}
            min={connectorWidthMin}
            max={connectorWidthMax}
            step={1}
            aria-label="Connector line width in pixels"
            disabled={!canEditFrame || !connector.enabled}
            className="w-[min(100%,10rem)] shrink-0"
          />
          <span
            className={cn(
              'shrink-0 text-xs tabular-nums',
              canEditFrame && connector.enabled
                ? 'text-muted-foreground'
                : 'text-muted-foreground/60',
            )}
          >
            px
          </span>
        </div>
      </div>

      <BackgroundColorPicker
        value={insetBg}
        onChange={(v) => {
          onInsetBackgroundColorChange(v)
          onFramePatch({ insetBackgroundColor: v })
        }}
      />

      <div className="mb-6 flex flex-col gap-3">
        <Label className="text-sm font-medium">Output format</Label>
        <RadioGroup
          value={outputFormat}
          onValueChange={(v) => onOutputFormatChange(v as MagnifierOutputFormat)}
          className="inline-flex w-full flex-wrap items-center gap-0.5 rounded-md border border-input bg-background p-0.5 shadow-sm"
          aria-label="Export format"
        >
          {(['webp', 'png', 'jpg'] as const).map((fmt) => {
            const isSelected = outputFormat === fmt
            return (
              <label
                key={fmt}
                htmlFor={`magnifier-fmt-${fmt}`}
                className={cn(
                  'relative flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-sm px-2 text-xs font-medium',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
                  isSelected && 'bg-accent text-accent-foreground shadow-sm',
                )}
              >
                <RadioGroupItem
                  value={fmt}
                  id={`magnifier-fmt-${fmt}`}
                  className="sr-only absolute"
                />
                {fmt.toUpperCase()}
              </label>
            )
          })}
        </RadioGroup>
        <span className="text-sm text-muted-foreground">
          WEBP for smaller files, PNG for lossless, JPG for broad compatibility.
        </span>
      </div>

      {outputFormat === 'jpg' && (
        <BackgroundColorPicker
          value={jpgBackgroundColor}
          onChange={onJpgBackgroundColorChange}
        />
      )}
    </div>
  )
}


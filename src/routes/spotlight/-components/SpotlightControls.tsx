import { Circle, RotateCcw, Square } from 'lucide-react'
import { OutlineColorSwatchPopover } from './OutlineColorSwatchPopover'
import type { ReactNode } from 'react'
import type { SpotlightTool } from './SpotlightCanvas'
import type {
  SpotlightEffect,
  SpotlightFocusArea,
  SpotlightShape,
  SpotlightShapeFillStyle,
  SpotlightShapeOutlineStyle,
} from '@/lib/image-spotlight'
import {
  clampSpotlightFillOpacityPct,
  clampSpotlightOutlineWidthPx,
} from '@/lib/image-spotlight'
import { SteppedNumberInput } from '@/components/SteppedNumberInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { BackgroundColorPicker } from '@/routes/convert/-components/BackgroundColorPicker'


export type SpotlightOutputFormat = 'jpg' | 'png' | 'webp'

interface SpotlightControlsProps {
  tool: SpotlightTool
  onToolChange: (tool: SpotlightTool) => void
  effect: SpotlightEffect
  onEffectChange: (effect: SpotlightEffect) => void
  darkenStrength: number
  onDarkenStrengthChange: (v: number) => void
  blurStrength: number
  onBlurStrengthChange: (v: number) => void
  focusArea: SpotlightFocusArea
  onFocusAreaChange: (v: SpotlightFocusArea) => void
  outputFormat: SpotlightOutputFormat
  onOutputFormatChange: (v: SpotlightOutputFormat) => void
  jpgBackgroundColor: string
  onJpgBackgroundColorChange: (v: string) => void
  shapes: Array<SpotlightShape>
  selectedId: string | null
  attachOutlineToNewShapes: boolean
  onAttachOutlineToNewShapesChange: (v: boolean) => void
  defaultOutlineColor: string
  onDefaultOutlineColorChange: (v: string) => void
  defaultOutlineWidthPx: number
  onDefaultOutlineWidthChange: (v: number) => void
  onShapeOutlinePatch: (
    shapeId: string,
    patch: Partial<SpotlightShapeOutlineStyle>,
  ) => void
  onAddOutlineToShape: (shapeId: string) => void
  onRemoveOutlineFromShape: (shapeId: string) => void
  attachFillToNewShapes: boolean
  onAttachFillToNewShapesChange: (v: boolean) => void
  defaultFillColor: string
  onDefaultFillColorChange: (v: string) => void
  defaultFillOpacityPct: number
  onDefaultFillOpacityPctChange: (v: number) => void
  onShapeFillPatch: (
    shapeId: string,
    patch: Partial<SpotlightShapeFillStyle>,
  ) => void
  onAddFillToShape: (shapeId: string) => void
  onRemoveFillFromShape: (shapeId: string) => void
  onStrengthReset: () => void
}

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

export function SpotlightControls({
  tool,
  onToolChange,
  effect,
  onEffectChange,
  darkenStrength,
  onDarkenStrengthChange,
  blurStrength,
  onBlurStrengthChange,
  focusArea,
  onFocusAreaChange,
  outputFormat,
  onOutputFormatChange,
  jpgBackgroundColor,
  onJpgBackgroundColorChange,
  shapes,
  selectedId,
  attachOutlineToNewShapes,
  onAttachOutlineToNewShapesChange,
  defaultOutlineColor,
  onDefaultOutlineColorChange,
  defaultOutlineWidthPx,
  onDefaultOutlineWidthChange,
  onShapeOutlinePatch,
  onAddOutlineToShape,
  onRemoveOutlineFromShape,
  attachFillToNewShapes,
  onAttachFillToNewShapesChange,
  defaultFillColor,
  onDefaultFillColorChange,
  defaultFillOpacityPct,
  onDefaultFillOpacityPctChange,
  onShapeFillPatch,
  onAddFillToShape,
  onRemoveFillFromShape,
  onStrengthReset,
}: SpotlightControlsProps) {
  const strength =
    effect === 'darken' ? darkenStrength : blurStrength
  const onStrengthChange = effect === 'darken' ? onDarkenStrengthChange : onBlurStrengthChange
  const min = effect === 'darken' ? 0 : 0
  const max = effect === 'darken' ? 100 : 50
  const step = effect === 'darken' ? 1 : 1
  const suffix = effect === 'darken' ? '%' : 'px'

  const selectedShape =
    selectedId === null ? null : shapes.find((s) => s.id === selectedId) ?? null
  const editingSelected = selectedShape !== null

  const displayOutlineColor = editingSelected
    ? (selectedShape.outline?.color ?? defaultOutlineColor)
    : defaultOutlineColor

  const displayOutlineWidth = editingSelected
    ? clampSpotlightOutlineWidthPx(
        selectedShape.outline?.widthPx ?? defaultOutlineWidthPx,
      )
    : clampSpotlightOutlineWidthPx(defaultOutlineWidthPx)

  const setOutlineColor = (c: string) => {
    if (editingSelected) {
      onShapeOutlinePatch(selectedShape.id, { color: c })
    } else {
      onDefaultOutlineColorChange(c)
    }
  }

  const setOutlineWidth = (w: number) => {
    const cw = clampSpotlightOutlineWidthPx(w)
    if (editingSelected) {
      onShapeOutlinePatch(selectedShape.id, { widthPx: cw })
    } else {
      onDefaultOutlineWidthChange(cw)
    }
  }

  const outlineWidthMin = 1
  const outlineWidthMax = 32

  const outlineActive =
    selectedShape !== null
      ? !!selectedShape.outline
      : attachOutlineToNewShapes

  const handleOutlineSwitch = (on: boolean) => {
    if (selectedShape !== null) {
      if (on) onAddOutlineToShape(selectedShape.id)
      else onRemoveOutlineFromShape(selectedShape.id)
    } else {
      onAttachOutlineToNewShapesChange(on)
    }
  }

  const displayFillColor = editingSelected
    ? (selectedShape.fill?.color ?? defaultFillColor)
    : defaultFillColor

  const displayFillOpacity = editingSelected
    ? clampSpotlightFillOpacityPct(
        selectedShape.fill?.opacityPct ?? defaultFillOpacityPct,
      )
    : clampSpotlightFillOpacityPct(defaultFillOpacityPct)

  const setFillColor = (c: string) => {
    if (editingSelected) {
      onShapeFillPatch(selectedShape.id, { color: c })
    } else {
      onDefaultFillColorChange(c)
    }
  }

  const setFillOpacity = (v: number) => {
    const cv = clampSpotlightFillOpacityPct(v)
    if (editingSelected) {
      onShapeFillPatch(selectedShape.id, { opacityPct: cv })
    } else {
      onDefaultFillOpacityPctChange(cv)
    }
  }

  const fillActive =
    selectedShape !== null
      ? !!selectedShape.fill
      : attachFillToNewShapes

  const handleFillSwitch = (on: boolean) => {
    if (selectedShape !== null) {
      if (on) onAddFillToShape(selectedShape.id)
      else onRemoveFillFromShape(selectedShape.id)
    } else {
      onAttachFillToNewShapesChange(on)
    }
  }

  return (
    <div className="space-y-2">
      <SegmentedTool
        label="Tool"
        value={tool}
        onChange={onToolChange}
        options={[
          {
            value: 'rect',
            label: 'Rectangle',
            icon: <Square className="size-3.5 shrink-0" aria-hidden />,
          },
          {
            value: 'ellipse',
            label: 'Ellipse',
            icon: <Circle className="size-3.5 shrink-0" aria-hidden />,
          },
        ]}
      />

      <div className="mb-6 flex flex-col gap-3">
        <Label className="text-sm font-medium">Shape outline</Label>
        <div className="flex h-8 min-h-8 max-w-full items-center gap-2">
          <Switch
            id="spotlight-outline-toggle"
            checked={outlineActive}
            onCheckedChange={handleOutlineSwitch}
            className="shrink-0"
            aria-label={
              editingSelected
                ? 'Show outline on this shape'
                : 'Add outline to new shapes'
            }
          />
          <OutlineColorSwatchPopover
            id="spotlight-outline"
            value={displayOutlineColor}
            onChange={setOutlineColor}
            swatchAriaLabel="Choose outline color"
            disabled={!outlineActive}
          />
          <SteppedNumberInput
            value={displayOutlineWidth}
            onChange={setOutlineWidth}
            min={outlineWidthMin}
            max={outlineWidthMax}
            step={1}
            aria-label="Outline width in pixels"
            disabled={!outlineActive}
            className="w-[min(100%,10rem)] shrink-0"
          />
          <span
            className={cn(
              'shrink-0 text-xs tabular-nums',
              outlineActive
                ? 'text-muted-foreground'
                : 'text-muted-foreground/60',
            )}
          >
            px
          </span>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <Label className="text-sm font-medium">Shape fill</Label>
        <div className="flex h-8 min-h-8 max-w-full items-center gap-2">
          <Switch
            id="spotlight-fill-toggle"
            checked={fillActive}
            onCheckedChange={handleFillSwitch}
            className="shrink-0"
            aria-label={
              editingSelected
                ? 'Show fill on this shape'
                : 'Add fill to new shapes'
            }
          />
          <OutlineColorSwatchPopover
            id="spotlight-fill"
            value={displayFillColor}
            onChange={setFillColor}
            swatchAriaLabel="Choose fill color"
            disabled={!fillActive}
          />
          <SteppedNumberInput
            value={displayFillOpacity}
            onChange={setFillOpacity}
            min={0}
            max={100}
            step={1}
            aria-label="Fill opacity percent"
            disabled={!fillActive}
            className="w-[min(100%,10rem)] shrink-0"
          />
          <span
            className={cn(
              'shrink-0 text-xs tabular-nums',
              fillActive ? 'text-muted-foreground' : 'text-muted-foreground/60',
            )}
          >
            %
          </span>
        </div>
      </div>

      <SegmentedTool
        label="Effect"
        value={effect}
        onChange={onEffectChange}
        options={[
          { value: 'darken', label: 'Darken' },
          { value: 'blur', label: 'Blur' },
        ]}
      />

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium shrink-0">
            {effect === 'darken' ? 'Darken' : 'Blur'} strength:
          </Label>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SteppedNumberInput
              value={strength}
              onChange={onStrengthChange}
              min={min}
              max={max}
              step={step}
              aria-label={
                effect === 'darken'
                  ? 'Darken strength'
                  : 'Blur strength in pixels'
              }
              className="max-w-[11rem] flex-1 sm:max-w-[13rem]"
            />
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {suffix}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6 shrink-0"
              onClick={onStrengthReset}
              aria-label={
                effect === 'darken'
                  ? 'Reset darken strength to default (60%)'
                  : 'Reset blur strength to default (12 px)'
              }
            >
              <RotateCcw className="size-3" aria-hidden />
            </Button>
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={strength}
          onChange={(e) => onStrengthChange(Number(e.target.value))}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background',
            '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2',
            '[&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:shadow-sm',
            '[&::-moz-range-track]:bg-muted [&::-moz-range-track]:rounded-lg',
          )}
          aria-label="Effect strength slider"
        />
        <span className="text-xs text-muted-foreground">
          {effect === 'darken'
            ? 'How much the rest of the image is darkened (0–100%).'
            : 'Blur radius on the rest of the image (0–50 px).'}
        </span>
      </div>

      <SegmentedTool
        label="Focus"
        value={focusArea}
        onChange={onFocusAreaChange}
        options={[
          { value: 'inside', label: 'Inside shapes' },
          { value: 'outside', label: 'Outside shapes' },
        ]}
      />

      <div className="mb-6 flex flex-col gap-3">
        <Label className="text-sm font-medium">Output format</Label>
        <RadioGroup
          value={outputFormat}
          onValueChange={(v) => onOutputFormatChange(v as SpotlightOutputFormat)}
          className="inline-flex w-full flex-wrap items-center gap-0.5 rounded-md border border-input bg-background p-0.5 shadow-sm"
          aria-label="Export format"
        >
          {(['webp', 'png', 'jpg'] as const).map((fmt) => {
            const isSelected = outputFormat === fmt
            return (
              <label
                key={fmt}
                htmlFor={`spotlight-fmt-${fmt}`}
                className={cn(
                  'relative flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-sm px-2 text-xs font-medium',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
                  isSelected && 'bg-accent text-accent-foreground shadow-sm',
                )}
              >
                <RadioGroupItem
                  value={fmt}
                  id={`spotlight-fmt-${fmt}`}
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

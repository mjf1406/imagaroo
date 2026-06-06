import { CircleHelp } from 'lucide-react'

import type {
  LengthUnit,
  Orientation,
  PaperSize,
  PosterLayout,
  PrimaryAxis,
} from '@/lib/image-poster'
import {
  PAPER_SIZES_MM,
  displayToMm,
  mmToDisplay,
} from '@/lib/image-poster'
import { SteppedNumberInput } from '@/components/SteppedNumberInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface PosterControlsProps {
  paperSize: PaperSize
  onPaperSizeChange: (v: PaperSize) => void
  orientation: Orientation
  onOrientationChange: (v: Orientation) => void
  marginMm: number
  onMarginMmChange: (v: number) => void
  overlapMm: number
  onOverlapMmChange: (v: number) => void
  unit: LengthUnit
  onUnitChange: (v: LengthUnit) => void
  primaryAxis: PrimaryAxis
  sheetsWide: number
  sheetsTall: number
  onSheetsWideChange: (v: number) => void
  onSheetsTallChange: (v: number) => void
  layout: PosterLayout | null
  showCropMarks: boolean
  onShowCropMarksChange: (v: boolean) => void
  showPageCoords: boolean
  onShowPageCoordsChange: (v: boolean) => void
  onOptimum: () => void
  hasImage: boolean
}

function UnitToggle({
  unit,
  onUnitChange,
}: {
  unit: LengthUnit
  onUnitChange: (v: LengthUnit) => void
}) {
  return (
    <div className="flex rounded-lg border border-input overflow-hidden text-xs">
      <button
        type="button"
        className={cn(
          'px-2 py-1 transition-colors',
          unit === 'mm' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
        )}
        onClick={() => onUnitChange('mm')}
      >
        mm
      </button>
      <button
        type="button"
        className={cn(
          'px-2 py-1 transition-colors',
          unit === 'in' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
        )}
        onClick={() => onUnitChange('in')}
      >
        in
      </button>
    </div>
  )
}

export function PosterControls({
  paperSize,
  onPaperSizeChange,
  orientation,
  onOrientationChange,
  marginMm,
  onMarginMmChange,
  overlapMm,
  onOverlapMmChange,
  unit,
  onUnitChange,
  primaryAxis,
  sheetsWide,
  sheetsTall,
  onSheetsWideChange,
  onSheetsTallChange,
  layout,
  showCropMarks,
  onShowCropMarksChange,
  showPageCoords,
  onShowPageCoordsChange,
  onOptimum,
  hasImage,
}: PosterControlsProps) {
  const marginDisplay = mmToDisplay(marginMm, unit)
  const overlapDisplay = mmToDisplay(overlapMm, unit)
  const marginStep = unit === 'mm' ? 1 : 0.1
  const overlapStep = unit === 'mm' ? 1 : 0.05
  const marginMax = unit === 'mm' ? 50 : 2
  const overlapMax = unit === 'mm' ? 30 : 1.2

  const handleMarginDisplay = (v: number) => {
    onMarginMmChange(displayToMm(v, unit))
  }

  const handleOverlapDisplay = (v: number) => {
    onOverlapMmChange(displayToMm(v, unit))
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field>
          <FieldLabel>Paper size</FieldLabel>
          <Select
            value={paperSize}
            onValueChange={(v) => onPaperSizeChange(v as PaperSize)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PAPER_SIZES_MM) as Array<PaperSize>).map((key) => (
                <SelectItem key={key} value={key}>
                  {PAPER_SIZES_MM[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Orientation</FieldLabel>
          <RadioGroup
            value={orientation}
            onValueChange={(v) => onOrientationChange(v as Orientation)}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="portrait" id="poster-portrait" />
              <Label htmlFor="poster-portrait">Portrait</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="landscape" id="poster-landscape" />
              <Label htmlFor="poster-landscape">Landscape</Label>
            </div>
          </RadioGroup>
        </Field>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Spacing</span>
            <UnitToggle unit={unit} onUnitChange={onUnitChange} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Margin ({unit})</FieldLabel>
              <SteppedNumberInput
                value={marginDisplay}
                onChange={handleMarginDisplay}
                min={0}
                max={marginMax}
                step={marginStep}
                integerMode={unit === 'mm'}
                aria-label="Margin"
                className="max-w-none"
              />
            </Field>
            <Field>
              <FieldLabel>Overlap ({unit})</FieldLabel>
              <SteppedNumberInput
                value={overlapDisplay}
                onChange={handleOverlapDisplay}
                min={0}
                max={overlapMax}
                step={overlapStep}
                integerMode={unit === 'mm'}
                aria-label="Page overlap"
                className="max-w-none"
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-sm font-medium">Dimensions</span>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Sheets wide</FieldLabel>
              <SteppedNumberInput
                value={layout?.sheetsWide ?? sheetsWide}
                onChange={onSheetsWideChange}
                min={1}
                max={50}
                step={1}
                disabled={!hasImage}
                aria-label="Sheets wide"
                className="max-w-none"
              />
            </Field>
            <Field>
              <FieldLabel>Sheets tall</FieldLabel>
              <SteppedNumberInput
                value={layout?.sheetsTall ?? sheetsTall}
                onChange={onSheetsTallChange}
                min={1}
                max={50}
                step={1}
                disabled={!hasImage}
                aria-label="Sheets tall"
                className="max-w-none"
              />
            </Field>
          </div>
          {hasImage && (
            <p className="text-xs text-muted-foreground">
              {primaryAxis === 'wide'
                ? 'Sheets tall auto from aspect ratio'
                : 'Sheets wide auto from aspect ratio'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onOptimum}
            disabled={!hasImage}
          >
            Use optimum size
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label="About optimum size"
              >
                <CircleHelp className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sets the sheet count from your image&apos;s pixel dimensions,
                assuming a standard printer resolution of 300&nbsp;DPI. This
                picks the largest sharp poster size without unnecessary
                upscaling.
              </p>
            </PopoverContent>
          </Popover>
        </div>

        {layout && hasImage && (
          <p className="text-xs text-muted-foreground">
            Poster size: {layout.posterW.toFixed(0)} × {layout.posterH.toFixed(0)}{' '}
            mm ({layout.sheetsWide}×{layout.sheetsTall} pages)
          </p>
        )}

        <Field orientation="horizontal">
          <FieldLabel className="flex-1">Crop marks</FieldLabel>
          <Switch
            checked={showCropMarks}
            onCheckedChange={onShowCropMarksChange}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldLabel className="flex-1">Page coordinates</FieldLabel>
          <Switch
            checked={showPageCoords}
            onCheckedChange={onShowPageCoordsChange}
          />
        </Field>
      </CardContent>
    </Card>
  )
}

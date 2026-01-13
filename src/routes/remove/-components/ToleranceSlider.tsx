import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface ToleranceSliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

export function ToleranceSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: ToleranceSliderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Tolerance:</Label>
        <span className="text-sm text-muted-foreground font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
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
        aria-label="Tolerance slider"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Low ({min})</span>
        <span>High ({max})</span>
      </div>
      <span className="text-sm text-muted-foreground">
        Adjust sensitivity for background detection. Lower values are more
        selective, higher values remove more pixels.
      </span>
    </div>
  )
}

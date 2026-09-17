import type {
  BackgroundRemovalModelId,
  BackgroundRemovalProgress,
  DeviceCapabilities,
  LoadedRuntimeInfo,
  QualityAvailability,
} from '@/lib/background-removal'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import {
  BACKGROUND_REMOVAL_MODELS,
  describeBackend,
  formatDownloadSize,
  formatProgress,
} from '@/lib/background-removal'

interface ModelSelectorProps {
  value: BackgroundRemovalModelId
  onChange: (value: BackgroundRemovalModelId) => void
  qualityAvailability: QualityAvailability
  capabilities: DeviceCapabilities | null
  runtime: LoadedRuntimeInfo | null
  progress: BackgroundRemovalProgress | null
  error: string | null
}

export function ModelSelector({
  value,
  onChange,
  qualityAvailability,
  capabilities,
  runtime,
  progress,
  error,
}: ModelSelectorProps) {
  const qualityDisabled = !qualityAvailability.ok
  const backendLabel = runtime
    ? describeBackend(runtime.device)
    : capabilities == null
      ? 'Detecting'
      : capabilities.webgpu
        ? 'WebGPU'
        : 'WASM'

  return (
    <div className="mb-6 flex flex-col gap-3">
      <Label className="text-sm font-medium">Model</Label>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as BackgroundRemovalModelId)}
        aria-label="Background removal model"
        className="grid gap-2"
      >
        {(['standard', 'quality'] as const).map((modelId) => {
          const model = BACKGROUND_REMOVAL_MODELS[modelId]
          const disabled = modelId === 'quality' && qualityDisabled
          const selected = value === modelId
          return (
            <label
              key={modelId}
              htmlFor={`bg-model-${modelId}`}
              className={cn(
                'flex cursor-pointer flex-col gap-1 rounded-md border border-input p-3',
                selected && 'border-primary bg-accent/50',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value={modelId}
                    id={`bg-model-${modelId}`}
                    disabled={disabled}
                  />
                  <span className="text-sm font-medium">{model.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  ~{formatDownloadSize(model.downloadBytes)} first download
                </span>
              </div>
              <p className="pl-6 text-xs text-muted-foreground">
                {model.description}
              </p>
              {modelId === 'quality' && !qualityAvailability.ok && (
                <p className="pl-6 text-xs text-muted-foreground">
                  {qualityAvailability.reason}
                </p>
              )}
            </label>
          )
        })}
      </RadioGroup>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            runtime?.device === 'webgpu' || capabilities?.webgpu
              ? 'default'
              : 'secondary'
          }
          aria-label={`Acceleration: ${backendLabel}`}
        >
          {backendLabel}
        </Badge>
        {runtime?.usedFallback && (
          <Badge variant="outline">Fell back to WASM</Badge>
        )}
      </div>
      {progress && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {formatProgress(progress)}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Images stay on this device. Models download from Hugging Face and are
        cached in your browser.
      </p>
    </div>
  )
}

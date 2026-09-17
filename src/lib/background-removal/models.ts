import type {
  BackgroundRemovalModelId,
  DeviceCapabilities,
  MaskActivation,
  ModelLoadAttempt,
  QualityAvailability,
} from './types'

export type BackgroundRemovalModelDefinition = {
  id: BackgroundRemovalModelId
  hubId: string
  revision: string
  label: string
  description: string
  downloadBytes: number
  inputKey: 'input' | 'pixel_values' | 'input_image' | null
  outputActivation: MaskActivation
  config?: { model_type: string }
  modelFileName?: string
}

export const QUALITY_MIN_STORAGE_BUFFERS = 8
export const QUALITY_MIN_DEVICE_MEMORY_GIB = 4

export const BACKGROUND_REMOVAL_MODELS: Record<
  BackgroundRemovalModelId,
  BackgroundRemovalModelDefinition
> = {
  standard: {
    id: 'standard',
    hubId: 'briaai/RMBG-1.4',
    revision: '2ceba5a5efaec153162aedea169f76caf9b46cf8',
    label: 'Standard',
    description: 'Works on most devices. Uses RMBG-1.4.',
    downloadBytes: 44_400_000,
    inputKey: 'input',
    outputActivation: 'none',
    config: { model_type: 'custom' },
  },
  quality: {
    id: 'quality',
    hubId: 'jiabins0303/birefnet-lite-1024-webgpu',
    revision: 'dc4edd9f7623961aa5ae2b186c1b428f4ed38d6a',
    label: 'Quality',
    description: 'Sharper edges on capable GPUs. Uses BiRefNet.',
    downloadBytes: 114_834_127,
    inputKey: 'input_image',
    outputActivation: 'sigmoid',
    modelFileName: 'model_fp16',
  },
}

export function formatDownloadSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024)
  if (megabytes >= 100) {
    return `${Math.round(megabytes)} MB`
  }
  return `${megabytes.toFixed(0)} MB`
}

export function getStandardLoadPlan(
  capabilities: DeviceCapabilities,
): Array<ModelLoadAttempt> {
  const plan: Array<ModelLoadAttempt> = []
  if (capabilities.webgpu) {
    plan.push({
      device: 'webgpu',
      dtype: capabilities.fp16 ? 'fp16' : 'fp32',
    })
  }
  plan.push({ device: 'wasm', dtype: 'q8' })
  return plan
}

export function canRunQualityModel(
  capabilities: DeviceCapabilities,
): QualityAvailability {
  if (!capabilities.webgpu) {
    return { ok: false, reason: 'Quality needs WebGPU on this browser.' }
  }
  if (capabilities.isSoftwareRenderer) {
    return {
      ok: false,
      reason:
        'Quality needs a hardware GPU. This device is using software rendering.',
    }
  }
  if (
    capabilities.maxStorageBuffersPerShaderStage < QUALITY_MIN_STORAGE_BUFFERS
  ) {
    return {
      ok: false,
      reason: `Quality needs a GPU that supports at least ${QUALITY_MIN_STORAGE_BUFFERS} storage buffers per shader stage.`,
    }
  }
  if (
    capabilities.deviceMemoryGiB !== null &&
    capabilities.deviceMemoryGiB < QUALITY_MIN_DEVICE_MEMORY_GIB
  ) {
    return {
      ok: false,
      reason: `Quality needs about ${QUALITY_MIN_DEVICE_MEMORY_GIB} GB of device memory.`,
    }
  }
  return { ok: true }
}

export function getPreferredModelId(
  capabilities: DeviceCapabilities,
): BackgroundRemovalModelId {
  return canRunQualityModel(capabilities).ok ? 'quality' : 'standard'
}

export function getQualityLoadPlan(
  capabilities: DeviceCapabilities,
): Array<ModelLoadAttempt> {
  if (!canRunQualityModel(capabilities).ok) {
    return []
  }
  return [
    {
      device: 'webgpu',
      dtype: 'fp32',
      modelFileName: BACKGROUND_REMOVAL_MODELS.quality.modelFileName,
    },
  ]
}

export function getLoadPlan(
  modelId: BackgroundRemovalModelId,
  capabilities: DeviceCapabilities,
): Array<ModelLoadAttempt> {
  if (modelId === 'quality') {
    return getQualityLoadPlan(capabilities)
  }
  return getStandardLoadPlan(capabilities)
}

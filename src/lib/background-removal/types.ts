export const BACKGROUND_REMOVAL_MODEL_IDS = ['standard', 'quality'] as const

export type BackgroundRemovalModelId =
  (typeof BACKGROUND_REMOVAL_MODEL_IDS)[number]

export type InferenceDevice = 'webgpu' | 'wasm'
export type ModelDtype = 'fp16' | 'fp32' | 'q8'
export type MaskActivation = 'none' | 'sigmoid'

export type DeviceCapabilities = {
  webgpu: boolean
  fp16: boolean
  maxStorageBuffersPerShaderStage: number
  deviceMemoryGiB: number | null
  isSoftwareRenderer: boolean
  adapterDescription: string
}

export type QualityAvailability = { ok: true } | { ok: false; reason: string }

export type ModelLoadAttempt = {
  device: InferenceDevice
  dtype: ModelDtype
  modelFileName?: string
}

export type LoadedRuntimeInfo = {
  modelId: BackgroundRemovalModelId
  device: InferenceDevice
  dtype: ModelDtype
  usedFallback: boolean
}

export type BackgroundRemovalProgress =
  | { stage: 'download'; file: string; progress: number }
  | { stage: 'load' }
  | { stage: 'inference' }
  | { stage: 'composite' }

export type WorkerDetectRequest = {
  type: 'detect'
}

export type WorkerLoadRequest = {
  type: 'load'
  requestId: string
  modelId: BackgroundRemovalModelId
}

export type WorkerInferRequest = {
  type: 'infer'
  requestId: string
  modelId: BackgroundRemovalModelId
  bitmap: ImageBitmap
}

export type WorkerDisposeRequest = {
  type: 'dispose'
}

export type WorkerRequest =
  | WorkerDetectRequest
  | WorkerLoadRequest
  | WorkerInferRequest
  | WorkerDisposeRequest

export type WorkerCapabilitiesResponse = {
  type: 'capabilities'
  capabilities: DeviceCapabilities
}

export type WorkerProgressResponse = {
  type: 'progress'
  requestId: string
  progress: BackgroundRemovalProgress
}

export type WorkerReadyResponse = {
  type: 'ready'
  requestId: string
  runtime: LoadedRuntimeInfo
}

export type WorkerMaskResponse = {
  type: 'mask'
  requestId: string
  width: number
  height: number
  mask: ArrayBuffer
  runtime: LoadedRuntimeInfo
}

export type WorkerErrorResponse = {
  type: 'error'
  requestId: string | null
  message: string
}

export type WorkerResponse =
  | WorkerCapabilitiesResponse
  | WorkerProgressResponse
  | WorkerReadyResponse
  | WorkerMaskResponse
  | WorkerErrorResponse

export type RemoveBgOptions = {
  modelId?: BackgroundRemovalModelId
  onProgress?: (progress: BackgroundRemovalProgress) => void
  signal?: AbortSignal
}

export function isBackgroundRemovalModelId(
  value: string,
): value is BackgroundRemovalModelId {
  return (BACKGROUND_REMOVAL_MODEL_IDS as ReadonlyArray<string>).includes(value)
}

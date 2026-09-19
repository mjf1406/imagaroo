import {
  AutoImageProcessor,
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from '@huggingface/transformers'
import type { Tensor } from '@huggingface/transformers'

import type {
  BackgroundRemovalModelId,
  DeviceCapabilities,
  LoadedRuntimeInfo,
  ModelLoadAttempt,
  WorkerRequest,
  WorkerResponse,
} from '@/lib/background-removal/types'
import { detectCapabilities } from '@/lib/background-removal/capabilities'
import {
  BACKGROUND_REMOVAL_MODELS,
  getLoadPlan,
} from '@/lib/background-removal/models'
import {
  floatMaskToUint8,
  resizeGrayscaleMask,
  spatialDims,
} from '@/lib/background-removal/mask'
import { mapHubProgress } from '@/lib/background-removal/progress'

type HubProgressInfo = {
  status: string
  file?: string
  name?: string
  progress?: number
}

type WorkerScope = {
  postMessage: (message: WorkerResponse, transfer?: Array<Transferable>) => void
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<WorkerRequest>) => void,
  ) => void
}

type InferenceModel = {
  dispose: () => void
  (inputs: unknown): Promise<Record<string, Tensor>>
}

type ImageProcessorLike = {
  (image: RawImage): Promise<unknown>
}

type LoadedSession = {
  modelId: BackgroundRemovalModelId
  runtime: LoadedRuntimeInfo
  model: InferenceModel
  processor: ImageProcessorLike
}

const ctx = self as unknown as WorkerScope

env.allowLocalModels = false
env.useBrowserCache = true
env.useWasmCache = true
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1
  env.backends.onnx.wasm.proxy = false
  const onnxWebVersion = env.backends.onnx.versions?.web
  if (onnxWebVersion) {
    env.backends.onnx.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${onnxWebVersion}/dist/`
  }
}

let capabilitiesPromise: Promise<DeviceCapabilities> | null = null
let session: LoadedSession | null = null
let taskQueue: Promise<void> = Promise.resolve()

function post(message: WorkerResponse, transfer?: Array<Transferable>) {
  ctx.postMessage(message, transfer)
}

function getCapabilities(): Promise<DeviceCapabilities> {
  capabilitiesPromise ??= detectCapabilities()
  return capabilitiesPromise
}

function reportProgress(requestId: string, info: HubProgressInfo) {
  const progress = mapHubProgress(info)
  if (!progress) {
    return
  }
  post({ type: 'progress', requestId, progress })
}

function firstTensor(result: Record<string, Tensor>): Tensor {
  const preferred = ['output', 'logits', 'output_image', 'alpha']
  for (const key of preferred) {
    if (Object.hasOwn(result, key)) {
      return result[key]
    }
  }
  const values = Object.values(result)
  if (values.length === 0) {
    throw new Error('The model did not return a mask tensor')
  }
  return values[0]
}

async function loadWithAttempt(
  modelId: BackgroundRemovalModelId,
  attempt: ModelLoadAttempt,
  requestId: string,
) {
  const definition = BACKGROUND_REMOVAL_MODELS[modelId]
  const model = await AutoModel.from_pretrained(definition.hubId, {
    revision: definition.revision,
    device: attempt.device,
    dtype: attempt.dtype,
    model_file_name: attempt.modelFileName ?? definition.modelFileName,
    ...(definition.config ? { config: definition.config as never } : {}),
    progress_callback: (info) => {
      reportProgress(requestId, info)
    },
  })
  let processor: ImageProcessorLike
  try {
    processor = (await AutoProcessor.from_pretrained(definition.hubId, {
      revision: definition.revision,
      progress_callback: (info: HubProgressInfo) => {
        reportProgress(requestId, info)
      },
    })) as unknown as ImageProcessorLike
  } catch {
    processor = (await AutoImageProcessor.from_pretrained(definition.hubId, {
      revision: definition.revision,
      progress_callback: (info: HubProgressInfo) => {
        reportProgress(requestId, info)
      },
    })) as unknown as ImageProcessorLike
  }
  return {
    model: model as unknown as InferenceModel,
    processor,
  }
}

function disposeSession() {
  if (!session) {
    return
  }
  try {
    session.model.dispose()
  } catch {
    // The session may already be gone after a failed WebGPU run.
  }
  session = null
}

async function ensureSession(
  modelId: BackgroundRemovalModelId,
  requestId: string,
  skipDevices: Array<LoadedRuntimeInfo['device']> = [],
): Promise<LoadedSession> {
  if (
    session?.modelId === modelId &&
    !skipDevices.includes(session.runtime.device)
  ) {
    return session
  }

  disposeSession()
  const capabilities = await getCapabilities()
  const plan = getLoadPlan(modelId, capabilities).filter(
    (attempt) => !skipDevices.includes(attempt.device),
  )
  if (plan.length === 0) {
    throw new Error(
      modelId === 'quality'
        ? 'Quality is not available on this device.'
        : 'No compatible background-removal backend is available.',
    )
  }

  let lastError: unknown
  for (const [index, attempt] of plan.entries()) {
    try {
      post({ type: 'progress', requestId, progress: { stage: 'load' } })
      const loaded = await loadWithAttempt(modelId, attempt, requestId)
      session = {
        modelId,
        model: loaded.model,
        processor: loaded.processor,
        runtime: {
          modelId,
          device: attempt.device,
          dtype: attempt.dtype,
          usedFallback: index > 0 || skipDevices.length > 0,
        },
      }
      return session
    } catch (error) {
      lastError = error
      disposeSession()
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : 'Failed to load the model'
  throw new Error(message)
}

async function runModel(
  loaded: LoadedSession,
  image: RawImage,
): Promise<Record<string, Tensor>> {
  const definition = BACKGROUND_REMOVAL_MODELS[loaded.modelId]
  const inputs = await loaded.processor(image)
  const pixelValues =
    inputs && typeof inputs === 'object' && 'pixel_values' in inputs
      ? (inputs as { pixel_values: unknown }).pixel_values
      : undefined

  const payloads: Array<unknown> = definition.inputKey
    ? [{ [definition.inputKey]: pixelValues }, inputs]
    : [inputs, { input: pixelValues }, { input_image: pixelValues }]

  let lastError: unknown
  for (const payload of payloads) {
    try {
      return await loaded.model(payload)
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : ''
      if (!/Missing the following inputs/i.test(message)) {
        throw error
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('The model rejected the image inputs')
}

async function inferMask(
  requestId: string,
  modelId: BackgroundRemovalModelId,
  bitmap: ImageBitmap,
): Promise<{
  mask: Uint8Array
  width: number
  height: number
  runtime: LoadedRuntimeInfo
}> {
  const width = bitmap.width
  const height = bitmap.height
  let loaded = await ensureSession(modelId, requestId)
  const definition = BACKGROUND_REMOVAL_MODELS[modelId]

  post({ type: 'progress', requestId, progress: { stage: 'inference' } })

  const canvas = new OffscreenCanvas(width, height)
  const canvasCtx = canvas.getContext('2d')
  if (!canvasCtx) {
    throw new Error('Failed to get canvas context')
  }
  canvasCtx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const image = RawImage.fromCanvas(canvas).rgb()
  let result: Record<string, Tensor>
  try {
    result = await runModel(loaded, image)
  } catch (error) {
    if (loaded.runtime.device !== 'webgpu') {
      throw error
    }
    loaded = await ensureSession(modelId, requestId, ['webgpu'])
    result = await runModel(loaded, image)
  }

  const tensor = firstTensor(result)
  const activated =
    definition.outputActivation === 'sigmoid' ? tensor.sigmoid() : tensor
  const { width: sourceWidth, height: sourceHeight } = spatialDims(
    activated.dims,
  )
  const data = activated.data
  if (!data || typeof data === 'string') {
    throw new Error('Mask tensor data is not numeric')
  }
  const rawMask = floatMaskToUint8(data as ArrayLike<number>, 'none')
  const mask = resizeGrayscaleMask(
    rawMask,
    sourceWidth,
    sourceHeight,
    width,
    height,
  )

  tensor.dispose()
  if (activated !== tensor) {
    activated.dispose()
  }

  return {
    mask,
    width,
    height,
    runtime: loaded.runtime,
  }
}

async function handleRequest(request: WorkerRequest) {
  if (request.type === 'detect') {
    const capabilities = await getCapabilities()
    post({ type: 'capabilities', capabilities })
    return
  }

  if (request.type === 'dispose') {
    disposeSession()
    return
  }

  if (request.type === 'load') {
    try {
      const loaded = await ensureSession(request.modelId, request.requestId)
      post({
        type: 'ready',
        requestId: request.requestId,
        runtime: loaded.runtime,
      })
    } catch (error) {
      post({
        type: 'error',
        requestId: request.requestId,
        message:
          error instanceof Error ? error.message : 'Failed to load the model',
      })
    }
    return
  }

  try {
    const result = await inferMask(
      request.requestId,
      request.modelId,
      request.bitmap,
    )
    const copy = Uint8Array.from(result.mask)
    post(
      {
        type: 'mask',
        requestId: request.requestId,
        width: result.width,
        height: result.height,
        mask: copy.buffer,
        runtime: result.runtime,
      },
      [copy.buffer],
    )
  } catch (error) {
    try {
      request.bitmap.close()
    } catch {
      // The bitmap may already have been closed during inference.
    }
    post({
      type: 'error',
      requestId: request.requestId,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to remove the background',
    })
  }
}

ctx.addEventListener('message', (event) => {
  taskQueue = taskQueue
    .then(() => handleRequest(event.data))
    .catch((error: unknown) => {
      post({
        type: 'error',
        requestId: null,
        message:
          error instanceof Error
            ? error.message
            : 'Background removal worker failed',
      })
    })
})

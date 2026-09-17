import { createMaskCache, makeMaskCacheKey } from './cache'
import { applyAlphaMask, fileToImageData, imageDataToBlob } from './mask'
import type {
  BackgroundRemovalModelId,
  BackgroundRemovalProgress,
  DeviceCapabilities,
  LoadedRuntimeInfo,
  RemoveBgOptions,
  WorkerRequest,
  WorkerResponse,
} from './types'
import BackgroundRemovalWorker from '@/workers/background-removal.worker.ts?worker'

type PendingRequest = {
  resolve: (value: WorkerResponse) => void
  reject: (error: Error) => void
  onProgress?: (progress: BackgroundRemovalProgress) => void
}

export type WorkerLike = {
  postMessage: Worker['postMessage']
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<WorkerResponse>) => void,
  ) => void
  removeEventListener: (
    type: 'message',
    listener: (event: MessageEvent<WorkerResponse>) => void,
  ) => void
  terminate: () => void
}

export function isStaleRequest(
  requestId: string,
  pendingIds: Set<string>,
): boolean {
  return !pendingIds.has(requestId)
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export class BackgroundRemovalClient {
  private worker: WorkerLike
  private requestCount = 0
  private pending = new Map<string, PendingRequest>()
  private capabilitiesPromise: Promise<DeviceCapabilities>
  private capabilitiesResolve:
    | ((capabilities: DeviceCapabilities) => void)
    | null = null
  private capabilitiesReject: ((error: Error) => void) | null = null
  private runtime: LoadedRuntimeInfo | null = null
  private loadPromise: Promise<LoadedRuntimeInfo> | null = null
  private loadModelId: BackgroundRemovalModelId | null = null
  private maskCache = createMaskCache(4)
  private disposed = false
  private readonly handleMessage = (event: MessageEvent<WorkerResponse>) => {
    this.onMessage(event.data)
  }

  constructor(
    workerFactory: () => WorkerLike = () => new BackgroundRemovalWorker(),
  ) {
    this.worker = workerFactory()
    this.worker.addEventListener('message', this.handleMessage)
    this.capabilitiesPromise = new Promise((resolve, reject) => {
      this.capabilitiesResolve = resolve
      this.capabilitiesReject = reject
    })
    this.worker.postMessage({ type: 'detect' })
  }

  private nextRequestId(): string {
    this.requestCount += 1
    return `bg-${this.requestCount}`
  }

  private onMessage(message: WorkerResponse) {
    if (message.type === 'capabilities') {
      this.capabilitiesResolve?.(message.capabilities)
      this.capabilitiesResolve = null
      this.capabilitiesReject = null
      return
    }

    if (message.type === 'error' && message.requestId === null) {
      this.capabilitiesReject?.(new Error(message.message))
      for (const pending of this.pending.values()) {
        pending.reject(new Error(message.message))
      }
      this.pending.clear()
      return
    }

    if (!('requestId' in message) || message.requestId === null) {
      return
    }

    const pending = this.pending.get(message.requestId)
    if (!pending) {
      return
    }

    if (message.type === 'progress') {
      pending.onProgress?.(message.progress)
      return
    }

    this.pending.delete(message.requestId)
    if (message.type === 'error') {
      pending.reject(new Error(message.message))
      return
    }

    pending.resolve(message)
  }

  private send(request: WorkerRequest, transfer?: Array<Transferable>): void {
    if (this.disposed) {
      throw new Error('Background removal client has been disposed')
    }
    if (transfer && transfer.length > 0) {
      this.worker.postMessage(request, transfer)
    } else {
      this.worker.postMessage(request)
    }
  }

  private waitFor(
    requestId: string,
    onProgress?: (progress: BackgroundRemovalProgress) => void,
    signal?: AbortSignal,
  ): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      const pending: PendingRequest = { resolve, reject, onProgress }
      this.pending.set(requestId, pending)

      const onAbort = () => {
        if (!this.pending.has(requestId)) {
          return
        }
        this.pending.delete(requestId)
        reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
      }

      if (signal?.aborted) {
        onAbort()
        return
      }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    return this.capabilitiesPromise
  }

  async ensureModel(
    modelId: BackgroundRemovalModelId,
    onProgress?: (progress: BackgroundRemovalProgress) => void,
    signal?: AbortSignal,
  ): Promise<LoadedRuntimeInfo> {
    if (this.runtime?.modelId === modelId && this.loadPromise) {
      return this.loadPromise
    }
    if (this.loadPromise && this.loadModelId === modelId) {
      return this.loadPromise
    }

    const requestId = this.nextRequestId()
    this.loadModelId = modelId
    this.loadPromise = (async () => {
      this.send({ type: 'load', requestId, modelId })
      const response = await this.waitFor(requestId, onProgress, signal)
      if (response.type !== 'ready') {
        throw new Error('Unexpected worker response while loading the model')
      }
      if (this.loadModelId === modelId) {
        this.runtime = response.runtime
      }
      return response.runtime
    })()

    try {
      return await this.loadPromise
    } catch (error) {
      if (this.loadModelId === modelId) {
        this.loadPromise = null
        this.loadModelId = null
        this.runtime = null
      }
      throw error
    }
  }

  private async inferMask(
    file: File,
    modelId: BackgroundRemovalModelId,
    onProgress?: (progress: BackgroundRemovalProgress) => void,
    signal?: AbortSignal,
  ) {
    const cacheKey = makeMaskCacheKey(file, modelId)
    const cached = this.maskCache.get(cacheKey)
    if (cached) {
      return cached
    }

    await this.ensureModel(modelId, onProgress, signal)
    const bitmap = await createImageBitmap(file)
    const requestId = this.nextRequestId()
    this.send(
      {
        type: 'infer',
        requestId,
        modelId,
        bitmap,
      },
      [bitmap],
    )

    const response = await this.waitFor(requestId, onProgress, signal)
    if (response.type !== 'mask') {
      throw new Error('Unexpected worker response during inference')
    }

    const cachedMask = {
      width: response.width,
      height: response.height,
      mask: new Uint8Array(response.mask),
    }
    this.maskCache.set(cacheKey, cachedMask)
    this.runtime = response.runtime
    return cachedMask
  }

  async removeBackground(
    file: File,
    outputFormat: 'png' | 'webp' = 'png',
    options: RemoveBgOptions = {},
  ): Promise<Blob> {
    const modelId = options.modelId ?? 'standard'
    try {
      const cachedMask = await this.inferMask(
        file,
        modelId,
        options.onProgress,
        options.signal,
      )
      options.onProgress?.({ stage: 'composite' })
      const imageData = await fileToImageData(file)
      const masked = applyAlphaMask(imageData, cachedMask.mask)
      return await imageDataToBlob(masked, outputFormat)
    } catch (error) {
      if (isAbortError(error) || options.signal?.aborted) {
        throw error
      }
      throw error
    }
  }

  getRuntime(): LoadedRuntimeInfo | null {
    return this.runtime
  }

  dispose() {
    if (this.disposed) {
      return
    }
    this.disposed = true
    for (const pending of this.pending.values()) {
      pending.reject(new DOMException('Aborted', 'AbortError'))
    }
    this.pending.clear()
    this.maskCache.clear()
    this.worker.postMessage({ type: 'dispose' })
    this.worker.removeEventListener('message', this.handleMessage)
    this.worker.terminate()
  }
}

let singleton: BackgroundRemovalClient | null = null

export function getBackgroundRemovalClient(): BackgroundRemovalClient {
  singleton ??= new BackgroundRemovalClient()
  return singleton
}

export function resetBackgroundRemovalClient() {
  singleton?.dispose()
  singleton = null
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    resetBackgroundRemovalClient()
  })
}

import { describe, expect, it, vi } from 'vite-plus/test'

import { formatProgress, mapHubProgress } from './progress'
import { BackgroundRemovalClient, isStaleRequest } from './client'
import type { WorkerLike } from './client'
import type { WorkerRequest, WorkerResponse } from './types'

vi.mock('@/workers/background-removal.worker.ts?worker', () => ({
  default: class {
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    terminate() {}
  },
}))

describe('mapHubProgress', () => {
  it('maps download totals', () => {
    expect(
      mapHubProgress({
        status: 'progress_total',
        name: 'briaai/RMBG-1.4',
        progress: 42,
      }),
    ).toEqual({
      stage: 'download',
      file: 'briaai/RMBG-1.4',
      progress: 42,
    })
  })

  it('maps load lifecycle events', () => {
    expect(mapHubProgress({ status: 'ready' })).toEqual({ stage: 'load' })
  })
})

describe('formatProgress', () => {
  it('includes a percent for downloads', () => {
    expect(
      formatProgress({ stage: 'download', file: 'model.onnx', progress: 12.2 }),
    ).toBe('Downloading model.onnx (12%)')
  })
})

describe('isStaleRequest', () => {
  it('treats unknown ids as stale', () => {
    expect(isStaleRequest('bg-1', new Set(['bg-2']))).toBe(true)
    expect(isStaleRequest('bg-2', new Set(['bg-2']))).toBe(false)
  })
})

describe('BackgroundRemovalClient', () => {
  it('ignores stale worker results after abort', async () => {
    const listeners = new Set<(event: MessageEvent<WorkerResponse>) => void>()
    const infer = { requestId: '' }
    const worker: WorkerLike = {
      postMessage(message: WorkerRequest) {
        if (message.type === 'detect') {
          queueMicrotask(() => {
            listeners.forEach((listener) =>
              listener({
                data: {
                  type: 'capabilities',
                  capabilities: {
                    webgpu: true,
                    fp16: true,
                    maxStorageBuffersPerShaderStage: 16,
                    deviceMemoryGiB: 8,
                    isSoftwareRenderer: false,
                    adapterDescription: 'test',
                  },
                },
              } as MessageEvent<WorkerResponse>),
            )
          })
        }
        if (message.type === 'load') {
          queueMicrotask(() => {
            listeners.forEach((listener) =>
              listener({
                data: {
                  type: 'ready',
                  requestId: message.requestId,
                  runtime: {
                    modelId: 'standard',
                    device: 'webgpu',
                    dtype: 'fp16',
                    usedFallback: false,
                  },
                },
              } as MessageEvent<WorkerResponse>),
            )
          })
        }
        if (message.type === 'infer') {
          infer.requestId = message.requestId
        }
      },
      addEventListener(_type, listener) {
        listeners.add(listener)
      },
      removeEventListener(_type, listener) {
        listeners.delete(listener)
      },
      terminate() {},
    }

    const client = new BackgroundRemovalClient(() => worker)
    await client.getCapabilities()
    await client.ensureModel('standard')

    const originalCreateImageBitmap = globalThis.createImageBitmap
    globalThis.createImageBitmap = () =>
      Promise.resolve({
        width: 1,
        height: 1,
        close() {},
      } as ImageBitmap)

    const abortController = new AbortController()
    const inferPromise = client.removeBackground(
      new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }),
      'png',
      { signal: abortController.signal },
    )

    for (let i = 0; i < 20 && infer.requestId === ''; i++) {
      await Promise.resolve()
    }
    abortController.abort()
    await expect(inferPromise).rejects.toMatchObject({ name: 'AbortError' })

    expect(infer.requestId).not.toBe('')
    listeners.forEach((listener) =>
      listener({
        data: {
          type: 'mask',
          requestId: infer.requestId,
          width: 1,
          height: 1,
          mask: new Uint8Array([255]).buffer,
          runtime: {
            modelId: 'standard',
            device: 'webgpu',
            dtype: 'fp16',
            usedFallback: false,
          },
        },
      } as MessageEvent<WorkerResponse>),
    )

    globalThis.createImageBitmap = originalCreateImageBitmap
    client.dispose()
  })
})

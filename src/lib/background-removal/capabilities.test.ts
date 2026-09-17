import { describe, expect, it } from 'vite-plus/test'

import { detectCapabilities } from './capabilities'

describe('detectCapabilities', () => {
  it('reports no WebGPU when the GPU API is missing', async () => {
    const result = await detectCapabilities({ deviceMemory: 8 })
    expect(result).toEqual({
      webgpu: false,
      fp16: false,
      maxStorageBuffersPerShaderStage: 0,
      deviceMemoryGiB: 8,
      isSoftwareRenderer: false,
      adapterDescription: '',
    })
  })

  it('reads adapter limits and fp16 support', async () => {
    const result = await detectCapabilities({
      deviceMemory: 4,
      gpu: {
        requestAdapter: () =>
          Promise.resolve({
            features: {
              has: (feature: string): boolean => feature === 'shader-f16',
            },
            limits: { maxStorageBuffersPerShaderStage: 12 },
            info: {
              vendor: 'apple',
              architecture: 'metal',
              device: 'apple m-series',
            },
          }),
      },
    })

    expect(result.webgpu).toBe(true)
    expect(result.fp16).toBe(true)
    expect(result.maxStorageBuffersPerShaderStage).toBe(12)
    expect(result.isSoftwareRenderer).toBe(false)
  })

  it('treats SwiftShader as software rendering', async () => {
    const result = await detectCapabilities({
      gpu: {
        requestAdapter: () =>
          Promise.resolve({
            features: { has: (): boolean => false },
            limits: { maxStorageBuffersPerShaderStage: 16 },
            info: { vendor: 'google', device: 'SwiftShader' },
          }),
      },
    })

    expect(result.webgpu).toBe(false)
    expect(result.isSoftwareRenderer).toBe(true)
  })
})

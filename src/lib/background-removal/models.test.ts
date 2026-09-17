import { describe, expect, it } from 'vite-plus/test'

import {
  canRunQualityModel,
  getPreferredModelId,
  getQualityLoadPlan,
  getStandardLoadPlan,
} from './models'
import type { DeviceCapabilities } from './types'

function capabilities(
  overrides: Partial<DeviceCapabilities> = {},
): DeviceCapabilities {
  return {
    webgpu: true,
    fp16: true,
    maxStorageBuffersPerShaderStage: 16,
    deviceMemoryGiB: 8,
    isSoftwareRenderer: false,
    adapterDescription: 'nvidia',
    ...overrides,
  }
}

describe('getStandardLoadPlan', () => {
  it('prefers WebGPU fp16 then quantized WASM', () => {
    expect(getStandardLoadPlan(capabilities())).toEqual([
      { device: 'webgpu', dtype: 'fp16' },
      { device: 'wasm', dtype: 'q8' },
    ])
  })

  it('uses WebGPU fp32 when fp16 is unavailable', () => {
    expect(getStandardLoadPlan(capabilities({ fp16: false }))).toEqual([
      { device: 'webgpu', dtype: 'fp32' },
      { device: 'wasm', dtype: 'q8' },
    ])
  })

  it('uses quantized WASM only without WebGPU', () => {
    expect(
      getStandardLoadPlan(capabilities({ webgpu: false, fp16: false })),
    ).toEqual([{ device: 'wasm', dtype: 'q8' }])
  })
})

describe('canRunQualityModel', () => {
  it('allows Quality on a capable WebGPU adapter', () => {
    expect(canRunQualityModel(capabilities())).toEqual({ ok: true })
    expect(getQualityLoadPlan(capabilities())).toEqual([
      {
        device: 'webgpu',
        dtype: 'fp32',
        modelFileName: 'model_fp16',
      },
    ])
  })

  it('rejects missing WebGPU', () => {
    expect(canRunQualityModel(capabilities({ webgpu: false }))).toEqual({
      ok: false,
      reason: 'Quality needs WebGPU on this browser.',
    })
  })

  it('rejects software renderers', () => {
    expect(
      canRunQualityModel(capabilities({ isSoftwareRenderer: true })),
    ).toEqual({
      ok: false,
      reason:
        'Quality needs a hardware GPU. This device is using software rendering.',
    })
  })

  it('rejects low storage buffer limits', () => {
    expect(
      canRunQualityModel(capabilities({ maxStorageBuffersPerShaderStage: 4 })),
    ).toMatchObject({ ok: false })
  })

  it('rejects low device memory when reported', () => {
    expect(
      canRunQualityModel(capabilities({ deviceMemoryGiB: 2 })),
    ).toMatchObject({ ok: false })
  })

  it('ignores missing deviceMemory', () => {
    expect(canRunQualityModel(capabilities({ deviceMemoryGiB: null }))).toEqual(
      { ok: true },
    )
  })
})

describe('getPreferredModelId', () => {
  it('selects Quality when WebGPU can run it', () => {
    expect(getPreferredModelId(capabilities())).toBe('quality')
  })

  it('selects Standard without WebGPU', () => {
    expect(getPreferredModelId(capabilities({ webgpu: false }))).toBe(
      'standard',
    )
  })

  it('selects Standard when Quality is blocked for other GPU limits', () => {
    expect(getPreferredModelId(capabilities({ deviceMemoryGiB: 2 }))).toBe(
      'standard',
    )
  })
})

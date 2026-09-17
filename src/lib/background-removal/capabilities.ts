import type { DeviceCapabilities } from './types'

const SOFTWARE_RENDERER_PATTERN =
  /swiftshader|llvmpipe|softpipe|microsoft basic render|cpu adapter/i

type AdapterInfoLike = {
  vendor?: string
  architecture?: string
  device?: string
  description?: string
}

type AdapterLike = {
  features: { has: (feature: string) => boolean }
  limits: { maxStorageBuffersPerShaderStage: number }
  info?: AdapterInfoLike
  requestAdapterInfo?: () => Promise<AdapterInfoLike>
}

type NavigatorLike = {
  gpu?: {
    requestAdapter: (options?: {
      powerPreference?: 'low-power' | 'high-performance'
    }) => Promise<AdapterLike | null>
  }
  deviceMemory?: number
}

function describeAdapter(info: AdapterInfoLike | undefined): string {
  if (!info) {
    return ''
  }
  return [info.vendor, info.architecture, info.device, info.description]
    .filter((part): part is string => Boolean(part))
    .join(' ')
}

async function readAdapterInfo(
  adapter: AdapterLike,
): Promise<AdapterInfoLike | undefined> {
  if (adapter.info) {
    return adapter.info
  }
  if (typeof adapter.requestAdapterInfo === 'function') {
    try {
      return await adapter.requestAdapterInfo()
    } catch {
      return undefined
    }
  }
  return undefined
}

export async function detectCapabilities(
  navigatorLike: NavigatorLike = globalThis.navigator,
): Promise<DeviceCapabilities> {
  const deviceMemoryGiB =
    typeof navigatorLike.deviceMemory === 'number'
      ? navigatorLike.deviceMemory
      : null

  const gpu = navigatorLike.gpu
  if (!gpu) {
    return {
      webgpu: false,
      fp16: false,
      maxStorageBuffersPerShaderStage: 0,
      deviceMemoryGiB,
      isSoftwareRenderer: false,
      adapterDescription: '',
    }
  }

  try {
    const adapter = await gpu.requestAdapter({
      powerPreference: 'high-performance',
    })
    if (!adapter) {
      return {
        webgpu: false,
        fp16: false,
        maxStorageBuffersPerShaderStage: 0,
        deviceMemoryGiB,
        isSoftwareRenderer: false,
        adapterDescription: '',
      }
    }

    const info = await readAdapterInfo(adapter)
    const adapterDescription = describeAdapter(info)
    const isSoftwareRenderer =
      SOFTWARE_RENDERER_PATTERN.test(adapterDescription)

    return {
      webgpu: !isSoftwareRenderer,
      fp16: adapter.features.has('shader-f16'),
      maxStorageBuffersPerShaderStage:
        adapter.limits.maxStorageBuffersPerShaderStage,
      deviceMemoryGiB,
      isSoftwareRenderer,
      adapterDescription,
    }
  } catch {
    return {
      webgpu: false,
      fp16: false,
      maxStorageBuffersPerShaderStage: 0,
      deviceMemoryGiB,
      isSoftwareRenderer: false,
      adapterDescription: '',
    }
  }
}

export function describeBackend(device: 'webgpu' | 'wasm'): string {
  return device === 'webgpu' ? 'WebGPU' : 'WASM'
}

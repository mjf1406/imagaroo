interface GPUAdapterLimits {
  maxStorageBuffersPerShaderStage: number
}

interface GPUSupportedFeatures {
  has: (feature: string) => boolean
}

interface GPUAdapterInfo {
  vendor?: string
  architecture?: string
  device?: string
  description?: string
}

interface GPUAdapter {
  readonly features: GPUSupportedFeatures
  readonly limits: GPUAdapterLimits
  readonly info?: GPUAdapterInfo
  requestAdapterInfo?: () => Promise<GPUAdapterInfo>
}

interface GPU {
  requestAdapter: (options?: {
    powerPreference?: 'low-power' | 'high-performance'
  }) => Promise<GPUAdapter | null>
}

interface Navigator {
  readonly gpu?: GPU
  readonly deviceMemory?: number
}

interface WorkerNavigator {
  readonly gpu?: GPU
  readonly deviceMemory?: number
}

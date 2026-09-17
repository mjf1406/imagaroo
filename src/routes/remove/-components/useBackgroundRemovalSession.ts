import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  BackgroundRemovalModelId,
  BackgroundRemovalProgress,
  DeviceCapabilities,
  LoadedRuntimeInfo,
  QualityAvailability,
} from '@/lib/background-removal'
import {
  canRunQualityModel,
  getBackgroundRemovalClient,
  getPreferredModelId,
} from '@/lib/background-removal'

export function useBackgroundRemovalSession(enabled: boolean) {
  const [modelId, setModelIdState] =
    useState<BackgroundRemovalModelId>('standard')
  const userSelectedModelRef = useRef(false)
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(
    null,
  )
  const [runtime, setRuntime] = useState<LoadedRuntimeInfo | null>(null)
  const [progress, setProgress] = useState<BackgroundRemovalProgress | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const setModelId = useCallback((next: BackgroundRemovalModelId) => {
    userSelectedModelRef.current = true
    setModelIdState(next)
  }, [])

  useEffect(() => {
    const client = getBackgroundRemovalClient()
    let cancelled = false
    client
      .getCapabilities()
      .then((detected) => {
        if (cancelled) {
          return
        }
        setCapabilities(detected)
        if (!userSelectedModelRef.current) {
          setModelIdState(getPreferredModelId(detected))
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Could not check this device',
          )
          setCapabilities({
            webgpu: false,
            fp16: false,
            maxStorageBuffersPerShaderStage: 0,
            deviceMemoryGiB: null,
            isSoftwareRenderer: false,
            adapterDescription: '',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const qualityAvailability: QualityAvailability = capabilities
    ? canRunQualityModel(capabilities)
    : { ok: false, reason: 'Checking whether this device can run Quality.' }

  useEffect(() => {
    if (!qualityAvailability.ok && modelId === 'quality') {
      setModelIdState('standard')
    }
  }, [modelId, qualityAvailability.ok])

  useEffect(() => {
    if (!enabled || capabilities == null) {
      return
    }
    const client = getBackgroundRemovalClient()
    let cancelled = false
    setError(null)
    setProgress({ stage: 'load' })
    client
      .ensureModel(modelId, (nextProgress) => {
        if (!cancelled) {
          setProgress(nextProgress)
        }
      })
      .then((loaded) => {
        if (!cancelled) {
          setRuntime(loaded)
          setProgress(null)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setRuntime(null)
          setProgress(null)
          if (
            !(caught instanceof DOMException && caught.name === 'AbortError')
          ) {
            setError(
              caught instanceof Error
                ? caught.message
                : 'Could not load the background removal model',
            )
          }
        }
      })
    return () => {
      cancelled = true
    }
  }, [capabilities, enabled, modelId])

  return {
    modelId,
    setModelId,
    capabilities,
    qualityAvailability,
    runtime,
    progress,
    error,
    setProgress,
  }
}

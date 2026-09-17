export type CachedMask = {
  width: number
  height: number
  mask: Uint8Array
}

export function makeMaskCacheKey(file: File, modelId: string): string {
  return `${modelId}:${file.name}:${file.size}:${file.lastModified}`
}

export function createMaskCache(maxEntries = 4) {
  const entries = new Map<string, CachedMask>()

  return {
    get(key: string): CachedMask | undefined {
      const value = entries.get(key)
      if (!value) {
        return undefined
      }
      entries.delete(key)
      entries.set(key, value)
      return value
    },
    set(key: string, value: CachedMask): void {
      if (entries.has(key)) {
        entries.delete(key)
      }
      entries.set(key, value)
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value
        if (oldest === undefined) {
          break
        }
        entries.delete(oldest)
      }
    },
    clear(): void {
      entries.clear()
    },
    get size(): number {
      return entries.size
    },
  }
}

export type MaskCache = ReturnType<typeof createMaskCache>

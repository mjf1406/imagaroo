import { describe, expect, it } from 'vite-plus/test'

import { createMaskCache, makeMaskCacheKey } from './cache'

describe('createMaskCache', () => {
  it('evicts the oldest entry when full', () => {
    const cache = createMaskCache(2)
    cache.set('a', { width: 1, height: 1, mask: new Uint8Array([1]) })
    cache.set('b', { width: 1, height: 1, mask: new Uint8Array([2]) })
    cache.set('c', { width: 1, height: 1, mask: new Uint8Array([3]) })

    expect(cache.size).toBe(2)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('c')?.mask[0]).toBe(3)
  })

  it('refreshes recency on get', () => {
    const cache = createMaskCache(2)
    cache.set('a', { width: 1, height: 1, mask: new Uint8Array([1]) })
    cache.set('b', { width: 1, height: 1, mask: new Uint8Array([2]) })
    cache.get('a')
    cache.set('c', { width: 1, height: 1, mask: new Uint8Array([3]) })

    expect(cache.get('a')?.mask[0]).toBe(1)
    expect(cache.get('b')).toBeUndefined()
  })
})

describe('makeMaskCacheKey', () => {
  it('includes the model and file identity', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.png', {
      type: 'image/png',
      lastModified: 123,
    })
    expect(makeMaskCacheKey(file, 'standard')).toBe(
      `standard:photo.png:${file.size}:123`,
    )
  })
})

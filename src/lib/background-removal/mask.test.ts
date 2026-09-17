import { describe, expect, it } from 'vite-plus/test'

import { applyAlphaMask, floatMaskToUint8, spatialDims } from './mask'

class TestImageData {
  readonly colorSpace = 'srgb' as const
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number

  constructor(
    dataOrWidth: Uint8ClampedArray | number,
    widthOrHeight: number,
    height?: number,
  ) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth
      this.height = widthOrHeight
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
      return
    }
    this.data = dataOrWidth
    this.width = widthOrHeight
    this.height = height ?? dataOrWidth.length / (widthOrHeight * 4)
  }
}

globalThis.ImageData = TestImageData as unknown as typeof ImageData

describe('spatialDims', () => {
  it('reads the last two dimensions', () => {
    expect(spatialDims([1, 1, 1024, 768])).toEqual({
      height: 1024,
      width: 768,
    })
  })

  it('rejects tensors without spatial dims', () => {
    expect(() => spatialDims([8])).toThrow(/at least 2 dimensions/)
  })
})

describe('floatMaskToUint8', () => {
  it('scales 0-1 values', () => {
    expect(Array.from(floatMaskToUint8([0, 0.5, 1], 'none'))).toEqual([
      0, 128, 255,
    ])
  })

  it('applies sigmoid', () => {
    const values = Array.from(floatMaskToUint8([0], 'sigmoid'))
    expect(values[0]).toBe(128)
  })

  it('scales byte-range values without flattening them', () => {
    expect(Array.from(floatMaskToUint8([0, 128, 255], 'none'))).toEqual([
      0, 128, 255,
    ])
  })
})

describe('applyAlphaMask', () => {
  it('multiplies existing alpha by the mask', () => {
    const image = new ImageData(2, 1)
    image.data.set([255, 0, 0, 255, 0, 255, 0, 128])
    const masked = applyAlphaMask(image, new Uint8Array([255, 0]))
    expect(masked.data[3]).toBe(255)
    expect(masked.data[7]).toBe(0)
  })

  it('rejects the wrong mask size', () => {
    const image = new ImageData(2, 2)
    expect(() => applyAlphaMask(image, new Uint8Array([1]))).toThrow(
      /Mask size mismatch/,
    )
  })
})

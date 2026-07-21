import { describe, expect, it } from 'vite-plus/test'

import {
  SPOTLIGHT_ANIMATION_FPS,
  computeAnimationFrameCount,
  getStrengthAtFrame,
  getTransitionProgressAtFrame,
} from './image-spotlight-animation'

describe('computeAnimationFrameCount', () => {
  it('computes total frames from transition and hold duration', () => {
    expect(computeAnimationFrameCount(2, 1, 30)).toBe(90)
    expect(computeAnimationFrameCount(0.5, 0, 30)).toBe(15)
    expect(computeAnimationFrameCount(0, 2, 30)).toBe(60)
  })

  it('returns at least one frame', () => {
    expect(computeAnimationFrameCount(0, 0, 30)).toBe(1)
  })
})

describe('getTransitionProgressAtFrame', () => {
  it('ramps from 0 to 1 over transition duration', () => {
    expect(getTransitionProgressAtFrame(0, 2, 30)).toBe(0)
    expect(getTransitionProgressAtFrame(30, 2, 30)).toBe(0.5)
    expect(getTransitionProgressAtFrame(60, 2, 30)).toBe(1)
    expect(getTransitionProgressAtFrame(90, 2, 30)).toBe(1)
  })

  it('jumps to 1 when transition duration is zero', () => {
    expect(getTransitionProgressAtFrame(0, 0, 30)).toBe(1)
  })
})

describe('getStrengthAtFrame', () => {
  it('interpolates strength during transition and holds at target', () => {
    const target = 60
    expect(getStrengthAtFrame(0, target, 2, 30)).toBe(0)
    expect(getStrengthAtFrame(30, target, 2, 30)).toBe(30)
    expect(getStrengthAtFrame(60, target, 2, 30)).toBe(60)
    expect(getStrengthAtFrame(75, target, 2, 30)).toBe(60)
  })

  it('uses default fps constant', () => {
    expect(getStrengthAtFrame(SPOTLIGHT_ANIMATION_FPS, 50, 1)).toBe(50)
  })
})

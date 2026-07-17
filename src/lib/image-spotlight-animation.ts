/**
 * Animated spotlight export: ramp effect strength from 0 to target, then hold.
 */

import { GIFEncoder, applyPalette, quantize } from 'gifenc'

import { magnifierExtent } from './image-magnifier'
import type { SpotlightRenderOptions } from './image-spotlight'
import { renderSpotlight } from './image-spotlight'

export const SPOTLIGHT_ANIMATION_FPS = 30

export type SpotlightAnimationFormat = 'gif' | 'mp4'

export type ExportSpotlightAnimationOptions = SpotlightRenderOptions & {
  format: SpotlightAnimationFormat
  transitionDurationSec: number
  holdDurationSec: number
  fps?: number
  onProgress?: (percent: number) => void
}

export type SpotlightAnimationExportResult = {
  blob: Blob
  fileExtension: 'gif' | 'mp4' | 'webm'
  usedWebmFallback: boolean
}

export function computeAnimationFrameCount(
  transitionDurationSec: number,
  holdDurationSec: number,
  fps: number = SPOTLIGHT_ANIMATION_FPS,
): number {
  const totalSec = Math.max(0, transitionDurationSec) + Math.max(0, holdDurationSec)
  return Math.max(1, Math.ceil(totalSec * fps))
}

export function getTransitionProgressAtFrame(
  frameIndex: number,
  transitionDurationSec: number,
  fps: number = SPOTLIGHT_ANIMATION_FPS,
): number {
  if (transitionDurationSec <= 0) return 1
  const elapsedSec = frameIndex / fps
  return Math.min(1, elapsedSec / transitionDurationSec)
}

export function getStrengthAtFrame(
  frameIndex: number,
  targetStrength: number,
  transitionDurationSec: number,
  fps: number = SPOTLIGHT_ANIMATION_FPS,
): number {
  const progress = getTransitionProgressAtFrame(
    frameIndex,
    transitionDurationSec,
    fps,
  )
  return progress * targetStrength
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hasSpotlightContent(options: SpotlightRenderOptions): boolean {
  return options.shapes.length > 0 || options.magnifier != null
}

function getSupportedVideoMimeType(): string | null {
  const candidates = [
    'video/mp4; codecs="avc1.42E01E"',
    'video/mp4',
    'video/webm; codecs=vp9',
    'video/webm',
  ]
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime
    }
  }
  return null
}

function buildRenderOptionsAtFrame(
  base: SpotlightRenderOptions,
  frameIndex: number,
  transitionDurationSec: number,
  fps: number,
): SpotlightRenderOptions {
  const targetDarken = base.darkenStrength
  const targetBlur = base.blurStrength

  if (base.effect === 'darken') {
    return {
      ...base,
      darkenStrength: getStrengthAtFrame(
        frameIndex,
        targetDarken,
        transitionDurationSec,
        fps,
      ),
      blurStrength: 0,
    }
  }

  return {
    ...base,
    darkenStrength: 0,
    blurStrength: getStrengthAtFrame(
      frameIndex,
      targetBlur,
      transitionDurationSec,
      fps,
    ),
  }
}

function createExportCanvas(
  img: HTMLImageElement,
  magnifier: SpotlightRenderOptions['magnifier'],
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number } {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const ext = magnifierExtent(magnifier ?? null, w, h)
  const canvas = document.createElement('canvas')
  canvas.width = ext.canvasW
  canvas.height = ext.canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }
  return { canvas, ctx, w, h }
}

async function exportSpotlightAnimationGif(
  img: HTMLImageElement,
  options: ExportSpotlightAnimationOptions,
): Promise<SpotlightAnimationExportResult> {
  const fps = options.fps ?? SPOTLIGHT_ANIMATION_FPS
  const totalFrames = computeAnimationFrameCount(
    options.transitionDurationSec,
    options.holdDurationSec,
    fps,
  )
  const frameDelayMs = Math.round(1000 / fps)
  const { canvas, ctx, w, h } = createExportCanvas(img, options.magnifier)
  const gif = GIFEncoder()
  let palette: ReturnType<typeof quantize> | null = null

  for (let i = 0; i < totalFrames; i++) {
    const frameOptions = buildRenderOptionsAtFrame(
      options,
      i,
      options.transitionDurationSec,
      fps,
    )
    renderSpotlight(ctx, img, w, h, frameOptions)

    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    if (palette === null) {
      palette = quantize(data, 256)
    }
    const index = applyPalette(data, palette)
    gif.writeFrame(index, width, height, {
      palette: i === 0 ? palette : undefined,
      delay: frameDelayMs,
    })

    options.onProgress?.(((i + 1) / totalFrames) * 100)
  }

  gif.finish()
  const bytes = gif.bytes()
  return {
    blob: new Blob([Uint8Array.from(bytes)], { type: 'image/gif' }),
    fileExtension: 'gif',
    usedWebmFallback: false,
  }
}

async function exportSpotlightAnimationVideo(
  img: HTMLImageElement,
  options: ExportSpotlightAnimationOptions,
): Promise<SpotlightAnimationExportResult> {
  const mimeType = getSupportedVideoMimeType()
  if (!mimeType) {
    throw new Error('Video recording is not supported in this browser')
  }

  const fps = options.fps ?? SPOTLIGHT_ANIMATION_FPS
  const totalFrames = computeAnimationFrameCount(
    options.transitionDurationSec,
    options.holdDurationSec,
    fps,
  )
  const { canvas, ctx, w, h } = createExportCanvas(img, options.magnifier)
  const stream = canvas.captureStream(fps)
  const chunks: Blob[] = []

  const recorder = new MediaRecorder(stream, { mimeType })
  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onerror = (event) => {
      const err =
        event instanceof ErrorEvent && event.error instanceof Error
          ? event.error
          : new Error('Video recording failed')
      reject(err)
    }
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }))
    }
  })

  recorder.start(100)

  for (let i = 0; i < totalFrames; i++) {
    const frameOptions = buildRenderOptionsAtFrame(
      options,
      i,
      options.transitionDurationSec,
      fps,
    )
    renderSpotlight(ctx, img, w, h, frameOptions)
    await sleep(1000 / fps)
    options.onProgress?.(((i + 1) / totalFrames) * 100)
  }

  await sleep(100)
  recorder.stop()
  const blob = await recorded

  const usedWebmFallback = !mimeType.includes('mp4')
  return {
    blob,
    fileExtension: usedWebmFallback ? 'webm' : 'mp4',
    usedWebmFallback,
  }
}

/**
 * Renders a spotlight transition animation and returns an encoded blob.
 */
export async function exportSpotlightAnimation(
  img: HTMLImageElement,
  options: ExportSpotlightAnimationOptions,
): Promise<SpotlightAnimationExportResult> {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (w === 0 || h === 0) {
    throw new Error('Image has no dimensions')
  }
  if (!hasSpotlightContent(options)) {
    throw new Error('Add at least one shape or magnifier before exporting animation')
  }

  if (options.format === 'gif') {
    return exportSpotlightAnimationGif(img, options)
  }
  return exportSpotlightAnimationVideo(img, options)
}

export function spotlightAnimationFilename(
  originalName: string,
  fileExtension: SpotlightAnimationExportResult['fileExtension'],
): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName
  return `${base}-spotlight-animation.${fileExtension}`
}

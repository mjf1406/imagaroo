import type { BackgroundRemovalProgress } from './types'

type HuggingFaceProgressInfo = {
  status: string
  file?: string
  name?: string
  progress?: number
}

export function mapHubProgress(
  info: HuggingFaceProgressInfo,
): BackgroundRemovalProgress | null {
  if (info.status === 'progress_total' || info.status === 'progress') {
    return {
      stage: 'download',
      file: info.file ?? info.name ?? '',
      progress: info.progress ?? 0,
    }
  }
  if (
    info.status === 'initiate' ||
    info.status === 'download' ||
    info.status === 'done' ||
    info.status === 'ready'
  ) {
    return { stage: 'load' }
  }
  return null
}

export function formatProgress(progress: BackgroundRemovalProgress): string {
  if (progress.stage === 'download') {
    const percent = Math.round(progress.progress)
    if (progress.file) {
      return `Downloading ${progress.file} (${percent}%)`
    }
    return `Downloading model (${percent}%)`
  }
  if (progress.stage === 'load') {
    return 'Loading model'
  }
  if (progress.stage === 'inference') {
    return 'Removing background'
  }
  return 'Applying mask'
}

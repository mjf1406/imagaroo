import type { RemoveBgOptions } from '@/lib/background-removal/types'
import { getBackgroundRemovalClient } from '@/lib/background-removal/client'

/**
 * Removes the background from an image with an on-device segmentation model.
 * Images stay in the browser. Models download from Hugging Face and are cached locally.
 */
export async function removeBg(
  file: File,
  outputFormat: 'png' | 'webp' = 'png',
  options: RemoveBgOptions = {},
): Promise<Blob> {
  return getBackgroundRemovalClient().removeBackground(
    file,
    outputFormat,
    options,
  )
}

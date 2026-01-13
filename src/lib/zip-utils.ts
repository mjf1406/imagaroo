import JSZip from 'jszip'

/**
 * Creates a ZIP file from an array of files
 * @param files - Array of objects with name and blob
 * @returns Promise that resolves to a Blob of the ZIP file
 */
export async function createZip(
  files: Array<{ name: string; blob: Blob }>
): Promise<Blob> {
  const zip = new JSZip()

  files.forEach((file) => {
    zip.file(file.name, file.blob)
  })

  return await zip.generateAsync({ type: 'blob' })
}

/**
 * Triggers a download of a blob with the given filename
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

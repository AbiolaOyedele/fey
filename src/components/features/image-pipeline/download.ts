/**
 * Fetches an image and saves it to disk as a file. Unlike an <a download> to a
 * cross-origin URL (which browsers open in a tab), this forces an actual
 * download by routing the bytes through a blob URL.
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error('DOWNLOAD_FAILED')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

/** Builds a friendly filename for a generated asset. */
export function assetFilename(generationId: string, kind: 'preview' | 'final'): string {
  return `image-pipeline-${generationId}-${kind}.png`
}

import { describe, it, expect } from 'vitest'
import { canForceDownload, downloadUrl, downloadAnchorProps } from '@/utils/cloudinary'

/**
 * Downloading a file should save it, not open it.
 *
 * The review tab's download control was `target="_blank"` on the raw file URL,
 * so the browser did what browsers do with an image or a PDF: rendered it in a
 * new tab. Writing `download={name}` on the anchor doesn't fix it either —
 * every browser ignores that attribute cross-origin. Only Cloudinary's
 * `fl_attachment`, which sets Content-Disposition, actually forces a save.
 *
 * These hold the two halves: that the rewrite happens where it can work, and
 * that it is not applied to URLs where it would silently do nothing.
 */

const CLOUD = 'https://res.cloudinary.com/demo/image/upload/v1699999999/fey/brief.pdf'
const RAW   = 'https://res.cloudinary.com/demo/raw/upload/v1699999999/fey/deck.key'

describe('forcing a download', () => {
  it('inserts fl_attachment into a Cloudinary image URL', () => {
    expect(downloadUrl(CLOUD)).toBe(
      'https://res.cloudinary.com/demo/image/upload/fl_attachment/v1699999999/fey/brief.pdf',
    )
  })

  it('works for raw assets too — documents are the common case here', () => {
    expect(downloadUrl(RAW)).toContain('/raw/upload/fl_attachment/')
  })

  it('inserts the flag ahead of existing transformations', () => {
    const t = 'https://res.cloudinary.com/demo/image/upload/w_160,h_160,c_fill/v1/fey/a.png'
    expect(downloadUrl(t)).toBe(
      'https://res.cloudinary.com/demo/image/upload/fl_attachment/w_160,h_160,c_fill/v1/fey/a.png',
    )
  })

  it('leaves a non-Cloudinary URL alone even when it contains /upload/', () => {
    // The old implementation matched on "/upload/" alone and would have
    // rewritten this into a URL that 404s.
    const other = 'https://files.example.com/upload/2026/report.pdf'
    expect(canForceDownload(other)).toBe(false)
    expect(downloadUrl(other)).toBe(other)
  })

  it('is not fooled by a lookalike host', () => {
    expect(canForceDownload('https://res.cloudinary.com.evil.test/x/upload/a.png')).toBe(false)
  })

  it('rewrites idempotently enough to survive a double call', () => {
    expect(downloadUrl(downloadUrl(CLOUD))).toContain('fl_attachment')
  })
})

describe('downloadAnchorProps', () => {
  it('does not open a tab when the download can be forced', () => {
    const props = downloadAnchorProps(CLOUD, 'brief.pdf')
    expect(props.href).toContain('fl_attachment')
    expect(props.download).toBe('brief.pdf')
    // The whole complaint: it opened another tab.
    expect(props.target).toBeUndefined()
  })

  it('falls back to a new tab where it cannot be forced', () => {
    // Better than navigating someone out of the page they were working in.
    const props = downloadAnchorProps('https://files.example.com/a.pdf', 'a.pdf')
    expect(props.target).toBe('_blank')
    expect(props.rel).toBe('noopener noreferrer')
  })
})

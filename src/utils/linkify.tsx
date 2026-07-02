import type { ReactNode } from 'react'

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}'"])/g

/**
 * Splits plain text into React nodes, turning bare URLs into clickable links.
 * Builds nodes directly (no dangerouslySetInnerHTML) so no HTML injection risk.
 */
export function linkifyText(text: string): ReactNode[] {
  const parts = text.split(URL_PATTERN)
  return parts.map((part, i) => {
    if (part.match(URL_PATTERN)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-600 underline hover:text-blue-700 break-all"
        >
          {part}
        </a>
      )
    }
    return part
  })
}

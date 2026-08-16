'use client'

import { Fragment } from 'react'
import { parseNote, parseInline, type InlineToken, type NoteBlock } from '@/utils/note-markdown'

/**
 * A note, rendered.
 *
 * Every block becomes a React element built from parsed data — there is no
 * innerHTML anywhere in this path, so a note can only ever produce text,
 * whatever was typed into it.
 *
 * Checkboxes are tickable when `onToggleTask` is given. That's the whole point
 * of a checklist living in the Vault rather than in a document: the agency can
 * work through it in place, and a client reading a shared copy simply sees
 * where it got to.
 */

interface NoteBodyProps {
  body: string
  accent: string
  /** Called with the source line of the checkbox that was tapped. */
  onToggleTask?: ((line: number) => void) | undefined
  /** Shown when the note has nothing in it yet. */
  emptyMessage?: string
}

function Inline({ tokens, accent }: { tokens: InlineToken[]; accent: string }) {
  return (
    <>
      {tokens.map((token, i) => {
        switch (token.type) {
          case 'strong':
            // NoirPro has no bold face, so emphasis is carried by colour and
            // weight 400 against the surrounding 300 — see DESIGN-SYSTEM.md.
            return <span key={i} className="font-medium text-gray-900">{token.text}</span>
          case 'em':
            return <em key={i} className="italic">{token.text}</em>
          case 'code':
            return (
              <code key={i} className="px-1 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[0.9em] font-mono break-words">
                {token.text}
              </code>
            )
          case 'link':
            return (
              <a
                key={i}
                href={token.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 break-words"
                style={{ color: accent }}
              >
                {token.text}
              </a>
            )
          default:
            return <Fragment key={i}>{token.text}</Fragment>
        }
      })}
    </>
  )
}

function Block({
  block, accent, onToggleTask,
}: {
  block: NoteBlock
  accent: string
  onToggleTask?: ((line: number) => void) | undefined
}) {
  switch (block.type) {
    case 'heading': {
      const size = block.level === 1 ? 'text-base' : block.level === 2 ? 'text-sm2' : 'text-sm'
      return (
        <p className={`font-display ${size} text-gray-900 mt-4 first:mt-0 mb-1 break-words`}>
          <Inline tokens={parseInline(block.text)} accent={accent} />
        </p>
      )
    }

    case 'task': {
      const tickable = !!onToggleTask
      // A div with role=button rather than a checkbox input: the whole row is
      // the target, which is what gets it to 44px on a phone without padding a
      // native control into a shape it doesn't want to be.
      return (
        <div
          {...(tickable
            ? {
                role: 'button',
                tabIndex: 0,
                onClick: () => onToggleTask(block.line),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggleTask(block.line)
                  }
                },
                'aria-pressed': block.checked,
              }
            : {})}
          className={`flex items-start gap-2.5 -mx-2 px-2 py-2 min-h-[44px] rounded-xl ${
            tickable ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''
          }`}
        >
          <span
            aria-hidden
            className="w-[18px] h-[18px] mt-0.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors"
            style={block.checked
              ? { backgroundColor: accent, borderColor: accent }
              : { borderColor: '#D1D5DB' }}
          >
            {block.checked && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path d="M1.5 5.2 3.8 7.5 8.5 2.8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className={`text-sm leading-relaxed break-words ${block.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
            <Inline tokens={parseInline(block.text)} accent={accent} />
          </span>
        </div>
      )
    }

    case 'bullet':
      return (
        <div className="flex items-start gap-2.5 py-0.5">
          <span aria-hidden className="w-1 h-1 rounded-full bg-gray-300 mt-[9px] flex-shrink-0" />
          <span className="text-sm text-gray-700 leading-relaxed break-words">
            <Inline tokens={parseInline(block.text)} accent={accent} />
          </span>
        </div>
      )

    case 'number':
      return (
        <div className="flex items-start gap-2.5 py-0.5">
          <span aria-hidden className="text-2xs text-gray-400 tabular-nums mt-[3px] flex-shrink-0 min-w-[14px]">
            {block.index}.
          </span>
          <span className="text-sm text-gray-700 leading-relaxed break-words">
            <Inline tokens={parseInline(block.text)} accent={accent} />
          </span>
        </div>
      )

    case 'quote':
      return (
        <p className="border-l-2 border-gray-200 pl-3 my-2 text-sm text-gray-500 italic leading-relaxed break-words">
          <Inline tokens={parseInline(block.text)} accent={accent} />
        </p>
      )

    case 'code':
      return (
        <pre className="my-2 p-3 rounded-xl bg-gray-50 border border-gray-100 overflow-x-auto">
          <code className="text-xs font-mono text-gray-700 whitespace-pre">{block.text}</code>
        </pre>
      )

    case 'divider':
      return <hr className="my-4 border-gray-100" />

    default:
      return (
        <p className="text-sm text-gray-700 leading-relaxed my-1.5 break-words">
          <Inline tokens={parseInline(block.text)} accent={accent} />
        </p>
      )
  }
}

export default function NoteBody({ body, accent, onToggleTask, emptyMessage }: NoteBodyProps) {
  const blocks = parseNote(body)

  if (blocks.length === 0) {
    return <p className="text-sm text-gray-300 italic">{emptyMessage ?? 'This note is empty.'}</p>
  }

  return (
    <div>
      {blocks.map((block, i) => (
        <Block key={`${block.line}-${i}`} block={block} accent={accent} onToggleTask={onToggleTask} />
      ))}
    </div>
  )
}

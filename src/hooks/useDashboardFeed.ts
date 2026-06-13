'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface UnreadMessageItem {
  id:           string
  contactId:    string
  contactName:  string
  body:         string
  hasAttachment: boolean
  createdAt:    string
}

export interface RecentFileItem {
  id:           string
  contactId:    string
  contactName:  string
  fileName:     string
  fileType:     string | null
  fileSize:     number | null
  uploaderType: 'owner' | 'client'
  createdAt:    string
}

export interface DashboardFeed {
  unread: UnreadMessageItem[]
  files:  RecentFileItem[]
  loaded: boolean
}

const EMPTY: DashboardFeed = { unread: [], files: [], loaded: false }

interface RawMessage {
  id: string; contact_id: string; body: string
  attachments: unknown[] | null; created_at: string
}
interface RawFile {
  id: string; contact_id: string; file_name: string
  file_type: string | null; file_size: number | null
  uploader_type: 'owner' | 'client'; created_at: string
}
interface ContactRow { id: string; name: string }

/**
 * Feeds the dashboard's "Unread messages" and "Recent files" cards. Pulls the
 * latest unread client messages and most-recent files for the owner, then
 * resolves contact names in a single follow-up query (no SQL joins needed).
 */
export function useDashboardFeed(userId: string | undefined): DashboardFeed {
  const [feed, setFeed] = useState<DashboardFeed>(EMPTY)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    void (async () => {
      const [msgRes, fileRes] = await Promise.all([
        supabase
          .from('crm_messages')
          .select('id, contact_id, body, attachments, created_at')
          .eq('owner_id', userId)
          .eq('sender_type', 'client')
          .is('read_at', null)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('crm_files')
          .select('id, contact_id, file_name, file_type, file_size, uploader_type, created_at')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false })
          .limit(6),
      ])
      if (cancelled) return

      const msgs  = (msgRes.data ?? []) as RawMessage[]
      const files = (fileRes.data ?? []) as RawFile[]

      // Resolve contact names for every contact referenced by either list.
      const contactIds = [...new Set([
        ...msgs.map((m) => m.contact_id),
        ...files.map((f) => f.contact_id),
      ])]

      const nameById = new Map<string, string>()
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id, name')
          .in('id', contactIds)
        if (cancelled) return
        for (const c of (contacts ?? []) as ContactRow[]) nameById.set(c.id, c.name)
      }

      setFeed({
        loaded: true,
        unread: msgs.map((m) => ({
          id:            m.id,
          contactId:     m.contact_id,
          contactName:   nameById.get(m.contact_id) ?? 'Unknown client',
          body:          m.body,
          hasAttachment: Array.isArray(m.attachments) && m.attachments.length > 0,
          createdAt:     m.created_at,
        })),
        files: files.map((f) => ({
          id:           f.id,
          contactId:    f.contact_id,
          contactName:  nameById.get(f.contact_id) ?? 'Unknown client',
          fileName:     f.file_name,
          fileType:     f.file_type,
          fileSize:     f.file_size,
          uploaderType: f.uploader_type,
          createdAt:    f.created_at,
        })),
      })
    })()

    return () => { cancelled = true }
  }, [userId])

  return feed
}

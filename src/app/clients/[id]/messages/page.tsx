'use client'

import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useContacts, useMessages } from '@/hooks/useCrm'
import MessageThread from '@/components/crm/MessageThread'
import type { MessageAttachment } from '@/types/crm'

export default function MessagesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const { workspace } = useWorkspace()
  const { contacts } = useContacts()
  const contact = contacts.find((c) => c.id === id)
  const { messages, loading, sendMessage } = useMessages(id)
  const searchParams = useSearchParams()
  const highlightMessageId = searchParams.get('message')

  const handleSend = async (text: string, html: string, attachments: MessageAttachment[]) => {
    await sendMessage(text, html, attachments, contact?.name)
  }

  return (
    <div className="h-full">
      <MessageThread
        messages={messages}
        ownerId={user?.id ?? ''}
        workspaceId={workspace?.id ?? null}
        contactName={contact?.name ?? 'Client'}
        onSend={handleSend}
        showWelcomeBanner={!!contact?.portal_welcome_message}
        loading={loading}
        highlightMessageId={highlightMessageId}
      />
    </div>
  )
}

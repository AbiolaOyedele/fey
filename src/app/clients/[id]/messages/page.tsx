'use client'

import { use } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useContacts, useMessages } from '@/hooks/useCrm'
import MessageThread from '@/components/crm/MessageThread'
import type { MessageAttachment } from '@/types/crm'

export default function MessagesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const { contacts } = useContacts()
  const contact = contacts.find((c) => c.id === id)
  const { messages, loading, sendMessage } = useMessages(id)

  const handleSend = async (text: string, html: string, attachments: MessageAttachment[]) => {
    await sendMessage(text, html, attachments)
  }

  return (
    <div className="h-full">
      <MessageThread
        messages={messages}
        ownerId={user?.id ?? ''}
        contactName={contact?.name ?? 'Client'}
        onSend={handleSend}
        showWelcomeBanner={!!contact?.portal_welcome_message}
        loading={loading}
      />
    </div>
  )
}

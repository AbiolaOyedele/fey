import { Button, Section, Text } from '@react-email/components'
import { BaseLayout, button, quote, text } from './components/BaseLayout'

export interface NewMessageEmailProps {
  workspaceName: string
  channelName: string
  senderName: string
  snippet: string
  channelUrl: string
  unsubscribeUrl: string
}

/**
 * Sent to workspace members when a new Playground (internal chat) message is
 * posted. A member can belong to several workspaces, so the workspace name is
 * always shown to disambiguate which one this alert is from. Non-transactional
 * — carries an unsubscribe link (EMAIL.md).
 */
export function NewMessageEmail({
  workspaceName,
  channelName,
  senderName,
  snippet,
  channelUrl,
  unsubscribeUrl,
}: NewMessageEmailProps) {
  return (
    <BaseLayout
      preview={`${senderName} posted in #${channelName} (${workspaceName})`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={text}>
        <strong>{senderName}</strong> posted a new message in{' '}
        <strong>#{channelName}</strong> · {workspaceName}:
      </Text>
      <Text style={quote}>{snippet}</Text>
      <Section style={{ margin: '0 0 20px' }}>
        <Button style={button} href={channelUrl}>
          Open chat
        </Button>
      </Section>
    </BaseLayout>
  )
}

NewMessageEmail.PreviewProps = {
  workspaceName: 'The Ruff Agency',
  channelName: 'general',
  senderName: 'Kim Adeyemi',
  snippet: 'Just pushed the new homepage copy — can someone give it a look before we send to the client?',
  channelUrl: 'https://dashboard.theruff.agency/playground',
  unsubscribeUrl: 'https://dashboard.theruff.agency/settings?tab=App',
} satisfies NewMessageEmailProps

export default NewMessageEmail

import { Button, Section, Text } from '@react-email/components'
import { BaseLayout, button, quote, text } from './components/BaseLayout'

export interface NewMessageEmailProps {
  channelName: string
  senderName: string
  snippet: string
  channelUrl: string
  unsubscribeUrl: string
}

/**
 * Sent to workspace members when a new Playground (internal chat) message is
 * posted. Non-transactional — carries an unsubscribe link (EMAIL.md).
 */
export function NewMessageEmail({
  channelName,
  senderName,
  snippet,
  channelUrl,
  unsubscribeUrl,
}: NewMessageEmailProps) {
  return (
    <BaseLayout
      preview={`${senderName} posted in #${channelName}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={text}>
        <strong>{senderName}</strong> posted a new message in{' '}
        <strong>#{channelName}</strong>:
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

export default NewMessageEmail

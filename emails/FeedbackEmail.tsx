import { Section, Text } from '@react-email/components'
import { BaseLayout, text } from './components/BaseLayout'

export interface FeedbackEmailProps {
  type: string
  message: string
  fromEmail: string
  source: string
  pageUrl?: string | null
}

/**
 * Internal notification sent to the admin when someone submits feedback.
 * Not customer-facing — no unsubscribe link.
 */
export function FeedbackEmail({ type, message, fromEmail, source, pageUrl }: FeedbackEmailProps) {
  return (
    <BaseLayout preview={`New ${type} feedback from ${fromEmail}`}>
      <Text style={text}>
        <strong>New {type} feedback</strong> ({source})
      </Text>
      <Section style={{ margin: '0 0 16px' }}>
        <Text style={{ ...text, whiteSpace: 'pre-wrap', margin: 0 }}>{message}</Text>
      </Section>
      <Text style={{ ...text, fontSize: '13px', color: '#6b7280', margin: 0 }}>
        From: {fromEmail}
        {pageUrl ? ` · Page: ${pageUrl}` : ''}
      </Text>
    </BaseLayout>
  )
}

FeedbackEmail.PreviewProps = {
  type: 'bug',
  message: 'The invoice PDF export cuts off the last line item when there are more than 8 rows.',
  fromEmail: 'kim@studio.com',
  source: 'Settings feedback form',
  pageUrl: '/invoices/new',
} satisfies FeedbackEmailProps

export default FeedbackEmail

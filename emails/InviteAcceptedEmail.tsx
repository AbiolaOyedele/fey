import { Button, Section, Text } from '@react-email/components'
import { BaseLayout, button, text } from './components/BaseLayout'

export interface InviteAcceptedEmailProps {
  memberName: string
  workspaceName: string
  workspaceUrl: string
}

/**
 * Sent to the inviter when their invite is accepted. Transactional
 * confirmation — no unsubscribe link.
 */
export function InviteAcceptedEmail({
  memberName,
  workspaceName,
  workspaceUrl,
}: InviteAcceptedEmailProps) {
  return (
    <BaseLayout preview={`${memberName} joined ${workspaceName}`}>
      <Text style={text}>
        <strong>{memberName}</strong> accepted your invite and joined{' '}
        <strong>{workspaceName}</strong>.
      </Text>
      <Section style={{ margin: '0 0 20px' }}>
        <Button style={button} href={workspaceUrl}>
          View your team
        </Button>
      </Section>
    </BaseLayout>
  )
}

InviteAcceptedEmail.PreviewProps = {
  memberName: 'Kim Adeyemi',
  workspaceName: 'The Ruff Agency',
  workspaceUrl: 'https://dashboard.theruff.agency/team',
} satisfies InviteAcceptedEmailProps

export default InviteAcceptedEmail

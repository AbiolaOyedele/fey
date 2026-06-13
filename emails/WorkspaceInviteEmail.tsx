import { Button, Section, Text } from '@react-email/components'
import { BaseLayout, button, text } from './components/BaseLayout'

export interface WorkspaceInviteEmailProps {
  workspaceName: string
  role: string
  inviteUrl: string
}

/**
 * Sent when an admin/owner invites someone to a workspace. Transactional —
 * no unsubscribe link.
 */
export function WorkspaceInviteEmail({
  workspaceName,
  role,
  inviteUrl,
}: WorkspaceInviteEmailProps) {
  return (
    <BaseLayout preview={`You’ve been invited to join ${workspaceName} on Fey`}>
      <Text style={text}>
        You’ve been invited to join <strong>{workspaceName}</strong> on Fey as a{' '}
        <strong>{role}</strong>.
      </Text>
      <Section style={{ margin: '0 0 20px' }}>
        <Button style={button} href={inviteUrl}>
          Accept invite
        </Button>
      </Section>
      <Text style={text}>
        If you didn’t expect this invitation, you can safely ignore this email.
      </Text>
    </BaseLayout>
  )
}

export default WorkspaceInviteEmail

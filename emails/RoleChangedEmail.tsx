import { Button, Section, Text } from '@react-email/components'
import { BaseLayout, button, text } from './components/BaseLayout'

export interface RoleChangedEmailProps {
  memberName: string
  workspaceName: string
  newRole: string
  workspaceUrl: string
}

/**
 * Sent to a member when their role in a workspace changes. Transactional
 * account notice — no unsubscribe link.
 */
export function RoleChangedEmail({
  memberName,
  workspaceName,
  newRole,
  workspaceUrl,
}: RoleChangedEmailProps) {
  return (
    <BaseLayout preview={`Your role in ${workspaceName} is now ${newRole}`}>
      <Text style={text}>Hi {memberName},</Text>
      <Text style={text}>
        Your role in <strong>{workspaceName}</strong> was changed to{' '}
        <strong>{newRole}</strong>.
      </Text>
      <Section style={{ margin: '0 0 20px' }}>
        <Button style={button} href={workspaceUrl}>
          Open workspace
        </Button>
      </Section>
    </BaseLayout>
  )
}

export default RoleChangedEmail

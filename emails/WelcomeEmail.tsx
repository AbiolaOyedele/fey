import { Button, Section, Text } from '@react-email/components'
import { BaseLayout, button, text } from './components/BaseLayout'

export interface WelcomeEmailProps {
  name: string
  workspaceName: string
  dashboardUrl: string
}

const list = {
  ...text,
  margin: '0 0 8px',
}

/**
 * Sent once, right after a new owner finishes setup and their first workspace
 * is created (src/app/api/v1/workspace/ensure/route.ts). Transactional — no
 * unsubscribe link.
 */
export function WelcomeEmail({ name, workspaceName, dashboardUrl }: WelcomeEmailProps) {
  return (
    <BaseLayout preview="Welcome to Fey — let's get your work organized">
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>
        Welcome to Fey. <strong>{workspaceName}</strong> is ready — here&apos;s what you can do right away:
      </Text>
      <Text style={list}>• Add a client to keep their tasks, files, and messages in one place</Text>
      <Text style={list}>• Break work into projects to keep each engagement organized</Text>
      <Text style={list}>• Track tasks with due dates, priorities, and progress as you go</Text>
      <Text style={list}>• Invite your team and assign work so everyone knows what's theirs</Text>
      <Section style={{ margin: '20px 0 0' }}>
        <Button style={button} href={dashboardUrl}>
          Open your dashboard
        </Button>
      </Section>
    </BaseLayout>
  )
}

WelcomeEmail.PreviewProps = {
  name: 'Kim',
  workspaceName: 'The Ruff Agency',
  dashboardUrl: 'https://dashboard.theruff.agency/',
} satisfies WelcomeEmailProps

export default WelcomeEmail

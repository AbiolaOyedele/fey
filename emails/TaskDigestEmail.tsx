import { Button, Section, Text } from '@react-email/components'
import { BaseLayout, text, quote } from './components/BaseLayout'

export interface DigestTask {
  id: string
  title: string
  due_date: string | null
  priority: 'low' | 'medium' | 'high'
  workspaceName: string | null
}

export interface TaskDigestEmailProps {
  dueOrOverdue: DigestTask[]
  recentlyAssigned: DigestTask[]
  completedYesterday: DigestTask[]
  tasksUrl: string
  unsubscribeUrl: string
}

const ACCENT = '#ED64A6'

const sectionHeader = {
  color: ACCENT,
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  margin: '0 0 10px',
}

const taskRow = {
  ...quote,
  borderLeft: `3px solid ${ACCENT}`,
  margin: '0 0 8px',
}

const doneTaskRow = {
  ...quote,
  borderLeft: '3px solid #d6d3d1',
  color: '#78716c',
  margin: '0 0 8px',
}

const button = {
  backgroundColor: ACCENT,
  borderRadius: '999px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 600,
  padding: '11px 22px',
  textDecoration: 'none',
}

const workspaceLabel = {
  color: '#a8a29e',
  fontSize: '13px',
}

function dueLabel(dueDate: string | null): string {
  if (!dueDate) return ''
  const [y, m, d] = dueDate.split('-')
  return ` — due ${d}/${m}/${y}`
}

/** Daily task-digest — due/overdue, recently assigned, completed yesterday. */
export function TaskDigestEmail({
  dueOrOverdue = [],
  recentlyAssigned = [],
  completedYesterday = [],
  tasksUrl,
  unsubscribeUrl,
}: TaskDigestEmailProps) {
  return (
    <BaseLayout preview="Your daily task digest" unsubscribeUrl={unsubscribeUrl}>
      <Text style={text}>Here&apos;s where things stand today.</Text>

      {dueOrOverdue.length > 0 && (
        <Section style={{ margin: '0 0 20px' }}>
          <Text style={sectionHeader}>Due today &amp; overdue</Text>
          {dueOrOverdue.map((t) => (
            <Text key={t.id} style={taskRow}>
              {t.title}
              {dueLabel(t.due_date)}
              {t.workspaceName && <span style={workspaceLabel}> · {t.workspaceName}</span>}
            </Text>
          ))}
        </Section>
      )}

      {recentlyAssigned.length > 0 && (
        <Section style={{ margin: '0 0 20px' }}>
          <Text style={sectionHeader}>Recently assigned to you</Text>
          {recentlyAssigned.map((t) => (
            <Text key={t.id} style={taskRow}>
              {t.title}
              {dueLabel(t.due_date)}
              {t.workspaceName && <span style={workspaceLabel}> · {t.workspaceName}</span>}
            </Text>
          ))}
        </Section>
      )}

      {completedYesterday.length > 0 && (
        <Section style={{ margin: '0 0 20px' }}>
          <Text style={sectionHeader}>Completed yesterday</Text>
          {completedYesterday.map((t) => (
            <Text key={t.id} style={doneTaskRow}>
              ✓ {t.title}
              {t.workspaceName && <span style={workspaceLabel}> · {t.workspaceName}</span>}
            </Text>
          ))}
        </Section>
      )}

      <Section style={{ margin: '4px 0 0' }}>
        <Button style={button} href={tasksUrl}>
          Open your tasks
        </Button>
      </Section>
    </BaseLayout>
  )
}

TaskDigestEmail.PreviewProps = {
  dueOrOverdue: [
    { id: '1', title: 'Send invoice to Acme Co', due_date: '2026-07-01', priority: 'high', workspaceName: 'The Ruff Agency' },
    { id: '2', title: 'Review homepage copy', due_date: '2026-06-29', priority: 'medium', workspaceName: 'Kim Studio' },
  ],
  recentlyAssigned: [
    { id: '3', title: 'Prep onboarding deck', due_date: '2026-07-05', priority: 'medium', workspaceName: 'The Ruff Agency' },
  ],
  completedYesterday: [
    { id: '4', title: 'Fix checkout bug', due_date: null, priority: 'high', workspaceName: 'The Ruff Agency' },
  ],
  tasksUrl: 'https://dashboard.theruff.agency/tasks',
  unsubscribeUrl: 'https://dashboard.theruff.agency/settings?tab=App',
} satisfies TaskDigestEmailProps

export default TaskDigestEmail

import { Column, Row, Section, Text } from '@react-email/components'
import * as React from 'react'
import { fontFamily } from './BaseLayout'

export type NoticeVariant = 'success' | 'error' | 'warning' | 'info'

export interface NoticeCardProps {
  variant: NoticeVariant
  title: string
  description: React.ReactNode
}

const VARIANTS: Record<NoticeVariant, { bg: string }> = {
  success: { bg: '#e3f7ee' },
  error: { bg: '#fbe7e7' },
  warning: { bg: '#fdf1d9' },
  info: { bg: '#e2f0fd' },
}

const card: React.CSSProperties = {
  borderRadius: '14px',
  margin: '0 0 12px',
  padding: '16px',
}

const closeCell: React.CSSProperties = {
  color: '#a8a29e',
  fontFamily,
  fontSize: '16px',
  fontWeight: 300,
  textAlign: 'right',
  verticalAlign: 'top',
  width: '20px',
}

const titleStyle: React.CSSProperties = {
  color: '#1c1917',
  fontFamily,
  fontSize: '15px',
  fontWeight: 300,
  margin: '0 0 4px',
}

const descStyle: React.CSSProperties = {
  color: '#57534e',
  fontFamily,
  fontSize: '13px',
  fontWeight: 300,
  lineHeight: '19px',
  margin: 0,
}

/** Colored toast-style notice used in alert emails (task digest, new message). */
export function NoticeCard({ variant, title, description }: NoticeCardProps) {
  const colors = VARIANTS[variant]
  return (
    <Section style={{ ...card, backgroundColor: colors.bg }}>
      <Row>
        <Column>
          <Text style={titleStyle}>{title}</Text>
          <Text style={descStyle}>{description}</Text>
        </Column>
        <Column style={closeCell}>×</Column>
      </Row>
    </Section>
  )
}

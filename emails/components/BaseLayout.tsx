import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface BaseLayoutProps {
  /** Hidden inbox preview line. */
  preview: string
  children: React.ReactNode
  /** Optional unsubscribe URL — required on non-transactional (alert) emails. */
  unsubscribeUrl?: string
}

const main: React.CSSProperties = {
  backgroundColor: '#f5f5f4',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  padding: '32px 0',
}

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e7e5e4',
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '480px',
  padding: '32px',
}

const brand: React.CSSProperties = {
  color: '#1c1917',
  fontSize: '20px',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  margin: '0 0 24px',
}

const footerText: React.CSSProperties = {
  color: '#a8a29e',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0',
}

const footerLink: React.CSSProperties = {
  color: '#78716c',
  textDecoration: 'underline',
}

const hr: React.CSSProperties = {
  borderColor: '#e7e5e4',
  margin: '28px 0 20px',
}

/**
 * Shared branded shell for every Fey email. Wraps content in a card with the
 * Fey wordmark and a footer. Pass `unsubscribeUrl` on alert emails to render an
 * unsubscribe link (required for non-transactional mail — see EMAIL.md).
 */
export function BaseLayout({ preview, children, unsubscribeUrl }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>Fey</Text>
          {children}
          <Hr style={hr} />
          <Section>
            <Text style={footerText}>
              Fey — your client workspace.
              {unsubscribeUrl ? (
                <>
                  {' '}
                  You’re receiving this because email alerts are on.{' '}
                  <Link style={footerLink} href={unsubscribeUrl}>
                    Unsubscribe
                  </Link>
                  .
                </>
              ) : null}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ── Shared content primitives ────────────────────────────────────────────────

export const text: React.CSSProperties = {
  color: '#292524',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

export const button: React.CSSProperties = {
  backgroundColor: '#1c1917',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 600,
  padding: '11px 20px',
  textDecoration: 'none',
}

export const quote: React.CSSProperties = {
  backgroundColor: '#f5f5f4',
  borderLeft: '3px solid #d6d3d1',
  borderRadius: '4px',
  color: '#44403c',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 20px',
  padding: '12px 16px',
}

import {
  Body,
  Container,
  Font,
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

// NoirPro ships only Light (300) and Regular (400) — same two faces the app
// itself uses (globals.css). Most mail clients (Outlook desktop, many
// webmail clients) strip @font-face and fall back to the system stack below,
// so that fallback must stay first-class, not an afterthought.
const systemFallback =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export const fontFamily = `'NoirPro', ${systemFallback}`

// Reads NEXT_PUBLIC_APP_URL directly rather than importing src/config/env —
// that module validates the *entire* app env (Supabase keys, etc.) at import
// time and throws if any are missing, which crashes the standalone `email
// dev` preview process. Font hosting only needs this one variable.
function fontBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  // Matches src/config/email.ts's own appUrl() fallback exactly (DOMAIN = 'theruff.agency').
  return (explicit ?? 'https://app.theruff.agency').replace(/\/$/, '')
}

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily,
  padding: '32px 0',
}

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #f7d6e7',
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '480px',
  overflow: 'hidden',
}

const brandBand: React.CSSProperties = {
  backgroundColor: '#fdf1f8',
  padding: '24px 32px',
}

const brand: React.CSSProperties = {
  color: '#1c1917',
  fontFamily,
  fontSize: '22px',
  fontWeight: 300,
  letterSpacing: '-0.02em',
  margin: '0',
}

const body: React.CSSProperties = {
  padding: '32px',
}

const footerText: React.CSSProperties = {
  color: '#a8a29e',
  fontFamily,
  fontSize: '12px',
  fontWeight: 300,
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
  const base = fontBaseUrl()
  return (
    <Html>
      <Head>
        <Font
          fontFamily="NoirPro"
          fallbackFontFamily={['Helvetica', 'sans-serif']}
          webFont={{ url: `${base}/fonts/NoirPro-Light.otf`, format: 'opentype' }}
          fontWeight={300}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBand}>
            <Text style={brand}>Fey</Text>
          </Section>
          <Section style={body}>
            {children}
            <Hr style={hr} />
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
  fontFamily,
  fontSize: '15px',
  fontWeight: 300,
  lineHeight: '24px',
  margin: '0 0 16px',
}

export const button: React.CSSProperties = {
  backgroundColor: '#1c1917',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontFamily,
  fontSize: '14px',
  fontWeight: 300,
  padding: '11px 20px',
  textDecoration: 'none',
}

export const quote: React.CSSProperties = {
  backgroundColor: '#f5f5f4',
  borderLeft: '3px solid #d6d3d1',
  borderRadius: '4px',
  color: '#44403c',
  fontFamily,
  fontSize: '14px',
  fontWeight: 300,
  lineHeight: '22px',
  margin: '0 0 20px',
  padding: '12px 16px',
}

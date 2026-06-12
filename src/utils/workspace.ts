/**
 * Turns a workspace slug into a human-readable name.
 * "acme-studio" → "Acme Studio", "bigbb" → "Bigbb".
 */
export function prettifySlug(slug: string | null | undefined): string {
  if (!slug) return ''
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * The display name for a workspace. Prefers an explicit company name, then a
 * prettified slug — never the owner's personal name. Used for the client
 * portal branding and the owner dashboard heading default.
 */
export function resolveWorkspaceName(
  companyName: string | null | undefined,
  slug: string | null | undefined,
): string {
  return companyName?.trim() || prettifySlug(slug) || 'Workspace'
}

// Slugs that can't be used — they clash with platform routes or reserved names.
export const RESERVED_SLUGS = new Set([
  'dashboard', 'www', 'app', 'api', 'admin', 'support',
  'help', 'mail', 'smtp', 'ftp', 'blog', 'status', 'auth',
  'login', 'logout', 'signup', 'register', 'portal', 'client',
])

export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

/**
 * Validates a workspace slug's format and reserved-name rules (NOT uniqueness,
 * which needs a DB check). Returns a human-readable reason if invalid, else null.
 */
export function validateSlugFormat(slug: string): string | null {
  if (slug.length < 3 || slug.length > 30) {
    return 'Slug must be between 3 and 30 characters.'
  }
  if (!SLUG_REGEX.test(slug)) {
    return 'Slug must start and end with a letter or number, and may only contain letters, numbers, and hyphens.'
  }
  if (RESERVED_SLUGS.has(slug)) {
    return 'This name is reserved. Please choose a different one.'
  }
  return null
}

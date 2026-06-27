/**
 * Escapes a string for safe interpolation into an HTML template (e.g. email
 * bodies). Prevents HTML/markup injection when the value is user-controlled —
 * a client-chosen name or email must never be able to inject tags or attributes.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

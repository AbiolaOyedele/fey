/**
 * /portal/[subdomain]/join
 *
 * Invite-link entry point — renders the same join form as /signup.
 * Invite URLs are: https://[slug].theruff.agency/join?code=XXXXXXXX
 * The `code` query param is pre-filled and hidden in the form.
 */
export { default } from '../signup/page'

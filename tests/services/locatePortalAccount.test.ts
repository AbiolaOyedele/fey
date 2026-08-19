import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

vi.mock('@/repositories/portal.repository', () => ({
  listPortalCredentialsByEmail: vi.fn(),
  getOwnerByWorkspaceSlug: vi.fn(),
}))

import * as portalRepo from '@/repositories/portal.repository'
import { locatePortalAccount } from '@/services/portal.service'

/**
 * The agency sign-in form can never authenticate a portal user — they aren't
 * Supabase Auth users — so it tells them their perfectly correct credentials
 * are invalid. This is what turns that dead end into a link.
 *
 * The tests that matter most are the ones about what it REFUSES to say. The
 * whole justification for an unauthenticated endpoint that names a workspace is
 * that it only ever answers someone who already holds the password.
 */

// Cheap cost factor: these only need to verify, not to be stored.
const hash = (pw: string) => bcrypt.hashSync(pw, 4)
const db = {} as never
const listed = vi.mocked(portalRepo.listPortalCredentialsByEmail)
const branding = vi.mocked(portalRepo.getOwnerByWorkspaceSlug)

beforeEach(() => {
  vi.clearAllMocks()
  branding.mockResolvedValue({ business_name: 'The Ruff Agency' } as never)
})

describe('locatePortalAccount', () => {
  it('names the workspace when the password verifies', async () => {
    listed.mockResolvedValue([{ workspace_slug: 'internal', password_hash: hash('correct-horse') }])
    await expect(locatePortalAccount(db, 'client@example.com', 'correct-horse'))
      .resolves.toEqual({ workspace_slug: 'internal', business_name: 'The Ruff Agency' })
  })

  it('says nothing when the password is wrong', async () => {
    // The address exists. Revealing that would be the enumeration leak.
    listed.mockResolvedValue([{ workspace_slug: 'internal', password_hash: hash('correct-horse') }])
    await expect(locatePortalAccount(db, 'client@example.com', 'guess')).resolves.toBeNull()
  })

  it('says nothing when the address was never registered', async () => {
    listed.mockResolvedValue([])
    await expect(locatePortalAccount(db, 'nobody@example.com', 'anything')).resolves.toBeNull()
  })

  it('is indistinguishable between a wrong password and an unknown address', async () => {
    listed.mockResolvedValue([{ workspace_slug: 'internal', password_hash: hash('correct-horse') }])
    const wrongPassword = await locatePortalAccount(db, 'client@example.com', 'guess')
    listed.mockResolvedValue([])
    const unknownEmail = await locatePortalAccount(db, 'nobody@example.com', 'guess')
    expect(wrongPassword).toEqual(unknownEmail)
  })

  it('picks the workspace the password actually belongs to', async () => {
    // One person, client of two agencies, a different password at each.
    listed.mockResolvedValue([
      { workspace_slug: 'other-agency', password_hash: hash('their-other-password') },
      { workspace_slug: 'internal',     password_hash: hash('correct-horse') },
    ])
    const found = await locatePortalAccount(db, 'client@example.com', 'correct-horse')
    expect(found?.workspace_slug).toBe('internal')
  })

  it('checks every row even after a match, so timing does not leak position', async () => {
    listed.mockResolvedValue([
      { workspace_slug: 'a', password_hash: hash('correct-horse') },
      { workspace_slug: 'b', password_hash: hash('something-else') },
      { workspace_slug: 'c', password_hash: hash('another') },
    ])
    const spy = vi.spyOn(bcrypt, 'compare')
    await locatePortalAccount(db, 'client@example.com', 'correct-horse')
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('still costs a comparison when there is nothing to compare against', async () => {
    listed.mockResolvedValue([])
    const spy = vi.spyOn(bcrypt, 'compare')
    await locatePortalAccount(db, 'nobody@example.com', 'guess')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('survives a row with no hash rather than treating it as a match', async () => {
    listed.mockResolvedValue([{ workspace_slug: 'internal', password_hash: null }])
    await expect(locatePortalAccount(db, 'client@example.com', '')).resolves.toBeNull()
  })

  it('returns the workspace even when its display name is missing', async () => {
    listed.mockResolvedValue([{ workspace_slug: 'internal', password_hash: hash('pw') }])
    branding.mockResolvedValue(null as never)
    await expect(locatePortalAccount(db, 'client@example.com', 'pw'))
      .resolves.toEqual({ workspace_slug: 'internal', business_name: null })
  })
})

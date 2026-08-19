import { describe, it, expect } from 'vitest'
import { suggestEmailFix, looksLikeEmail } from '@/utils/email'

/**
 * The case that prompted this: an account was created against
 * "temitopelumi@gmail.con". Perfectly valid syntax, passes z.string().email(),
 * and unreachable forever.
 *
 * The false-positive tests matter as much as the true ones. A checker that
 * second-guesses a real address is worse than the typo — the person is right
 * and the app is arguing with them.
 */

describe('suggestEmailFix — catches the slip', () => {
  it('fixes the one that actually happened', () => {
    expect(suggestEmailFix('temitopelumi@gmail.con')).toBe('temitopelumi@gmail.com')
  })

  it.each([
    ['ada@gmial.com',    'ada@gmail.com'],
    ['ada@gmai.com',     'ada@gmail.com'],
    ['ada@gmail.co',     'ada@gmail.com'],
    ['ada@gmail.cmo',    'ada@gmail.com'],
    ['ada@hotmial.com',  'ada@hotmail.com'],
    ['ada@yahoo.con',    'ada@yahoo.com'],
    ['ada@outlok.com',   'ada@outlook.com'],
    ['ada@icloud.con',   'ada@icloud.com'],
  ])('%s → %s', (input, expected) => {
    expect(suggestEmailFix(input)).toBe(expected)
  })

  it('fixes a .con on a domain it has never heard of', () => {
    expect(suggestEmailFix('kemi@theruff.con')).toBe('kemi@theruff.com')
  })

  it('keeps the local part exactly as typed, @ and dots included', () => {
    expect(suggestEmailFix('first.last+tag@gmail.con')).toBe('first.last+tag@gmail.com')
  })

  it('is case-insensitive about the domain', () => {
    expect(suggestEmailFix('ada@GMAIL.CON')).toBe('ada@gmail.com')
  })
})

describe('suggestEmailFix — leaves real addresses alone', () => {
  it.each([
    'abiola@gmail.com',
    'kemi@theruff.agency',
    'someone@proton.me',
    'team@hey.com',
    'person@mail.com',        // real provider, one edit from gmail.com
    'dev@ruff.dev',
    'sales@company.co',       // .co is a TLD people choose on purpose
    'admin@sub.domain.co.uk',
    'x@yahoo.co.uk',
  ])('%s', (email) => {
    expect(suggestEmailFix(email)).toBeNull()
  })

  it('says nothing about input that isn’t an address yet', () => {
    // Fires on every keystroke, so a half-typed address must stay quiet.
    expect(suggestEmailFix('ada@')).toBeNull()
    expect(suggestEmailFix('ada')).toBeNull()
    expect(suggestEmailFix('')).toBeNull()
    expect(suggestEmailFix('@gmail.com')).toBeNull()
  })

  it('never returns the input unchanged', () => {
    for (const e of ['a@gmail.com', 'a@theruff.agency', 'a@x.io']) {
      expect(suggestEmailFix(e)).not.toBe(e)
    }
  })
})

describe('looksLikeEmail', () => {
  it('accepts an address with a bogus domain — that is not its job', () => {
    expect(looksLikeEmail('temitopelumi@gmail.con')).toBe(true)
  })

  it('rejects one still being typed', () => {
    expect(looksLikeEmail('ada@gmail')).toBe(false)
    expect(looksLikeEmail('ada@')).toBe(false)
    expect(looksLikeEmail('ada gmail.com')).toBe(false)
  })
})

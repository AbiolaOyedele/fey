import { describe, it, expect } from 'vitest'
import { portalNotificationHref } from '@/utils/portalNotificationLink'

/**
 * Where a notification takes a client.
 *
 * The function resolves from the entity first, because notifications written
 * before it existed stored a bare section path ('/tasks') and dropped the
 * client on the board to hunt for the task they'd just been told about.
 *
 * A stored link that already names the task is the exception: it can say which
 * TAB to open, which is how "your work is ready for review" lands on the
 * deliverable instead of on the task's details.
 */

describe('portalNotificationHref', () => {
  it('opens a review notification on the Review tab', () => {
    expect(portalNotificationHref({
      link: '/tasks?taskId=abc-123&tab=review',
      entity_type: 'task',
      entity_id: 'abc-123',
    })).toBe('/tasks?taskId=abc-123&tab=review')
  })

  it('still repairs an old row that only stored the section', () => {
    // The case the entity-first rule exists for.
    expect(portalNotificationHref({
      link: '/tasks',
      entity_type: 'task',
      entity_id: 'abc-123',
    })).toBe('/tasks?taskId=abc-123')
  })

  it('ignores a stored link naming a DIFFERENT task', () => {
    // The entity is the authority on which task this is about; a mismatched
    // link would take the client to somebody else's work.
    expect(portalNotificationHref({
      link: '/tasks?taskId=other-999&tab=review',
      entity_type: 'task',
      entity_id: 'abc-123',
    })).toBe('/tasks?taskId=abc-123')
  })

  it('handles a task notification with no stored link at all', () => {
    expect(portalNotificationHref({ link: null, entity_type: 'task', entity_id: 'abc-123' }))
      .toBe('/tasks?taskId=abc-123')
  })

  it('leaves the other entity types alone', () => {
    expect(portalNotificationHref({ link: '/x', entity_type: 'crm_contract', entity_id: 'c1' })).toBe('/contracts/c1')
    expect(portalNotificationHref({ link: '/x', entity_type: 'project', entity_id: 'p1' })).toBe('/projects/p1')
  })

  it('falls back to the stored link, then to notifications', () => {
    expect(portalNotificationHref({ link: '/invoices', entity_type: 'unknown', entity_id: 'z' })).toBe('/invoices')
    expect(portalNotificationHref({ link: null, entity_type: null, entity_id: null })).toBe('/notifications')
  })
})

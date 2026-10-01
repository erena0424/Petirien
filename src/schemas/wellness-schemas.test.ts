import { describe, expect, it } from 'vitest'
import { lintSchema } from 'deepspace/worker'
import { schemas } from '../schemas'

const USER_CONTENT = ['checkins', 'suggestions', 'savedVideos', 'savedIdeas', 'journalEntries', 'preferences', 'usage', 'searchCache']

describe('wellness schemas', () => {
  it('pass the SDK schema lint', () => {
    for (const s of schemas) expect(lintSchema(s), s.name).toEqual([])
  })

  it('lets every role touch only its OWN rows, so nobody (not even admin) can read others\' notes', () => {
    for (const s of schemas.filter((x) => ['checkins', 'suggestions', 'savedVideos', 'savedIdeas', 'journalEntries', 'preferences'].includes(x.name))) {
      for (const role of ['member', 'admin'] as const) {
        expect(s.permissions[role]?.read, `${s.name}/${role}`).toBe('own')
        expect(s.permissions[role]?.update, `${s.name}/${role}`).toBe('own')
        expect(s.permissions[role]?.delete, `${s.name}/${role}`).toBe('own')
      }
      expect(s.permissions.viewer?.read, s.name).toBe(false)
    }
  })

  it('lets the app owner (pinned to admin) use their own data: admin may create wherever members may', () => {
    for (const s of schemas.filter((x) => ['checkins', 'suggestions', 'savedVideos', 'savedIdeas', 'journalEntries', 'preferences'].includes(x.name))) {
      expect(s.permissions.admin?.create, s.name).toBe(s.permissions.member?.create)
    }
    // Specifically the writes the owner does from the browser:
    for (const name of ['checkins', 'savedVideos', 'savedIdeas', 'journalEntries', 'preferences']) {
      expect(schemas.find((x) => x.name === name)?.permissions.admin?.create, name).toBe(true)
    }
  })

  it('never lets any role read all rows of user content or the server-only collections', () => {
    for (const s of schemas.filter((x) => ['checkins', 'suggestions', 'savedVideos', 'savedIdeas', 'journalEntries', 'preferences', 'usage', 'searchCache'].includes(x.name))) {
      for (const role of ['viewer', 'member', 'admin'] as const) expect(s.permissions[role]?.read, `${s.name}/${role}`).not.toBe(true)
    }
    for (const name of ['searchCache', 'usage']) {
      const s = schemas.find((x) => x.name === name)!
      expect(s.permissions.admin?.create, name).toBe(false)
      expect(s.permissions.admin?.update, name).toBe(false)
    }
  })

  it('keeps counters and the cache out of members\' hands', () => {
    for (const name of ['usage', 'searchCache']) {
      const s = schemas.find((x) => x.name === name)!
      expect(s.permissions.member?.create, name).toBe(false)
      expect(s.permissions.member?.update, name).toBe(false)
      expect(s.permissions.member?.delete, name).toBe(false)
    }
  })

  it('makes members read only their own user content', () => {
    for (const s of schemas.filter((x) => ['checkins', 'suggestions', 'savedVideos', 'savedIdeas', 'journalEntries', 'preferences'].includes(x.name))) {
      expect(s.permissions.member?.read, s.name).toBe('own')
    }
  })

  it('enforces one saved row per user per video and one preferences row per user', () => {
    expect(schemas.find((s) => s.name === 'savedVideos')?.uniqueOn).toEqual(['userId', 'videoId'])
    expect(schemas.find((s) => s.name === 'savedIdeas')?.uniqueOn).toEqual(['userId', 'activityId'])
    expect(schemas.find((s) => s.name === 'preferences')?.uniqueOn).toEqual(['userId'])
  })
})

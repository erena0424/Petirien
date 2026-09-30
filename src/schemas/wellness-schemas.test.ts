import { describe, expect, it } from 'vitest'
import { lintSchema } from 'deepspace/worker'
import { schemas } from '../schemas'

const USER_CONTENT = ['checkins', 'suggestions', 'savedVideos', 'preferences', 'usage', 'searchCache']

describe('wellness schemas', () => {
  it('pass the SDK schema lint', () => {
    for (const s of schemas) expect(lintSchema(s), s.name).toEqual([])
  })

  it('never give the admin role read access to user content', () => {
    for (const s of schemas.filter((x) => USER_CONTENT.includes(x.name))) {
      expect(s.permissions.admin?.read, s.name).toBe(false)
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
    for (const s of schemas.filter((x) => ['checkins', 'suggestions', 'savedVideos', 'preferences'].includes(x.name))) {
      expect(s.permissions.member?.read, s.name).toBe('own')
    }
  })

  it('enforces one saved row per user per video and one preferences row per user', () => {
    expect(schemas.find((s) => s.name === 'savedVideos')?.uniqueOn).toEqual(['userId', 'videoId'])
    expect(schemas.find((s) => s.name === 'preferences')?.uniqueOn).toEqual(['userId'])
  })
})

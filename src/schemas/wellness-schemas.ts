/**
 * Wellness collections. Every user-content collection is owner-only for EVERY
 * role, including admin: nobody, not even the app owner, can read another
 * person's check-in notes. `usage` and `searchCache` are written only by
 * server actions, so members cannot forge counters or poison the cache.
 *
 * Admin must still be able to use the app for itself. The app owner is pinned
 * to the admin role, so denying admin everything (an earlier version did)
 * stopped the owner from saving videos, seeing their own history, or setting
 * preferences. Admin therefore gets the same "own rows only" access as members.
 */

import type { CollectionSchema } from 'deepspace/schema'

type Column = CollectionSchema['columns'][number]

/** Owner id. `userBound` + `immutable` so a client cannot claim another id. */
const userId: Column = {
  name: 'userId',
  storage: 'text',
  interpretation: 'plain',
  required: true,
  userBound: true,
  immutable: true,
}

const text = (name: string, required = false): Column => ({
  name,
  storage: 'text',
  interpretation: 'plain',
  required,
})

const num = (name: string, required = false): Column => ({
  name,
  storage: 'number',
  interpretation: 'plain',
  required,
})

const json = (name: string): Column => ({
  name,
  storage: 'text',
  interpretation: { kind: 'json' },
})

const select = (name: string, options: string[], required = false): Column => ({
  name,
  storage: 'text',
  interpretation: { kind: 'select', options },
  required,
})

/** Own rows only, for members and admin alike. */
const ownerOnly = {
  viewer: { read: false, create: false, update: false, delete: false },
  member: { read: 'own', create: true, update: 'own', delete: 'own' },
  admin: { read: 'own', create: true, update: 'own', delete: 'own' },
} as const

export const checkinsSchema: CollectionSchema = {
  name: 'checkins',
  ownerField: 'userId',
  columns: [
    userId,
    num('mood', true),
    num('energy', true),
    num('minutes', true),
    select('goal', ['calm', 'express', 'connect', 'move', 'break']),
    /** Short LLM-derived summary of what the person wants. Not a transcript. */
    text('intent'),
    /** Optional, user-written, deletable. Never logged. */
    text('note'),
  ],
  permissions: ownerOnly,
}

export const suggestionsSchema: CollectionSchema = {
  name: 'suggestions',
  ownerField: 'userId',
  columns: [
    userId,
    text('checkinId', true),
    text('activityId', true),
    text('videoId'),
    text('title'),
    text('reason'),
    num('rank'),
    select('status', ['shown', 'opened', 'rejected', 'saved']),
    select('helpful', ['yes', 'somewhat', 'no']),
    select('reasonChip', ['too_long', 'too_much_effort', 'not_my_thing', 'different_kind']),
  ],
  // Rows are created by the recommend action; members may only update/delete their own.
  permissions: {
    ...ownerOnly,
    member: { read: 'own', create: false, update: 'own', delete: 'own' },
    admin: { read: 'own', create: false, update: 'own', delete: 'own' },
  },
}

export const savedVideosSchema: CollectionSchema = {
  name: 'savedVideos',
  ownerField: 'userId',
  uniqueOn: ['userId', 'videoId'],
  columns: [
    userId,
    text('videoId', true),
    text('title'),
    text('channel'),
    text('thumbnail'),
    num('durationSec'),
    text('activityId'),
    /** The person's own note; may persist. */
    text('userNote'),
    /** ms epoch. Title/thumbnail/duration must be refreshed or deleted within 30 days. */
    num('metaRefreshedAt'),
    select('availability', ['ok', 'no_embed', 'gone']),
  ],
  permissions: ownerOnly,
}

/** Journal entries the bunny wrote and the person chose to save. Never the chat itself. */
export const journalEntriesSchema: CollectionSchema = {
  name: 'journalEntries',
  ownerField: 'userId',
  columns: [userId, text('title', true), json('notes'), json('feelings'), text('bunnyNote')],
  permissions: ownerOnly,
}

/** Activities saved without a video (steps only). One per person per activity. */
export const savedIdeasSchema: CollectionSchema = {
  name: 'savedIdeas',
  ownerField: 'userId',
  uniqueOn: ['userId', 'activityId'],
  columns: [userId, text('activityId', true), text('userNote')],
  permissions: ownerOnly,
}

export const preferencesSchema: CollectionSchema = {
  name: 'preferences',
  ownerField: 'userId',
  uniqueOn: ['userId'],
  columns: [
    userId,
    json('likedTags'),
    json('dislikedTags'),
    json('avoid'),
    num('defaultMinutes'),
    /** Older yes/no version of `screenMode`; still read so existing rows keep working. */
    num('screenFree'),
    select('screenMode', ['auto', 'video', 'none']),
  ],
  permissions: ownerOnly,
}

/** Per-user daily call counter. Server-written only. */
export const usageSchema: CollectionSchema = {
  name: 'usage',
  ownerField: 'userId',
  uniqueOn: ['userId', 'day'],
  columns: [userId, text('day', true), num('count', true)],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}

/** Shared YouTube result cache. Server-only: no member access at all. */
export const searchCacheSchema: CollectionSchema = {
  name: 'searchCache',
  columns: [text('query', true), json('results'), num('fetchedAt', true)],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}

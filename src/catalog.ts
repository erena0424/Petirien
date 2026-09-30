/**
 * Activity catalog — small, curated, hand-written.
 *
 * The catalog is code, not data: the recommend pipeline filters it
 * deterministically, the LLM only chooses among the filtered ids, and each
 * activity's `searchQuery` (not model output) drives video retrieval.
 * Copy here is everyday-support wording only.
 */

export const GOALS = ['calm', 'express', 'connect', 'move', 'break'] as const
export type Goal = (typeof GOALS)[number]

export const CATEGORIES = ['meditation', 'movement', 'creative'] as const
export type Category = (typeof CATEGORIES)[number]

/** 1 = barely any effort, 3 = needs real energy. */
export type Effort = 1 | 2 | 3

export const SETTINGS = ['lying', 'seated', 'standing', 'floor', 'desk'] as const
export type Setting = (typeof SETTINGS)[number]

/**
 * Tag vocabulary (used by preferences, dislikes and "avoid"):
 *  guided          a voice talks you through it
 *  no-voice        no talking at all
 *  music           background music or ambient sound
 *  follow-along    someone demonstrates; you copy
 *  eyes-closed     can be done with eyes closed
 *  needs-supplies  paper, pens, paint, etc.
 */
export interface Activity {
  id: string
  title: string
  category: Category
  goals: Goal[]
  minMinutes: number
  maxMinutes: number
  effort: Effort
  setting: Setting
  tags: string[]
  /** One gentle sentence shown to the user. */
  blurb: string
  /** Curated YouTube query. Never model-written. */
  searchQuery: string
}

export const CATALOG: Activity[] = [
  // ── Meditation ────────────────────────────────────────────────
  {
    id: 'box-breathing',
    title: 'Box breathing',
    category: 'meditation',
    goals: ['calm', 'break'],
    minMinutes: 3,
    maxMinutes: 10,
    effort: 1,
    setting: 'seated',
    tags: ['guided'],
    blurb: 'A steady in-hold-out-hold rhythm, led by a voice, that gives your mind one simple thing to follow.',
    searchQuery: '5 minute box breathing guided',
  },
  {
    id: 'body-scan',
    title: 'Body scan',
    category: 'meditation',
    goals: ['calm', 'break'],
    minMinutes: 8,
    maxMinutes: 20,
    effort: 1,
    setting: 'lying',
    tags: ['guided', 'eyes-closed'],
    blurb: 'Lie down and move your attention slowly from head to toe. Nothing to fix, just notice.',
    searchQuery: '10 minute body scan meditation gentle',
  },
  {
    id: 'silent-sit',
    title: 'Quiet sit with a soft bell',
    category: 'meditation',
    goals: ['calm', 'break'],
    minMinutes: 3,
    maxMinutes: 15,
    effort: 1,
    setting: 'seated',
    tags: ['no-voice', 'eyes-closed'],
    blurb: 'A few minutes of stillness with just a timer and a gentle bell. No one talking.',
    searchQuery: '5 minute meditation timer soft bell no talking',
  },
  {
    id: 'loving-kindness',
    title: 'Loving-kindness practice',
    category: 'meditation',
    goals: ['connect', 'calm'],
    minMinutes: 5,
    maxMinutes: 15,
    effort: 1,
    setting: 'seated',
    tags: ['guided', 'eyes-closed'],
    blurb: 'Send warm wishes to yourself and to people you care about, guided step by step.',
    searchQuery: '10 minute loving kindness meditation guided',
  },
  {
    id: 'rain-sounds',
    title: 'Rain sounds to rest with',
    category: 'meditation',
    goals: ['break', 'calm'],
    minMinutes: 5,
    maxMinutes: 30,
    effort: 1,
    setting: 'lying',
    tags: ['no-voice', 'music', 'eyes-closed'],
    blurb: 'Soft rain, no words, no tasks. Close your eyes or just look out the window.',
    searchQuery: 'gentle rain sounds relaxing 10 minutes',
  },
  {
    id: 'grounding-54321',
    title: '5-4-3-2-1 grounding',
    category: 'meditation',
    goals: ['calm'],
    minMinutes: 3,
    maxMinutes: 8,
    effort: 1,
    setting: 'seated',
    tags: ['guided'],
    blurb: 'Name things you can see, feel, and hear around you to come back to the room.',
    searchQuery: '5 4 3 2 1 grounding exercise guided 5 minutes',
  },
  {
    id: 'mindful-pause',
    title: 'A short mindful pause',
    category: 'meditation',
    goals: ['break', 'calm'],
    minMinutes: 3,
    maxMinutes: 10,
    effort: 1,
    setting: 'seated',
    tags: ['guided'],
    blurb: 'A few minutes to stop what you are doing, breathe, and reset before the next thing.',
    searchQuery: '5 minute mindfulness meditation for a break guided',
  },
  // ── Movement ──────────────────────────────────────────────────
  {
    id: 'desk-stretch',
    title: 'Desk stretch',
    category: 'movement',
    goals: ['move', 'break'],
    minMinutes: 3,
    maxMinutes: 10,
    effort: 1,
    setting: 'desk',
    tags: ['follow-along'],
    blurb: 'Loosen your neck, shoulders, and back without leaving your chair.',
    searchQuery: '5 minute desk stretch gentle follow along',
  },
  {
    id: 'chair-yoga',
    title: 'Chair yoga',
    category: 'movement',
    goals: ['move', 'calm'],
    minMinutes: 8,
    maxMinutes: 15,
    effort: 1,
    setting: 'seated',
    tags: ['follow-along', 'guided'],
    blurb: 'Slow, seated movements you can do in regular clothes. Go as gently as you like.',
    searchQuery: '10 minute chair yoga gentle',
  },
  {
    id: 'gentle-yoga',
    title: 'Gentle floor yoga',
    category: 'movement',
    goals: ['move', 'calm'],
    minMinutes: 8,
    maxMinutes: 20,
    effort: 2,
    setting: 'floor',
    tags: ['follow-along', 'guided'],
    blurb: 'Easy stretches on the floor at a slow pace, made for beginners.',
    searchQuery: '10 minute gentle yoga for beginners',
  },
  {
    id: 'neck-shoulders',
    title: 'Neck and shoulder release',
    category: 'movement',
    goals: ['move', 'break', 'calm'],
    minMinutes: 3,
    maxMinutes: 8,
    effort: 1,
    setting: 'seated',
    tags: ['follow-along'],
    blurb: 'Small, slow movements for the place where many of us hold the day.',
    searchQuery: 'neck and shoulder release stretch 5 minutes',
  },
  {
    id: 'legs-up-rest',
    title: 'Legs-up rest',
    category: 'movement',
    goals: ['calm', 'break'],
    minMinutes: 5,
    maxMinutes: 15,
    effort: 1,
    setting: 'floor',
    tags: ['guided', 'eyes-closed'],
    blurb: 'Rest with your legs up a wall or sofa and let your body be held.',
    searchQuery: 'restorative yoga legs up the wall 10 minutes',
  },
  {
    id: 'indoor-walk',
    title: 'Easy walk at home',
    category: 'movement',
    goals: ['move'],
    minMinutes: 5,
    maxMinutes: 15,
    effort: 2,
    setting: 'standing',
    tags: ['follow-along', 'music'],
    blurb: 'Walk in place or around the room with a friendly, low-key guide. Gets you moving without going out.',
    searchQuery: '10 minute easy indoor walk low impact beginner',
  },
  {
    id: 'shake-it-out',
    title: 'Shake it out',
    category: 'movement',
    goals: ['move', 'express'],
    minMinutes: 3,
    maxMinutes: 8,
    effort: 2,
    setting: 'standing',
    tags: ['follow-along', 'music'],
    blurb: 'A few minutes of loose, silly movement to music. No one is watching.',
    searchQuery: '5 minute easy dance shake it out',
  },
  // ── Creative ──────────────────────────────────────────────────
  {
    id: 'doodle-along',
    title: 'Doodle along',
    category: 'creative',
    goals: ['express', 'break'],
    minMinutes: 5,
    maxMinutes: 20,
    effort: 1,
    setting: 'desk',
    tags: ['follow-along', 'needs-supplies', 'music'],
    blurb: 'Simple shapes and patterns to copy. A pen and any scrap of paper is enough.',
    searchQuery: 'easy doodle drawing for beginners relaxing',
  },
  {
    id: 'easy-watercolor',
    title: 'Simple watercolor',
    category: 'creative',
    goals: ['express'],
    minMinutes: 10,
    maxMinutes: 25,
    effort: 2,
    setting: 'desk',
    tags: ['follow-along', 'needs-supplies', 'music'],
    blurb: 'A relaxed, beginner-friendly painting to follow. Mistakes are part of the look.',
    searchQuery: 'easy watercolor painting for beginners relaxing',
  },
  {
    id: 'journaling-prompts',
    title: 'Journaling prompts',
    category: 'creative',
    goals: ['express', 'calm'],
    minMinutes: 5,
    maxMinutes: 15,
    effort: 1,
    setting: 'desk',
    tags: ['guided', 'needs-supplies'],
    blurb: 'A few gentle questions to write about, just for you. Skip any that do not fit.',
    searchQuery: 'journaling prompts for beginners 5 minutes guided',
  },
  {
    id: 'easy-origami',
    title: 'Easy paper folding',
    category: 'creative',
    goals: ['break', 'express'],
    minMinutes: 8,
    maxMinutes: 20,
    effort: 2,
    setting: 'desk',
    tags: ['follow-along', 'needs-supplies'],
    blurb: 'Fold one simple paper shape, step by step. Something small to make and keep.',
    searchQuery: 'easy origami tutorial simple beginner',
  },
  {
    id: 'gratitude-note',
    title: 'Write a thank-you note',
    category: 'creative',
    goals: ['connect', 'express'],
    minMinutes: 8,
    maxMinutes: 20,
    effort: 2,
    setting: 'desk',
    tags: ['guided', 'needs-supplies'],
    blurb: 'Write a few lines to someone who helped you. You decide whether to send it.',
    searchQuery: 'gratitude letter writing exercise guided',
  },
  {
    id: 'mandala-coloring',
    title: 'Mandala coloring',
    category: 'creative',
    goals: ['break', 'express', 'calm'],
    minMinutes: 5,
    maxMinutes: 30,
    effort: 1,
    setting: 'desk',
    tags: ['needs-supplies', 'music', 'follow-along'],
    blurb: 'Fill in a pattern with colors you like, with calm music in the background.',
    searchQuery: 'relaxing mandala coloring with calm music',
  },
]

export function getActivity(id: string): Activity | undefined {
  return CATALOG.find((a) => a.id === id)
}

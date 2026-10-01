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
  /** What you need before starting. Hand-written. */
  needs: string
  /** Three to five short steps. Hand-written, never model-generated. */
  steps: string[]
  /** One reassuring or safety line. */
  tip: string
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
    needs: 'Somewhere to sit',
    steps: [
      'Sit comfortably and let your shoulders drop.',
      'Breathe in slowly through your nose for a count of four.',
      'Hold gently for four, breathe out for four, hold for four.',
      'Repeat for a few minutes, or follow the video.',
    ],
    tip: 'If holding your breath feels uncomfortable, skip the holds and just breathe slowly. Stop if anything hurts or you feel dizzy.',
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
    needs: 'A place to lie down',
    steps: [
      'Lie on your back and let your arms rest.',
      'Start at your feet and notice how they feel, without changing anything.',
      'Move your attention slowly up through your legs, belly, chest, arms, and face.',
      'When your mind wanders, gently come back. You can do that as many times as you need.',
    ],
    tip: 'You don\'t have to relax on purpose. Noticing is enough.',
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
    needs: 'A chair or cushion, and a timer',
    steps: [
      'Sit comfortably and set the timer.',
      'Close your eyes, or rest your gaze on one spot.',
      'Notice your breathing without trying to steer it.',
      'When your mind wanders, which it will, come back to the next breath.',
    ],
    tip: 'Even five quiet minutes counts.',
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
    needs: 'Somewhere quiet to sit',
    steps: [
      'Sit comfortably and take a few slow breaths.',
      'Silently say a kind wish for yourself, like “may I be okay.”',
      'Think of someone you care about and wish the same for them.',
      'Finish with one more slow breath.',
    ],
    tip: 'If it feels awkward at first, that\'s normal. Go at your own pace.',
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
    needs: 'Headphones or speakers',
    steps: [
      'Get comfortable, lying down or in a chair.',
      'Press play and keep the volume low.',
      'Close your eyes, or look out the window.',
      'Let the sound fill the time. There\'s nothing to do.',
    ],
    tip: 'Keep it quiet enough that you could still hear someone call your name.',
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
    needs: 'Nothing, just look around',
    steps: [
      'Name five things you can see.',
      'Name four things you can feel, like your feet on the floor.',
      'Name three things you can hear.',
      'Name two things you can smell and one you can taste.',
    ],
    tip: 'Say them out loud or in your head. Any answer counts.',
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
    needs: 'Somewhere to sit',
    steps: [
      'Stop what you\'re doing and put your hands down.',
      'Take three slow breaths.',
      'Notice one thing you can see, one you can hear, and one you can feel.',
      'Take one more breath, then choose your next step.',
    ],
    tip: 'This works in a hallway, at a desk, or on the couch.',
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
    needs: 'A chair',
    steps: [
      'Sit tall and roll your shoulders back a few times.',
      'Tilt your head gently toward each shoulder and hold for a few breaths.',
      'Reach both arms overhead and stretch up.',
      'Turn slowly to each side and look over your shoulder.',
    ],
    tip: 'Stretch only as far as feels comfortable. Stop if anything hurts or you feel dizzy.',
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
    needs: 'A sturdy chair',
    steps: [
      'Sit near the front edge with both feet on the floor.',
      'Follow the video\'s slow movements for your arms, back, and legs.',
      'Breathe steadily and go only as far as is comfortable.',
      'Finish with a few slow breaths.',
    ],
    tip: 'Skip any movement that doesn\'t suit you. Stop if anything hurts or you feel dizzy.',
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
    needs: 'A mat or a soft floor',
    steps: [
      'Clear a little floor space.',
      'Follow the video\'s slow, easy poses.',
      'Use a pillow or folded blanket if something feels strained.',
      'Finish by resting for a minute.',
    ],
    tip: 'Skip any pose that doesn\'t feel right. Nobody is checking. Stop if anything hurts or you feel dizzy.',
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
    needs: 'A chair',
    steps: [
      'Sit tall and let your arms hang.',
      'Lift your shoulders up to your ears, then let them drop.',
      'Slowly tilt your head toward each shoulder, hold, and breathe.',
      'Roll your shoulders back in slow circles.',
    ],
    tip: 'Keep every movement small and slow. Stop if anything hurts or you feel dizzy.',
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
    needs: 'A wall or sofa, and a clear floor',
    steps: [
      'Sit sideways next to a wall.',
      'Lie back and swing your legs up so they rest against the wall.',
      'Let your arms rest and breathe slowly.',
      'To finish, bend your knees and roll to one side before sitting up.',
    ],
    tip: 'Skip this one if lying with your legs raised feels uncomfortable.',
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
    needs: 'A little floor space',
    steps: [
      'Clear a path, or stay in one spot.',
      'Walk in place or around the room at an easy pace.',
      'Swing your arms and breathe normally.',
      'Slow down when you\'ve had enough.',
    ],
    tip: 'If you could chat while doing it, you\'re at a good pace. Stop if anything hurts or you feel dizzy.',
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
    needs: 'A little space',
    steps: [
      'Put on a song you like, or follow the video.',
      'Shake out your hands, then your arms, then your shoulders.',
      'Let your legs and the rest of you join in.',
      'Finish with one big breath out.',
    ],
    tip: 'No one is watching. Do it your way. Stop if anything hurts or you feel dizzy.',
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
    needs: 'Paper and any pen',
    steps: [
      'Grab some paper and a pen.',
      'Watch the first shapes, then copy them at your own speed.',
      'Pause the video whenever you want to catch up.',
      'Keep your doodles, or don\'t.',
    ],
    tip: 'There\'s no wrong line.',
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
    needs: 'Watercolors or a paint set, a brush, paper, and a cup of water',
    steps: [
      'Set out your paints, brush, paper, and water.',
      'Follow the video one step at a time, pausing as needed.',
      'Let each layer dry a little before adding the next.',
      'Step back and look when you\'re done.',
    ],
    tip: 'It\'s okay if yours looks different from the video.',
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
    needs: 'Paper or a notes app',
    steps: [
      'Get something to write with.',
      'Pick one prompt from the video that catches your eye.',
      'Write for a few minutes without editing yourself.',
      'Stop whenever you like. You don\'t have to finish.',
    ],
    tip: 'This is just for you. Skip any prompt that feels too heavy.',
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
    needs: 'A square sheet of paper',
    steps: [
      'Cut or fold a sheet of paper into a square.',
      'Follow the video, pausing at each fold.',
      'Press each crease firmly.',
      'Keep your finished shape somewhere you\'ll see it.',
    ],
    tip: 'If you mess one up, start again. It\'s quick.',
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
    needs: 'Paper and a pen',
    steps: [
      'Think of someone who helped you, even in a small way.',
      'Write what they did and how it helped.',
      'Add a line saying thank you.',
      'Decide later whether to send it. Either way is fine.',
    ],
    tip: 'It doesn\'t have to be long or well written.',
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
    needs: 'A mandala page, and pencils or markers',
    steps: [
      'Print or find a mandala to color.',
      'Choose a few colors that feel right today.',
      'Start in the middle and work outward, slowly.',
      'Stop whenever you\'re ready.',
    ],
    tip: 'There\'s no wrong color.',
    searchQuery: 'relaxing mandala coloring with calm music',
  },
]

export function getActivity(id: string): Activity | undefined {
  return CATALOG.find((a) => a.id === id)
}

/**
 * Static crisis and support resources. Hand-written and verified, never
 * retrieved or model-generated. Verified 2026-09-30 against the services'
 * own pages: 988 (call, text, chat), Crisis Text Line (text HOME to 741741),
 * findahelpline.com (international directory by ThroughLine).
 */

export interface SupportAction {
  label: string
  href: string
  external?: boolean
}

export interface SupportResource {
  id: string
  name: string
  detail: string
  actions: SupportAction[]
}

export const SUPPORT_RESOURCES: SupportResource[] = [
  {
    id: '988',
    name: '988 Suicide & Crisis Lifeline',
    detail: 'Free, private, and open 24/7 in the US. Call or text 988, or chat online.',
    actions: [
      { label: 'Call 988', href: 'tel:988' },
      { label: 'Text 988', href: 'sms:988' },
      { label: 'Chat online', href: 'https://988lifeline.org/chat/', external: true },
    ],
  },
  {
    id: 'crisis-text-line',
    name: 'Crisis Text Line',
    detail: 'Free, 24/7 text support in the US. Text HOME to 741741.',
    actions: [{ label: 'Text 741741', href: 'sms:741741' }],
  },
  {
    id: 'emergency',
    name: 'If you are in immediate danger',
    detail: 'Call 911 (or your local emergency number).',
    actions: [{ label: 'Call 911', href: 'tel:911' }],
  },
  {
    id: 'international',
    name: 'Outside the US',
    detail: 'Find a free helpline in your country.',
    actions: [{ label: 'findahelpline.com', href: 'https://findahelpline.com/', external: true }],
  },
]

export const SUPPORT_INTRO =
  'If you are thinking about hurting yourself, or things feel like too much, please reach out to a person. These services are free and private.'

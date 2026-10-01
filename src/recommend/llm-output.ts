import { z } from 'zod'
import { GOALS } from '../catalog'

export const interpretSchema = z.object({
  goal: z.enum(GOALS).nullish(),
  activityIds: z.array(z.string()).max(10),
  reply: z.string(),
  intent: z.string().max(200).optional(),
  needsSupportResources: z.boolean(),
})
export type InterpretOut = z.infer<typeof interpretSchema>

export const rankSchema = z.object({
  picks: z
    .array(z.object({ activityId: z.string(), videoId: z.string(), reason: z.string() }))
    .max(8),
})
export type RankOut = z.infer<typeof rankSchema>

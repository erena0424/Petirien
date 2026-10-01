import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { recommend } from './recommend'

export const actions: Record<string, ActionHandler<Env>> = {
  recommend,
}

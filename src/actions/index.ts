import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { recommend } from './recommend'
import { reflectReplyAction, summarizeConversationAction } from './reflect'
import { refreshSaved } from './saved'

export const actions: Record<string, ActionHandler<Env>> = {
  recommend,
  refreshSaved,
  reflectReply: reflectReplyAction,
  summarizeConversation: summarizeConversationAction,
}

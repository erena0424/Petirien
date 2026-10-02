import type { Page } from '@playwright/test'

/**
 * The floating bunny is big and sits over the page, as designed. Tests that click
 * around the page tuck it small into the bottom-right corner, chat folded away, first (once per
 * browser session) so it is not in the way. The floating.spec tests do not use this.
 */
export const HOME_IDEAS_FIXTURE = {
  status: 'ok',
  ideas: [
    { activityId: 'body-scan', activityTitle: 'Body scan', reason: 'A slow, guided way to notice how you feel.', video: { videoId: 'homevid0001', title: 'Ten minute body scan', channel: 'Calm Channel', thumbnail: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', durationSec: 600, watchUrl: 'https://www.youtube.com/watch?v=homevid0001' } },
    { activityId: 'chair-yoga', activityTitle: 'Chair yoga', reason: 'Gentle stretches you can do sitting down.', video: { videoId: 'homevid0002', title: 'Seated stretch flow', channel: 'Calm Channel', thumbnail: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', durationSec: 480, watchUrl: 'https://www.youtube.com/watch?v=homevid0002' } },
  ],
}

export async function tuck(page: Page) {
  // Nearby places are a paid Maps search. Tests never make one unless they mock it themselves (their own route wins).
  await page.route('**/api/integrations/serpapi/places-search', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { local_results: [] } }) }),
  )
  // Home asks the server for two videos for right now (a YouTube search when not cached, which costs money). Tests never do that.
  await page.route('**/api/actions/homeIdeas', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: HOME_IDEAS_FIXTURE }) }),
  )
  // The app writes notes for old saved chats by itself (a real model call, billed). Chats left over from earlier test runs
  // are old, so without this a plain page load could spend money. A spec that watches this call registers its own route,
  // which takes priority over this one.
  await page.route('**/api/actions/summarizeConversation', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { status: 'ok' } }) }),
  )
  await page.addInitScript(() => {
    if (sessionStorage.getItem('tucked')) return
    sessionStorage.setItem('tucked', '1')
    // Never let a leftover "has used the calendar" flag make a page read the real calendar (a paid call) during a test.
    localStorage.removeItem('petirien.calendarUsed')
    localStorage.removeItem('petirien.placesAutoAt')
    localStorage.setItem('petirien.bunnyFloat', JSON.stringify({ right: 8, bottom: 8, size: 's', collapsed: true }))
  })
}

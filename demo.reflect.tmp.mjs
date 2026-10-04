import { chromium } from '@playwright/test'
const REFLECTIONS = [
  { date: '2026-09-02', title: 'Dentist appointment', msgs: ['The dentist appointment went fine. I was anxious for nothing.', 'I treated myself to a warm drink afterwards and sat in the sun for a few minutes.'] },
  { date: '2026-09-12', title: 'Birthday dinner for Jun', msgs: [
    "Jun's birthday dinner was tonight. I almost cancelled because I was worn out from the week.",
    "I'm glad I went. The restaurant was loud but warm, and everyone kept telling stories from college.",
    "I realized I haven't seen most of these people since spring. I felt a little guilty about that, but nobody made me feel it.",
    'Jun gave a small speech and I teared up a bit. It felt good to be around people who know me.',
    'On the way home I walked a few blocks instead of taking the bus. The air was cool and I felt calm.',
    'I want to be better about keeping in touch. Maybe a short message every week to someone.'] },
  { date: '2026-09-15', title: 'Quarterly review meeting', msgs: ['The quarterly review was stressful but fair.', 'I took notes on what to improve and left feeling more clear than worried.'] },
  { date: '2026-09-19', title: 'Hike at the arboretum', msgs: ['We hiked at the arboretum this morning and the leaves are starting to turn.', 'I felt calmer afterwards. I want to do this more often.'] },
  { date: '2026-09-22', title: 'Presentation to the team', msgs: [
    'I finally gave the presentation to the team today. I was nervous all morning and kept going over my slides.',
    'The first two minutes were shaky and my voice felt tight. After that I found my rhythm and it felt more like talking to friends.',
    "Someone asked a hard question about the timeline and I didn't have a perfect answer. I said I'd follow up, and nobody seemed bothered.",
    'My manager told me afterwards that the structure was clear. I wanted to believe it but part of me kept replaying the shaky start.',
    "I think I'm proud that I did it anyway. I practiced a lot and it paid off, even if it wasn't flawless.",
    "I'm tired now, in a good way. I want to do something calm tonight and not check my email."] },
  { date: '2026-09-24', title: 'Movie night', msgs: ['Movie night was cozy. I fell asleep halfway through, which is a sign I needed rest.', 'No regrets. I am going to go to bed early this week.'] },
  { date: '2026-10-01', title: 'Planning meeting', msgs: ['The planning meeting ran long and I felt scattered afterwards.', 'I wrote down three priorities for tomorrow and that helped me settle.'] },
  { date: '2026-10-02', title: 'Coffee with Sam', msgs: [
    "Coffee with Sam this morning. We hadn't talked properly in weeks.",
    "I told Sam I've been feeling stretched thin between work and everything else. Saying it out loud made it feel smaller.",
    "Sam shared that they've been struggling to keep a routine too. It was a relief not to be the only one.",
    'We talked about small habits that help. Sam walks after lunch and says it resets their afternoon.',
    'I left feeling lighter, and a bit hopeful. I want to try the walk idea this week.',
    'Later I noticed I was smiling on the way back to my desk. Small thing, but I noticed.'] },
]
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: '/private/tmp/claude-501/-Users-elena0424-VS-Code-MyAgents-Product-Ideas-Mental-Health/650d279c-d12c-457b-b486-3142387b0027/scratchpad/demo/state.json' })
const page = await ctx.newPage()
page.setDefaultTimeout(60000)
const words = async () => ((await page.getByTestId('bunny-words').first().textContent().catch(() => '')) || '').trim()
const fold = async () => { const t = page.getByTestId('floating-toggle'); if ((await t.count()) && (await t.getAttribute('aria-expanded')) === 'true') await t.click() }
for (const r of REFLECTIONS) {
  try {
    await page.goto('https://petirien.app.space/journal', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4500)
    await fold()
    await page.getByTestId('journal-view-month').click()
    if (r.date.startsWith('2026-09')) { await page.getByRole('button', { name: 'Previous month' }).click(); await page.waitForTimeout(1200) }
    await page.locator('[data-testid="journal-day"][data-date="' + r.date + '"]').click()
    await page.waitForTimeout(800)
    await page.getByTestId('agenda-event').filter({ hasText: r.title }).first().click()
    await page.getByTestId('event-dialog').getByRole('button', { name: 'Reflect on this' }).click()
    await page.waitForTimeout(2500)
    for (const m of r.msgs) {
      const before = await words()
      await page.getByLabel('Tell the bunny something').fill(m)
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await page.waitForFunction((prev) => { const el = document.querySelector('[data-testid="bunny-words"]'); const t = el && el.textContent ? el.textContent.trim() : ''; return t && t !== prev }, before, { timeout: 60000 })
      await page.waitForTimeout(900)
    }
    await page.getByTestId('journal-button').click()
    const ok = await page.getByTestId('notes-written').waitFor({ timeout: 90000 }).then(() => true).catch(() => false)
    console.log(r.date, r.title, '| messages:', r.msgs.length, '| journal written:', ok)
  } catch (e) {
    console.log(r.date, r.title, '| FAILED:', String(e).split('\n')[0].slice(0, 160))
  }
}
await ctx.storageState({ path: '/private/tmp/claude-501/-Users-elena0424-VS-Code-MyAgents-Product-Ideas-Mental-Health/650d279c-d12c-457b-b486-3142387b0027/scratchpad/demo/state.json' })
await b.close()
console.log('ALL DONE')

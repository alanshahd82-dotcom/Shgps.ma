import { launch, open, SP } from './lib.mjs'
const MOCK = 'http://127.0.0.1:3001'
const post = (p, body) => fetch(MOCK + p, { method: 'POST', body: JSON.stringify(body ?? {}) }).then(r => r.json())
const b = await launch()
const out = {}
// 1) offline vehicle (Camion Atlas): the button is there and the cut is queued
{
  const { page, errors } = await open(b, { path: '/client/vehicles', lang: 'fr', viewport: { width: 390, height: 1100 } })
  await page.waitForTimeout(1200)
  const offlineBtn = page.locator('button[aria-label="Couper dès le retour du signal"]').first()
  out.offlineButtonVisible = await offlineBtn.count()
  await offlineBtn.click()
  const dlg = page.getByRole('dialog')
  out.dialogNoteQueued = await dlg.getByText(/retour du signal/).count()
  await dlg.locator('input').fill('Secret123')
  await dlg.locator('button[type=submit]').click()
  await page.waitForTimeout(800)
  const seen = await fetch(MOCK + '/__seen').then(r => r.json())
  out.request = seen.filter(x => /command/.test(x.url)).map(x => [x.url, x.body])
  out.errors = errors
  await page.context().close()
}
// 2) a queued cut is shown as waiting and can be cancelled
await post('/__command', { command: { id: 9, type: 'engineStop', requested_state: 'stopped', status: 'pending', created_at: new Date().toISOString(), traccar_command_id: 5 }, deviceReply: null })
{
  const { page } = await open(b, { path: '/client/vehicles', lang: 'fr', viewport: { width: 390, height: 1100 } })
  await page.waitForTimeout(1200)
  const pendingBtn = page.locator('button[aria-label^="Coupure en attente"]').first()
  out.pendingLabelShown = await pendingBtn.count()
  await page.screenshot({ path: SP + '/Q-pending.png' })
  await pendingBtn.click()
  out.cancelConfirm = await page.locator('button[aria-label^="Confirmer l"]').first().innerText().catch(() => null)
  await page.locator('button[aria-label^="Confirmer l"]').first().click()
  await page.waitForTimeout(800)
  const seen = await fetch(MOCK + '/__seen').then(r => r.json())
  out.cancelRequest = seen.filter(x => /command/.test(x.url)).map(x => [x.url, x.body]).pop()
}
console.log(JSON.stringify(out, null, 1))
await b.close()

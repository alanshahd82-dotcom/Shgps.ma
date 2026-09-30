import { launch, open, SP } from './lib.mjs'
const MOCK = 'http://127.0.0.1:3001'
const seenCmd = async () => (await fetch(MOCK + '/__seen').then(r => r.json())).filter(x => /\/command$/.test(x.url)).map(x => x.body)
const b = await launch()
const out = {}
for (const lang of ['fr', 'ar']) {
  const { page, errors } = await open(b, { path: '/client/vehicles', lang, viewport: { width: 390, height: 1000 } })
  await page.waitForTimeout(1200)
  const cutBtn = page.locator('[role=button]').first().locator('button[aria-label]')
  await cutBtn.click()
  const dlg = page.getByRole('dialog')
  const r = { dialogOpen: await dlg.count(), requestsBefore: (await seenCmd()).length }
  const submit = dlg.locator('button[type=submit]')
  r.submitDisabledWhenEmpty = await submit.isDisabled()
  // wrong password: stays open, shows the reason, nothing succeeds
  await dlg.locator('input').fill('wrong-one')
  await submit.click()
  await page.waitForTimeout(600)
  r.afterWrong = { dialogStillOpen: await dlg.count(), alert: await dlg.getByRole('alert').innerText().catch(() => null) }
  await page.screenshot({ path: `${SP}/PW-${lang}-wrong.png` })
  // escape closes without sending
  const before = (await seenCmd()).length
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  r.closedByEscape = (await dlg.count()) === 0
  r.noExtraRequestOnEscape = (await seenCmd()).length === before
  // correct password: sent and the dialog closes
  await cutBtn.click()
  await dlg.locator('input').fill('Secret123')
  await dlg.locator('button[type=submit]').click()
  await page.waitForTimeout(900)
  const cmds = await seenCmd()
  r.lastRequest = cmds[cmds.length - 1]
  r.dialogClosedAfterSuccess = (await dlg.count()) === 0
  r.errors = errors
  out[lang] = r
  await page.context().close()
}
// vehicle page (admin view) uses the same modal
{
  const { page, errors } = await open(b, { role: 'admin', path: '/admin/vehicle/1', lang: 'fr', viewport: { width: 390, height: 1000 } })
  await page.waitForTimeout(1300)
  const btn = page.locator('.engine-cutoff-button')
  out.vehiclePage = { engineButton: await btn.count() }
  if (await btn.count()) {
    await btn.click()
    const dlg = page.getByRole('dialog')
    await dlg.locator('input').fill('nope'); await dlg.locator('button[type=submit]').click(); await page.waitForTimeout(500)
    out.vehiclePage.wrongKeepsOpen = (await dlg.count()) === 1
    await dlg.locator('input').fill('Secret123'); await dlg.locator('button[type=submit]').click(); await page.waitForTimeout(800)
    const cmds = await seenCmd()
    out.vehiclePage.lastRequest = cmds[cmds.length - 1]
    out.vehiclePage.closed = (await dlg.count()) === 0
  }
  out.vehiclePage.errors = errors
}
console.log(JSON.stringify(out, null, 1))
await b.close()

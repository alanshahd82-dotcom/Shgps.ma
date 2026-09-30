import { launch, open } from './lib.mjs'
const MOCK = 'http://127.0.0.1:3001'
const b = await launch()
await fetch(MOCK + '/__command', { method: 'POST', body: JSON.stringify({ command: { id: 11, type: 'engineStop', requested_state: 'stopped', status: 'sent', created_at: new Date().toISOString(), traccar_command_id: 5 }, deviceReply: null }) })
const { page, errors } = await open(b, { path: '/client/vehicles', lang: 'fr', viewport: { width: 390, height: 1000 } })
await page.waitForTimeout(1300)
const btn = page.locator('button[aria-label^="Coupure envoyée"]').first()
const out = { present: await btn.count(), disabled: await btn.isDisabled().catch(() => null) }
await btn.click()
const dlg = page.getByRole('dialog')
out.dialogTitle = await dlg.locator('h2').innerText()
await dlg.locator('input').fill('Secret123')
await dlg.locator('button[type=submit]').click()
await page.waitForTimeout(600)
const seen = await fetch(MOCK + '/__seen').then(r => r.json())
out.requests = seen.filter(x => /command/.test(x.url)).map(x => [x.url, x.body])
out.errors = errors
console.log(JSON.stringify(out))
await b.close()

import { launch, open } from './lib.mjs'
const MOCK = 'http://127.0.0.1:3001'
const b = await launch()
const { page, errors } = await open(b, { role: 'admin', path: '/admin/clients/5', lang: 'fr', viewport: { width: 1280, height: 850 } })
await page.getByText('Dacia Logan').first().click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: /Couper moteur/ }).click()
const dlg = page.getByRole('dialog')
const out = { dialog: await dlg.count() }
await dlg.locator('input').fill('nope'); await dlg.locator('button[type=submit]').click(); await page.waitForTimeout(500)
out.wrongKeepsOpen = (await dlg.count()) === 1
await dlg.locator('input').fill('Secret123'); await dlg.locator('button[type=submit]').click(); await page.waitForTimeout(700)
const cmds = (await fetch(MOCK + '/__seen').then(r => r.json())).filter(x => /\/command$/.test(x.url)).map(x => x.body)
out.last = cmds[cmds.length - 1]; out.closed = (await dlg.count()) === 0; out.errors = errors
console.log(JSON.stringify(out))
await b.close()

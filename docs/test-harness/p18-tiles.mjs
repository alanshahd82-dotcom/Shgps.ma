import { launch, open } from './lib.mjs'
const b = await launch()
const out = {}
const { page, errors } = await open(b, { path: '/client/home', lang: 'fr' })
await page.waitForTimeout(1200)
const tiles = await page.evaluate(() => [...document.querySelectorAll('section[aria-label] button')].slice(0, 4).map(x => x.innerText.replace(/\s+/g, ' ').trim()))
out.tiles = tiles
for (const [i, f] of [[0, 'moving'], [1, 'stopped'], [2, 'offline']]) {
  await page.goto('http://127.0.0.1:5173/client/home', { waitUntil: 'networkidle' }); await page.waitForTimeout(700)
  await page.locator('section[aria-label] button').nth(i).click()
  await page.waitForTimeout(600)
  out[f] = { url: page.url().split('/').pop(), cards: await page.locator('[role=button][aria-label]').count(), tile: tiles[i] }
}
out.errors = errors
console.log(JSON.stringify(out))
await b.close()

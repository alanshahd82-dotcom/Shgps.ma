import { launch, open } from './lib.mjs'
const b = await launch()
for (const lang of ['ar','fr']) {
  const { page, errors } = await open(b, { path: '/client/home', lang })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `hero-${lang}-a.png`, clip: { x: 0, y: 60, width: 390, height: 260 } })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `hero-${lang}-b.png`, clip: { x: 0, y: 60, width: 390, height: 260 } })
  console.log(lang, JSON.stringify(errors))
}
await b.close()

import { chromium } from 'playwright-core'
export async function launch() {
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
}
export async function open(browser, { role = 'client', viewport = { width: 390, height: 844 }, path = '/client/home', lang, geolocation, permissions } = {}) {
  const ctx = await browser.newContext({ viewport, ...(geolocation ? { geolocation } : {}), ...(permissions ? { permissions } : {}) })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push('CONSOLE: ' + m.text().slice(0, 200)) })
  if (lang) await page.addInitScript(l => localStorage.setItem('athargps_lang', l), lang)
  await page.addInitScript(role => {
    if (role === 'client') { localStorage.setItem('athargps_token', 'client-token'); localStorage.setItem('athargps_client', JSON.stringify({ id: 5, name: 'Client A', email: 'a@client.ma' })) }
    else { localStorage.setItem('athargps_token', 'admin-token'); localStorage.setItem('athargps_admin', JSON.stringify({ id: 1, name: 'Admin', email: 'admin@x.ma', isAdmin: true })) }
    localStorage.setItem('athargps_onboarding_seen', 'true')
  }, role)
  await page.goto('http://127.0.0.1:5173' + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  return { page, ctx, errors }
}
export async function setArabic(page) {
  // switch language through the app's own settings screen, like a real user
  const before = page.url()
  await page.goto('http://127.0.0.1:5173/client/settings', { waitUntil: 'networkidle' })
  const btn = page.getByText('العربية', { exact: true }).first()
  if (await btn.count()) await btn.click()
  await page.waitForTimeout(400)
  await page.evaluate(() => history.back())
}
export const SP = process.env.SP

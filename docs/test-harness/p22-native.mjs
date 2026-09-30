import { launch } from './lib.mjs'
const MOCK = 'http://127.0.0.1:3001'
const b = await launch()
const out = {}
for (const native of [true, false]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const apiHosts = new Set(); const wsUrls = []
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('websocket', ws => wsUrls.push(ws.url().replace(/token=[^&]+/, 'token=…')))
  await page.addInitScript(isNative => {
    if (isNative) window.androidBridge = { postMessage() {} }
    localStorage.setItem('athargps_token', 'client-token'); localStorage.setItem('athargps_client', JSON.stringify({ id: 5, name: 'Client A' })); localStorage.setItem('athargps_onboarding_seen', 'true'); localStorage.setItem('athargps_lang', 'ar')
  }, native)
  // the real server is not reachable from here: answer for it with the local mock, and record where the app called
  await page.route('https://athargps.com/**', async route => {
    const req = route.request(); const u = new URL(req.url()); apiHosts.add(u.host)
    const r = await fetch(MOCK + u.pathname + u.search, { method: req.method(), headers: { authorization: req.headers()['authorization'] || '', 'content-type': 'application/json' }, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() })
    await route.fulfill({ status: r.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: await r.text() })
  })
  page.on('request', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && u.host !== 'athargps.com') apiHosts.add(u.host) })
  await page.goto('http://127.0.0.1:5173/client/home', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  out[native ? 'native' : 'browser'] = { apiHosts: [...apiHosts], ws: wsUrls, showsVehicles: /Dacia Logan/.test(await page.evaluate(() => document.body.innerText)), errors }
  await ctx.close()
}
console.log(JSON.stringify(out, null, 1))
await b.close()

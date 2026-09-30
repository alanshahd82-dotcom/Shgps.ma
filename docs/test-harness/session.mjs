import { launch } from './lib.mjs'
const b = await launch()
const out = {}
async function ctxWith(role, init) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(([role, native]) => {
    if (native) window.androidBridge = { postMessage() {} }
    if (role === 'client') { localStorage.setItem('athargps_token', 'client-token'); localStorage.setItem('athargps_client', JSON.stringify({ id: 5, name: 'Client A', email: 'a@client.ma' })) }
    else { localStorage.setItem('athargps_token', 'admin-token'); localStorage.setItem('athargps_admin', JSON.stringify({ id: 1, name: 'Admin', email: 'admin@x.ma', isAdmin: true })) }
    localStorage.setItem('athargps_onboarding_seen', 'true'); localStorage.setItem('athargps_lang', 'ar')
  }, [role, init?.native])
  return { ctx, page, errors }
}
const path = page => new URL(page.url()).pathname

// 1) phone app, admin already signed in: opening the app goes straight to the admin panel
{
  const { ctx, page, errors } = await ctxWith('admin', { native: true })
  await page.route('https://athargps.com/**', async route => {
    const u = new URL(route.request().url())
    const r = await fetch('http://127.0.0.1:3001' + u.pathname + u.search, { headers: { authorization: route.request().headers()['authorization'] || '' } })
    await route.fulfill({ status: r.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: await r.text() })
  })
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
  out.adminNativeStart = { path: path(page), errors }
  await ctx.close()
}
// 2) network down at start (session check fails), client already signed in: no login form, then it recovers
{
  const { ctx, page, errors } = await ctxWith('client')
  let down = true
  await page.route('**/api/auth/me', route => down ? route.abort('failed') : route.continue())
  await page.goto('http://127.0.0.1:5173/client/home', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
  const during = { path: path(page), loginForm: await page.locator('input[type=password]').count() }
  down = false
  await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.waitForTimeout(1500)
  const after = { path: path(page), showsVehicles: /Dacia Logan/.test(await page.evaluate(() => document.body.innerText)) }
  out.networkDownAtStart = { during, after, errors }
  await ctx.close()
}
// 3) token expired: first /me answers 401, /auth/refresh renews it: still signed in, no login form
{
  const { ctx, page, errors } = await ctxWith('client')
  let first = true
  await page.route('**/api/auth/me', route => { if (first) { first = false; return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"expired"}' }) } return route.continue() })
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"token":"client-token"}' }))
  await page.goto('http://127.0.0.1:5173/client/home', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
  out.expiredTokenRenewed = { path: path(page), loginForm: await page.locator('input[type=password]').count(), errors }
  await ctx.close()
}
// 4) refresh refused (really signed out elsewhere): the login form is shown
{
  const { ctx, page } = await ctxWith('client')
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"expired"}' }))
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"no"}' }))
  await page.goto('http://127.0.0.1:5173/client/home', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
  out.trulyExpired = { path: path(page) }
  await ctx.close()
}
console.log(JSON.stringify(out, null, 1))
await b.close()

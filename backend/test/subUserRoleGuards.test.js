import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { requireRole } from '../src/middleware/requireRole.js'

function run(user, ...roles) {
  let status = null
  let nexted = false
  const res = { status(c) { status = c; return this }, json() { return this } }
  requireRole(...roles)({ user }, res, () => { nexted = true })
  return { nexted, status }
}

test('account owners and admins always pass', () => {
  assert.equal(run({ parent_client_id: null, role: 'owner' }, 'manager').nexted, true)
  assert.equal(run({ is_admin: true, parent_client_id: 5 }, 'manager').nexted, true)
})

test('sub-user needs the manager role for write actions', () => {
  assert.equal(run({ parent_client_id: 1, role: 'manager' }, 'manager').nexted, true)
  for (const role of ['viewer', 'reports', 'alerts']) {
    const r = run({ parent_client_id: 1, role }, 'manager')
    assert.equal(r.nexted, false)
    assert.equal(r.status, 403)
  }
})

const WRITE_ROUTES = {
  'src/routes/devices.js': /(\w+Router\.(?:post|patch|delete)\('[^']*',[^\n]*)/g,
  'src/routes/geofences.js': /(\w+Router\.(?:post|patch|delete)\('[^']*',[^\n]*)/g,
  'src/routes/maintenance.js': /(\w+Router\.(?:post|patch|delete)\('[^']*',[^\n]*)/g,
}

test('every write route in devices, geofences and maintenance requires the manager role', () => {
  for (const [file, re] of Object.entries(WRITE_ROUTES)) {
    const src = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    const lines = src.match(re) || []
    assert.ok(lines.length > 0, file)
    for (const line of lines) {
      assert.match(line, /requireRole\('manager'\)/, `${file}: ${line.slice(0, 80)}`)
    }
  }
})

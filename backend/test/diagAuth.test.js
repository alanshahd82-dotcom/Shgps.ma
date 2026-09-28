// The diagnostics endpoint must not be public any more.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

process.env.JWT_SECRET ||= 'test-secret'

test('GET /api/diag/offline rejects requests without a token', async () => {
  const { default: express } = await import('express')
  const { diagRouter } = await import('../src/routes/diag.js')
  const app = express()
  app.use('/api/diag', diagRouter)
  const server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)) })
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/diag/offline`)
    assert.equal(res.status, 401)
  } finally {
    server.close()
  }
})

test('the diagnostics route no longer runs shell commands', () => {
  const source = readFileSync(new URL('../src/routes/diag.js', import.meta.url), 'utf8')
  assert.ok(!/child_process|execSync/.test(source))
  assert.ok(/requireMainAdmin/.test(source))
})

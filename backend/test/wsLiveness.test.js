import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { startWsLiveness } from '../src/utils/wsLiveness.js'

const require = createRequire(import.meta.url)
const { WebSocketServer, WebSocket } = require('ws')

function startServer(options) {
  return new Promise(resolve => {
    const wss = new WebSocketServer({ port: 0, ...options }, () => resolve(wss))
  })
}
const connect = wss => new Promise(resolve => {
  const ws = new WebSocket(`ws://127.0.0.1:${wss.address().port}`)
  ws.on('open', () => resolve(ws))
})
const sleep = ms => new Promise(r => setTimeout(r, ms))

test('a connection whose peer stopped answering pings is terminated', async () => {
  const wss = await startServer({ autoPong: false })   // server never answers pings
  const ws = await connect(wss)
  let dead = false
  const closed = new Promise(resolve => ws.on('close', resolve))
  startWsLiveness(ws, { intervalMs: 40, timeoutMs: 80, onDead: () => { dead = true } })
  await Promise.race([closed, sleep(1500).then(() => { throw new Error('socket was not terminated') })])
  assert.equal(dead, true)
  wss.close()
})

test('a healthy connection that answers pings stays open', async () => {
  const wss = await startServer()                      // ws answers pings automatically
  const ws = await connect(wss)
  let dead = false
  startWsLiveness(ws, { intervalMs: 40, timeoutMs: 80, onDead: () => { dead = true } })
  await sleep(500)
  assert.equal(dead, false)
  assert.equal(ws.readyState, WebSocket.OPEN)
  ws.close()
  wss.close()
})

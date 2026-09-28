// Detects half-open WebSocket connections (network silently gone, no close
// event): ping regularly and terminate the socket when no pong comes back, so
// the normal "close" handling (reconnect / cleanup) runs.
export function startWsLiveness(ws, { intervalMs = 30000, timeoutMs = 10000, onDead } = {}) {
  let awaitingPong = false
  let killTimer = null

  ws.on('pong', () => {
    awaitingPong = false
    clearTimeout(killTimer)
  })

  const timer = setInterval(() => {
    if (ws.readyState !== 1 || awaitingPong) return
    awaitingPong = true
    try { ws.ping() } catch { /* the socket is already closing */ }
    killTimer = setTimeout(() => {
      if (!awaitingPong) return
      onDead?.()
      try { ws.terminate() } catch { /* already closed */ }
    }, timeoutMs)
    killTimer.unref?.()
  }, intervalMs)
  timer.unref?.()

  const stop = () => {
    clearInterval(timer)
    clearTimeout(killTimer)
  }
  ws.on('close', stop)
  return stop
}

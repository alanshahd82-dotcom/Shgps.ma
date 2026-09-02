import { Router } from 'express'
import { config } from '../config.js'

export const diagRouter = Router()

diagRouter.get('/offline', async (_req, res) => {
  const results = {
    ts: new Date().toISOString(),
    network: {},
    traccar: {},
    system: {},
  }

  try {
    const traccarUrl = config.traccar.url
    let sessionCookie = null
    try {
      const sessionRes = await fetch(`${traccarUrl}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          email: config.traccar.email,
          password: config.traccar.password,
        }).toString(),
      })
      const setCookie = sessionRes.headers.get('set-cookie') || ''
      const m = setCookie.match(/JSESSIONID=[^;]+/)
      sessionCookie = m ? m[0] : null
    } catch (e) {
      results.traccar.sessionError = e.message
    }

    const traccarGet = async (path) => {
      if (!sessionCookie) return { _error: 'no session' }
      const r = await fetch(`${traccarUrl}${path}`, {
        headers: { Cookie: sessionCookie, 'Content-Type': 'application/json' },
      })
      if (!r.ok) return { _error: `HTTP ${r.status}`, _status: r.status }
      if (r.status === 204) return null
      return r.json()
    }

    // 1. Traccar devices, positions, server
    const [allDevices, allPositions, serverInfo] = await Promise.all([
      traccarGet('/api/devices').catch(e => ({ _error: e.message })),
      traccarGet('/api/positions').catch(e => ({ _error: e.message })),
      traccarGet('/api/server').catch(e => ({ _error: e.message })),
    ])

    results.traccar.sessionOk = !!sessionCookie
    results.traccar.serverInfo = serverInfo
    results.traccar.allDeviceCount = Array.isArray(allDevices) ? allDevices.length : null
    results.traccar.allPositionCount = Array.isArray(allPositions) ? allPositions.length : null

    const targetIds = [37, 70]
    results.traccar.devices = Array.isArray(allDevices)
      ? allDevices.filter(d => targetIds.includes(d.id)).map(d => ({
          id: d.id, name: d.name, uniqueId: d.uniqueId,
          status: d.status, lastUpdate: d.lastUpdate, positionId: d.positionId,
          attributes: d.attributes || {},
        }))
      : allDevices

    results.traccar.positions = Array.isArray(allPositions)
      ? allPositions.filter(p => targetIds.includes(p.deviceId)).map(p => ({
          deviceId: p.deviceId, fixTime: p.fixTime, serverTime: p.serverTime,
          deviceTime: p.deviceTime, lat: p.latitude, lng: p.longitude,
          speed: p.speed, attributes: p.attributes || {},
        }))
      : allPositions

    // 2. Try Traccar log API (some versions support it)
    results.traccar.logApi = await traccarGet('/api/server/log').catch(e => ({ _error: e.message }))

    // 3. Try Traccar events with different endpoint formats
    const now = new Date()
    const from = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    const fromStr = from.toISOString()
    const toStr = now.toISOString()

    const [events37, events70, eventsAll] = await Promise.all([
      traccarGet(`/api/events?deviceId=37&from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`).catch(e => ({ _error: e.message })),
      traccarGet(`/api/events?deviceId=70&from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`).catch(e => ({ _error: e.message })),
      traccarGet('/api/events').catch(e => ({ _error: e.message })),
    ])

    const formatEvents = (evs) => Array.isArray(evs)
      ? evs.slice(-30).map(e => ({
          id: e.id, type: e.type, eventTime: e.eventTime,
          deviceId: e.deviceId, positionId: e.positionId,
          attributes: e.attributes || {},
        }))
      : evs

    results.traccar.events37 = formatEvents(events37)
    results.traccar.events70 = formatEvents(events70)
    results.traccar.eventsAll = formatEvents(eventsAll)

    // 4. Poll positions after 15s
    if (sessionCookie) {
      await new Promise(r => setTimeout(r, 15000))
      try {
        const pollRes = await fetch(`${traccarUrl}/api/positions`, {
          headers: { Cookie: sessionCookie, 'Content-Type': 'application/json' },
        })
        if (pollRes.ok) {
          const pollPositions = await pollRes.json()
          results.traccar.pollAfter15s = {}
          for (const id of targetIds) {
            const p = pollPositions.find(x => x.deviceId === id)
            results.traccar.pollAfter15s[`device${id}`] = p
              ? { serverTime: p.serverTime, fixTime: p.fixTime, lat: p.latitude, lng: p.longitude }
              : null
          }
        }
      } catch (e) {
        results.traccar.pollAfter15s = { error: e.message }
      }
    }

    // 5. Network checks
    const { createConnection } = await import('node:net')
    const fs = await import('node:fs')

    let dockerGateway = null
    try {
      const route = fs.readFileSync('/proc/net/route', 'utf8')
      const lines = route.split('\n').slice(1)
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 3 && parts[1] === '00000000') {
          const gwHex = parts[2]
          const gwBytes = Buffer.from(gwHex, 'hex')
          dockerGateway = `${gwBytes[3]}.${gwBytes[2]}.${gwBytes[1]}.${gwBytes[0]}`
          break
        }
      }
    } catch (e) {
      dockerGateway = null
    }
    results.network.dockerGateway = dockerGateway

    // Get public IP
    let publicIp = null
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) })
      if (ipRes.ok) {
        const ipData = await ipRes.json()
        publicIp = ipData.ip
      }
    } catch (e) {
      results.network.publicIpError = e.message
    }
    results.network.publicIp = publicIp

    const testPort = (host, port, label) => new Promise((resolve) => {
      const sock = createConnection({ host, port }, () => {
        sock.destroy()
        resolve({ host, port, label, status: 'connected' })
      })
      sock.on('error', (e) => resolve({ host, port, label, status: 'error', error: e.code || e.message }))
      sock.setTimeout(5000, () => { sock.destroy(); resolve({ host, port, label, status: 'timeout' }) })
    })

    const connectivityTests = [
      testPort('traccar', 5023, 'docker-network-5023-gt06'),
      testPort('traccar', 8082, 'docker-network-8082-api'),
      testPort('traccar', 5029, 'docker-network-5029-wanway'),
      testPort('postgres', 5432, 'docker-network-5432-pg'),
    ]
    if (dockerGateway) {
      connectivityTests.push(testPort(dockerGateway, 5023, 'docker-gateway-5023-host-published'))
      connectivityTests.push(testPort(dockerGateway, 80, 'docker-gateway-80-nginx'))
      connectivityTests.push(testPort(dockerGateway, 443, 'docker-gateway-443-nginx'))
    }
    // Test public IP on port 5023 (hairpin NAT test)
    if (publicIp) {
      connectivityTests.push(testPort(publicIp, 5023, 'public-ip-5023-hairpin'))
      connectivityTests.push(testPort(publicIp, 80, 'public-ip-80-nginx'))
      connectivityTests.push(testPort(publicIp, 443, 'public-ip-443-nginx'))
    }
    results.network.connectivity = await Promise.all(connectivityTests)

    // 6. /proc/net/tcp for port 5023
    try {
      const PORT_HEX = (5023).toString(16)
      const parseTcp = (file) => {
        try {
          const content = fs.readFileSync(file, 'utf8')
          return content.split('\n').slice(1).map(line => {
            const parts = line.trim().split(/\s+/)
            if (parts.length < 4) return null
            return {
              local: parts[1], remote: parts[2], state: parts[3],
              uid: parts[7], inode: parts[9],
            }
          }).filter(Boolean)
        } catch (e) {
          return []
        }
      }
      const tcp = parseTcp('/proc/net/tcp')
      const tcp6 = parseTcp('/proc/net/tcp6')
      const port5023Conns = [...tcp, ...tcp6].filter(c =>
        c.local?.endsWith(':' + PORT_HEX) || c.remote?.endsWith(':' + PORT_HEX)
      )
      results.network.procNetTcp = {
        port5023Hex: PORT_HEX,
        port5023Connections: port5023Conns,
        totalTcp: tcp.length,
        totalTcp6: tcp6.length,
      }
    } catch (e) {
      results.network.procNetTcp = { error: e.message }
    }

    // 7. System commands
    const { execSync } = await import('node:child_process')
    const tryCmd = (cmd) => {
      try {
        const output = execSync(cmd, { timeout: 5000, encoding: 'utf8' })
        return { output: output.substring(0, 3000) }
      } catch (e) {
        return { error: (e.message || 'failed').substring(0, 300) }
      }
    }
    results.system.commands = {
      ss_tlnp: tryCmd('ss -tlnp 2>&1 || true'),
      netstat_tlnp: tryCmd('netstat -tlnp 2>&1 || true'),
      iptables_nat: tryCmd('iptables -t nat -L DOCKER -n 2>&1 || true'),
      iptables_input: tryCmd('iptables -L INPUT -n 2>&1 || true'),
      docker_ps: tryCmd('docker ps --format "{{.Names}} {{.Ports}}" 2>&1 || true'),
      ufw: tryCmd('ufw status 2>&1 || true'),
      // Try to read Traccar log if volume is accessible
      traccar_log: tryCmd('tail -100 /opt/traccar/data/logs/tracker-server.log 2>&1 || true'),
      // Try cat /proc/net/tcp for all connections
      proc_net_tcp: tryCmd('cat /proc/net/tcp 2>&1 | head -50 || true'),
    }

    res.json(results)
  } catch (e) {
    results._fatalError = e.message
    results._stack = e.stack?.split('\n').slice(0, 5)
    res.status(500).json(results)
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { speedDisplay, speedBadgeHtml } from '../../src/utils/mapSpeed.js'
import { MARKER_SIZE, SELECTED_BOOST, markerScaleForZoom } from '../../src/utils/markerSize.js'

test('MAP-SPEED-1: moving vehicle shows current speed', () => {
  const device = { speed: 23, status: 'online', lang: 'fr' }
  const result = speedDisplay(device, 'moving')
  assert.equal(result.kmh, 23)
  assert.equal(result.unit, 'km/h')
})

test('MAP-SPEED-2: stopped vehicle shows 0 km/h', () => {
  const device = { speed: 0, status: 'online', lang: 'fr' }
  const result = speedDisplay(device, 'stopped')
  assert.equal(result.kmh, 0)
  assert.equal(result.unit, 'km/h')
})

test('MAP-SPEED-3: offline vehicle does not show stale speed', () => {
  const device = { speed: 45, status: 'offline', lang: 'fr' }
  const result = speedDisplay(device, 'offline')
  assert.equal(result, null)
})

test('MAP-SPEED-4: power-disconnected vehicle does not show stale speed', () => {
  const device = { speed: 45, status: 'online', powerDisconnected: true, lang: 'fr' }
  const result = speedDisplay(device, 'online')
  assert.equal(result, null)
})

test('MAP-SPEED-5: speed badge HTML contains no status text', () => {
  const device = { speed: 23, status: 'online', lang: 'fr' }
  const html = speedBadgeHtml(device, 'moving')
  assert.ok(!html.includes('En ligne'), 'no "En ligne" text')
  assert.ok(!html.includes('Offline'), 'no "Offline" text')
  assert.ok(!html.includes('D\u00e9connect'), 'no "D\u00e9connect\u00e9" text')
  assert.ok(!html.includes('status-bubble'), 'no status bubble class')
  assert.ok(!html.includes('formatAge'), 'no age formatter')
})

test('MAP-SPEED-6: speed badge HTML shows only speed number and unit', () => {
  const device = { speed: 23, status: 'online', lang: 'fr' }
  const html = speedBadgeHtml(device, 'moving')
  assert.ok(html.includes('data-live-speed-num'), 'has speed number element')
  assert.ok(html.includes('>23<'), 'shows speed value 23')
  assert.ok(html.includes('km/h'), 'shows km/h unit')
})

test('MAP-SPEED-7: offline badge HTML is hidden', () => {
  const device = { speed: 45, status: 'offline', lang: 'fr' }
  const html = speedBadgeHtml(device, 'offline')
  assert.ok(html.includes('is-hidden'), 'badge is hidden when offline')
})

test('MAP-SPEED-8: Arabic unit is correct', () => {
  const device = { speed: 23, status: 'online', lang: 'ar' }
  const result = speedDisplay(device, 'moving')
  assert.equal(result.unit, '\u0643\u0645/\u0633')
})

test('MAP-SPEED-9: NaN speed is hidden (no fabricated 0)', () => {
  const device = { speed: NaN, status: 'online', lang: 'fr' }
  const result = speedDisplay(device, 'online')
  assert.equal(result, null)
})

test('MAP-SPEED-10: null speed is hidden', () => {
  const device = { speed: null, status: 'online', lang: 'fr' }
  const result = speedDisplay(device, 'online')
  assert.equal(result, null)
})

test('MAP-SPEED-11: speed badge HTML does not contain map camera calls', () => {
  const device = { speed: 23, status: 'online', lang: 'fr' }
  const html = speedBadgeHtml(device, 'moving')
  assert.ok(!html.includes('setView'), 'no setView')
  assert.ok(!html.includes('flyTo'), 'no flyTo')
  assert.ok(!html.includes('fitBounds'), 'no fitBounds')
  assert.ok(!html.includes('panBy'), 'no panBy')
  assert.ok(!html.includes('setZoom'), 'no setZoom')
})

test('MAP-SPEED-12: speedDisplay is a pure function (no map reference)', () => {
  const device = { speed: 23, status: 'online', lang: 'fr' }
  const result = speedDisplay(device, 'moving')
  assert.equal(typeof result, 'object')
  assert.equal(result.kmh, 23)
  // Pure function: same input always produces same output
  const result2 = speedDisplay(device, 'moving')
  assert.deepEqual(result, result2)
})

test('MAP-SPEED-13: existing marker size remains unchanged', () => {
  assert.ok(MARKER_SIZE.bike > 60, 'bike marker still enlarged')
  assert.ok(MARKER_SIZE.car > 68, 'car marker still enlarged')
  assert.ok(MARKER_SIZE.truck > 76, 'truck marker still enlarged')
  assert.ok(SELECTED_BOOST > 0, 'selected boost still positive')
})

test('MAP-SPEED-14: markerScaleForZoom stays in safe visual range (no camera change)', () => {
  for (const zoom of [8, 10, 12, 13, 15, 18]) {
    const scale = markerScaleForZoom(zoom)
    assert.ok(scale >= 0.78 && scale <= 1.12, 'scale stays in safe visual range')
  }
})

test('MAP-SPEED-15: km/h unit remains correct for French', () => {
  const device = { speed: 50, status: 'online', lang: 'fr' }
  const result = speedDisplay(device, 'moving')
  assert.equal(result.unit, 'km/h')
})

test('MAP-SPEED-16: speed rounds correctly', () => {
  const device = { speed: 23.7, status: 'online', lang: 'fr' }
  const result = speedDisplay(device, 'moving')
  assert.equal(result.kmh, 24)
})

test('MAP-SPEED-17: negative speed is clamped to 0', () => {
  const device = { speed: -5, status: 'online', lang: 'fr' }
  const result = speedDisplay(device, 'moving')
  assert.equal(result.kmh, 0)
})

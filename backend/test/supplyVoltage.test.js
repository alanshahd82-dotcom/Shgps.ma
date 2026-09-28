// Phase 7 — a measured supply voltage of ~0 V is real data.
//
//   - unknown (no reading) is never shown as 0 V;
//   - a tracker whose supply sensor is known to work and reads ~0 V in
//     several distinct packets IS a power loss and is shown as 0 V;
//   - one glitchy packet, or a device that never reported a real battery
//     voltage (unwired analog input), never raises a power loss;
//   - a normal voltage afterwards restores the state.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectExternalPowerLoss,
  detectExternalPowerRestored,
  extractRawSupplyReading,
  markVehicleConnected,
  clearVehicleVoltage,
  observeVehicleVoltage,
  readVehicleVoltage,
  readLastKnownVehicleVoltage,
  resetSupplySensorState,
} from '../src/services/vehicleTelemetry.js'

let seq = 0
function pos(id, attributes) {
  seq += 1
  const iso = new Date(Date.now() + seq).toISOString()
  return { id: seq, deviceId: id, serverTime: iso, deviceTime: iso, fixTime: iso, attributes }
}
function reset(id) {
  markVehicleConnected(id)
  clearVehicleVoltage(id)
  resetSupplySensorState(id)
}

test('no reading is unknown, never 0', () => {
  assert.equal(extractRawSupplyReading(pos(1, {})), null)
  assert.equal(extractRawSupplyReading(pos(1, { adc1: '' })), null)
  assert.equal(extractRawSupplyReading(pos(1, { adc1: null })), null)
  assert.equal(extractRawSupplyReading(pos(1, { charge: false })), null)
  assert.equal(extractRawSupplyReading(pos(1, { adc1: 0 })), 0)
})

test('sensor known to work + two packets at 0 V = confirmed power loss shown as 0 V', () => {
  const D = 9101
  reset(D)
  observeVehicleVoltage(pos(D, { adc1: 12.8 }))
  const p1 = pos(D, { adc1: 0, alarm: 'powerCut' })
  assert.equal(detectExternalPowerLoss(p1)?.source === 'supply:low', false, 'one packet is not enough')
  const p2 = pos(D, { adc1: 0 })
  assert.equal(detectExternalPowerLoss(p2)?.source, 'supply:low')
  // the same packet evaluated by another caller gives the same answer
  assert.equal(detectExternalPowerLoss(p2)?.source, 'supply:low')
  assert.equal(readVehicleVoltage(p2, D), 0)
  assert.deepEqual(readLastKnownVehicleVoltage(D)?.voltage, 0)
})

test('a single glitch packet does not raise a power loss', () => {
  const D = 9102
  reset(D)
  observeVehicleVoltage(pos(D, { adc1: 12.6 }))
  assert.equal(detectExternalPowerLoss(pos(D, { adc1: 0 }))?.source, undefined)
  assert.equal(detectExternalPowerLoss(pos(D, { adc1: 12.5 })), null)
  assert.equal(detectExternalPowerLoss(pos(D, { adc1: 0 }))?.source, undefined)
})

test('a device that never reported a real battery voltage never gets a supply-loss', () => {
  const D = 9103
  reset(D)
  for (let i = 0; i < 4; i += 1) {
    assert.equal(detectExternalPowerLoss(pos(D, { adc1: 0 }))?.source, undefined)
  }
  assert.equal(readVehicleVoltage(pos(D, { adc1: 0 }), D), null)
})

test('a normal voltage after the loss restores the state', () => {
  const D = 9104
  reset(D)
  observeVehicleVoltage(pos(D, { adc1: 12.9 }))
  detectExternalPowerLoss(pos(D, { adc1: 0 }))
  assert.equal(detectExternalPowerLoss(pos(D, { adc1: 0 }))?.source, 'supply:low')
  const back = pos(D, { adc1: 12.7 })
  assert.equal(detectExternalPowerRestored(back)?.source, 'supply:normal')
  assert.equal(detectExternalPowerLoss(back), null)
})

test('a silent tracker (no attribute at all) is still unknown, not a loss', () => {
  const D = 9105
  reset(D)
  observeVehicleVoltage(pos(D, { adc1: 12.9 }))
  for (let i = 0; i < 3; i += 1) assert.equal(detectExternalPowerLoss(pos(D, {})), null)
})

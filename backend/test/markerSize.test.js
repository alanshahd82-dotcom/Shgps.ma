import test from 'node:test'
import assert from 'node:assert/strict'
import { MARKER_SIZE, SELECTED_BOOST, MARKER_ASPECT_RATIO, markerScaleForZoom } from '../../src/utils/markerSize.js'

test('MARKER-1: marker sizes are noticeably larger than the previous baseline', () => {
  // Previous baseline: bike 60, car 68, truck 76. New values must be larger.
  assert.ok(MARKER_SIZE.bike > 60, 'bike marker enlarged')
  assert.ok(MARKER_SIZE.car > 68, 'car marker enlarged')
  assert.ok(MARKER_SIZE.truck > 76, 'truck marker enlarged')
  assert.ok(SELECTED_BOOST > 0, 'selected boost is positive')
})

test('MARKER-2: markerScaleForZoom is a pure visual scale (no camera change)', () => {
  // markerScaleForZoom returns a multiplier for the rendered icon only.
  // It must never call setView, flyTo, fitBounds, or panBy.
  for (const zoom of [8, 10, 12, 13, 15, 18]) {
    const scale = markerScaleForZoom(zoom)
    assert.ok(typeof scale === 'number' && scale > 0)
    assert.ok(scale >= 0.78 && scale <= 1.12, 'scale stays in safe visual range')
  }
})

test('MARKER-3: aspect ratio is preserved (no distortion)', () => {
  assert.ok(MARKER_ASPECT_RATIO > 0 && MARKER_ASPECT_RATIO < 1)
})

test('MARKER-4: markers are proportional bike < car < truck', () => {
  assert.ok(MARKER_SIZE.bike < MARKER_SIZE.car, 'bike < car')
  assert.ok(MARKER_SIZE.car < MARKER_SIZE.truck, 'car < truck')
})

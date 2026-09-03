// Test D: Verifies that resolveEngineCommand with protocol=gt06 returns
// the standard Traccar path (type=engineStop, not custom), which lets
// Traccar Gt06ProtocolEncoder produce the wire command Relay,1#.
//
// This test imports the REAL traccar.js module (no mocking).
// It only calls resolveEngineCommand (a pure function, no HTTP).
//
// Run: node --test test/gt06StandardPath.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

// Set synthetic JWT_SECRET before importing the real module.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-not-for-production';
}

const { resolveEngineCommand } = await import('../src/services/traccar.js');

test('D: GT06 protocol routes to standard engineStop path (not custom)', () => {
  const result = resolveEngineCommand({
    type: 'engineStop',
    protocol: 'gt06',
    deviceAttributes: {},
  });
  assert.equal(result.type, 'engineStop', 'must return type=engineStop for standard GT06 path');
  assert.deepEqual(result.attributes, {}, 'standard path has empty attributes');
  assert.equal(result.profile, 'traccar-standard', 'must use traccar-standard profile');
});

test('D: GT06 standard path does NOT produce custom Relay,1#', () => {
  const result = resolveEngineCommand({
    type: 'engineStop',
    protocol: 'gt06',
    deviceAttributes: {},
  });
  assert.notEqual(result.type, 'custom', 'must NOT fall into custom fallback');
  assert.ok(!result.attributes?.data, 'must NOT have custom data attribute (Relay,1#)');
});

test('D: empty protocol falls to custom fallback (Relay,1#) - regression guard', () => {
  const result = resolveEngineCommand({
    type: 'engineStop',
    protocol: '',
    deviceAttributes: {},
  });
  assert.equal(result.type, 'custom', 'empty protocol must fall to custom fallback');
  assert.equal(result.attributes?.data, 'Relay,1#', 'fallback must produce Relay,1#');
});

test('D: GT06 with engineStopCommand attribute still uses explicit custom', () => {
  const result = resolveEngineCommand({
    type: 'engineStop',
    protocol: 'gt06',
    deviceAttributes: { engineStopCommand: 'DYD#' },
  });
  assert.equal(result.type, 'custom', 'explicit engineStopCommand overrides protocol');
  assert.equal(result.attributes?.data, 'DYD#', 'must use the explicit command string');
});
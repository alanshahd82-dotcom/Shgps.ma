// Real-module import test for engineCommands.js
// Proves the production module loads without syntax/import errors.
// This test imports the REAL module — not an in-memory model.
//
// Run: node --test test/engineCommands.import.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import * as engineCommands from '../src/services/engineCommands.js';

test('module loads without syntax errors', () => {
  assert.ok(engineCommands, 'module should be importable');
});

test('module exports expected functions', () => {
  assert.equal(typeof engineCommands.createRequest, 'function');
  assert.equal(typeof engineCommands.getActiveCommand, 'function');
  assert.equal(typeof engineCommands.getCommand, 'function');
  assert.equal(typeof engineCommands.reconfirmCommand, 'function');
  assert.equal(typeof engineCommands.cancelActiveCommand, 'function');
  assert.equal(typeof engineCommands.cancel, 'function');
  assert.equal(typeof engineCommands.deliverOnce, 'function');
  assert.equal(typeof engineCommands.transition, 'function');
  assert.equal(typeof engineCommands.processPendingCommands, 'function');
  assert.equal(typeof engineCommands.processPendingCommandsForDevice, 'function');
  assert.equal(typeof engineCommands.startCommandWorker, 'function');
  assert.equal(typeof engineCommands.onDeviceActivity, 'function');
  assert.equal(typeof engineCommands.reconcileCancellation, 'function');
});

test('module exports expected constants', () => {
  assert.ok(Array.isArray(engineCommands.IN_FLIGHT_STATUSES));
  assert.deepEqual(engineCommands.IN_FLIGHT_STATUSES, ['requested', 'pending', 'sent']);
  assert.ok(Array.isArray(engineCommands.DELIVERED_STATUSES));
  assert.deepEqual(engineCommands.DELIVERED_STATUSES, ['unconfirmed', 'delivered']);
  assert.ok(Array.isArray(engineCommands.ACTIONABLE_STATUSES));
  assert.deepEqual(engineCommands.ACTIONABLE_STATUSES,
    ['requested', 'pending', 'sent', 'unconfirmed', 'delivered']);
  assert.ok(Array.isArray(engineCommands.TERMINAL_STATUSES));
  assert.ok(Array.isArray(engineCommands.COMMAND_TYPES));
  assert.deepEqual(engineCommands.COMMAND_TYPES, ['engineStop', 'engineResume']);
});

test('module exports expected error classes', () => {
  assert.equal(typeof engineCommands.CommandConflictError, 'function');
  assert.equal(typeof engineCommands.InvalidCommandError, 'function');
  const err = new engineCommands.InvalidCommandError('test');
  assert.ok(err instanceof Error);
  assert.equal(err.message, 'test');
});

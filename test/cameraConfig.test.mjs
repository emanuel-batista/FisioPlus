import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCameraConstraints } from '../src/cameraConfig.js';

test('buildCameraConstraints uses exact device selection when provided', () => {
  const constraints = buildCameraConstraints('cam-123');

  assert.deepEqual(constraints.video.deviceId, { exact: 'cam-123' });
  assert.equal(constraints.video.facingMode, undefined);
});

test('buildCameraConstraints falls back to user camera when no device is selected', () => {
  const constraints = buildCameraConstraints();

  assert.equal(constraints.video.deviceId, undefined);
  assert.equal(constraints.video.facingMode, 'user');
});

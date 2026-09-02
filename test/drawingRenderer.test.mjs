import test from 'node:test';
import assert from 'node:assert/strict';
import { clampNormalizedPoint } from '../src/drawingRenderer.js';

test('clampNormalizedPoint keeps pose and bar markers inside the frame bounds', () => {
  const clamped = clampNormalizedPoint({ x: 1.15, y: -0.2, z: 0.5 });

  assert.deepEqual(clamped, { x: 1, y: 0, z: 0.5 });
});

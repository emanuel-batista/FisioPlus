import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/gameEngine.js';

test('GameEngine.adjustRepetition increments and decrements safely', () => {
  const engine = new GameEngine();

  engine.adjustRepetition(1);
  assert.equal(engine.repsCount, 1);

  engine.adjustRepetition(-1);
  assert.equal(engine.repsCount, 0);

  engine.adjustRepetition(-5);
  assert.equal(engine.repsCount, 0);
});

test('GameEngine.adjustRepetition preserves debug total mode target', () => {
  const engine = new GameEngine();
  engine.setDebugMode(true);

  engine.adjustRepetition(2);
  assert.equal(engine.repsCount, 2);
  assert.equal(engine.targetReps, Infinity);
});

test('GameEngine.toggleDebugMode transitions screens and sets state', () => {
  const engine = new GameEngine();
  assert.equal(engine.isDebugMode, false);

  engine.toggleDebugMode(true);
  assert.equal(engine.isDebugMode, true);
  assert.equal(engine.currentScreen, 'game');
  assert.equal(engine.targetReps, Infinity);

  engine.toggleDebugMode(false);
  assert.equal(engine.isDebugMode, false);
  assert.equal(engine.targetReps, 10);
});

test('GameEngine.simulateRepetition increments count and triggers callback', () => {
  const engine = new GameEngine();
  let reported = null;
  engine.onRepCount = (data) => { reported = data; };

  engine.simulateRepetition();
  assert.equal(engine.repsCount, 1);
  assert.equal(reported?.reps, 1);
});

test('GameEngine.triggerVictory fires onVictory callback', () => {
  const engine = new GameEngine();
  let victoryData = null;
  engine.onVictory = (data) => { victoryData = data; };

  engine.triggerVictory();
  assert.ok(victoryData !== null);
  assert.ok(victoryData.accuracy >= 90);
});


import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_SPEED,
  GAME_PROMO_DROPS_THRESHOLD,
  GAME_PROMO_SCORE_THRESHOLD,
  LANE_WIDTH,
  createInitialGameState,
  getDifficultySpeed,
  getPromoProgress,
  laneToWorldX,
  shiftLane,
  startRun,
  stepGameState,
  triggerJump,
} from './gameLogic';

test('shiftLane clamps strictly within -1..1 and lateral damping converges to target lane X', () => {
  let state = startRun(createInitialGameState());
  state = shiftLane(state, -1);
  assert.equal(state.lane, -1);
  state = shiftLane(state, -1);
  assert.equal(state.lane, -1);

  state = shiftLane(state, 1);
  state = shiftLane(state, 1);
  assert.equal(state.lane, 1);

  for (let i = 0; i < 40; i++) {
    state = stepGameState(state, 1 / 60, () => 0.9).state;
  }
  assert.ok(Math.abs(state.x - laneToWorldX(1)) < 0.05);
  assert.equal(laneToWorldX(1), LANE_WIDTH);
});

test('Ollie jump executes with input buffering, arcs above barrier clearance, and lands with squash feedback', () => {
  let state = startRun(createInitialGameState());
  state = triggerJump(state);

  let ollieFired = false;
  let peakY = 0;
  let landed = false;

  for (let i = 0; i < 90; i++) {
    const res = stepGameState(state, 1 / 60, () => 0.9);
    state = res.state;
    if (res.events.some((e) => e.type === 'ollie')) ollieFired = true;
    if (state.y > peakY) peakY = state.y;
    if (res.events.some((e) => e.type === 'land')) {
      landed = true;
      break;
    }
  }

  assert.equal(ollieFired, true);
  assert.ok(peakY > 1.8, `Expected Ollie apex > 1.8m, got ${peakY}`);
  assert.equal(landed, true);
  assert.equal(state.grounded, true);
  assert.ok(state.squashY < 0.9, 'Landing should trigger squash compression');
});

test('Jumping clears a low barrier while staying grounded collides, deducts a life, and activates hitstop + invulnerability', () => {
  // Grounded collision
  let groundedState = startRun(createInitialGameState());
  groundedState.entities = [
    {
      id: 1,
      kind: 'barrier',
      lane: 0,
      targetLane: 0,
      z: -0.4,
      collected: false,
      hit: false,
      telegraph: 0,
      swerved: false,
    },
  ];
  const hitRes = stepGameState(groundedState, 1 / 60, () => 0.5);
  assert.equal(hitRes.state.lives, 2);
  assert.ok(hitRes.state.hitstopTimer > 0);
  assert.ok(hitRes.state.invulnTimer > 1);
  assert.ok(hitRes.events.some((e) => e.type === 'hit'));

  // Jumping over the same barrier avoids collision
  let jumpingState = startRun(createInitialGameState());
  jumpingState.y = 1.65;
  jumpingState.vy = 2;
  jumpingState.grounded = false;
  jumpingState.entities = [
    {
      id: 2,
      kind: 'barrier',
      lane: 0,
      targetLane: 0,
      z: -0.4,
      collected: false,
      hit: false,
      telegraph: 0,
      swerved: false,
    },
  ];
  const clearRes = stepGameState(jumpingState, 1 / 60, () => 0.5);
  assert.equal(clearRes.state.lives, 3);
  assert.equal(clearRes.events.some((e) => e.type === 'hit'), false);
});

test('Collecting OSSK drop crates increments drops, combo multiplier, and unlocks OSSK15 reward at threshold', () => {
  let state = startRun(createInitialGameState());
  state.drops = GAME_PROMO_DROPS_THRESHOLD - 1;
  state.entities = [
    {
      id: 10,
      kind: 'drop',
      lane: 0,
      targetLane: 0,
      z: -0.2,
      collected: false,
      hit: false,
      telegraph: 0,
      swerved: false,
    },
  ];

  const res = stepGameState(state, 1 / 60, () => 0.5);
  assert.equal(res.state.drops, GAME_PROMO_DROPS_THRESHOLD);
  assert.equal(res.state.combo, 2);
  assert.equal(res.state.promoUnlocked, true);
  assert.equal(getPromoProgress(res.state), 1);
  assert.ok(res.events.some((e) => e.type === 'collect'));
  assert.ok(res.events.some((e) => e.type === 'unlock'));

  // Also verify score threshold unlock
  let scoreState = startRun(createInitialGameState());
  scoreState.score = GAME_PROMO_SCORE_THRESHOLD + 2;
  const scoreRes = stepGameState(scoreState, 1 / 60, () => 0.5);
  assert.equal(scoreRes.state.promoUnlocked, true);
});

test('Moving delivery trolley telegraphs and swerves toward its target lane as it approaches', () => {
  let state = startRun(createInitialGameState());
  state.entities = [
    {
      id: 22,
      kind: 'trolley',
      lane: -1,
      targetLane: 1,
      z: -32,
      collected: false,
      hit: false,
      telegraph: 0,
      swerved: false,
    },
  ];

  // Step forward so trolley crosses z = -28 and begins swerving
  for (let i = 0; i < 40; i++) {
    state = stepGameState(state, 1 / 60, () => 0.5).state;
  }

  const trolley = state.entities.find((e) => e.id === 22);
  assert.ok(trolley, 'Trolley should still be active');
  assert.equal(trolley.swerved, true);
  assert.ok(trolley.telegraph > 0.8);
  assert.ok(trolley.lane > -0.8, `Expected trolley lane to shift toward 1, got ${trolley.lane}`);
  assert.ok(getDifficultySpeed(400) > BASE_SPEED);
});

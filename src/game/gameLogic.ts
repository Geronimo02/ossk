export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type LaneIndex = -1 | 0 | 1;

export type EntityKind = 'drop' | 'barrier' | 'bollard' | 'trolley';

export interface RunEntity {
  id: number;
  kind: EntityKind;
  lane: number; // Continuous lane position (-1..1) for smooth moving trolleys
  targetLane: LaneIndex;
  z: number; // Distance along road; player sits at z = 0, entities spawn at -Z and approach 0
  collected: boolean;
  hit: boolean;
  telegraph: number; // 0..1 intensity when trolley is about to shift lanes
  swerved: boolean;
}

export interface GameEvent {
  type: 'ollie' | 'land' | 'lane' | 'collect' | 'hit' | 'unlock' | 'gameover';
  combo?: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface GameState {
  phase: GamePhase;
  lane: LaneIndex;
  x: number; // World X in meters
  y: number; // Vertical height above street (m)
  vy: number; // Vertical velocity (m/s)
  grounded: boolean;
  coyoteTimer: number; // Seconds remaining to still allow Ollie after leaving ground
  jumpBufferTimer: number; // Seconds remaining of buffered jump input
  squashY: number; // Scale Y for squash-and-stretch feedback
  speed: number; // Forward speed (m/s)
  distance: number; // Total meters skated
  score: number;
  bestScore: number;
  drops: number;
  combo: number;
  comboTimer: number;
  lives: number;
  invulnTimer: number;
  hitstopTimer: number;
  shakeIntensity: number;
  promoUnlocked: boolean;
  elapsed: number;
  nextSpawnDistance: number;
  nextEntityId: number;
  entities: RunEntity[];
}

export const LANE_WIDTH = 2.6;
export const GRAVITY = -34;
export const JUMP_VELOCITY = 12.6;
export const COYOTE_DURATION = 0.09;
export const JUMP_BUFFER_DURATION = 0.125;
export const HITSTOP_DURATION = 0.055;
export const INVULN_DURATION = 1.45;
export const COMBO_WINDOW = 4.2;
export const SPAWN_Z = -78;
export const DESPAWN_Z = 14;
export const BASE_SPEED = 16.5;
export const MAX_SPEED = 31.5;

export const GAME_PROMO_CODE = 'OSSK15';
export const GAME_PROMO_SCORE_THRESHOLD = 500;
export const GAME_PROMO_DROPS_THRESHOLD = 8;

export function laneToWorldX(lane: number): number {
  return lane * LANE_WIDTH;
}

export function getDifficultySpeed(distance: number): number {
  const ramp = Math.min(1, Math.max(0, distance / 680));
  return BASE_SPEED + (MAX_SPEED - BASE_SPEED) * ramp;
}

export function createInitialGameState(
  bestScore = 0,
  promoUnlocked = false,
  phase: GamePhase = 'title'
): GameState {
  return {
    phase,
    lane: 0,
    x: 0,
    y: 0,
    vy: 0,
    grounded: true,
    coyoteTimer: COYOTE_DURATION,
    jumpBufferTimer: 0,
    squashY: 1,
    speed: BASE_SPEED,
    distance: 0,
    score: 0,
    bestScore,
    drops: 0,
    combo: 1,
    comboTimer: 0,
    lives: 3,
    invulnTimer: 0,
    hitstopTimer: 0,
    shakeIntensity: 0,
    promoUnlocked,
    elapsed: 0,
    nextSpawnDistance: 16,
    nextEntityId: 1,
    entities: [],
  };
}

export function startRun(state: GameState): GameState {
  const fresh = createInitialGameState(state.bestScore, state.promoUnlocked, 'playing');
  fresh.entities = [
    {
      id: 1,
      kind: 'drop',
      lane: 0,
      targetLane: 0,
      z: -24,
      collected: false,
      hit: false,
      telegraph: 0,
      swerved: false,
    },
    {
      id: 2,
      kind: 'barrier',
      lane: 0,
      targetLane: 0,
      z: -42,
      collected: false,
      hit: false,
      telegraph: 0,
      swerved: false,
    },
    {
      id: 3,
      kind: 'drop',
      lane: 0,
      targetLane: 0,
      z: -42,
      collected: false,
      hit: false,
      telegraph: 1,
      swerved: false,
    },
    {
      id: 4,
      kind: 'bollard',
      lane: -1,
      targetLane: -1,
      z: -58,
      collected: false,
      hit: false,
      telegraph: 0,
      swerved: false,
    },
    {
      id: 5,
      kind: 'drop',
      lane: 1,
      targetLane: 1,
      z: -60,
      collected: false,
      hit: false,
      telegraph: 0,
      swerved: false,
    },
  ];
  fresh.nextEntityId = 6;
  fresh.nextSpawnDistance = 12;
  return fresh;
}

export function shiftLane(
  state: GameState,
  delta: -1 | 1,
  events?: GameEvent[]
): GameState {
  if (state.phase !== 'playing') return state;
  const nextLane = Math.max(-1, Math.min(1, state.lane + delta)) as LaneIndex;
  if (nextLane === state.lane) return state;
  events?.push({ type: 'lane', x: laneToWorldX(nextLane), y: state.y, z: 0 });
  return {
    ...state,
    lane: nextLane,
  };
}

export function triggerJump(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  return {
    ...state,
    jumpBufferTimer: JUMP_BUFFER_DURATION,
  };
}

export function getPromoProgress(state: GameState): number {
  if (state.promoUnlocked) return 1;
  const byScore = state.score / GAME_PROMO_SCORE_THRESHOLD;
  const byDrops = state.drops / GAME_PROMO_DROPS_THRESHOLD;
  return Math.max(0, Math.min(1, Math.max(byScore, byDrops)));
}

function pickRandomLane(rng: () => number): LaneIndex {
  const r = rng();
  if (r < 1 / 3) return -1;
  if (r < 2 / 3) return 0;
  return 1;
}

function spawnWave(state: GameState, rng: () => number): RunEntity[] {
  const spawned: RunEntity[] = [];
  let nextId = state.nextEntityId;
  const progress = Math.min(1, state.distance / 520);
  const hazardLane = pickRandomLane(rng);

  // Choose hazard variety (trolleys appear once player has warmed up past 75m)
  const hazardRoll = rng();
  let hazardKind: EntityKind = 'barrier';
  if (state.distance > 75 && hazardRoll < 0.25 + progress * 0.16) {
    hazardKind = 'trolley';
  } else if (hazardRoll < 0.62) {
    hazardKind = 'barrier';
  } else {
    hazardKind = 'bollard';
  }

  let targetLane = hazardLane;
  if (hazardKind === 'trolley') {
    const candidates: LaneIndex[] = ([-1, 0, 1] as LaneIndex[]).filter((l) => l !== hazardLane);
    targetLane = candidates[Math.floor(rng() * candidates.length) % candidates.length];
  }

  spawned.push({
    id: nextId++,
    kind: hazardKind,
    lane: hazardLane,
    targetLane,
    z: SPAWN_Z,
    collected: false,
    hit: false,
    telegraph: 0,
    swerved: false,
  });

  // Occasionally add a second non-blocking obstacle at higher difficulty, always leaving >= 1 clear lane
  const openLanes = ([-1, 0, 1] as LaneIndex[]).filter(
    (l) => l !== hazardLane && l !== targetLane
  );
  if (state.distance > 140 && openLanes.length >= 2 && rng() < 0.32 + progress * 0.22) {
    const secondLane = openLanes[0];
    spawned.push({
      id: nextId++,
      kind: rng() < 0.55 ? 'barrier' : 'bollard',
      lane: secondLane,
      targetLane: secondLane,
      z: SPAWN_Z - 1.5,
      collected: false,
      hit: false,
      telegraph: 0,
      swerved: false,
    });
  }

  // Spawn an appetizing OSSK Drop Crate either on an open lane or floating over a jumpable barrier
  const dropOnBarrier = hazardKind === 'barrier' && rng() < 0.4;
  const dropLane = dropOnBarrier
    ? hazardLane
    : openLanes[Math.floor(rng() * openLanes.length) % Math.max(1, openLanes.length)] ?? 0;

  spawned.push({
    id: nextId++,
    kind: 'drop',
    lane: dropLane,
    targetLane: dropLane,
    z: dropOnBarrier ? SPAWN_Z : SPAWN_Z - 4.5,
    collected: false,
    hit: false,
    telegraph: dropOnBarrier ? 1 : 0, // telegraph === 1 signals elevated aerial drop over barrier
    swerved: false,
  });

  state.nextEntityId = nextId;
  return spawned;
}

export function stepGameState(
  prev: GameState,
  rawDt: number,
  rng: () => number = Math.random
): { state: GameState; events: GameEvent[] } {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const events: GameEvent[] = [];

  if (prev.phase !== 'playing') {
    return {
      state: {
        ...prev,
        elapsed: prev.elapsed + dt,
        shakeIntensity: Math.max(0, prev.shakeIntensity - dt * 3.5),
      },
      events,
    };
  }

  // Brief impact freeze-frame (hitstop) for visceral collision feel
  if (prev.hitstopTimer > 0) {
    const nextHitstop = Math.max(0, prev.hitstopTimer - dt);
    return {
      state: {
        ...prev,
        hitstopTimer: nextHitstop,
        shakeIntensity: Math.max(0, prev.shakeIntensity - dt * 1.4),
      },
      events,
    };
  }

  const next: GameState = {
    ...prev,
    elapsed: prev.elapsed + dt,
    invulnTimer: Math.max(0, prev.invulnTimer - dt),
    shakeIntensity: Math.max(0, prev.shakeIntensity - dt * 3.6),
    coyoteTimer: Math.max(0, prev.coyoteTimer - dt),
    jumpBufferTimer: Math.max(0, prev.jumpBufferTimer - dt),
    entities: prev.entities.map((e) => ({ ...e })),
  };

  // Combo decay timer
  if (next.combo > 1) {
    next.comboTimer = Math.max(0, next.comboTimer - dt);
    if (next.comboTimer === 0) {
      next.combo = 1;
    }
  }

  // Smooth lateral lane damping (exponential decay independent of frame rate)
  const targetX = laneToWorldX(next.lane);
  const lateralAlpha = 1 - Math.exp(-15 * dt);
  next.x = next.x + (targetX - next.x) * lateralAlpha;

  // Execute buffered Ollie if grounded or within coyote time
  if (next.jumpBufferTimer > 0 && (next.grounded || next.coyoteTimer > 0)) {
    next.vy = JUMP_VELOCITY;
    next.grounded = false;
    next.coyoteTimer = 0;
    next.jumpBufferTimer = 0;
    next.squashY = 1.24;
    events.push({ type: 'ollie', x: next.x, y: next.y, z: 0 });
  }

  // Vertical physics
  if (!next.grounded) {
    next.vy += GRAVITY * dt;
    next.y += next.vy * dt;
    if (next.y <= 0) {
      next.y = 0;
      next.vy = 0;
      next.grounded = true;
      next.coyoteTimer = COYOTE_DURATION;
      next.squashY = 0.78;
      events.push({ type: 'land', x: next.x, y: 0, z: 0 });
    }
  } else {
    next.coyoteTimer = COYOTE_DURATION;
  }

  // Squash & stretch recovery toward 1.0
  next.squashY = next.squashY + (1 - next.squashY) * (1 - Math.exp(-14 * dt));

  // Advance forward distance & progressive speed
  next.speed = getDifficultySpeed(next.distance);
  const deltaDist = next.speed * dt;
  next.distance += deltaDist;
  next.score += deltaDist * 1.85;

  // Spawn new obstacle / drop waves
  if (next.distance >= next.nextSpawnDistance) {
    const wave = spawnWave(next, rng);
    next.entities.push(...wave);
    const spacing = Math.max(13.5, 22 - (next.speed - BASE_SPEED) * 0.42);
    next.nextSpawnDistance = next.distance + spacing;
  }

  // Advance entities & resolve collisions
  const surviving: RunEntity[] = [];
  for (const entity of next.entities) {
    entity.z += deltaDist;

    // Trolley lane-shift telegraphing and smooth lateral move
    if (entity.kind === 'trolley' && entity.lane !== entity.targetLane) {
      if (entity.z > -46 && entity.z <= -28) {
        entity.telegraph = Math.min(1, (entity.z + 46) / 14);
      } else if (entity.z > -28) {
        entity.telegraph = 1;
        entity.swerved = true;
        const moveAlpha = 1 - Math.exp(-6.5 * dt);
        entity.lane = entity.lane + (entity.targetLane - entity.lane) * moveAlpha;
      }
    }

    const ex = laneToWorldX(entity.lane);
    const dx = Math.abs(next.x - ex);
    const dz = Math.abs(entity.z);

    if (entity.kind === 'drop') {
      const dropY = entity.telegraph > 0.5 ? 2.05 : 0.9;
      const dy = Math.abs(next.y + 0.85 - dropY);
      if (!entity.collected && dx < 1.18 && dz < 1.35 && dy < 1.45) {
        entity.collected = true;
        next.drops += 1;
        next.combo = Math.min(5, next.combo + 1);
        next.comboTimer = COMBO_WINDOW;
        next.score += 45 * next.combo;
        events.push({
          type: 'collect',
          combo: next.combo,
          x: ex,
          y: dropY,
          z: entity.z,
        });
      }
    } else if (!entity.hit && next.invulnTimer <= 0) {
      // Hazard collision box — barriers can be cleanly cleared with an Ollie!
      const clearanceHeight =
        entity.kind === 'barrier' ? 1.02 : entity.kind === 'bollard' ? 1.45 : 1.75;
      const hitHalfWidth = entity.kind === 'bollard' ? 0.82 : 1.05;
      const hitHalfDepth = entity.kind === 'trolley' ? 1.25 : 0.95;

      if (dx < hitHalfWidth && dz < hitHalfDepth && next.y < clearanceHeight) {
        entity.hit = true;
        next.lives = Math.max(0, next.lives - 1);
        next.combo = 1;
        next.comboTimer = 0;
        next.invulnTimer = INVULN_DURATION;
        next.hitstopTimer = HITSTOP_DURATION;
        next.shakeIntensity = 0.65;
        events.push({ type: 'hit', x: ex, y: 0.7, z: entity.z });

        if (next.lives <= 0) {
          next.phase = 'gameover';
          events.push({ type: 'gameover' });
        }
      }
    }

    if (entity.z < DESPAWN_Z && !entity.collected) {
      surviving.push(entity);
    }
  }

  next.entities = surviving;

  // Update best score
  const roundedScore = Math.floor(next.score);
  if (roundedScore > next.bestScore) {
    next.bestScore = roundedScore;
  }

  // Unlock OSSK15 (-15% OFF) reward once score or drop goal is achieved
  if (
    !next.promoUnlocked &&
    (roundedScore >= GAME_PROMO_SCORE_THRESHOLD || next.drops >= GAME_PROMO_DROPS_THRESHOLD)
  ) {
    next.promoUnlocked = true;
    events.push({ type: 'unlock' });
  }

  return { state: next, events };
}

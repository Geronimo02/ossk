import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRELOADER_MAX_DURATION_MS,
  PRELOADER_MIN_DURATION_MS,
  computePreloaderProgress,
  formatPreloaderPercent,
  shouldShowPreloader,
} from './preloaderLogic';

test('shouldShowPreloader shows only once per session and respects reduced motion / skip', () => {
  assert.equal(shouldShowPreloader(null, false, false), true);
  assert.equal(shouldShowPreloader('1', false, false), false);
  assert.equal(shouldShowPreloader(null, true, false), false);
  assert.equal(shouldShowPreloader(null, false, true), false);
});

test('computePreloaderProgress respects minimum duration floor even if assets finish instantly', () => {
  const early = computePreloaderProgress({
    loadedCount: 6,
    totalCount: 6,
    fontsReady: true,
    elapsedMs: 250,
  });
  assert.equal(early.readyToReveal, false);
  assert.ok(early.percent > 0 && early.percent < 100);

  const ready = computePreloaderProgress({
    loadedCount: 6,
    totalCount: 6,
    fontsReady: true,
    elapsedMs: PRELOADER_MIN_DURATION_MS,
    previousPercent: early.percent,
  });
  assert.equal(ready.percent, 100);
  assert.equal(ready.readyToReveal, true);
});

test('computePreloaderProgress tracks real asset progress and never jumps backward', () => {
  const step1 = computePreloaderProgress({
    loadedCount: 2,
    totalCount: 6,
    fontsReady: false,
    elapsedMs: 400,
    previousPercent: 0,
  });
  const step2 = computePreloaderProgress({
    loadedCount: 5,
    totalCount: 6,
    fontsReady: true,
    elapsedMs: 650,
    previousPercent: step1.percent,
  });
  const regressionGuard = computePreloaderProgress({
    loadedCount: 1,
    totalCount: 6,
    fontsReady: false,
    elapsedMs: 660,
    previousPercent: step2.percent,
  });

  assert.equal(step1.readyToReveal, false);
  assert.ok(step2.percent > step1.percent);
  assert.equal(regressionGuard.percent, step2.percent);
});

test('computePreloaderProgress enforces hard max timeout cap on slow networks', () => {
  const capped = computePreloaderProgress({
    loadedCount: 0,
    totalCount: 6,
    fontsReady: false,
    elapsedMs: PRELOADER_MAX_DURATION_MS,
    previousPercent: 18,
  });
  assert.equal(capped.percent, 100);
  assert.equal(capped.readyToReveal, true);
});

test('formatPreloaderPercent zero-pads single digits cleanly', () => {
  assert.equal(formatPreloaderPercent(0), '00');
  assert.equal(formatPreloaderPercent(7), '07');
  assert.equal(formatPreloaderPercent(42), '42');
  assert.equal(formatPreloaderPercent(100), '100');
});

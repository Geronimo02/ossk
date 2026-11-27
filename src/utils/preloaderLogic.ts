export const PRELOADER_SESSION_KEY = 'ossk-preloader-seen-v1';
export const PRELOADER_MIN_DURATION_MS = 850;
export const PRELOADER_MAX_DURATION_MS = 1600;
export const PRELOADER_EXIT_DURATION_MS = 740;

export interface PreloaderProgressInput {
  loadedCount: number;
  totalCount: number;
  fontsReady: boolean;
  elapsedMs: number;
  previousPercent?: number;
  minDurationMs?: number;
  maxDurationMs?: number;
}

export interface PreloaderProgressResult {
  percent: number;
  readyToReveal: boolean;
}

/**
 * Decides whether the editorial preloader curtain should mount on entry.
 * Skips when already shown in this browser tab session, when reduced motion
 * is requested by the OS, or when explicitly bypassed via `?autostart=1`.
 */
export function shouldShowPreloader(
  sessionFlag: string | null,
  prefersReducedMotion: boolean,
  skipParam = false
): boolean {
  if (skipParam) return false;
  if (prefersReducedMotion) return false;
  return sessionFlag !== '1';
}

/**
 * Computes monotonic 0..100 progress driven by real runway image preloads
 * + webfont readiness, bounded by a minimum editorial beat and a hard cap
 * so slow connections never stall the storefront.
 */
export function computePreloaderProgress({
  loadedCount,
  totalCount,
  fontsReady,
  elapsedMs,
  previousPercent = 0,
  minDurationMs = PRELOADER_MIN_DURATION_MS,
  maxDurationMs = PRELOADER_MAX_DURATION_MS,
}: PreloaderProgressInput): PreloaderProgressResult {
  const safeElapsed = Math.max(0, elapsedMs);
  const safeTotal = Math.max(0, totalCount);
  const safeLoaded = Math.max(0, Math.min(loadedCount, safeTotal));
  const safePrev = Math.max(0, Math.min(100, Math.floor(previousPercent)));

  const totalUnits = safeTotal + 1;
  const loadedUnits = safeLoaded + (fontsReady ? 1 : 0);
  const assetFraction = totalUnits > 0 ? loadedUnits / totalUnits : 1;

  if (safeElapsed >= maxDurationMs) {
    return { percent: 100, readyToReveal: true };
  }

  if (assetFraction >= 1 && safeElapsed >= minDurationMs) {
    return { percent: 100, readyToReveal: true };
  }

  const timeLinear = minDurationMs > 0 ? Math.min(1, safeElapsed / minDurationMs) : 1;
  const easedTime = 1 - Math.pow(1 - timeLinear, 2);

  // When assets are already loaded, pace cleanly along the eased editorial curve.
  // When assets are still downloading, reflect real asset progress so the bar feels honest.
  const targetFraction =
    assetFraction >= 1
      ? easedTime
      : Math.min(easedTime, assetFraction * 0.8 + easedTime * 0.2);

  const rawPercent = Math.min(99, Math.max(0, Math.round(targetFraction * 100)));
  const percent = Math.max(safePrev, rawPercent);

  return {
    percent,
    readyToReveal: false,
  };
}

/**
 * Formats 0..100 for fixed-width tabular readout (00 .. 100).
 */
export function formatPreloaderPercent(percent: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return clamped < 10 ? `0${clamped}` : String(clamped);
}

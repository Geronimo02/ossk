import { useEffect, useMemo, useRef, useState } from 'react';
import { RUNWAY_LOOKS } from '../data/catalog';
import {
  PRELOADER_EXIT_DURATION_MS,
  PRELOADER_MAX_DURATION_MS,
  PRELOADER_MIN_DURATION_MS,
  PRELOADER_SESSION_KEY,
  computePreloaderProgress,
  formatPreloaderPercent,
  shouldShowPreloader,
} from '../utils/preloaderLogic';

function detectInitialVisibility(): boolean {
  if (typeof window === 'undefined') return false;
  let sessionFlag: string | null = null;
  try {
    sessionFlag = window.sessionStorage.getItem(PRELOADER_SESSION_KEY);
  } catch {
    sessionFlag = null;
  }
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skipParam = new URLSearchParams(window.location.search).get('autostart') === '1';
  return shouldShowPreloader(sessionFlag, prefersReducedMotion, skipParam);
}

export function PreloaderCurtain() {
  const [visible, setVisible] = useState<boolean>(detectInitialVisibility);
  const [exiting, setExiting] = useState(false);
  const [percent, setPercent] = useState(0);

  const percentRef = useRef(0);
  const revealTriggeredRef = useRef(false);

  const preloadUrls = useMemo(
    () => Array.from(new Set(RUNWAY_LOOKS.map((look) => look.image))),
    []
  );

  useEffect(() => {
    if (!visible) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let cancelled = false;
    let rafId = 0;
    let beatTimer = 0;
    let exitTimer = 0;
    let loadedCount = 0;
    let fontsReady = false;
    const startedAt = performance.now();

    const markFontReady = () => {
      fontsReady = true;
    };

    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      document.fonts.ready.then(markFontReady, markFontReady);
    } else {
      fontsReady = true;
    }

    const trackedImages: HTMLImageElement[] = preloadUrls.map((src) => {
      const img = new Image();
      let settled = false;
      const onDone = () => {
        if (settled) return;
        settled = true;
        loadedCount += 1;
      };
      img.onload = onDone;
      img.onerror = onDone;
      img.src = src;
      if (img.complete) {
        onDone();
      }
      return img;
    });

    const triggerReveal = () => {
      if (revealTriggeredRef.current || cancelled) return;
      revealTriggeredRef.current = true;
      percentRef.current = 100;
      setPercent(100);

      try {
        window.sessionStorage.setItem(PRELOADER_SESSION_KEY, '1');
      } catch {
        // ignore storage restrictions
      }

      // Brief beat at 100% before lifting the obsidian curtain
      beatTimer = window.setTimeout(() => {
        if (cancelled) return;
        setExiting(true);
        exitTimer = window.setTimeout(() => {
          if (cancelled) return;
          setVisible(false);
        }, PRELOADER_EXIT_DURATION_MS);
      }, 90);
    };

    const tick = (now: number) => {
      if (cancelled) return;

      const result = computePreloaderProgress({
        loadedCount,
        totalCount: preloadUrls.length,
        fontsReady,
        elapsedMs: now - startedAt,
        previousPercent: percentRef.current,
        minDurationMs: PRELOADER_MIN_DURATION_MS,
        maxDurationMs: PRELOADER_MAX_DURATION_MS,
      });

      if (result.percent !== percentRef.current) {
        percentRef.current = result.percent;
        setPercent(result.percent);
      }

      if (result.readyToReveal) {
        triggerReveal();
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(beatTimer);
      window.clearTimeout(exitTimer);
      trackedImages.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
      document.body.style.overflow = prevOverflow;
    };
  }, [preloadUrls, visible]);

  if (!visible) return null;

  const formattedPercent = formatPreloaderPercent(percent);

  return (
    <div
      data-testid="ossk-preloader"
      role="status"
      aria-live="polite"
      aria-label={`Cargando OSSK Tandil ${formattedPercent}%`}
      className={`ossk-preloader fixed inset-0 z-[400] bg-[#0a0a0a] text-white select-none flex flex-col justify-between px-6 py-7 sm:px-10 sm:py-9 ${
        exiting ? 'is-exiting pointer-events-none' : ''
      }`}
    >
      {/* Top Editorial Stamp Bar */}
      <div className="ossk-preloader-inner flex items-center justify-between gap-4 font-mono-tech text-[10px] sm:text-[11px] tracking-[0.2em] uppercase text-[#a1a1aa]">
        <span className="inline-flex items-center gap-2 text-white/90">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d91e2a]" aria-hidden="true" />
          OSSK TANDIL · ARCHIVE 01
        </span>
        <span className="text-right">RODRÍGUEZ 743 · TANDIL</span>
      </div>

      {/* Center Display Mark + Razor-Thin Crimson Progress Rail */}
      <div className="ossk-preloader-inner flex flex-col items-center justify-center my-auto w-full max-w-[420px] mx-auto">
        <div className="font-display text-[clamp(74px,16vw,152px)] font-extrabold leading-[0.88] tracking-[0.14em] text-white text-center pl-[0.14em]">
          OSSK
        </div>

        <div className="mt-7 sm:mt-9 w-full">
          <div className="relative h-[2px] w-full bg-white/14 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 w-full bg-[#d91e2a] origin-left transition-transform duration-150 ease-out"
              style={{ transform: `scaleX(${Math.max(0.02, percent / 100)})` }}
            />
          </div>
          <div className="mt-3.5 flex items-center justify-between font-mono-tech text-[10px] tracking-[0.22em] uppercase text-[#a1a1aa]">
            <span>{percent >= 100 ? 'PASARELA LISTA' : 'CARGANDO LOOKS 3D'}</span>
            <span
              data-testid="preloader-percent"
              className="text-white font-semibold tabular-nums text-[12px] tracking-[0.14em]"
            >
              {formattedPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Subtle Signature */}
      <div className="ossk-preloader-inner flex items-center justify-between gap-4 font-mono-tech text-[10px] tracking-[0.18em] uppercase text-[#71717a]">
        <span>PROBÁ EL LOOK</span>
        <span>BUENOS AIRES · AR</span>
      </div>
    </div>
  );
}

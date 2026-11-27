import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Heart, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import {
  GAME_PROMO_CODE,
  GAME_PROMO_DROPS_THRESHOLD,
  GAME_PROMO_SCORE_THRESHOLD,
  type GameEvent,
} from '../game/gameLogic';
import { type CameraPreset, type HudSnapshot, OsskThreeEngine } from '../game/threeEngine';
import { soundEngine } from '../utils/soundEngine';

interface OsskGameOverlayProps {
  isOpen: boolean;
  promoUnlocked: boolean;
  onUnlockPromo: () => void;
  onApplyPromoAndOpenOrder: () => void;
  onClose: () => void;
}

const BEST_SCORE_KEY = 'ossk-skaterun-best-v1';

function loadBestScore(): number {
  try {
    const val = Number(localStorage.getItem(BEST_SCORE_KEY) || '0');
    return Number.isFinite(val) && val > 0 ? val : 0;
  } catch {
    return 0;
  }
}

export function OsskGameOverlay({
  isOpen,
  promoUnlocked,
  onUnlockPromo,
  onApplyPromoAndOpenOrder,
  onClose,
}: OsskGameOverlayProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<OsskThreeEngine | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const heldKeysRef = useRef<Set<string>>(new Set());

  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('chase');
  const [dockOpen, setDockOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => soundEngine.isEnabled());
  const [hud, setHud] = useState<HudSnapshot>(() => ({
    phase: 'title',
    score: 0,
    bestScore: loadBestScore(),
    drops: 0,
    combo: 1,
    lives: 3,
    speedKmh: 51,
    promoUnlocked,
    distance: 0,
  }));

  useEffect(() => {
    return soundEngine.subscribe((enabled) => setSoundOn(enabled));
  }, []);

  const handleEngineEvent = useCallback(
    (ev: GameEvent) => {
      if (ev.type === 'lane') soundEngine.playLaneShift();
      else if (ev.type === 'ollie') soundEngine.playOllie();
      else if (ev.type === 'land') soundEngine.playLand();
      else if (ev.type === 'collect') soundEngine.playCollect(ev.combo ?? 1);
      else if (ev.type === 'hit') soundEngine.playHit();
      else if (ev.type === 'unlock') {
        soundEngine.playUnlock();
        onUnlockPromo();
      }
    },
    [onUnlockPromo]
  );

  // Mount / dispose isolated Three.js engine when game overlay opens/closes
  useEffect(() => {
    if (!isOpen || !canvasMountRef.current) return;

    const mount = canvasMountRef.current;
    const engine = new OsskThreeEngine({
      container: mount,
      initialBestScore: loadBestScore(),
      initialPromoUnlocked: promoUnlocked,
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
        if (snapshot.bestScore > loadBestScore()) {
          try {
            localStorage.setItem(BEST_SCORE_KEY, String(snapshot.bestScore));
          } catch {
            // ignore storage errors
          }
        }
      },
      onEvent: handleEngineEvent,
    });
    engineRef.current = engine;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      engine.dispose();
      engineRef.current = null;
      heldKeysRef.current.clear();
    };
  }, [isOpen, handleEngineEvent, promoUnlocked]);

  // Keyboard & focus-blur input handling (prevents stuck keys)
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const phase = engine.getPhase();

      if (e.key === 'Escape') {
        e.preventDefault();
        if (phase === 'playing' || phase === 'paused') {
          engine.togglePause();
        } else {
          onClose();
        }
        return;
      }

      if (phase === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        soundEngine.playPop();
        engine.startNewRun();
        return;
      }

      if (phase === 'gameover' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        soundEngine.playPop();
        engine.startNewRun();
        return;
      }

      if (phase !== 'playing') return;

      if (heldKeysRef.current.has(e.code)) return;
      heldKeysRef.current.add(e.code);

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        engine.moveLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        engine.moveLane(1);
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        engine.jump();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.code);
    };

    const onBlur = () => {
      heldKeysRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [isOpen, onClose]);

  const handleCameraChange = (preset: CameraPreset) => {
    soundEngine.playPop();
    setCameraPreset(preset);
    engineRef.current?.setCameraPreset(preset);
  };

  if (!isOpen) return null;

  const progressRatio = hud.promoUnlocked
    ? 1
    : Math.min(
        1,
        Math.max(hud.score / GAME_PROMO_SCORE_THRESHOLD, hud.drops / GAME_PROMO_DROPS_THRESHOLD)
      );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="OSSK 743 Skate Run 3D"
      data-testid="ossk-game-overlay"
      className="fixed inset-0 z-250 w-screen h-screen overflow-hidden bg-[#141416] select-none"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        if (!touchStartRef.current || engineRef.current?.getPhase() !== 'playing') return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartRef.current.x;
        const dy = t.clientY - touchStartRef.current.y;
        touchStartRef.current = null;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 28) {
          engineRef.current.moveLane(dx > 0 ? 1 : -1);
        } else if (dy < -24) {
          engineRef.current.jump();
        }
      }}
    >
      {/* Isolated empty WebGL mount container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* TITLE SCREEN OVER LIVE 3D TANDIL STREET */}
      {hud.phase === 'title' && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-5 md:p-8 bg-gradient-to-b from-[#0d0d10]/82 via-[#0d0d10]/20 to-[#0d0d10]/65">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[11px] font-bold tracking-[0.2em] uppercase text-[#f5f3ee]">
              RODRÍGUEZ 743 · TANDIL 3D
            </span>
            <button
              type="button"
              data-testid="game-close-btn"
              onClick={() => {
                soundEngine.playPop();
                onClose();
              }}
              className="pointer-events-auto inline-flex items-center gap-2 min-h-[40px] px-3.5 bg-[#121215]/95 border border-white/25 text-white font-mono-tech text-[11px] font-bold tracking-[0.14em] uppercase hover:bg-white hover:text-[#121215] transition-colors"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tienda</span>
            </button>
          </div>

          <div className="mt-2 mb-auto flex flex-col items-center text-center px-3">
            {/* Bespoke SVG Title Lockup */}
            <svg
              viewBox="0 0 540 124"
              className="w-full max-w-[440px] h-auto drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
              role="img"
              aria-label="OSSK 743 Skate Run"
            >
              <rect x="116" y="4" width="308" height="24" fill="#d91e2a" />
              <text
                x="270"
                y="21"
                textAnchor="middle"
                fill="#ffffff"
                fontFamily="JetBrains Mono, monospace"
                fontSize="12"
                fontWeight="700"
                letterSpacing="4"
              >
                RODRÍGUEZ 743 · TANDIL
              </text>
              <text
                x="270"
                y="94"
                textAnchor="middle"
                fill="#ffffff"
                fontFamily="Barlow Condensed, Arial, sans-serif"
                fontSize="80"
                fontWeight="800"
                letterSpacing="4"
              >
                SKATE RUN 743
              </text>
              <line x1="68" y1="112" x2="472" y2="112" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.5" />
            </svg>

            <p className="mt-2 max-w-[440px] text-[13.5px] text-[#f5f3ee] leading-[1.5] drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
              Juntá <strong className="text-white">8 Drops</strong> o <strong className="text-white">500 pts</strong>{' '}
              en Calle Rodríguez y desbloqueá <strong className="text-[#ff5c66]">15% OFF ({GAME_PROMO_CODE})</strong> en tu pedido.
            </p>

            <div className="pointer-events-auto mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                data-testid="game-start-btn"
                onClick={() => {
                  soundEngine.playPop();
                  engineRef.current?.startNewRun();
                }}
                className="inline-flex items-center justify-center gap-2.5 min-h-[48px] px-8 bg-[#d91e2a] border border-[#d91e2a] text-white font-mono-tech text-[12px] font-bold tracking-[0.18em] uppercase hover:bg-white hover:text-[#121215] hover:border-white transition-colors"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Empezar Run</span>
              </button>
            </div>
          </div>

          <p className="mb-11 text-center font-mono-tech text-[10.5px] tracking-[0.14em] uppercase text-[#e6e2da] drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
            A / D o ← / → Carriles · Espacio Ollie · Esc Pausa
          </p>
        </div>
      )}

      {/* ACTIVE GAMEPLAY HUD */}
      {hud.phase === 'playing' && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6">
          <div className="flex items-start justify-between gap-4">
            {/* Top-left Score & Drops */}
            <div className="bg-[#111114]/90 border border-white/15 px-4 py-2.5 text-white">
              <div className="flex items-baseline gap-3">
                <span
                  data-testid="game-score"
                  className="font-display text-[36px] leading-none font-extrabold tabular-nums tracking-[0.04em]"
                >
                  {hud.score}
                </span>
                <span className="font-mono-tech text-[11px] font-bold uppercase text-[#ff4d58]">
                  x{hud.combo}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 font-mono-tech text-[10px] tracking-[0.12em] uppercase text-[#c8c4bc] tabular-nums">
                <span>DROPS {hud.drops}</span>
                <span>{hud.speedKmh} KM/H</span>
                <span>{hud.distance} M</span>
              </div>
            </div>

            {/* Top-right Lives + 15% OFF Reward Bar + Pause */}
            <div className="flex items-start gap-2.5">
              <div className="bg-[#111114]/90 border border-white/15 px-3.5 py-2.5 text-white min-w-[168px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1" aria-label={`${hud.lives} vidas`}>
                    {[0, 1, 2].map((idx) => (
                      <Heart
                        key={idx}
                        className={`w-4 h-4 ${
                          idx < hud.lives
                            ? 'text-[#d91e2a] fill-[#d91e2a]'
                            : 'text-white/20 fill-transparent'
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <span className="font-mono-tech text-[10px] font-bold tracking-[0.12em] uppercase text-[#f4f2ec]">
                    {hud.promoUnlocked ? `${GAME_PROMO_CODE} ACTIVO` : 'META 15% OFF'}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-white/15 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      hud.promoUnlocked ? 'bg-[#22c55e]' : 'bg-[#d91e2a]'
                    }`}
                    style={{ width: `${Math.round(progressRatio * 100)}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                data-testid="game-pause-btn"
                onClick={() => {
                  soundEngine.playPop();
                  engineRef.current?.togglePause();
                }}
                aria-label="Pausar juego"
                className="pointer-events-auto w-11 h-11 bg-[#111114]/90 border border-white/20 text-white grid place-items-center hover:bg-white hover:text-[#111114] transition-colors"
              >
                <Pause className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Mobile on-screen thumb controls */}
          <div className="md:hidden pointer-events-auto flex items-center justify-between gap-3 pb-12">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Mover a la izquierda"
                onClick={() => engineRef.current?.moveLane(-1)}
                className="w-14 h-14 bg-[#111114]/90 border border-white/25 text-white font-mono-tech text-[18px] font-bold"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Mover a la derecha"
                onClick={() => engineRef.current?.moveLane(1)}
                className="w-14 h-14 bg-[#111114]/90 border border-white/25 text-white font-mono-tech text-[18px] font-bold"
              >
                →
              </button>
            </div>
            <button
              type="button"
              onClick={() => engineRef.current?.jump()}
              className="h-14 px-6 bg-[#d91e2a] border border-[#d91e2a] text-white font-mono-tech text-[11px] font-bold tracking-[0.14em] uppercase"
            >
              OLLIE ↑
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {hud.phase === 'paused' && (
        <div className="absolute inset-0 bg-[#0d0d10]/80 flex items-center justify-center p-5">
          <div className="w-full max-w-[360px] bg-[#141417] border border-white/20 p-6 text-white text-center">
            <p className="font-mono-tech text-[10.5px] tracking-[0.18em] uppercase text-[#a1a1aa]">
              PAUSA · SKATE RUN 743
            </p>
            <h3 className="mt-2 font-display text-[36px] font-extrabold uppercase tracking-[0.04em] leading-none">
              {hud.score} PTS
            </h3>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                data-testid="game-resume-btn"
                onClick={() => {
                  soundEngine.playPop();
                  engineRef.current?.togglePause();
                }}
                className="min-h-[46px] bg-white text-[#121215] font-mono-tech text-[11px] font-bold tracking-[0.14em] uppercase hover:bg-[#d91e2a] hover:text-white transition-colors"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  engineRef.current?.startNewRun();
                }}
                className="min-h-[44px] border border-white/25 bg-transparent text-white font-mono-tech text-[11px] font-bold tracking-[0.14em] uppercase hover:bg-white/10 transition-colors"
              >
                Reiniciar Run
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  onClose();
                }}
                className="min-h-[44px] border border-transparent text-[#a1a1aa] font-mono-tech text-[11px] uppercase hover:text-white transition-colors"
              >
                Volver a la tienda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {hud.phase === 'gameover' && (
        <div className="absolute inset-0 bg-[#0d0d10]/82 flex items-center justify-center p-5">
          <div className="w-full max-w-[400px] bg-[#141417] border border-white/20 p-6 text-white text-center">
            <p className="font-mono-tech text-[10.5px] tracking-[0.18em] uppercase text-[#ff4d58]">
              FIN DEL RUN · CALLE RODRÍGUEZ
            </p>
            <h3 className="mt-2 font-display text-[44px] font-extrabold uppercase tracking-[0.04em] leading-none tabular-nums">
              {hud.score} PTS
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-2 border-y border-white/12 py-3 font-mono-tech text-[11px] uppercase tabular-nums">
              <div>
                <div className="text-[#9a9894] text-[9.5px]">Récord</div>
                <div className="font-bold text-white mt-0.5">{hud.bestScore}</div>
              </div>
              <div>
                <div className="text-[#9a9894] text-[9.5px]">Drops</div>
                <div className="font-bold text-white mt-0.5">{hud.drops}</div>
              </div>
              <div>
                <div className="text-[#9a9894] text-[9.5px]">Distancia</div>
                <div className="font-bold text-white mt-0.5">{hud.distance}m</div>
              </div>
            </div>

            {hud.promoUnlocked ? (
              <div className="mt-4 p-3 border border-[#22c55e]/50 bg-[#102618] text-left">
                <p className="font-mono-tech text-[10.5px] font-bold tracking-[0.12em] uppercase text-[#4ade80]">
                  ¡CUPÓN {GAME_PROMO_CODE} DESBLOQUEADO!
                </p>
                <p className="mt-1 text-[12.5px] text-[#e5e7eb]">
                  Tenés <strong>15% OFF</strong> directo en tu pedido de Ossk Tandil.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-[12.5px] text-[#b4b0a8]">
                Llegá a 500 pts o 8 Drops en un run para desbloquear <strong>15% OFF ({GAME_PROMO_CODE})</strong>.
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2.5">
              {hud.promoUnlocked && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playCombo();
                    onApplyPromoAndOpenOrder();
                  }}
                  className="min-h-[48px] bg-[#d91e2a] text-white font-mono-tech text-[11px] font-bold tracking-[0.14em] uppercase hover:bg-white hover:text-[#121215] transition-colors"
                >
                  Usar 15% OFF y abrir pedido →
                </button>
              )}
              <button
                type="button"
                data-testid="game-retry-btn"
                onClick={() => {
                  soundEngine.playPop();
                  engineRef.current?.startNewRun();
                }}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] bg-white text-[#121215] font-mono-tech text-[11px] font-bold tracking-[0.14em] uppercase hover:bg-[#e5e2dc] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Jugar de nuevo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  onClose();
                }}
                className="min-h-[40px] border-0 bg-transparent text-[#a1a1aa] font-mono-tech text-[10.5px] uppercase hover:text-white transition-colors"
              >
                Volver a la tienda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COLLAPSIBLE BOTTOM DOCK (<= 15% viewport, solid dark rgba — zero backdrop-filter over WebGL) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
        {dockOpen && (
          <div
            data-testid="game-controls-dock"
            className="mb-1.5 flex flex-wrap items-center justify-center gap-2 px-3 py-2 bg-[#111114]/95 border border-white/20 text-white"
          >
            <span className="font-mono-tech text-[10px] tracking-[0.14em] uppercase text-[#a1a1aa] mr-1">
              Cámara
            </span>
            {(['chase', 'low', 'aerial'] as CameraPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleCameraChange(preset)}
                className={`min-h-[30px] px-2.5 border font-mono-tech text-[10px] font-bold tracking-[0.1em] uppercase transition-colors ${
                  cameraPreset === preset
                    ? 'border-[#d91e2a] bg-[#d91e2a] text-white'
                    : 'border-white/20 bg-transparent text-[#d4d4d8] hover:border-white'
                }`}
              >
                {preset === 'chase' ? 'Chase' : preset === 'low' ? 'Bajo' : 'Aérea'}
              </button>
            ))}

            <div className="w-px h-5 bg-white/15 mx-1" aria-hidden="true" />

            <button
              type="button"
              onClick={() => soundEngine.toggle()}
              className="inline-flex items-center gap-1.5 min-h-[30px] px-2.5 border border-white/20 text-[#e4e4e7] font-mono-tech text-[10px] font-bold uppercase hover:border-white"
            >
              {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{soundOn ? 'Sonido' : 'Mudo'}</span>
            </button>
          </div>
        )}

        <button
          type="button"
          data-testid="game-dock-toggle"
          onClick={() => {
            soundEngine.playPop();
            setDockOpen((prev) => !prev);
          }}
          className="inline-flex items-center gap-1.5 min-h-[32px] px-3.5 bg-[#111114]/95 border border-white/20 text-[#e4e4e7] font-mono-tech text-[10px] font-bold tracking-[0.14em] uppercase hover:text-white hover:border-white/50 transition-colors"
        >
          {dockOpen ? (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>Controles</span>
        </button>
      </div>
    </div>
  );
}

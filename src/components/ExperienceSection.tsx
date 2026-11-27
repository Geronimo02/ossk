import { Gamepad2, Sparkles } from 'lucide-react';
import { GAME_PROMO_CODE } from '../game/gameLogic';
import { TandilStoreMap } from './TandilStoreMap';
import { soundEngine } from '../utils/soundEngine';

interface ExperienceSectionProps {
  promoUnlocked: boolean;
  onLaunchGame: () => void;
  onOpenOrder: () => void;
}

export function ExperienceSection({
  promoUnlocked,
  onLaunchGame,
  onOpenOrder,
}: ExperienceSectionProps) {
  return (
    <section
      id="experiencia"
      aria-labelledby="experience-heading"
      className="bg-white border-t border-[#e4e4e4] py-16 md:py-24 px-5 md:px-10"
    >
      <div className="max-w-[1440px] mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-6 pb-8 border-b border-[#e4e4e4]">
          <div>
            <p className="m-0 font-mono-tech text-[10.5px] tracking-[0.18em] uppercase text-[#d91e2a] font-bold">
              04 · 3D &amp; Mapa Real
            </p>
            <h2
              id="experience-heading"
              className="m-0 mt-2 font-display text-[clamp(34px,4.5vw,56px)] font-extrabold uppercase tracking-[0.02em] leading-[0.94] text-[#151413]"
            >
              Skate Run 743 &amp; Cómo Llegar
            </h2>
          </div>
          <p className="m-0 max-w-[440px] text-[14.5px] leading-[1.6] text-[#5e5a54]">
            Patiná Calle Rodríguez en 3D para desbloquear un 15% OFF directo en tu pedido, y trazá tu ruta real hasta nuestro local en el centro de Tandil.
          </p>
        </div>

        {/* 3D Game Launch Banner */}
        <div className="mt-8 bg-[#0e0e10] text-white border border-[#151413] p-6 md:p-9 grid grid-cols-1 lg:grid-cols-[1fr_auto] items-center gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-mono-tech text-[10.5px] font-bold tracking-[0.16em] uppercase text-[#ff4d58]">
                <Gamepad2 className="w-4 h-4" aria-hidden="true" />
                <span>Arcade 3D · Three.js</span>
              </span>
              {promoUnlocked && (
                <span
                  data-testid="promo-unlocked-badge"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#14331f] border border-[#22c55e]/50 font-mono-tech text-[10px] font-bold tracking-[0.12em] uppercase text-[#4ade80]"
                >
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  <span>{GAME_PROMO_CODE} · 15% OFF Activo</span>
                </span>
              )}
            </div>

            <h3 className="m-0 mt-2.5 font-display text-[clamp(28px,3.6vw,44px)] font-extrabold uppercase tracking-[0.03em] leading-[0.98]">
              OSSK Skate Run 743 · Ganá 15% OFF
            </h3>
            <p className="m-0 mt-2.5 max-w-[600px] text-[14px] leading-[1.55] text-[#c8c4bc]">
              Recorré Calle Rodríguez rumbo a las Sierras con el Zip Hoodie Animal Stars. Esquivá vallas y carros en 3 carriles, meté Ollie sobre barreras y llegá a 500 pts o 8 Drops para activar el cupón{' '}
              <strong className="text-white">{GAME_PROMO_CODE} (-15% OFF)</strong> en tu pedido.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="launch-game-btn"
              onClick={() => {
                soundEngine.playZoom(true);
                onLaunchGame();
              }}
              className="inline-flex items-center justify-center gap-2.5 min-h-[50px] px-7 bg-[#d91e2a] border border-[#d91e2a] text-white font-mono-tech text-[11.5px] font-bold tracking-[0.16em] uppercase whitespace-nowrap hover:bg-white hover:text-[#151413] hover:border-white transition-colors"
            >
              <span>Jugar en 3D →</span>
            </button>
            {promoUnlocked && (
              <button
                type="button"
                onClick={onOpenOrder}
                className="inline-flex items-center justify-center min-h-[50px] px-5 bg-transparent border border-white/25 text-white font-mono-tech text-[11px] font-bold tracking-[0.14em] uppercase whitespace-nowrap hover:border-white transition-colors"
              >
                Ver mi 15% OFF
              </button>
            )}
          </div>
        </div>

        {/* Google Maps Platform Interactive Map & Routing */}
        <div className="mt-8">
          <TandilStoreMap />
        </div>
      </div>
    </section>
  );
}

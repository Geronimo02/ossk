import type { TandilStoreStatus } from '../utils/storeLogic';

interface StoreFooterProps {
  status: TandilStoreStatus;
}

export function StoreFooter({ status }: StoreFooterProps) {
  return (
    <footer id="local" className="bg-[#0a0a0a] text-[#fafafa] pt-20 pb-11 border-t border-[#222222]">
      <div className="w-full max-w-[1440px] mx-auto px-5 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-14 border-b border-white/14">
          <div className="lg:col-span-7">
            <p className="m-0 font-mono-tech text-[11px] tracking-[0.14em] uppercase text-[#a1a1aa]">
              <span className={status.isOpen ? 'text-[#ff4d58] font-bold' : 'text-[#d4d4d8] font-bold'}>
                {status.label}
              </span>
              <span className="mx-2 text-[#666]">·</span>
              <span>37°19&apos;43&quot;S 59°08&apos;12&quot;W</span>
            </p>

            <h2 className="mt-4 mb-0 font-display text-[clamp(2.5rem,5.4vw,4.5rem)] font-extrabold leading-[0.92] uppercase text-balance">
              Rodríguez 743,
              <span className="block text-[#9a9a9f]">Tandil — Argentina.</span>
            </h2>

            <p className="mt-4 mb-0 max-w-[48ch] text-[14.5px] leading-[1.6] text-[#a1a1aa]">
              Probate el fit en persona en el local o confirmá tu pedido online por WhatsApp para pasar a retirar sin espera. También coordinamos envíos.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="https://www.google.com/maps/search/?api=1&query=Rodriguez+743+Tandil+Buenos+Aires"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center min-h-[46px] px-5 bg-white text-[#0a0a0a] font-mono-tech text-[11px] font-bold tracking-[0.14em] uppercase whitespace-nowrap transition-colors hover:bg-[#d91e2a] hover:text-white"
              >
                Abrir en Google Maps ↗
              </a>
              <a
                href="https://www.instagram.com/ossktandil/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center min-h-[46px] px-5 border border-white/28 text-white font-mono-tech text-[11px] tracking-[0.14em] uppercase whitespace-nowrap transition-colors hover:bg-white hover:text-[#0a0a0a]"
              >
                @ossktandil
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="border border-white/14 bg-[#141414] p-6">
              <p className="m-0 font-mono-tech text-[11px] tracking-[0.16em] uppercase text-[#a1a1aa]">
                Horarios de atención
              </p>
              <h3 className="mt-2.5 mb-2 font-display text-[26px] font-extrabold uppercase leading-none">
                Lunes a Sábado
              </h3>
              <p className="m-0 font-mono-tech text-[13px] leading-[1.85] text-[#f4f4f5]">
                Mañana · 10:00 a 13:00 hs
                <br />
                Tarde · 17:00 a 20:30 hs
              </p>
              <p className="mt-2.5 mb-0 font-mono-tech text-[11px] text-[#a1a1aa]">
                Estado actual: {status.detail}
              </p>
            </div>

            <div className="border border-white/14 bg-[#141414] p-6">
              <p className="m-0 font-mono-tech text-[11px] tracking-[0.16em] uppercase text-[#ff4d58]">
                Combo Look Completo
              </p>
              <p className="mt-2.5 mb-0 text-[13.5px] leading-[1.6] text-[#d4d4d8]">
                Llevando 3 o más prendas de la pasarela o catálogo accedés a{' '}
                <strong className="text-[#ff4d58]">10% OFF</strong> al confirmar por WhatsApp o en el local.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 font-mono-tech text-[11px] tracking-[0.12em] uppercase text-[#8c8c94]">
          <span>
            <strong className="text-white font-display text-[18px] tracking-[0.14em]">OSSK</strong> · Ropa Urbana · Tandil
          </span>
          <span>© 2026 Ossk Tandil · Runway &amp; Catálogo</span>
        </div>
      </div>
    </footer>
  );
}

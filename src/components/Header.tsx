import { ShoppingBag } from 'lucide-react';

interface HeaderProps {
  totalQty: number;
  pulse: boolean;
  onOpenOrder: () => void;
}

export function Header({ totalQty, pulse, onOpenOrder }: HeaderProps) {
  return (
    <header
      id="site-header"
      className="sticky top-0 z-60 h-16 md:h-20 px-5 md:px-10 flex items-center justify-between gap-8 bg-white/95 backdrop-blur-md border-b border-[#e4e4e4]"
    >
      {/* Zone 1: Single-element brand wordmark */}
      <a
        href="#top"
        aria-label="Ossk Tandil inicio"
        className="font-display text-[26px] md:text-[30px] font-extrabold tracking-[0.14em] leading-none uppercase text-[#151413] whitespace-nowrap shrink-0"
      >
        OSSK
      </a>

      {/* Zone 2: Clean single-line text navigation */}
      <nav aria-label="Navegación principal" className="flex items-center gap-5 md:gap-8 text-[13px] font-medium text-[#5e5a54]">
        <a
          href="#top"
          aria-current="page"
          className="py-2 text-[#151413] font-semibold underline decoration-[#d91e2a] underline-offset-4 whitespace-nowrap shrink-0"
        >
          Runway
        </a>
        <a
          href="#catalogo"
          className="py-2 hover:text-[#151413] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          Catálogo
        </a>
        <a
          href="#comunidad"
          className="hidden md:inline-block py-2 hover:text-[#151413] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          En el local
        </a>
        <a
          href="#experiencia"
          className="hidden sm:inline-block py-2 hover:text-[#151413] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          3D &amp; Mapa
        </a>
      </nav>

      {/* Zone 3: Primary order action */}
      <button
        id="open-bag"
        type="button"
        onClick={onOpenOrder}
        aria-label={`Abrir pedido (${totalQty} prendas)`}
        className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 md:px-4 border font-mono-tech text-[11px] font-semibold tracking-[0.12em] uppercase whitespace-nowrap shrink-0 transition-all duration-200 ${
          totalQty >= 3
            ? 'border-[#d91e2a] bg-[#d91e2a] text-white hover:bg-[#b31620] hover:border-[#b31620]'
            : 'border-[#151413] bg-[#151413] text-white hover:bg-white hover:text-[#151413]'
        } ${pulse ? 'scale-105' : 'scale-100'}`}
      >
        <ShoppingBag className="w-4 h-4 shrink-0" strokeWidth={1.6} aria-hidden="true" />
        <span>Pedido</span>
        <span data-testid="cart-count" className="min-w-[1ch] text-center">
          {totalQty}
        </span>
      </button>
    </header>
  );
}

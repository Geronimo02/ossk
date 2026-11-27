import { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import {
  BRAND_FILTERS,
  CATEGORY_FILTERS,
  PRODUCTS,
  SIZE_FILTERS,
  type BrandDrop,
  type Product,
  type ProductCategory,
} from '../data/catalog';
import { filterProducts, formatArs } from '../utils/storeLogic';
import { soundEngine } from '../utils/soundEngine';

interface CatalogSectionProps {
  onQuickAdd: (productId: string, size: string) => void;
  onOpenLoupe: (productId: string) => void;
}

export function CatalogSection({ onQuickAdd, onOpenLoupe }: CatalogSectionProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | ProductCategory>('all');
  const [activeBrand, setActiveBrand] = useState<'all' | BrandDrop>('all');
  const [activeSize, setActiveSize] = useState<string>('all');
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const visibleProducts = filterProducts(PRODUCTS, activeCategory, activeSize, activeBrand);

  const handleQuickAdd = (product: Product, size: string) => {
    const key = `${product.id}::${size}`;
    onQuickAdd(product.id, size);
    setConfirmedKey(key);
    window.setTimeout(() => {
      setConfirmedKey((prev) => (prev === key ? null : prev));
    }, 800);
  };

  const handleResetFilters = () => {
    soundEngine.playPop();
    setActiveCategory('all');
    setActiveBrand('all');
    setActiveSize('all');
  };

  return (
    <section id="catalogo" className="bg-[#f5f5f3] text-[#151413] py-16 md:py-24">
      <div className="w-full max-w-[1440px] mx-auto px-5 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6 pb-7 border-b border-[#dfdfdc]">
          <div>
            <p className="m-0 font-mono-tech text-[11px] tracking-[0.2em] uppercase text-[#5e5a54]">
              02 · Catálogo Individual · Multimarca &amp; Drops
            </p>
            <h2 className="mt-2 mb-0 font-display text-[clamp(2.35rem,5vw,4.25rem)] font-extrabold leading-[0.92] uppercase text-balance">
              Stock Disponible
            </h2>
          </div>
          <p className="m-0 max-w-[44ch] text-[14px] leading-[1.55] text-[#5e5a54]">
            Filtrá por categoría, marca o talle. Tocá cualquier prenda para alternar Flat-lay / Puesto e inspeccionar la tela con lupa 2.4x.
          </p>
        </div>

        {/* Sticky Filter Bar */}
        <div className="sticky top-16 md:top-20 z-30 -mx-5 md:-mx-10 px-5 md:px-10 py-3 mb-9 bg-[#f5f5f3]/95 backdrop-blur-md border-b border-[#dfdfdc] flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Filtrar por categoría">
              {CATEGORY_FILTERS.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      soundEngine.playPop();
                      setActiveCategory(cat.id);
                    }}
                    className={`min-h-[40px] px-3.5 border font-mono-tech text-[11px] tracking-[0.12em] uppercase whitespace-nowrap shrink-0 transition-colors ${
                      isActive
                        ? 'bg-[#151413] border-[#151413] text-white font-bold'
                        : 'bg-white border-[#dcdcd8] text-[#151413] hover:border-[#151413]'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar" role="group" aria-label="Filtrar por talle">
                {SIZE_FILTERS.map((size) => {
                  const isActive = activeSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        soundEngine.playPop();
                        setActiveSize(size);
                      }}
                      className={`min-h-[40px] min-w-[40px] px-2.5 border font-mono-tech text-[11px] tracking-[0.1em] uppercase whitespace-nowrap shrink-0 transition-colors ${
                        isActive
                          ? 'bg-[#151413] border-[#151413] text-white font-bold'
                          : 'bg-white border-[#dcdcd8] text-[#151413] hover:border-[#151413]'
                      }`}
                    >
                      {size === 'all' ? 'Todos' : size}
                    </button>
                  );
                })}
              </div>
              <span
                data-testid="catalog-count"
                className="font-mono-tech text-[11px] tracking-[0.16em] uppercase text-[#5e5a54] whitespace-nowrap shrink-0"
              >
                {visibleProducts.length} {visibleProducts.length === 1 ? 'prenda' : 'prendas'}
              </span>
            </div>
          </div>

          {/* Brand / Drop Filter Row */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 border-t border-[#e5e5e1]" role="group" aria-label="Filtrar por marca o drop">
            <span className="font-mono-tech text-[10px] tracking-[0.16em] uppercase text-[#5e5a54] whitespace-nowrap shrink-0">
              Marca / Drop:
            </span>
            {BRAND_FILTERS.map((b) => {
              const isActive = activeBrand === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    soundEngine.playPop();
                    setActiveBrand(b.id);
                  }}
                  className={`min-h-[32px] px-2.5 border-0 bg-transparent font-mono-tech text-[10.5px] tracking-[0.12em] uppercase whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'text-[#d91e2a] font-bold underline underline-offset-4'
                      : 'text-[#5e5a54] hover:text-[#151413]'
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty filter state */}
        {visibleProducts.length === 0 ? (
          <div className="border border-[#dfdfdc] bg-white px-6 py-16 text-center">
            <p className="font-mono-tech text-[11px] tracking-[0.18em] uppercase text-[#5e5a54]">
              Sin resultados para este filtro
            </p>
            <p className="mt-2 text-[14px] text-[#5e5a54]">
              Probá limpiar la categoría, marca o talle seleccionado para ver todo el stock disponible.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-5 inline-flex items-center justify-center min-h-[44px] px-6 bg-[#151413] text-white font-mono-tech text-[11px] font-semibold tracking-[0.14em] uppercase whitespace-nowrap hover:bg-[#d91e2a] transition-colors"
            >
              Ver todo el catálogo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-7">
            {visibleProducts.map((product) => {
              const primaryFailed = failedImages[`${product.id}-0`];
              const altFailed = failedImages[`${product.id}-1`];
              const isHighlightBadge =
                product.badge === 'DROP' || product.badge === 'LIMITED' || product.badge === 'COMBO';

              return (
                <article
                  key={product.id}
                  data-testid="product-card"
                  className="group flex flex-col border border-[#e1e1dd] bg-white transition-colors duration-200 hover:border-[#151413]"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#eaeae6]">
                    <button
                      type="button"
                      onClick={() => onOpenLoupe(product.id)}
                      aria-label={`Ver ${product.name} con lupa técnica`}
                      className="block w-full h-full p-0 border-0 bg-transparent text-left"
                    >
                      {primaryFailed ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#ecece9] to-[#dfdfd9] text-[#5e5a54]">
                          <span className="font-mono-tech text-[10px] tracking-[0.18em] uppercase">
                            {product.sku}
                          </span>
                          <span className="mt-2 font-display text-xl font-extrabold uppercase text-[#151413]">
                            {product.name}
                          </span>
                        </div>
                      ) : (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [`${product.id}-0`]: true }))
                          }
                          className="w-full h-full object-cover editorial-bw-soft transition-opacity duration-300 group-hover:opacity-0"
                        />
                      )}
                      {!altFailed && (
                        <img
                          src={product.images[1]}
                          alt=""
                          aria-hidden="true"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [`${product.id}-1`]: true }))
                          }
                          className="absolute inset-0 w-full h-full object-cover object-top editorial-bw-soft opacity-0 transition-all duration-400 group-hover:opacity-100 group-hover:scale-[1.03]"
                        />
                      )}
                    </button>

                    {product.badge && (
                      <span
                        className={`pointer-events-none absolute top-2.5 left-2.5 px-2 py-0.5 text-white font-mono-tech text-[9.5px] font-bold tracking-[0.14em] uppercase ${
                          isHighlightBadge ? 'bg-[#d91e2a]' : 'bg-[#151413]'
                        }`}
                      >
                        {product.badge}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenLoupe(product.id)}
                      title="Inspeccionar con lupa 2.4x"
                      aria-label={`Lupa técnica de ${product.name}`}
                      className="absolute right-2.5 bottom-2.5 w-10 h-10 border border-[#151413]/20 bg-white/95 text-[#151413] grid place-items-center transition-colors duration-200 hover:bg-[#151413] hover:text-white"
                    >
                      <ZoomIn className="w-4 h-4" strokeWidth={1.7} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="p-4 flex flex-col justify-between flex-1 gap-3.5">
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono-tech text-[10px] tracking-[0.12em] uppercase text-[#5e5a54] truncate">
                          <strong className="text-[#151413] font-semibold">{product.brand}</strong> · {product.fit}
                        </span>
                        <span className="font-mono-tech text-[14px] font-bold text-[#151413] shrink-0">
                          {formatArs(product.price)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenLoupe(product.id)}
                        className="mt-1.5 p-0 border-0 bg-transparent text-left text-[15px] font-semibold text-[#151413] leading-snug hover:underline underline-offset-4"
                      >
                        {product.name}
                      </button>

                      <p className="mt-1 mb-0 text-[12px] text-[#5e5a54] truncate">
                        {product.fabric}
                      </p>
                    </div>

                    <div className="border-t border-[#ecece8] pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono-tech text-[9.5px] tracking-[0.14em] uppercase text-[#5e5a54]">
                          Sumar rápido · Talle
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenLoupe(product.id)}
                          className="p-0 border-0 bg-transparent font-mono-tech text-[10px] uppercase underline underline-offset-2 text-[#151413] hover:text-[#d91e2a]"
                        >
                          Medidas
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {product.sizes.map((size) => {
                          const key = `${product.id}::${size}`;
                          const isOk = confirmedKey === key;
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => handleQuickAdd(product, size)}
                              aria-label={`Sumar ${product.name} talle ${size}`}
                              className={`min-h-[38px] border font-mono-tech text-[11px] transition-colors ${
                                isOk
                                  ? 'bg-[#d91e2a] border-[#d91e2a] text-white font-bold'
                                  : 'bg-[#f5f5f3] border-[#dcdcd8] text-[#151413] hover:bg-[#151413] hover:border-[#151413] hover:text-white'
                              }`}
                            >
                              {isOk ? '✓' : size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { OSSK_WHATSAPP, PRODUCTS } from '../data/catalog';
import {
  buildWhatsAppMessage,
  computeOrderTotals,
  formatArs,
  getComboUpsell,
  type CartItem,
  type DeliveryMode,
} from '../utils/storeLogic';
import { soundEngine } from '../utils/soundEngine';

interface OrderDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  gamePromoUnlocked: boolean;
  onClose: () => void;
  onUpdateQty: (key: string, delta: number) => void;
  onRemoveItem: (key: string) => void;
  onQuickAdd: (productId: string, size: string) => void;
  onClear: () => void;
  onNotify: (message: string) => void;
}

export function OrderDrawer({
  isOpen,
  items,
  gamePromoUnlocked,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onQuickAdd,
  onClear,
  onNotify,
}: OrderDrawerProps) {
  const [delivery, setDelivery] = useState<DeliveryMode>('retiro');
  const [customerName, setCustomerName] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setEntered(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
      };
    } else {
      setEntered(false);
      const timer = window.setTimeout(() => {
        setShouldRender(false);
      }, 540);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const totals = computeOrderTotals(items, gamePromoUnlocked);
  const upsell = gamePromoUnlocked ? null : getComboUpsell(items, PRODUCTS);
  const waText = buildWhatsAppMessage(
    items,
    delivery,
    customerName,
    orderNote,
    gamePromoUnlocked
  );
  const waUrl = `https://wa.me/${OSSK_WHATSAPP}?text=${encodeURIComponent(waText)}`;

  const handleCopy = () => {
    soundEngine.playPop();
    navigator.clipboard
      ?.writeText(waText)
      .then(() => onNotify('Resumen copiado al portapapeles'))
      .catch(() => onNotify('No se pudo copiar el resumen'));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tu pedido en Ossk Tandil"
      data-testid="order-drawer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`ossk-drawer-backdrop fixed inset-0 z-220 flex justify-end bg-[#0a0a0a]/65 backdrop-blur-xs ${
        entered ? 'is-open' : ''
      }`}
    >
      <aside
        data-testid="order-drawer-panel"
        className="ossk-drawer-panel w-full max-w-[440px] h-full flex flex-col bg-[#0a0a0a] text-white border-l border-white/16"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/14">
          <span className="font-mono-tech text-[12px] font-bold tracking-[0.16em] uppercase">
            Tu Pedido ({totals.totalQty})
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar pedido"
            className="w-10 h-10 border border-white/20 bg-transparent text-white grid place-items-center transition-colors hover:bg-white hover:text-[#0a0a0a]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#a1a1aa] px-4">
              <p className="font-mono-tech text-[11px] tracking-[0.16em] uppercase text-white">
                Tu pedido está vacío
              </p>
              <p className="mt-2 text-[13.5px] max-w-[270px] leading-[1.55]">
                Sumá prendas desde la pasarela 3D o el catálogo y enviá tu orden lista a WhatsApp.
              </p>
            </div>
          ) : (
            <>
              <ul className="list-none m-0 p-0 space-y-2.5">
                {items.map((item) => (
                  <li
                    key={item.key}
                    className="flex gap-3 p-3 border border-white/12 bg-[#141414]"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-[60px] h-[76px] object-cover shrink-0 bg-[#1f1f22]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-[13.5px] font-semibold truncate">
                          {item.name}
                        </strong>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playPop();
                            onRemoveItem(item.key);
                          }}
                          aria-label={`Quitar ${item.name} talle ${item.size}`}
                          className="p-1 border-0 bg-transparent text-[#a1a1aa] hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="font-mono-tech text-[10.5px] text-[#a1a1aa] mt-0.5">
                        TALLE {item.size} · {item.sku}
                      </div>
                      <div className="flex items-center justify-between mt-2.5">
                        <div className="inline-flex border border-white/20">
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playPop();
                              onUpdateQty(item.key, -1);
                            }}
                            aria-label={`Restar cantidad de ${item.name}`}
                            className="w-8 h-8 border-0 bg-transparent text-white hover:bg-white/10"
                          >
                            −
                          </button>
                          <span className="min-w-[28px] grid place-items-center font-mono-tech text-[11px]">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playPop();
                              onUpdateQty(item.key, 1);
                            }}
                            aria-label={`Sumar cantidad de ${item.name}`}
                            className="w-8 h-8 border-0 bg-transparent text-white hover:bg-white/10"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-mono-tech text-[13px] font-bold">
                          {formatArs(item.price * item.qty)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {upsell && (
                <div
                  data-testid="combo-upsell"
                  className="mt-4 p-3.5 border border-[#d91e2a]/50 bg-[#141414]"
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="font-mono-tech text-[10.5px] font-bold tracking-[0.12em] uppercase text-[#ff4d58]">
                      {upsell.needed === 1
                        ? 'Te falta 1 prenda para 10% OFF'
                        : `Te faltan ${upsell.needed} prendas para 10% OFF`}
                    </span>
                    <span className="font-mono-tech text-[10px] tracking-[0.1em] uppercase text-[#a1a1aa]">
                      Combo 3+
                    </span>
                  </div>
                  <div className="space-y-2">
                    {upsell.suggestions.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-2.5 p-2 border border-white/10 bg-[#0d0d0e]"
                      >
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-[42px] h-[52px] object-cover shrink-0 bg-[#1f1f22]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-semibold text-white truncate">
                            {product.name}
                          </div>
                          <div className="font-mono-tech text-[10.5px] text-[#a1a1aa]">
                            {formatArs(product.price)} · Talle {product.sizes[0]}
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid={`upsell-add-${product.id}`}
                          onClick={() => onQuickAdd(product.id, product.sizes[0])}
                          className="min-h-[34px] px-3 border border-[#d91e2a] bg-[#d91e2a] text-white font-mono-tech text-[10px] font-bold tracking-[0.1em] uppercase whitespace-nowrap transition-colors hover:bg-white hover:text-[#0a0a0a] hover:border-white"
                        >
                          + Sumar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-white/14">
                <p className="m-0 mb-2 font-mono-tech text-[10.5px] tracking-[0.14em] text-[#a1a1aa] uppercase">
                  Entrega
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={delivery === 'retiro'}
                    onClick={() => {
                      soundEngine.playPop();
                      setDelivery('retiro');
                    }}
                    className={`min-h-[42px] border font-mono-tech text-[10.5px] font-bold uppercase transition-colors ${
                      delivery === 'retiro'
                        ? 'border-white bg-white text-[#0a0a0a]'
                        : 'border-white/22 bg-transparent text-[#a1a1aa] hover:border-white'
                    }`}
                  >
                    Retiro 743
                  </button>
                  <button
                    type="button"
                    aria-pressed={delivery === 'envio'}
                    onClick={() => {
                      soundEngine.playPop();
                      setDelivery('envio');
                    }}
                    className={`min-h-[42px] border font-mono-tech text-[10.5px] font-bold uppercase transition-colors ${
                      delivery === 'envio'
                        ? 'border-white bg-white text-[#0a0a0a]'
                        : 'border-white/22 bg-transparent text-[#a1a1aa] hover:border-white'
                    }`}
                  >
                    Envío
                  </button>
                </div>

                <label className="sr-only" htmlFor="order-customer-name">
                  Tu nombre (opcional)
                </label>
                <input
                  id="order-customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Tu nombre (opcional)"
                  className="w-full min-h-[42px] px-3 mt-2.5 border border-white/20 bg-[#141414] text-white text-[13px] placeholder:text-[#71717a]"
                />

                <label className="sr-only" htmlFor="order-note">
                  Nota para el local (opcional)
                </label>
                <input
                  id="order-note"
                  type="text"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Nota (ej. paso a las 18hs)"
                  className="w-full min-h-[42px] px-3 mt-2 border border-white/20 bg-[#141414] text-white text-[13px] placeholder:text-[#71717a]"
                />
              </div>
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-white/14 bg-[#141414]">
            {totals.gamePromoActive && (
              <div className="mb-2.5 px-3 py-2 border border-[#22c55e]/45 bg-[#102618] flex items-center justify-between">
                <span className="font-mono-tech text-[10px] font-bold tracking-[0.12em] uppercase text-[#4ade80]">
                  Cupón Skate Run 743 · OSSK15
                </span>
                <span className="font-mono-tech text-[10.5px] font-bold text-white">
                  -15% OFF
                </span>
              </div>
            )}

            <div className="flex items-baseline justify-between mb-3">
              <span
                className={`font-mono-tech text-[11px] tracking-[0.14em] uppercase ${
                  totals.discountPercent > 0 ? 'text-[#ff4d58] font-bold' : 'text-[#a1a1aa]'
                }`}
              >
                {totals.gamePromoActive
                  ? 'Total Skate Run (-15%)'
                  : totals.comboEligible
                    ? 'Total Combo (-10%)'
                    : 'Total estimado'}
              </span>
              <span className="font-mono-tech flex items-baseline gap-2">
                {totals.discountPercent > 0 && (
                  <s className="text-[12px] text-[#888890]">{formatArs(totals.subtotal)}</s>
                )}
                <strong data-testid="order-total" className="text-[20px]">
                  {formatArs(totals.finalTotal)}
                </strong>
              </span>
            </div>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => soundEngine.playAdd()}
              className="flex items-center justify-center w-full min-h-[48px] px-5 bg-white text-[#0a0a0a] font-mono-tech text-[11px] font-bold tracking-[0.14em] uppercase whitespace-nowrap transition-colors hover:bg-[#d91e2a] hover:text-white"
            >
              Enviar pedido por WhatsApp →
            </a>

            <div className="flex items-center justify-between mt-2.5">
              <button
                type="button"
                onClick={handleCopy}
                className="py-2 border-0 bg-transparent text-[#a1a1aa] font-mono-tech text-[10.5px] uppercase hover:text-white transition-colors"
              >
                Copiar resumen
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  onClear();
                }}
                className="py-2 border-0 bg-transparent text-[#a1a1aa] font-mono-tech text-[10.5px] uppercase hover:text-white transition-colors"
              >
                Vaciar
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}


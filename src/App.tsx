import { useCallback, useEffect, useRef, useState } from 'react';
import { getProductById } from './data/catalog';
import { Header } from './components/Header';
import { RunwaySection } from './components/RunwaySection';
import { CatalogSection } from './components/CatalogSection';
import { CommunitySection } from './components/CommunitySection';
import { ExperienceSection } from './components/ExperienceSection';
import { OsskGameOverlay } from './components/OsskGameOverlay';
import { LoupeModal } from './components/LoupeModal';
import { OrderDrawer } from './components/OrderDrawer';
import { StoreFooter } from './components/StoreFooter';
import { PreloaderCurtain } from './components/PreloaderCurtain';
import type { AddItemEntry, OsskRunwayElement } from './components/osskRunwayElement';
import {
  computeOrderTotals,
  getTandilStoreStatus,
  mergeOrderItems,
  type CartItem,
} from './utils/storeLogic';
import { soundEngine } from './utils/soundEngine';

const STORAGE_KEY = 'ossk-runway-order-v2';
const PROMO_STORAGE_KEY = 'ossk-skaterun-promo15-v1';

function loadInitialPromo(): boolean {
  try {
    return localStorage.getItem(PROMO_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function loadInitialCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [cart, setCart] = useState<CartItem[]>(loadInitialCart);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loupeProductId, setLoupeProductId] = useState<string | null>(null);
  const [gameOpen, setGameOpen] = useState(false);
  const [gamePromoUnlocked, setGamePromoUnlocked] = useState<boolean>(loadInitialPromo);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [storeStatus, setStoreStatus] = useState(() => getTandilStoreStatus());
  const [toast, setToast] = useState<string | null>(null);
  const [bagPulse, setBagPulse] = useState(false);

  const runwayRef = useRef<OsskRunwayElement | null>(null);
  const toastTimerRef = useRef<number>(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    const onQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStoreStatus(getTandilStoreStatus());
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  const handleOpenOrder = useCallback(() => {
    soundEngine.playDrawer(true);
    setDrawerOpen(true);
  }, []);

  const handleCloseOrder = useCallback(() => {
    soundEngine.playDrawer(false);
    setDrawerOpen(false);
  }, []);

  const handleOpenLoupe = useCallback((id: string) => {
    soundEngine.playZoom(true);
    setLoupeProductId(id);
  }, []);

  const handleCloseLoupe = useCallback(() => {
    soundEngine.playZoom(false);
    setLoupeProductId(null);
  }, []);

  const handleJumpToLook = useCallback((lookIndex: number) => {
    soundEngine.playPop();
    runwayRef.current?.goToLook(lookIndex);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  const handleAddItems = useCallback(
    (entries: AddItemEntry[], openAfter = false) => {
      const resolved = entries
        .map((entry) => {
          const product = getProductById(entry.productId);
          return product ? { product, size: entry.size } : null;
        })
        .filter((x): x is { product: NonNullable<ReturnType<typeof getProductById>>; size: string } => Boolean(x));

      if (!resolved.length) return;

      const prevTotals = computeOrderTotals(cart);
      const nextCart = mergeOrderItems(cart, resolved);
      const nextTotals = computeOrderTotals(nextCart);

      setCart(nextCart);
      setBagPulse(true);
      window.setTimeout(() => setBagPulse(false), 280);

      if (nextTotals.comboEligible && (!prevTotals.comboEligible || resolved.length > 1)) {
        soundEngine.playCombo();
      } else {
        soundEngine.playAdd();
      }

      showToast(
        resolved.length > 1
          ? 'Look completo sumado · 10% OFF activo'
          : nextTotals.comboEligible && !prevTotals.comboEligible
            ? '¡Combo 3+ desbloqueado · 10% OFF!'
            : 'Prenda sumada a tu pedido'
      );

      if (openAfter) {
        soundEngine.playDrawer(true);
        setDrawerOpen(true);
      }
    },
    [cart, showToast]
  );

  const handleQuickAdd = useCallback(
    (productId: string, size: string) => {
      handleAddItems([{ productId, size }], false);
    },
    [handleAddItems]
  );

  const handleLoupeAdd = useCallback(
    (productId: string, size: string, openDrawer: boolean) => {
      handleAddItems([{ productId, size }], openDrawer);
      if (openDrawer) {
        setLoupeProductId(null);
      }
    },
    [handleAddItems]
  );

  const handleUpdateQty = useCallback((key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.key === key ? { ...item, qty: Math.min(20, item.qty + delta) } : item))
        .filter((item) => item.qty > 0)
    );
  }, []);

  const handleRemoveItem = useCallback((key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const handleClearCart = useCallback(() => {
    setCart([]);
  }, []);

  const handleUnlockPromo = useCallback(() => {
    setGamePromoUnlocked(true);
    try {
      localStorage.setItem(PROMO_STORAGE_KEY, '1');
    } catch {
      // ignore storage errors
    }
    showToast('¡Cupón OSSK15 desbloqueado · 15% OFF activo!');
  }, [showToast]);

  const handleApplyPromoAndOpenOrder = useCallback(() => {
    setGameOpen(false);
    setDrawerOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (gameOpen) return;
      if (loupeProductId) {
        handleCloseLoupe();
        return;
      }
      if (drawerOpen) {
        handleCloseOrder();
        return;
      }
      if (runwayRef.current?.openSheet) {
        runwayRef.current.closeMobileSheet();
        return;
      }
      if (runwayRef.current?.zoomed) {
        runwayRef.current.closeZoom();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, gameOpen, handleCloseLoupe, handleCloseOrder, loupeProductId]);

  const totals = computeOrderTotals(cart, gamePromoUnlocked);
  const activeLoupeProduct = loupeProductId ? getProductById(loupeProductId) ?? null : null;

  return (
    <div id="top" className="min-h-screen bg-white text-[#151413]">
      <PreloaderCurtain />
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <Header
        totalQty={totals.totalQty}
        pulse={bagPulse}
        onOpenOrder={handleOpenOrder}
      />

      <main>
        <RunwaySection
          storeStatusText={`${storeStatus.label} · RODRÍGUEZ 743`}
          onAddItems={(entries) => handleAddItems(entries, false)}
          onOpenLoupe={handleOpenLoupe}
          runwayRef={runwayRef}
        />

        <CatalogSection
          onQuickAdd={handleQuickAdd}
          onOpenLoupe={handleOpenLoupe}
        />

        <CommunitySection
          onOpenLoupe={handleOpenLoupe}
          onJumpToLook={handleJumpToLook}
        />

        <ExperienceSection
          promoUnlocked={gamePromoUnlocked}
          onLaunchGame={() => setGameOpen(true)}
          onOpenOrder={handleOpenOrder}
        />
      </main>

      <StoreFooter status={storeStatus} />

      <OsskGameOverlay
        isOpen={gameOpen}
        promoUnlocked={gamePromoUnlocked}
        onUnlockPromo={handleUnlockPromo}
        onApplyPromoAndOpenOrder={handleApplyPromoAndOpenOrder}
        onClose={() => setGameOpen(false)}
      />

      <LoupeModal
        product={activeLoupeProduct}
        onClose={handleCloseLoupe}
        onAdd={handleLoupeAdd}
      />

      <OrderDrawer
        isOpen={drawerOpen}
        items={cart}
        gamePromoUnlocked={gamePromoUnlocked}
        onClose={handleCloseOrder}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onQuickAdd={handleQuickAdd}
        onClear={handleClearCart}
        onNotify={showToast}
      />

      <div
        role="status"
        aria-live="polite"
        className={`fixed left-1/2 bottom-6 -translate-x-1/2 z-300 px-5 py-3 bg-[#151413] text-white font-mono-tech text-[11px] tracking-[0.1em] uppercase pointer-events-none transition-all duration-300 ${
          toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {toast ?? ''}
      </div>
    </div>
  );
}


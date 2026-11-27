import { useEffect, useRef } from 'react';
import {
  registerOsskRunwayElement,
  type AddItemEntry,
  type OsskRunwayElement,
} from './osskRunwayElement';

registerOsskRunwayElement();

interface RunwaySectionProps {
  storeStatusText: string;
  onAddItems: (entries: AddItemEntry[]) => void;
  onOpenLoupe: (productId: string) => void;
  runwayRef: React.RefObject<OsskRunwayElement | null>;
}

export function RunwaySection({
  storeStatusText,
  onAddItems,
  onOpenLoupe,
  runwayRef,
}: RunwaySectionProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const addItemsRef = useRef(onAddItems);
  const openLoupeRef = useRef(onOpenLoupe);

  useEffect(() => {
    addItemsRef.current = onAddItems;
    openLoupeRef.current = onOpenLoupe;
  }, [onAddItems, onOpenLoupe]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const el = document.createElement('ossk-runway') as OsskRunwayElement;
    el.id = 'ossk-runway';
    el.dataset.autoplay = 'true';
    el.dataset.speed = '5000';
    el.dataset.storeStatus = storeStatusText;

    const handleAdd = (ev: Event) => {
      const customEv = ev as CustomEvent<{ entries: AddItemEntry[] }>;
      if (customEv.detail?.entries?.length) {
        addItemsRef.current(customEv.detail.entries);
      }
    };

    const handleLoupe = (ev: Event) => {
      const customEv = ev as CustomEvent<{ productId: string }>;
      if (customEv.detail?.productId) {
        openLoupeRef.current(customEv.detail.productId);
      }
    };

    el.addEventListener('ossk:add-items', handleAdd);
    el.addEventListener('ossk:open-loupe', handleLoupe);
    host.innerHTML = '';
    host.appendChild(el);
    runwayRef.current = el;

    return () => {
      el.removeEventListener('ossk:add-items', handleAdd);
      el.removeEventListener('ossk:open-loupe', handleLoupe);
      el.remove();
      runwayRef.current = null;
    };
  }, [runwayRef]);

  useEffect(() => {
    if (runwayRef.current) {
      runwayRef.current.setAttribute('data-store-status', storeStatusText);
    }
  }, [storeStatusText, runwayRef]);

  return <div ref={hostRef} className="w-full" />;
}

import type { BrandDrop, Product, ProductCategory } from '../data/catalog';

export interface CartItem {
  key: string;
  id: string;
  sku: string;
  name: string;
  size: string;
  price: number;
  image: string;
  qty: number;
}

export type DeliveryMode = 'retiro' | 'envio';

export interface TandilStoreStatus {
  isOpen: boolean;
  label: string;
  detail: string;
}

export interface OrderTotals {
  totalQty: number;
  subtotal: number;
  comboEligible: boolean;
  gamePromoActive: boolean;
  discountPercent: number;
  discountAmount: number;
  finalTotal: number;
}

export interface RingBodyTransform {
  x: number;
  bottom: number;
  scale: number;
  opacity: number;
  blur: number;
  zIndex: number;
  slotDistance: number;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export function damp(curr: number, target: number, k: number, dt: number): number {
  return curr + (target - curr) * (1 - Math.pow(1 - k, clamp(dt, 0, 0.1) * 60));
}

export function wrapIndex(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}

export function shortestDelta(from: number, to: number, count: number): number {
  let d = (to - from + count) % count;
  if (d > count / 2) d -= count;
  return d;
}

export function formatArs(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getTandilStoreStatus(date: Date = new Date()): TandilStoreStatus {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const day = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 12);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const mins = (hour === 24 ? 0 : hour) * 60 + minute;

  if (day === 'Sun') {
    return {
      isOpen: false,
      label: 'CERRADO HOY',
      detail: 'Abre lunes 10:00 hs · Rodríguez 743',
    };
  }

  if (mins >= 600 && mins < 780) {
    return {
      isOpen: true,
      label: 'ABIERTO AHORA',
      detail: 'Hasta las 13:00 hs · Rodríguez 743',
    };
  }

  if (mins >= 1020 && mins < 1230) {
    return {
      isOpen: true,
      label: 'ABIERTO AHORA',
      detail: 'Hasta las 20:30 hs · Rodríguez 743',
    };
  }

  if (mins < 600) {
    return {
      isOpen: false,
      label: 'CERRADO',
      detail: 'Abre hoy 10:00 hs · Rodríguez 743',
    };
  }

  if (mins >= 780 && mins < 1020) {
    return {
      isOpen: false,
      label: 'CERRADO',
      detail: 'Vuelve hoy 17:00 hs · Rodríguez 743',
    };
  }

  return {
    isOpen: false,
    label: 'CERRADO',
    detail:
      day === 'Sat'
        ? 'Abre lunes 10:00 hs · Rodríguez 743'
        : 'Abre mañana 10:00 hs · Rodríguez 743',
  };
}

export function computeOrderTotals(
  items: ReadonlyArray<CartItem>,
  gamePromoUnlocked = false
): OrderTotals {
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const comboEligible = totalQty >= 3;
  const gamePromoActive = gamePromoUnlocked && totalQty > 0;
  const discountPercent = gamePromoActive ? 15 : comboEligible ? 10 : 0;
  const finalTotal =
    discountPercent > 0 ? Math.round(subtotal * (1 - discountPercent / 100)) : subtotal;

  return {
    totalQty,
    subtotal,
    comboEligible,
    gamePromoActive,
    discountPercent,
    discountAmount: subtotal - finalTotal,
    finalTotal,
  };
}

export function mergeOrderItems(
  current: ReadonlyArray<CartItem>,
  additions: ReadonlyArray<{ product: Product; size: string }>
): CartItem[] {
  const next = current.map((item) => ({ ...item }));
  for (const { product, size } of additions) {
    const key = `${product.id}::${size}`;
    const existing = next.find((item) => item.key === key);
    if (existing) {
      existing.qty = Math.min(20, existing.qty + 1);
    } else {
      next.push({
        key,
        id: product.id,
        sku: product.sku,
        name: product.name,
        size,
        price: product.price,
        image: product.images[0],
        qty: 1,
      });
    }
  }
  return next;
}

export function buildWhatsAppMessage(
  items: ReadonlyArray<CartItem>,
  delivery: DeliveryMode,
  customerName: string,
  orderNote: string,
  gamePromoUnlocked = false
): string {
  const totals = computeOrderTotals(items, gamePromoUnlocked);
  const totalLine = totals.gamePromoActive
    ? `Subtotal: ${formatArs(totals.subtotal)}\nCupón Skate Run 743 (OSSK15 -15%): ${formatArs(
        totals.finalTotal
      )}`
    : totals.comboEligible
      ? `Subtotal: ${formatArs(totals.subtotal)}\nPromo Combo Look (3+ prendas -10%): ${formatArs(
          totals.finalTotal
        )}`
      : `Total estimado: ${formatArs(totals.subtotal)}`;

  const lines = [
    'Hola Ossk Tandil! Quiero confirmar este pedido:',
    '',
    ...items.map(
      (item, idx) =>
        `${idx + 1}. ${item.name} (${item.sku}) — Talle ${item.size} x${item.qty} · ${formatArs(
          item.price * item.qty
        )}`
    ),
    '',
    totalLine,
    `Entrega: ${
      delivery === 'retiro' ? 'Retiro en local (Rodríguez 743, Tandil)' : 'Envío a coordinar'
    }`,
  ];

  if (customerName.trim()) {
    lines.push(`Nombre: ${customerName.trim()}`);
  }
  if (orderNote.trim()) {
    lines.push(`Nota: ${orderNote.trim()}`);
  }

  return lines.join('\n');
}

export function filterProducts(
  products: ReadonlyArray<Product>,
  category: 'all' | ProductCategory,
  size: string,
  brand: 'all' | BrandDrop = 'all'
): Product[] {
  return products.filter(
    (product) =>
      (category === 'all' || product.category === category) &&
      (size === 'all' || product.sizes.includes(size)) &&
      (brand === 'all' || product.brand === brand)
  );
}

export interface ComboUpsellState {
  needed: number;
  suggestions: Product[];
}

export function getComboUpsell(
  items: ReadonlyArray<CartItem>,
  products: ReadonlyArray<Product>
): ComboUpsellState | null {
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  if (totalQty <= 0 || totalQty >= 3) return null;

  const needed = 3 - totalQty;
  const inCartIds = new Set(items.map((item) => item.id));
  const candidates = products.filter(
    (p) => p.category === 'medias' || p.category === 'accesorios'
  );
  const preferred = candidates.filter((p) => !inCartIds.has(p.id));
  const suggestions = (preferred.length > 0 ? preferred : candidates).slice(0, 2);

  if (!suggestions.length) return null;
  return { needed, suggestions };
}

export function stepSpring(
  cur: number,
  target: number,
  vel: number,
  dt: number,
  k = 95
): { cur: number; vel: number; settled: boolean } {
  const c = 2 * Math.sqrt(k);
  const h = dt / 4;
  let nextCur = cur;
  let nextVel = vel;

  for (let s = 0; s < 4; s++) {
    const acc = -k * (nextCur - target) - c * nextVel;
    nextVel += acc * h;
    nextCur += nextVel * h;
  }

  if (Math.abs(nextCur - target) <= 0.003 && Math.abs(nextVel) <= 0.015) {
    return { cur: target, vel: 0, settled: true };
  }

  return { cur: nextCur, vel: nextVel, settled: false };
}

export function computeRingTransform(
  bodyIndex: number,
  cur: number,
  totalBodies: number,
  width: number,
  height: number,
  isStill: boolean,
  frontScale = 1.08
): RingBodyTransform {
  const cx = 0.5 * width;
  const radius = 0.62 * width;
  const perspective = 1.65 * width;
  const floor = height - 34;
  const horizon = 0.36 * height;
  const step = (2 * Math.PI) / totalBodies;

  let phi = ((bodyIndex - cur) * step) % (2 * Math.PI);
  if (phi > Math.PI) phi -= 2 * Math.PI;
  if (phi <= -Math.PI) phi += 2 * Math.PI;

  const z = radius * (1 - Math.cos(phi));
  const persp = perspective / (perspective + z);
  const slotDistance = Math.abs(phi) / step;
  const scale = persp * (1 + (frontScale - 1) * clamp(1 - slotDistance, 0, 1));
  const x = cx + radius * Math.sin(phi) * persp;
  const feet = horizon + (floor - horizon) * persp;
  const bottom = height - feet;
  const blur = slotDistance <= 1 ? 1.8 * slotDistance : Math.min(1.8 + (slotDistance - 1) * 2, 6.5);
  let opacity = clamp((Math.cos(phi) + 0.55) / 0.3, 0, 1);
  if (isStill && slotDistance < 0.02) {
    opacity = 0;
  }

  return {
    x,
    bottom,
    scale,
    opacity,
    blur,
    zIndex: Math.round(scale * 1000),
    slotDistance,
  };
}

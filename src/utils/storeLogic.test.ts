import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, getProductById } from '../data/catalog';
import {
  buildWhatsAppMessage,
  computeOrderTotals,
  computeRingTransform,
  filterProducts,
  getComboUpsell,
  getTandilStoreStatus,
  mergeOrderItems,
  shortestDelta,
  stepSpring,
  wrapIndex,
} from './storeLogic';
import { getSoundGain } from './soundEngine';

test('getTandilStoreStatus detects open morning, midday break, open afternoon, and Sunday closed in Argentina time', () => {
  const mondayMorning = getTandilStoreStatus(new Date('2026-06-08T14:30:00Z'));
  assert.equal(mondayMorning.isOpen, true);
  assert.equal(mondayMorning.label, 'ABIERTO AHORA');
  assert.match(mondayMorning.detail, /13:00/);

  const mondaySiesta = getTandilStoreStatus(new Date('2026-06-08T18:00:00Z'));
  assert.equal(mondaySiesta.isOpen, false);
  assert.match(mondaySiesta.detail, /17:00/);

  const saturdayAfternoon = getTandilStoreStatus(new Date('2026-06-13T21:45:00Z'));
  assert.equal(saturdayAfternoon.isOpen, true);
  assert.match(saturdayAfternoon.detail, /20:30/);

  const sunday = getTandilStoreStatus(new Date('2026-06-14T15:00:00Z'));
  assert.equal(sunday.isOpen, false);
  assert.equal(sunday.label, 'CERRADO HOY');
});

test('computeOrderTotals applies 10% combo discount strictly at 3+ items', () => {
  const zip = getProductById('zip-animal-red')!;
  const baggy = getProductById('baggy-camu-trio')!;
  const medias = getProductById('medias-ossk-3pack')!;

  const twoItems = mergeOrderItems([], [
    { product: zip, size: 'L' },
    { product: baggy, size: 'L' },
  ]);
  const totals2 = computeOrderTotals(twoItems);
  assert.equal(totals2.totalQty, 2);
  assert.equal(totals2.comboEligible, false);
  assert.equal(totals2.finalTotal, zip.price + baggy.price);

  const threeItems = mergeOrderItems(twoItems, [{ product: medias, size: 'U' }]);
  const totals3 = computeOrderTotals(threeItems);
  assert.equal(totals3.totalQty, 3);
  assert.equal(totals3.comboEligible, true);
  assert.equal(totals3.subtotal, zip.price + baggy.price + medias.price);
  assert.equal(totals3.finalTotal, Math.round(totals3.subtotal * 0.9));
});

test('mergeOrderItems increments quantity for duplicate product+size and caps at 20', () => {
  const tee = getProductById('remera-boxy-240')!;
  let items = mergeOrderItems([], [{ product: tee, size: 'M' }]);
  items = mergeOrderItems(items, [{ product: tee, size: 'M' }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].qty, 2);

  items = mergeOrderItems(items, [{ product: tee, size: 'L' }]);
  assert.equal(items.length, 2);
});

test('buildWhatsAppMessage formats itemized summary, combo discount, delivery mode, and optional fields', () => {
  const zip = getProductById('zip-animal-red')!;
  const baggy = getProductById('baggy-camu-trio')!;
  const medias = getProductById('medias-ossk-3pack')!;
  const items = mergeOrderItems([], [
    { product: zip, size: 'L' },
    { product: baggy, size: 'M' },
    { product: medias, size: 'U' },
  ]);
  const msg = buildWhatsAppMessage(items, 'retiro', 'Lucas', 'Paso 18hs');
  assert.match(msg, /Hola Ossk Tandil!/);
  assert.match(msg, /Zip Hoodie Animal Stars Rojo \(OSK-AN-01\) — Talle L x1/);
  assert.match(msg, /Promo Combo Look \(3\+ prendas -10%\)/);
  assert.match(msg, /Retiro en local \(Rodríguez 743, Tandil\)/);
  assert.match(msg, /Nombre: Lucas/);
  assert.match(msg, /Nota: Paso 18hs/);

  const gameMsg = buildWhatsAppMessage(items.slice(0, 1), 'envio', 'Sofi', '', true);
  assert.match(gameMsg, /Cupón Skate Run 743 \(OSSK15 -15%\)/);
  const gameTotals = computeOrderTotals(items.slice(0, 1), true);
  assert.equal(gameTotals.gamePromoActive, true);
  assert.equal(gameTotals.discountPercent, 15);
  assert.equal(gameTotals.finalTotal, Math.round(zip.price * 0.85));
});

test('filterProducts filters by category, size, and brand accurately', () => {
  assert.equal(filterProducts(PRODUCTS, 'all', 'all', 'all').length, 12);
  assert.equal(filterProducts(PRODUCTS, 'baggys', 'all', 'all').length, 3);
  assert.equal(filterProducts(PRODUCTS, 'bermudas', 'all', 'all').length, 1);
  assert.equal(filterProducts(PRODUCTS, 'medias', 'all', 'all').length, 1);
  assert.equal(filterProducts(PRODUCTS, 'all', 'U', 'all').length, 2);
  assert.equal(filterProducts(PRODUCTS, 'all', 'all', 'ANIMAL').length, 1);
  assert.equal(filterProducts(PRODUCTS, 'all', 'all', 'FRESCO').length, 2);
  assert.equal(filterProducts(PRODUCTS, 'buzos', 'U', 'all').length, 0);
});

test('getComboUpsell recommends medias/caps when cart has 1-2 items and clears at 3+', () => {
  assert.equal(getComboUpsell([], PRODUCTS), null);

  const zip = getProductById('zip-animal-red')!;
  const baggy = getProductById('baggy-camu-trio')!;
  const medias = getProductById('medias-ossk-3pack')!;

  const twoItems = mergeOrderItems([], [
    { product: zip, size: 'L' },
    { product: baggy, size: 'L' },
  ]);
  const upsell = getComboUpsell(twoItems, PRODUCTS);
  assert.ok(upsell);
  assert.equal(upsell.needed, 1);
  assert.equal(upsell.suggestions.length, 2);
  assert.ok(upsell.suggestions.some((p) => p.category === 'medias'));

  const threeItems = mergeOrderItems(twoItems, [{ product: medias, size: 'U' }]);
  assert.equal(getComboUpsell(threeItems, PRODUCTS), null);
});

test('getSoundGain clamps gain safely and mutes when disabled', () => {
  assert.equal(getSoundGain(false, 0.08), 0);
  assert.equal(getSoundGain(true, 0.08), 0.08);
  assert.equal(getSoundGain(true, 0.9), 0.4);
});

test('3D ring projection, wrapping, shortestDelta, and critically damped spring converge cleanly', () => {
  assert.equal(wrapIndex(-1, 6), 5);
  assert.equal(shortestDelta(0, 5, 6), -1);
  assert.equal(shortestDelta(0, 2, 6), 2);

  const frontMoving = computeRingTransform(0, 0, 12, 1000, 700, false, 1.08);
  assert.equal(Math.round(frontMoving.x), 500);
  assert.equal(Number(frontMoving.scale.toFixed(2)), 1.08);
  assert.equal(frontMoving.blur, 0);
  assert.equal(frontMoving.opacity, 1);

  const frontStill = computeRingTransform(0, 0, 12, 1000, 700, true, 1.08);
  assert.equal(frontStill.opacity, 0);

  let state = { cur: 0, vel: 0, settled: false };
  for (let i = 0; i < 120; i++) {
    state = stepSpring(state.cur, 1, state.vel, 1 / 60);
  }
  assert.equal(state.settled, true);
  assert.equal(state.cur, 1);
});

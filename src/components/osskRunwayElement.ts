import { RUNWAY_LOOKS, getProductById } from '../data/catalog';
import {
  clamp,
  computeRingTransform,
  damp,
  formatArs,
  shortestDelta,
  stepSpring,
  wrapIndex,
} from '../utils/storeLogic';
import { soundEngine } from '../utils/soundEngine';

export interface AddItemEntry {
  productId: string;
  size: string;
}

interface RingBody {
  el: HTMLElement;
  a: number;
  look: number;
  hit: HTMLButtonElement | null;
  w: number;
  blur: number;
  x: number;
  g: number;
  v: number;
  from: number;
  trip: boolean;
  prevGoal: number;
}

interface DragPointer {
  id: number;
  sx: number;
  sy: number;
  startTarget: number;
  active: boolean;
  samples: Array<{ x: number; t: number }>;
}

function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export class OsskRunwayElement extends HTMLElement {
  private n = RUNWAY_LOOKS.length;
  private N = RUNWAY_LOOKS.length * Math.ceil(8 / RUNWAY_LOOKS.length);
  private index = 0;
  private target = 0;
  private cur = 0;
  private vel = 0;
  private still = false;
  private isMobile = false;
  private visible = true;
  private playing = false;
  private engaged = false;
  private panelHover = false;
  public zoomed = false;
  private dragging = false;
  private suppressClickUntil = 0;
  private rafId = 0;
  private lastFrameT = 0;
  private autoTimer = 0;
  private lbClearTimer = 0;
  private wheelLockUntil = 0;
  private wheelAcc = 0;
  private lastW = 0;
  private latchedVh = 800;
  private W = 900;
  private H = 600;
  private unit = 280;
  private reducedMotion = false;
  private hasFinePointer = false;
  private initialized = false;

  public openSheet: { card: HTMLElement; picker: HTMLElement } | null = null;
  private sheetHost: HTMLDivElement | null = null;
  private bodies: RingBody[] = [];

  private stage!: HTMLElement;
  private actorsEl!: HTMLElement;
  private heroes: HTMLElement[] = [];
  private ticks: HTMLButtonElement[] = [];
  private panels: HTMLElement[] = [];
  private panelCol!: HTMLElement;
  private liveEl!: HTMLElement;
  private piecesEl!: HTMLElement;
  private eyebrowEl!: HTMLElement;
  private autoBtn!: HTMLButtonElement;
  private soundBtn: HTMLButtonElement | null = null;
  private unsubSound: (() => void) | null = null;
  private lbMode: 'puesto' | 'flatlay' = 'puesto';
  private lbModeBtns: HTMLButtonElement[] = [];
  private cursorEl: HTMLElement | null = null;
  private lbEl!: HTMLElement;
  private lbStage!: HTMLElement;
  private lbKicker!: HTMLElement;
  private lbName!: HTMLElement;
  private lbClose!: HTMLButtonElement;

  private cursorState = { on: false, tx: 0, ty: 0, x: 0, y: 0, raf: 0, lastT: 0 };
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private resizeTimer = 0;
  private onWindowResize = () => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.measure(), 120);
  };

  static get observedAttributes() {
    return ['data-store-status'];
  }

  attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null) {
    if (name === 'data-store-status' && this.eyebrowEl && newVal) {
      this.eyebrowEl.textContent = `01 · PASARELA 3D · OSSK TANDIL · ${newVal}`;
    }
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.latchedVh = window.innerHeight;
    this.cur = this.reducedMotion ? 0 : -1.15;

    this.renderMarkup();
    this.cacheDom();
    this.initBodies();
    this.bindEvents();
    this.measure();
    this.setIndex(0, true);
    this.kick();

    if (!this.reducedMotion && this.dataset.autoplay === 'true') {
      this.setPlaying(true);
    }
  }

  disconnectedCallback() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.cursorState.raf) cancelAnimationFrame(this.cursorState.raf);
    window.clearTimeout(this.autoTimer);
    window.clearTimeout(this.lbClearTimer);
    window.clearTimeout(this.resizeTimer);
    window.removeEventListener('resize', this.onWindowResize);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.unsubSound?.();
    this.unsubSound = null;
    this.closeMobileSheet();
    this.sheetHost?.remove();
    this.sheetHost = null;
    this.initialized = false;
  }

  private renderMarkup() {
    const storeStatus = this.dataset.storeStatus || 'RODRÍGUEZ 743';

    const heroHtml = RUNWAY_LOOKS.map((look, i) => {
      const pinsHtml = look.pieces
        .map((piece, pIdx) => {
          const p = getProductById(piece.productId);
          if (!p) return '';
          const dir = piece.arrowDir || (piece.x > 52 ? 'left' : 'right');
          const arrowSvg =
            dir === 'left'
              ? `<svg class="rw__pin-arrow" width="38" height="22" viewBox="0 0 38 22" fill="none" aria-hidden="true"><path d="M36 4 C24 3, 14 9, 5 17 M5 17 L13 17 M5 17 L7 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
              : `<svg class="rw__pin-arrow" width="38" height="22" viewBox="0 0 38 22" fill="none" aria-hidden="true"><path d="M2 4 C14 3, 24 9, 33 17 M33 17 L25 17 M33 17 L31 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
          return `
            <button
              class="rw__pin rw__pin--${dir}"
              type="button"
              data-rw-pin="${pIdx + 1}"
              data-x="${piece.x}"
              data-y="${piece.y}"
              data-flat-x="${piece.flatX}"
              data-flat-y="${piece.flatY}"
              data-tip="${escapeHtml(p.name)}"
              style="left:${piece.x}%;top:${piece.y}%;--pi:${pIdx + 1}"
              aria-label="${pIdx + 1}: ${escapeHtml(p.name)}"
              tabindex="-1"
            >
              <span class="rw__pin-dot">${pIdx + 1}</span>
              <span class="rw__pin-callout" aria-hidden="true">
                ${arrowSvg}
                <span class="rw__pin-label">${escapeHtml(piece.callout)}</span>
              </span>
            </button>
          `;
        })
        .join('');

      return `
        <div class="rw__hero ${i === 0 ? 'is-on' : ''}" data-rw-hero data-index="${i}" data-name="${escapeHtml(look.name)}">
          <span class="rw__shadow"></span>
          <div class="rw__figure">
            <div class="rw__art">
              <img
                src="${look.image}"
                alt="${escapeHtml(look.name)} — Look 0${i + 1} Ossk Tandil"
                class="editorial-bw"
                referrerpolicy="no-referrer"
                loading="${i === 0 ? 'eager' : 'lazy'}"
                decoding="async"
                draggable="false"
              />
              <div class="rw__plate-scrim"></div>
              <div class="rw__plate-caption">
                <div>
                  <div class="rw__plate-code">LOOK 0${i + 1} · ${escapeHtml(look.dropLabel)}</div>
                  <div class="rw__plate-name">${escapeHtml(look.name)}</div>
                </div>
              </div>
              <button
                class="rw__zoom"
                type="button"
                data-rw-zoom
                aria-label="Ver look 0${i + 1}: ${escapeHtml(look.name)}"
                tabindex="${i === 0 ? '0' : '-1'}"
              ></button>
              <div class="rw__pins">${pinsHtml}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const bodyHtml = RUNWAY_LOOKS.map(
      (look, i) => `
        <div class="rw__model" data-rw-model data-index="${i}" aria-hidden="true">
          <span class="rw__shadow"></span>
          <div class="rw__figure">
            <div class="rw__art">
              <img
                src="${look.image}"
                alt="${escapeHtml(look.name)}"
                class="editorial-bw"
                referrerpolicy="no-referrer"
                loading="${i < 2 ? 'eager' : 'lazy'}"
                decoding="async"
                draggable="false"
              />
              <div class="rw__plate-scrim"></div>
              <div class="rw__plate-caption">
                <div>
                  <div class="rw__plate-code">LOOK 0${i + 1}</div>
                  <div class="rw__plate-name">${escapeHtml(look.name)}</div>
                </div>
              </div>
              <button
                class="rw__hit"
                type="button"
                data-rw-go="${i}"
                aria-label="Ir al look 0${i + 1}: ${escapeHtml(look.name)}"
                tabindex="-1"
              ></button>
            </div>
          </div>
        </div>
      `
    ).join('');

    const ticksHtml = RUNWAY_LOOKS.map(
      (look, i) => `
        <button
          class="rw__tick"
          type="button"
          data-rw-tick="${i}"
          aria-current="${i === 0 ? 'true' : 'false'}"
          aria-label="Look 0${i + 1}: ${escapeHtml(look.name)}"
        >
          <span class="rw__tick-bar"></span>
          <span class="rw__tick-label">0${i + 1}<span class="rw__tick-name">&nbsp;&nbsp;${escapeHtml(look.name)}</span></span>
        </button>
      `
    ).join('');

    const panelsHtml = RUNWAY_LOOKS.map((look, i) => {
      const sum = look.pieces.reduce((acc, item) => acc + (getProductById(item.productId)?.price ?? 0), 0);
      const combo = Math.round(sum * 0.9);
      const itemsHtml = look.pieces
        .map((piece, pIdx) => {
          const n = pIdx + 1;
          const p = getProductById(piece.productId);
          if (!p) return '';
          const pickerId = `ossk-picker-${i}-${n}`;
          const radioName = `ossk-opt-${i}-${n}`;
          const defaultSize = p.sizes[Math.min(1, p.sizes.length - 1)];

          return `
            <li
              class="rw__item"
              data-rw-card="${n}"
              data-product-id="${p.id}"
              data-title="${escapeHtml(p.name)}"
              data-selected="${defaultSize}"
              style="--i:${n}"
            >
              ${piece.tag ? `<span class="rw__tag"><span class="rw__tag-text">${escapeHtml(piece.tag)}</span></span>` : ''}
              <button
                class="rw__media"
                type="button"
                data-open-loupe="${p.id}"
                aria-label="Inspeccionar ${escapeHtml(p.name)} con lupa"
              >
                <img
                  src="${p.images[0]}"
                  alt="${escapeHtml(p.name)}"
                  class="editorial-bw-soft"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
                <span class="rw__num">${n}</span>
              </button>
              <div class="rw__info">
                <span class="rw__type">${escapeHtml(p.vendor)}</span>
                <button class="rw__name" type="button" data-open-loupe="${p.id}">${escapeHtml(p.name)}</button>
                <span class="rw__price">${formatArs(p.price)}</span>
              </div>
              <button
                class="rw__add"
                type="button"
                data-rw-add
                aria-expanded="false"
                aria-controls="${pickerId}"
                aria-label="Elegir talle y sumar: ${escapeHtml(p.name)}"
              >
                <svg class="ic-plus" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 4v16M4 12h16" /></svg>
                <svg class="ic-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4.5 12.5l5 5L19.5 7" /></svg>
                <svg class="ic-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3a9 9 0 1 1-9 9" /></svg>
              </button>
              <div class="rw__picker" id="${pickerId}" data-rw-picker hidden>
                <div class="rw__picker-head">
                  <img class="rw__picker-thumb editorial-bw-soft" src="${p.images[0]}" alt="${escapeHtml(p.name)}" referrerpolicy="no-referrer" />
                  <div>
                    <div class="rw__picker-title">${escapeHtml(p.name)}</div>
                    <div class="rw__picker-price">${formatArs(p.price)}</div>
                  </div>
                  <button class="rw__picker-close" type="button" data-rw-pick-close aria-label="Cerrar selector de talle">×</button>
                </div>
                <fieldset class="rw__opt">
                  <legend class="rw__opt-name">Elegí talle · ${escapeHtml(p.fit)}</legend>
                  <div class="rw__pills">
                    ${p.sizes
                      .map(
                        (s) => `
                          <label class="rw__pill">
                            <input type="radio" name="${radioName}" value="${s}" ${s === defaultSize ? 'checked' : ''} />
                            <span class="rw__pill-label">${s}</span>
                          </label>
                        `
                      )
                      .join('')}
                  </div>
                </fieldset>
                <button class="rw__confirm" type="button" data-rw-confirm>
                  Sumar al pedido <span class="sr-only"> — ${escapeHtml(p.name)}</span>
                </button>
              </div>
            </li>
          `;
        })
        .join('');

      return `
        <div class="rw__look-panel ${i === 0 ? 'is-in' : ''}" data-rw-panel="${i}" ${i === 0 ? '' : 'hidden'}>
          <div class="rw__mhead">
            <span class="rw__mhead-title">${escapeHtml(look.name)}</span>
            <span class="rw__label">${look.pieces.length} prendas</span>
          </div>
          <ul class="rw__items" role="list">${itemsHtml}</ul>
          <div class="rw__bundle">
            <p class="rw__msg" data-rw-msg role="status" aria-live="polite"></p>
            <div class="rw__bundle-row">
              <div class="rw__bundle-copy">
                <span class="rw__bundle-title">Completá el look</span>
                <span class="rw__bundle-note">3 prendas · 10% OFF en combo</span>
              </div>
              <div class="rw__bundle-price">
                <s>${formatArs(sum)}</s>
                <strong>${formatArs(combo)}</strong>
              </div>
            </div>
            <button class="rw__cta" type="button" data-rw-all>
              <span class="rw__cta-add">Sumar look completo</span>
              <span class="rw__cta-m">Sumar look completo — ${formatArs(combo)}</span>
              <span class="rw__cta-done">Look completo en tu pedido ✓</span>
              <svg class="rw__cta-arrow" width="20" height="12" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 7h24M19 1l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.innerHTML = `
      <div class="rw__sticky">
        <div class="rw__grid">
          <div class="rw__left">
            <div class="rw__head">
              <div class="rw__intro">
                <span class="rw__eyebrow" data-rw-eyebrow>01 · PASARELA 3D · OSSK TANDIL · ${escapeHtml(storeStatus)}</span>
                <h1 class="rw__title">Probá el Look.</h1>
                <p class="rw__sub">Seis looks urbanos armados de pies a cabeza. Arrastrá para girar el anillo o tocá el frente para aislar los pines.</p>
              </div>
              <span class="sr-only" aria-live="polite" aria-atomic="true" data-rw-live></span>
            </div>

            <div class="rw__stage" data-rw-stage data-testid="runway-stage" tabindex="0" role="region" aria-roledescription="carousel" aria-label="Pasarela 3D de Ossk Tandil">
              <div class="rw__actors" data-rw-actors>${bodyHtml}</div>
              <div class="rw__heroes" data-rw-heroes>${heroHtml}</div>
              <span class="rw__sweep" aria-hidden="true"></span>
              ${
                this.hasFinePointer
                  ? `
                <span class="rw__cursor" data-rw-cursor aria-hidden="true">
                  <span class="rw__cursor-in">
                    <span class="rw__cursor-label rw__cursor-drag">Drag</span>
                    <span class="rw__cursor-label rw__cursor-view">View</span>
                  </span>
                </span>
              `
                  : ''
              }
              <span class="rw__walk" aria-hidden="true"><span class="rw__walk-line"></span></span>
            </div>

            <div class="rw__controls">
              <button class="rw__icon" type="button" data-rw-prev aria-label="Look anterior">
                <svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M25 7H1M7 1L1 7l6 6" /></svg>
              </button>
              <div class="rw__ticks">${ticksHtml}</div>
              <button class="rw__icon rw__sound ${soundEngine.isEnabled() ? 'is-on' : ''}" type="button" data-rw-sound aria-pressed="${soundEngine.isEnabled() ? 'true' : 'false'}" aria-label="Activar o silenciar efectos sonoros" title="Sonido táctil">
                <svg class="icon-sound-on" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                <svg class="icon-sound-off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              </button>
              <button class="rw__icon rw__auto" type="button" data-rw-auto aria-pressed="false" aria-label="Reproducir o pausar pasarela">
                <svg class="icon-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z" /></svg>
                <svg class="icon-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 4.5h3.5v15H6.5zM14 4.5h3.5v15H14z" /></svg>
              </button>
              <button class="rw__icon" type="button" data-rw-next aria-label="Siguiente look">
                <svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 7h24M19 1l6 6-6 6" /></svg>
              </button>
            </div>

            <div class="rw__lb" data-rw-lb role="region" aria-label="Ver look aislado" aria-hidden="true">
              <div class="rw__lb-top">
                <p class="rw__lb-cap">
                  <span class="rw__lb-kicker" data-rw-lb-kicker></span>
                  <span class="rw__lb-name" data-rw-lb-name></span>
                </p>
                <div class="rw__lb-actions">
                  <div class="rw__lb-switch" role="group" aria-label="Cambiar vista del look">
                    <button class="rw__lb-mode is-on" type="button" data-rw-lb-mode="puesto" aria-pressed="true">Puesto</button>
                    <button class="rw__lb-mode" type="button" data-rw-lb-mode="flatlay" aria-pressed="false">Flat-lay</button>
                  </div>
                  <button class="rw__lb-close" type="button" data-rw-zoom-close aria-label="Cerrar vista aislada">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 5l14 14M19 5L5 19" /></svg>
                  </button>
                </div>
              </div>
              <div class="rw__lb-stage" data-rw-lb-stage></div>
              <p class="rw__lb-hint">Alterná Puesto / Flat-lay o tocá una flecha para resaltar la prenda</p>
            </div>
          </div>

          <aside class="rw__panel" data-rw-panel-col>
            <div class="rw__panel-inner">
              <div class="rw__panel-head">
                <h2 class="rw__panel-title">En este look</h2>
                <span class="rw__label" data-rw-pieces>3 prendas</span>
              </div>
              ${panelsHtml}
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  private cacheDom() {
    this.stage = this.querySelector('[data-rw-stage]') as HTMLElement;
    this.actorsEl = this.querySelector('[data-rw-actors]') as HTMLElement;
    this.heroes = Array.from(this.querySelectorAll<HTMLElement>('[data-rw-hero]'));
    this.ticks = Array.from(this.querySelectorAll<HTMLButtonElement>('[data-rw-tick]'));
    this.panels = Array.from(this.querySelectorAll<HTMLElement>('[data-rw-panel]'));
    this.panelCol = this.querySelector('[data-rw-panel-col]') as HTMLElement;
    this.liveEl = this.querySelector('[data-rw-live]') as HTMLElement;
    this.piecesEl = this.querySelector('[data-rw-pieces]') as HTMLElement;
    this.eyebrowEl = this.querySelector('[data-rw-eyebrow]') as HTMLElement;
    this.autoBtn = this.querySelector('[data-rw-auto]') as HTMLButtonElement;
    this.soundBtn = this.querySelector<HTMLButtonElement>('[data-rw-sound]');
    this.lbModeBtns = Array.from(this.querySelectorAll<HTMLButtonElement>('[data-rw-lb-mode]'));
    this.cursorEl = this.querySelector('[data-rw-cursor]');
    this.lbEl = this.querySelector('[data-rw-lb]') as HTMLElement;
    this.lbStage = this.querySelector('[data-rw-lb-stage]') as HTMLElement;
    this.lbKicker = this.querySelector('[data-rw-lb-kicker]') as HTMLElement;
    this.lbName = this.querySelector('[data-rw-lb-name]') as HTMLElement;
    this.lbClose = this.querySelector('[data-rw-zoom-close]') as HTMLButtonElement;

    this.unsubSound = soundEngine.subscribe((enabled) => {
      if (!this.soundBtn) return;
      this.soundBtn.classList.toggle('is-on', enabled);
      this.soundBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    });
  }

  private initBodies() {
    const originals = Array.from(this.actorsEl.querySelectorAll<HTMLElement>('[data-rw-model]'));
    for (let i = 0; i < this.n; i++) {
      const clone = originals[i].cloneNode(true) as HTMLElement;
      clone.setAttribute('data-rw-clone', '1');
      const img = clone.querySelector('img');
      if (img) img.loading = 'lazy';
      this.actorsEl.appendChild(clone);
    }

    const allEls = Array.from(this.actorsEl.querySelectorAll<HTMLElement>('[data-rw-model]'));
    this.bodies = allEls.map((el, a) => {
      const startPos = this.reducedMotion ? a : a + 1.15;
      return {
        el,
        a,
        look: a % this.n,
        hit: el.querySelector<HTMLButtonElement>('[data-rw-go]'),
        w: 240,
        blur: -1,
        x: startPos,
        g: startPos,
        v: 0,
        from: startPos,
        trip: false,
        prevGoal: a,
      };
    });
  }

  private measure() {
    const vw = window.innerWidth;
    const wasMobile = this.isMobile;
    this.isMobile = vw <= 749;

    if (wasMobile && !this.isMobile && this.openSheet) {
      this.closeMobileSheet();
    }

    const headerH = document.getElementById('site-header')?.offsetHeight || (this.isMobile ? 64 : 80);
    if (!this.isMobile) {
      const frameH = Math.max(540, window.innerHeight - headerH);
      this.style.setProperty('--rw-frame-h', `${frameH}px`);
    } else {
      if (Math.abs(vw - this.lastW) > 2 || Math.abs(window.innerHeight - this.latchedVh) >= 160) {
        this.latchedVh = window.innerHeight;
      }
      this.style.setProperty('--rw-frame-h', `${Math.round(this.latchedVh * 1.02)}px`);
    }
    this.lastW = vw;

    const rect = this.stage.getBoundingClientRect();
    this.W = Math.max(280, rect.width);
    this.H = Math.max(260, rect.height);
    const fs = this.isMobile ? 1 : 1.08;
    this.style.setProperty('--rw-fs', String(fs));

    const modelH = this.isMobile
      ? Math.max(200, Math.round(this.H - 40))
      : Math.max(220, Math.round((this.H - 48) / fs));
    this.stage.style.setProperty('--rw-model-h', `${modelH}px`);
    this.stage.style.setProperty('--rw-hx', this.isMobile ? `${(0.3 * this.W).toFixed(1)}px` : `${(0.5 * this.W).toFixed(1)}px`);
    this.stage.style.setProperty('--rw-hy', this.isMobile ? '22px' : '34px');

    this.unit = this.isMobile ? Math.max(90, this.W * 0.32 * 1.6) : Math.max(120, 0.3 * this.W);
    for (const b of this.bodies) {
      b.w = b.el.offsetWidth || modelH * 0.5625;
    }
    this.renderAll();
  }

  private setStill(flag: boolean) {
    if (this.still === flag) return;
    this.still = flag;
    this.classList.toggle('rw--still', flag);
  }

  private put(b: RingBody, x: number, bottom: number, scale: number, opacity: number, blur: number, z: number) {
    let op = opacity;
    if (x + (b.w * scale) / 2 < -4 || x - (b.w * scale) / 2 > this.W + 4) op = 0;
    b.el.style.transform = `translate3d(${x.toFixed(1)}px, ${(-bottom).toFixed(1)}px, 0) translateX(-50%) scale(${scale.toFixed(4)})`;
    b.el.style.opacity = op.toFixed(3);
    b.el.style.zIndex = String(z);
    b.el.style.visibility = op < 0.01 ? 'hidden' : 'visible';
    b.el.style.pointerEvents = op < 0.5 ? 'none' : 'auto';
    const roundedBlur = blur <= 0.05 ? 0 : Math.round(blur * 10) / 10;
    if (roundedBlur !== b.blur) {
      b.blur = roundedBlur;
      b.el.style.filter = roundedBlur ? `blur(${roundedBlur}px)` : '';
    }
  }

  private renderAll() {
    const W = this.W;
    const H = this.H;
    if (!W || !H) return;

    if (!this.isMobile) {
      for (const b of this.bodies) {
        const t = computeRingTransform(b.a, this.cur, this.N, W, H, this.still, 1.08);
        this.put(b, t.x, t.bottom, t.scale, t.opacity, t.blur, t.zIndex);
      }
    } else {
      const ax = 0.3;
      const ay = 22;
      const sx = 0.32;
      const sy = 22;
      const sr = 0.76;
      const ex = 0.55;
      const d = 4;
      for (const b of this.bodies) {
        let k = b.x;
        let e = -1;
        const goal = wrapIndex(b.a - this.target, this.N);
        if (b.trip) {
          const span = Math.abs(goal - b.from) || 1;
          const u = clamp(Math.abs(b.x - b.from) / span, 0, 1);
          if (goal > b.from) {
            if (u < 0.5) e = 2 * u * 1.4;
            else k = goal + 2 * (1 - u);
          } else {
            if (u < 0.5) k = b.from + 2 * u;
            else e = 2 * (1 - u) * 1.4;
          }
        } else if (k < 0) {
          e = Math.min(-k, 1.4);
        }

        if (e >= 0) {
          this.put(
            b,
            W * (ax - ex * e),
            ay - 22 * e,
            1 + 0.14 * e,
            Math.max(0, 1 - 1.05 * e),
            4 * Math.min(e, 1),
            1100
          );
        } else {
          const opacity = k <= d - 1 ? 1 - 0.13 * k : Math.max(0, 0.61 * (d - k));
          const finalOp = this.still && Math.abs(k) < 0.02 ? 0 : opacity;
          this.put(
            b,
            W * (ax + sx * k),
            ay + sy * k,
            Math.pow(sr, k),
            finalOp,
            Math.min(0.9 * k, 3.2),
            1000 - Math.round(10 * k)
          );
        }
      }
    }
  }

  private kick() {
    if (this.rafId || !this.visible || document.hidden) return;
    this.lastFrameT = performance.now();

    const step = (now: number) => {
      this.rafId = 0;
      const dt = Math.min(0.05, (now - this.lastFrameT) / 1000 || 1 / 60);
      this.lastFrameT = now;

      let settled = true;

      if (!this.isMobile) {
        if (this.reducedMotion) {
          this.cur = this.target;
          this.vel = 0;
        } else {
          const next = stepSpring(this.cur, this.target, this.vel, dt, 95);
          this.cur = next.cur;
          this.vel = next.vel;
          if (!next.settled) settled = false;
        }
      } else {
        for (const b of this.bodies) {
          const goal = wrapIndex(b.a - this.target, this.N);
          if (this.reducedMotion) {
            b.x = goal;
            b.g = goal;
            b.v = 0;
            b.trip = false;
            b.prevGoal = goal;
            continue;
          }
          if (Math.abs(goal - b.prevGoal) > this.N / 2) {
            b.from = b.x;
            b.trip = true;
          }
          b.prevGoal = goal;

          const tau = this.dragging ? 0.016 : b.trip ? 0.1 : 0.03 + 0.04 * Math.min(goal, 4);
          b.g += (goal - b.g) * (1 - Math.exp(-dt / tau));
          const next = stepSpring(b.x, b.g, b.v, dt, 95);
          b.x = next.cur;
          b.v = next.vel;

          if (b.trip && Math.abs(b.x - goal) < 0.02) b.trip = false;
          if (Math.abs(b.x - goal) <= 0.0006 && Math.abs(b.v) <= 0.0006) {
            b.x = goal;
            b.g = goal;
            b.v = 0;
            b.trip = false;
          } else {
            settled = false;
          }
        }
      }

      const shouldBeStill = settled && !this.dragging;
      this.setStill(shouldBeStill);
      this.renderAll();

      if (!shouldBeStill && this.visible && !document.hidden) {
        this.rafId = requestAnimationFrame(step);
      }
    };

    this.rafId = requestAnimationFrame(step);
  }

  private moveTo(T: number) {
    this.target = T;
    this.setStill(false);
    this.setIndex(wrapIndex(Math.round(T), this.n), false);
    this.kick();
  }

  public next() {
    this.moveTo(Math.round(this.target) + 1);
  }

  public prev() {
    this.moveTo(Math.round(this.target) - 1);
  }

  public go(i: number) {
    const d = shortestDelta(this.index, i, this.n);
    this.moveTo(Math.round(this.target) + d);
  }

  private setIndex(i: number, silent = false) {
    const changed = i !== this.index || silent;
    this.index = i;
    this.dataset.activeLook = String(i);

    for (const b of this.bodies) {
      let k = wrapIndex(b.a - Math.round(this.target), this.N);
      if (!this.isMobile && k > this.N / 2) k -= this.N;
      const focusable = k !== 0 && Math.abs(k) <= (this.isMobile ? 3 : 2);
      b.el.setAttribute('aria-hidden', focusable ? 'false' : 'true');
      if (b.hit) b.hit.tabIndex = focusable ? 0 : -1;
    }

    if (!changed) return;

    if (!silent) {
      if (this.zoomed) this.closeZoom();
      if (this.openSheet) this.closeMobileSheet();
    }

    this.style.setProperty('--rw-progress', ((i + 1) / this.n).toFixed(3));

    this.heroes.forEach((h, idx) => {
      const on = idx === i;
      h.classList.toggle('is-on', on);
      h.setAttribute('aria-hidden', on ? 'false' : 'true');
      const zBtn = h.querySelector<HTMLButtonElement>('[data-rw-zoom]');
      if (zBtn) zBtn.tabIndex = on ? 0 : -1;
    });

    this.ticks.forEach((t, idx) => {
      t.setAttribute('aria-current', idx === i ? 'true' : 'false');
      t.classList.toggle('is-past', idx < i);
    });

    this.panels.forEach((p, idx) => {
      const on = idx === i;
      p.hidden = !on;
      p.classList.remove('is-in');
      if (on) {
        void p.offsetWidth;
        p.classList.add('is-in');
      }
    });

    if (!silent && !this.reducedMotion) {
      this.stage.classList.remove('is-sweep');
      void this.stage.offsetWidth;
      this.stage.classList.add('is-sweep');
    }

    if (!silent) {
      this.liveEl.textContent = `Look ${i + 1}: ${RUNWAY_LOOKS[i].name}`;
      this.piecesEl.textContent = `${RUNWAY_LOOKS[i].pieces.length} prendas`;
      this.piecesEl.classList.remove('is-swap');
      void this.piecesEl.offsetWidth;
      this.piecesEl.classList.add('is-swap');
    }

    this.hot(null);
    this.restartAutoplay();
  }

  private setPlaying(on: boolean) {
    const next = this.reducedMotion ? false : on;
    this.playing = next;
    this.classList.toggle('is-playing', next);
    this.autoBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
    this.restartAutoplay();
  }

  private engage() {
    this.engaged = true;
    if (this.playing) this.setPlaying(false);
  }

  private restartAutoplay() {
    window.clearTimeout(this.autoTimer);
    this.ticks.forEach((t) => t.classList.remove('is-run'));
    if (!this.playing) return;

    const currTick = this.ticks[this.index];
    if (currTick) {
      void currTick.offsetWidth;
      currTick.classList.add('is-run');
    }

    const speed = Number(this.dataset.speed) || 5000;
    this.autoTimer = window.setTimeout(() => {
      if (
        this.playing &&
        this.visible &&
        !this.dragging &&
        !document.hidden &&
        !this.panelHover &&
        !this.zoomed &&
        !this.engaged
      ) {
        this.next();
      } else {
        this.restartAutoplay();
      }
    }, speed);
  }

  public goToLook(lookIndex: number) {
    if (this.zoomed) this.closeZoom();
    this.engage();
    this.go(wrapIndex(lookIndex, this.n));
    soundEngine.playTick();
  }

  public setZoomMode(mode: 'puesto' | 'flatlay') {
    if (!this.zoomed || this.lbMode === mode) return;
    this.lbMode = mode;
    soundEngine.playZoom(mode === 'flatlay');

    this.lbModeBtns.forEach((btn) => {
      const active = btn.dataset.rwLbMode === mode;
      btn.classList.toggle('is-on', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const look = RUNWAY_LOOKS[this.index];
    const img = this.lbStage.querySelector<HTMLImageElement>('.rw__art img');
    if (img && look) {
      img.src = mode === 'flatlay' ? look.flatlayImage : look.image;
      img.alt =
        mode === 'flatlay'
          ? `${look.name} — Outfit OSSK Flat-lay`
          : `${look.name} — Look 0${this.index + 1} Ossk Tandil`;
    }

    const art = this.lbStage.querySelector<HTMLElement>('.rw__art');
    art?.classList.toggle('is-flatlay', mode === 'flatlay');

    this.lbStage.querySelectorAll<HTMLButtonElement>('[data-rw-pin]').forEach((pin) => {
      const nextX = mode === 'flatlay' ? pin.dataset.flatX : pin.dataset.x;
      const nextY = mode === 'flatlay' ? pin.dataset.flatY : pin.dataset.y;
      if (nextX && nextY) {
        pin.style.left = `${nextX}%`;
        pin.style.top = `${nextY}%`;
      }
    });
  }

  public openZoom() {
    if (this.zoomed) return;
    this.engage();
    this.hot(null);
    this.lbMode = 'puesto';
    soundEngine.playZoom(true);

    this.lbModeBtns.forEach((btn) => {
      const active = btn.dataset.rwLbMode === 'puesto';
      btn.classList.toggle('is-on', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const hero = this.heroes[this.index];
    const heroFig = hero?.querySelector<HTMLElement>('.rw__figure');
    const heroShadow = hero?.querySelector<HTMLElement>('.rw__shadow');
    if (!hero || !heroFig || !heroShadow) return;

    const fromRect = heroFig.getBoundingClientRect();

    this.lbStage.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'rw__lb-model';

    const shadowClone = heroShadow.cloneNode(true) as HTMLElement;
    const figClone = heroFig.cloneNode(true) as HTMLElement;
    figClone.querySelector('[data-rw-zoom]')?.remove();
    figClone.querySelectorAll<HTMLButtonElement>('[data-rw-pin]').forEach((pin) => {
      pin.tabIndex = 0;
    });

    wrap.appendChild(shadowClone);
    wrap.appendChild(figClone);
    this.lbStage.appendChild(wrap);

    const stRect = this.lbStage.getBoundingClientRect();
    const targetH = Math.max(180, Math.min(stRect.height, stRect.width / 0.5625));
    wrap.style.setProperty('--rw-model-h', `${Math.round(targetH)}px`);

    const toRect = figClone.getBoundingClientRect();

    this.lbKicker.textContent = `LOOK 0${this.index + 1} · ${RUNWAY_LOOKS[this.index].dropLabel}`;
    this.lbName.textContent = RUNWAY_LOOKS[this.index].name;
    this.zoomed = true;
    this.lbEl.setAttribute('aria-hidden', 'false');

    if (!this.reducedMotion && toRect.height > 0 && fromRect.height > 0) {
      const dx = fromRect.left - toRect.left;
      const dy = fromRect.bottom - toRect.bottom;
      const sc = fromRect.height / toRect.height;
      wrap.style.transition = 'none';
      wrap.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sc.toFixed(4)})`;
      void wrap.offsetWidth;
      this.classList.add('rw--zoom');
      wrap.style.transition = '';
      wrap.style.transform = '';
    } else {
      this.classList.add('rw--zoom');
    }

    this.lbClose.focus({ preventScroll: true });
  }

  public closeZoom() {
    if (!this.zoomed) return;
    this.zoomed = false;
    this.hot(null);
    soundEngine.playZoom(false);

    const wrap = this.lbStage.querySelector<HTMLElement>('.rw__lb-model');
    const heroFig = this.heroes[this.index]?.querySelector<HTMLElement>('.rw__figure');
    if (wrap && heroFig && !this.reducedMotion) {
      const fromRect = heroFig.getBoundingClientRect();
      const curFig = wrap.querySelector<HTMLElement>('.rw__figure')?.getBoundingClientRect();
      if (curFig && curFig.height > 0 && fromRect.height > 0) {
        const dx = fromRect.left - curFig.left;
        const dy = fromRect.bottom - curFig.bottom;
        const sc = fromRect.height / curFig.height;
        wrap.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sc.toFixed(4)})`;
      }
    }

    this.classList.remove('rw--zoom');
    this.lbEl.setAttribute('aria-hidden', 'true');
    window.clearTimeout(this.lbClearTimer);
    this.lbClearTimer = window.setTimeout(() => {
      if (!this.zoomed) this.lbStage.innerHTML = '';
    }, this.reducedMotion ? 0 : 920);
  }

  private hot(pinNum: string | null, scrollCard = false) {
    this.querySelectorAll('.is-hot').forEach((el) => el.classList.remove('is-hot'));
    if (!pinNum) return;

    const scope = this.zoomed ? this.lbEl : this.heroes[this.index];
    scope?.querySelector(`[data-rw-pin="${pinNum}"]`)?.classList.add('is-hot');

    const panel = this.panels[this.index];
    const card = panel?.querySelector<HTMLElement>(`[data-rw-card="${pinNum}"]`);
    if (card) {
      card.classList.add('is-hot');
      if (scrollCard) {
        const list = panel.querySelector<HTMLElement>('.rw__items');
        if (list && list.scrollWidth > list.clientWidth + 4) {
          list.scrollTo({ left: Math.max(0, card.offsetLeft - 18), behavior: this.reducedMotion ? 'auto' : 'smooth' });
        } else if (list && list.scrollHeight > list.clientHeight + 4) {
          list.scrollTo({ top: Math.max(0, card.offsetTop - 12), behavior: this.reducedMotion ? 'auto' : 'smooth' });
        }
      }
    }
  }

  private togglePicker(card: HTMLElement) {
    if (card.classList.contains('is-added') || card.classList.contains('is-loading')) return;
    const isOpen = card.classList.contains('is-picking');
    if (isOpen) this.closePicker(card);
    else this.openPicker(card);
  }

  private openPicker(card: HTMLElement) {
    if (card.classList.contains('is-added') || card.classList.contains('is-picking')) return;
    const picker = card.querySelector<HTMLElement>('[data-rw-picker]');
    if (!picker) return;

    card.classList.add('is-picking');
    card.querySelector('[data-rw-add]')?.setAttribute('aria-expanded', 'true');
    picker.hidden = false;

    if (this.isMobile) {
      if (this.openSheet) this.closeMobileSheet();
      if (!this.sheetHost) {
        this.sheetHost = document.createElement('div');
        this.sheetHost.className = 'rw-sheet-host';
        this.sheetHost.innerHTML = `<button class="rw__pick-scrim" type="button" data-rw-pick-close tabindex="-1" aria-hidden="true"></button>`;
        this.sheetHost.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-rw-pick-close]')) this.closeMobileSheet();
          else if (target.closest('[data-rw-confirm]') && this.openSheet) {
            this.confirmCard(this.openSheet.card);
          }
        });
        this.sheetHost.addEventListener('change', (e) => {
          const input = e.target as HTMLInputElement;
          if (input.matches('input[type="radio"]') && this.openSheet) {
            this.openSheet.card.dataset.selected = input.value;
            this.openSheet.card.dataset.touched = '1';
            soundEngine.playPop();
            this.engage();
          }
        });
        document.body.appendChild(this.sheetHost);
      }
      this.sheetHost.appendChild(picker);
      void this.sheetHost.offsetWidth;
      this.sheetHost.classList.add('is-open');
      this.openSheet = { card, picker };
    }

    const checked = picker.querySelector<HTMLInputElement>('input[type="radio"]:checked');
    checked?.focus({ preventScroll: true });
  }

  private closePicker(card: HTMLElement) {
    if (this.openSheet?.card === card) {
      this.closeMobileSheet();
      return;
    }
    const picker = card.querySelector<HTMLElement>('[data-rw-picker]');
    if (picker) picker.hidden = true;
    card.classList.remove('is-picking');
    card.querySelector('[data-rw-add]')?.setAttribute('aria-expanded', 'false');
  }

  public closeMobileSheet() {
    if (!this.openSheet) return;
    const { card, picker } = this.openSheet;
    picker.hidden = true;
    card.appendChild(picker);
    card.classList.remove('is-picking');
    card.querySelector('[data-rw-add]')?.setAttribute('aria-expanded', 'false');
    this.sheetHost?.classList.remove('is-open');
    this.openSheet = null;
  }

  private emitAddItems(entries: AddItemEntry[]) {
    this.dispatchEvent(
      new CustomEvent<{ entries: AddItemEntry[] }>('ossk:add-items', {
        bubbles: true,
        detail: { entries },
      })
    );
  }

  private emitOpenLoupe(productId: string) {
    this.dispatchEvent(
      new CustomEvent<{ productId: string }>('ossk:open-loupe', {
        bubbles: true,
        detail: { productId },
      })
    );
  }

  private confirmCard(card: HTMLElement) {
    if (card.classList.contains('is-added') || card.classList.contains('is-loading')) return;
    const productId = card.dataset.productId;
    const size = card.dataset.selected;
    if (!productId || !size) return;

    card.dataset.touched = '1';
    card.classList.add('is-loading');

    window.setTimeout(() => {
      this.emitAddItems([{ productId, size }]);
      card.classList.remove('is-loading');
      card.classList.add('is-added');
      this.closePicker(card);
      this.checkPanelComplete(card.closest<HTMLElement>('[data-rw-panel]'));
    }, 240);
  }

  private handleAddFullLook(panel: HTMLElement) {
    if (panel.classList.contains('is-complete')) return;
    const msgEl = panel.querySelector<HTMLElement>('[data-rw-msg]');
    if (msgEl) msgEl.textContent = '';

    const cards = Array.from(panel.querySelectorAll<HTMLElement>('[data-rw-card]')).filter(
      (c) => !c.classList.contains('is-added')
    );
    const ready = cards.filter((c) => c.dataset.touched === '1' && c.dataset.selected);
    const pending = cards.filter((c) => !ready.includes(c));

    if (ready.length) {
      ready.forEach((c) => c.classList.add('is-loading'));
      window.setTimeout(() => {
        this.emitAddItems(
          ready.map((c) => ({
            productId: c.dataset.productId || '',
            size: c.dataset.selected || 'M',
          }))
        );
        ready.forEach((c) => {
          c.classList.remove('is-loading');
          c.classList.add('is-added');
          this.closePicker(c);
        });
        this.checkPanelComplete(panel);
      }, 240);
    }

    if (pending.length) {
      if (this.isMobile) {
        this.openPicker(pending[0]);
      } else {
        pending.forEach((c) => this.openPicker(c));
      }
      const names = pending.map((c) => c.dataset.title).join(', ');
      if (msgEl) msgEl.textContent = `Elegí talle para: ${names}`;
    }
  }

  private checkPanelComplete(panel: HTMLElement | null) {
    if (!panel) return;
    const cards = Array.from(panel.querySelectorAll<HTMLElement>('[data-rw-card]'));
    if (cards.length && cards.every((c) => c.classList.contains('is-added'))) {
      panel.classList.add('is-complete');
      const msgEl = panel.querySelector<HTMLElement>('[data-rw-msg]');
      if (msgEl) msgEl.textContent = '';
    }
  }

  private initCursor() {
    if (!this.hasFinePointer || !this.cursorEl) return;
    this.classList.add('rw--cursor');

    const tickCursor = (now: number) => {
      this.cursorState.raf = 0;
      const dt = (now - this.cursorState.lastT) / 1000 || 1 / 60;
      this.cursorState.lastT = now;

      if (this.reducedMotion) {
        this.cursorState.x = this.cursorState.tx;
        this.cursorState.y = this.cursorState.ty;
      } else {
        this.cursorState.x = damp(this.cursorState.x, this.cursorState.tx, 0.18, dt);
        this.cursorState.y = damp(this.cursorState.y, this.cursorState.ty, 0.18, dt);
      }

      if (this.cursorEl) {
        this.cursorEl.style.transform = `translate3d(${this.cursorState.x.toFixed(1)}px, ${this.cursorState.y.toFixed(1)}px, 0)`;
      }

      const dist = Math.hypot(this.cursorState.tx - this.cursorState.x, this.cursorState.ty - this.cursorState.y);
      if (this.cursorState.on && dist > 0.25) {
        this.cursorState.raf = requestAnimationFrame(tickCursor);
      }
    };

    this.stage.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !this.cursorEl) return;
      const r = this.stage.getBoundingClientRect();
      this.cursorState.tx = e.clientX - r.left;
      this.cursorState.ty = e.clientY - r.top;

      if (!this.cursorState.on) {
        this.cursorState.on = true;
        this.cursorState.x = this.cursorState.tx;
        this.cursorState.y = this.cursorState.ty;
        this.cursorEl.classList.add('is-on');
      }

      const target = e.target as HTMLElement;
      const overZoom = !this.dragging && !!target.closest('[data-rw-zoom]');
      const overLink = !this.dragging && !overZoom && !!target.closest('[data-rw-go], [data-rw-pin]');
      this.cursorEl.classList.toggle('is-view', overZoom);
      this.cursorEl.classList.toggle('is-link', overLink);

      if (!this.cursorState.raf) {
        this.cursorState.lastT = performance.now();
        this.cursorState.raf = requestAnimationFrame(tickCursor);
      }
    });

    this.stage.addEventListener('pointerleave', () => {
      this.cursorState.on = false;
      this.cursorEl?.classList.remove('is-on', 'is-view', 'is-link');
    });
  }

  private bindEvents() {
    this.initCursor();

    window.addEventListener('resize', this.onWindowResize);
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(this.stage);

    this.intersectionObserver = new IntersectionObserver((entries) => {
      this.visible = entries[0]?.isIntersecting ?? true;
      if (this.visible) this.kick();
    });
    this.intersectionObserver.observe(this);

    this.panelCol.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') this.panelHover = true;
    });
    this.panelCol.addEventListener('pointerleave', () => {
      this.panelHover = false;
      this.restartAutoplay();
    });

    this.panelCol.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-rw-card]');
      if (card?.dataset.rwCard) this.hot(card.dataset.rwCard, false);
    });

    this.panelCol.addEventListener('pointerout', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-rw-card]');
      if (card && !card.contains(e.relatedTarget as Node | null)) this.hot(null);
    });

    this.panelCol.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.matches('input[type="radio"]')) return;
      const card = input.closest<HTMLElement>('[data-rw-card]');
      if (card) {
        card.dataset.selected = input.value;
        card.dataset.touched = '1';
        soundEngine.playPop();
        this.engage();
      }
    });

    let ptr: DragPointer | null = null;
    this.stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this.zoomed) return;
      ptr = {
        id: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        startTarget: this.target,
        active: false,
        samples: [{ x: e.clientX, t: performance.now() }],
      };
    });

    this.stage.addEventListener('pointermove', (e) => {
      if (!ptr || e.pointerId !== ptr.id) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) {
        ptr = null;
        return;
      }
      const dx = e.clientX - ptr.sx;
      const dy = e.clientY - ptr.sy;

      if (!ptr.active) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          ptr = null;
          return;
        }
        if (Math.abs(dx) > 8 && Math.abs(dx) > 1.2 * Math.abs(dy)) {
          ptr.active = true;
          this.dragging = true;
          this.classList.add('is-dragging');
          this.setStill(false);
          try {
            this.stage.setPointerCapture(e.pointerId);
          } catch {
            // pointer capture unavailable
          }
        } else {
          return;
        }
      }

      ptr.samples.push({ x: e.clientX, t: performance.now() });
      if (ptr.samples.length > 6) ptr.samples.shift();
      this.target = ptr.startTarget - dx / this.unit;
      this.kick();
    });

    const endDrag = (e: PointerEvent) => {
      if (!ptr || e.pointerId !== ptr.id) return;
      const wasDrag = ptr.active;
      const dx = e.clientX - ptr.sx;
      const samples = ptr.samples;
      const from = Math.round(ptr.startTarget);
      ptr = null;

      if (!wasDrag) return;
      this.dragging = false;
      this.classList.remove('is-dragging');
      this.suppressClickUntil = performance.now() + 80;

      const first = samples[0];
      const last = samples[samples.length - 1];
      const vx = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;

      if (this.isMobile) {
        if (Math.abs(dx) > 30 || Math.abs(vx) > 0.3) {
          this.moveTo(from + (dx > 0 ? -1 : 1));
          soundEngine.playTick();
        } else {
          this.moveTo(from);
        }
      } else {
        let dest = Math.round(this.target - (vx * 160) / this.unit);
        if (dest === from && Math.abs(vx) > 0.3) dest = from + (vx > 0 ? -1 : 1);
        const clamped = clamp(dest, from - 2, from + 2);
        if (clamped !== from) soundEngine.playTick();
        this.moveTo(clamped);
      }
    };

    this.stage.addEventListener('pointerup', endDrag);
    this.stage.addEventListener('pointercancel', endDrag);

    this.stage.addEventListener(
      'wheel',
      (e) => {
        if (this.zoomed) return;
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        const now = performance.now();
        if (now < this.wheelLockUntil) return;
        this.wheelAcc += e.deltaX;
        if (Math.abs(this.wheelAcc) > 45) {
          if (this.wheelAcc > 0) this.next();
          else this.prev();
          this.wheelAcc = 0;
          this.wheelLockUntil = now + 520;
        }
      },
      { passive: false }
    );

    this.stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prev();
      }
    });

    this.addEventListener(
      'click',
      (e) => {
        if (performance.now() < this.suppressClickUntil) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );

    this.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.closest('[data-rw-sound]')) {
        soundEngine.toggle();
        return;
      }

      const modeBtn = target.closest<HTMLButtonElement>('[data-rw-lb-mode]');
      if (modeBtn?.dataset.rwLbMode) {
        this.setZoomMode(modeBtn.dataset.rwLbMode === 'flatlay' ? 'flatlay' : 'puesto');
        return;
      }

      if (target.closest('[data-rw-pick-close]')) {
        soundEngine.playPop();
        const card = target.closest<HTMLElement>('[data-rw-card]');
        if (card) this.closePicker(card);
        return;
      }

      if (target.closest('[data-rw-zoom-close]') || target === this.lbStage) {
        this.closeZoom();
        return;
      }

      if (target.closest('[data-rw-zoom]')) {
        this.openZoom();
        return;
      }

      if (target.closest('[data-rw-next]')) {
        this.engage();
        this.next();
        soundEngine.playTick();
        return;
      }

      if (target.closest('[data-rw-prev]')) {
        this.engage();
        this.prev();
        soundEngine.playTick();
        return;
      }

      const tick = target.closest<HTMLElement>('[data-rw-tick]');
      if (tick?.dataset.rwTick) {
        this.engage();
        this.go(Number(tick.dataset.rwTick));
        soundEngine.playTick();
        return;
      }

      if (target.closest('[data-rw-auto]')) {
        if (!this.playing) this.engaged = false;
        this.setPlaying(!this.playing);
        soundEngine.playPop();
        return;
      }

      const pin = target.closest<HTMLElement>('[data-rw-pin]');
      if (pin?.dataset.rwPin) {
        this.engage();
        this.hot(pin.dataset.rwPin, true);
        soundEngine.playPop();
        return;
      }

      const goHit = target.closest<HTMLButtonElement>('[data-rw-go]');
      if (goHit) {
        const body = this.bodies.find((b) => b.hit === goHit);
        if (!body) return;
        let k = wrapIndex(body.a - Math.round(this.target), this.N);
        if (!this.isMobile && k > this.N / 2) k -= this.N;
        if (k === 0) this.openZoom();
        else if (Math.abs(k) < this.n) {
          this.moveTo(Math.round(this.target) + k);
          soundEngine.playTick();
        }
        return;
      }

      const loupeBtn = target.closest<HTMLElement>('[data-open-loupe]');
      if (loupeBtn?.dataset.openLoupe) {
        this.engage();
        this.emitOpenLoupe(loupeBtn.dataset.openLoupe);
        return;
      }

      if (target.closest('[data-rw-confirm]')) {
        this.engage();
        const card = target.closest<HTMLElement>('[data-rw-card]');
        if (card) this.confirmCard(card);
        return;
      }

      if (target.closest('[data-rw-add]')) {
        this.engage();
        soundEngine.playPop();
        const card = target.closest<HTMLElement>('[data-rw-card]');
        if (card) this.togglePicker(card);
        return;
      }

      if (target.closest('[data-rw-all]')) {
        this.engage();
        soundEngine.playPop();
        const panel = target.closest<HTMLElement>('[data-rw-panel]');
        if (panel) this.handleAddFullLook(panel);
      }
    });
  }
}

export function registerOsskRunwayElement() {
  if (typeof window !== 'undefined' && !customElements.get('ossk-runway')) {
    customElements.define('ossk-runway', OsskRunwayElement);
  }
}

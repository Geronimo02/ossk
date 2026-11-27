import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Image as ImageIcon, Upload, X } from 'lucide-react';
import type { Product } from '../data/catalog';
import { clamp, damp, formatArs } from '../utils/storeLogic';
import {
  type LoupeViewMode,
  isValidGlbFileName,
  resolveProductModelSource,
  toggleLoupeViewMode,
} from '../utils/garment3dLogic';
import { soundEngine } from '../utils/soundEngine';
import { GarmentStudio3D } from './GarmentStudio3D';

interface LoupeModalProps {
  product: Product | null;
  onClose: () => void;
  onAdd: (productId: string, size: string, openDrawer: boolean) => void;
}

export function LoupeModal({ product, onClose, onAdd }: LoupeModalProps) {
  const [imgIdx, setImgIdx] = useState(0);
  const [viewMode, setViewMode] = useState<LoupeViewMode>('2d');
  const [selectedSize, setSelectedSize] = useState('M');
  const [mobileZoom, setMobileZoom] = useState(false);
  const [customGlb, setCustomGlb] = useState<{ url: string; name: string } | null>(null);
  const [glbError, setGlbError] = useState<string | null>(null);
  const [stageDragOver, setStageDragOver] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const glbInputRef = useRef<HTMLInputElement>(null);
  const customGlbRef = useRef<{ url: string; name: string } | null>(null);
  const loupeRef = useRef({
    active: false,
    tx: 0,
    ty: 0,
    cx: 0,
    cy: 0,
    w: 1,
    h: 1,
    raf: 0,
    lastT: 0,
  });

  const revokeCustomGlb = useCallback(() => {
    if (customGlbRef.current) {
      URL.revokeObjectURL(customGlbRef.current.url);
      customGlbRef.current = null;
    }
    setCustomGlb(null);
  }, []);

  useEffect(() => {
    if (!product) return;
    setImgIdx(0);
    setViewMode('2d');
    setSelectedSize(product.sizes[Math.min(1, product.sizes.length - 1)]);
    setMobileZoom(false);
    setGlbError(null);
    setStageDragOver(false);
    revokeCustomGlb();
    loupeRef.current.active = false;
    if (lensRef.current) lensRef.current.style.display = 'none';
  }, [product, revokeCustomGlb]);

  useEffect(() => {
    return () => {
      if (loupeRef.current.raf) cancelAnimationFrame(loupeRef.current.raf);
      revokeCustomGlb();
    };
  }, [revokeCustomGlb]);

  if (!product) return null;

  const activeModel = resolveProductModelSource(product.modelUrl, product.sku, customGlb);
  const is3dMode = viewMode === '3d';
  const currentSrc = product.images[imgIdx];
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleGlbFile = (file: File) => {
    if (!isValidGlbFileName(file.name)) {
      setGlbError('Subí un escaneo en formato .GLB o .GLTF.');
      return;
    }
    revokeCustomGlb();
    const url = URL.createObjectURL(file);
    const next = { url, name: file.name };
    customGlbRef.current = next;
    setCustomGlb(next);
    setGlbError(null);
    handlePointerLeave();
    setViewMode('3d');
  };

  const tickLoupe = (now: number) => {
    const st = loupeRef.current;
    st.raf = 0;
    if (!st.active || !lensRef.current) return;

    const dt = (now - st.lastT) / 1000 || 1 / 60;
    st.lastT = now;
    st.cx = reducedMotion ? st.tx : damp(st.cx, st.tx, 0.22, dt);
    st.cy = reducedMotion ? st.ty : damp(st.cy, st.ty, 0.22, dt);

    const half = 84;
    const zoom = 2.4;
    lensRef.current.style.transform = `translate3d(${(st.cx - half).toFixed(1)}px, ${(st.cy - half).toFixed(1)}px, 0)`;
    lensRef.current.style.backgroundSize = `${(st.w * zoom).toFixed(0)}px ${(st.h * zoom).toFixed(0)}px`;
    lensRef.current.style.backgroundPosition = `${(-(st.cx * zoom - half)).toFixed(1)}px ${(-(st.cy * zoom - half)).toFixed(1)}px`;
    st.raf = requestAnimationFrame(tickLoupe);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !stageRef.current || !lensRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    const st = loupeRef.current;
    st.w = r.width;
    st.h = r.height;
    st.tx = clamp(e.clientX - r.left, 0, r.width);
    st.ty = clamp(e.clientY - r.top, 0, r.height);

    if (!st.active) {
      st.cx = st.tx;
      st.cy = st.ty;
      st.active = true;
      lensRef.current.style.display = 'block';
      st.lastT = performance.now();
      st.raf = requestAnimationFrame(tickLoupe);
    }
  };

  const handlePointerLeave = () => {
    loupeRef.current.active = false;
    if (lensRef.current) lensRef.current.style.display = 'none';
  };

  const handleStageClick = () => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      setMobileZoom((z) => !z);
    }
  };

  const handleToggle2d3d = () => {
    soundEngine.playZoom(!is3dMode);
    handlePointerLeave();
    setMobileZoom(false);
    setViewMode((prev) => toggleLoupeViewMode(prev));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle técnico de ${product.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-150 flex items-center justify-center p-4 bg-[#0a0a0a]/82 backdrop-blur-md"
    >
      <div className="relative w-full max-w-[980px] max-h-[92svh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 bg-[#0a0a0a] text-white border border-white/20">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle técnico"
          className="absolute top-3 right-3 z-10 w-11 h-11 border border-white/28 bg-[#0a0a0a]/90 text-white grid place-items-center transition-colors hover:bg-white hover:text-[#0a0a0a]"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Left: 2D Technical Loupe Stage OR 360° 3D OrbitControls Studio */}
        <div
          ref={stageRef}
          onPointerMove={!is3dMode ? handlePointerMove : undefined}
          onPointerLeave={!is3dMode ? handlePointerLeave : undefined}
          onClick={!is3dMode ? handleStageClick : undefined}
          onDragOver={
            !is3dMode
              ? (e) => {
                  e.preventDefault();
                  setStageDragOver(true);
                }
              : undefined
          }
          onDragLeave={!is3dMode ? () => setStageDragOver(false) : undefined}
          onDrop={
            !is3dMode
              ? (e) => {
                  e.preventDefault();
                  setStageDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleGlbFile(file);
                }
              : undefined
          }
          className={`relative aspect-[4/5] bg-[#131316] overflow-hidden select-none ${
            !is3dMode ? 'cursor-crosshair' : ''
          }`}
        >
          {!is3dMode ? (
            <>
              <img
                src={currentSrc}
                alt={`${product.name} — ${product.viewLabels[imgIdx]}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top editorial-bw transition-transform duration-300"
                style={{ transform: mobileZoom ? 'scale(1.85)' : 'scale(1)' }}
              />
              <div
                ref={lensRef}
                aria-hidden="true"
                className="hidden pointer-events-none absolute top-0 left-0 w-[168px] h-[168px] rounded-full border-2 border-white shadow-[0_14px_40px_rgba(0,0,0,0.85)] bg-no-repeat editorial-bw will-change-transform"
                style={{ backgroundImage: `url(${currentSrc})` }}
              />
              <div className="pointer-events-none absolute top-3 left-3 px-2.5 py-1.5 bg-[#0a0a0a]/85 border border-white/20 font-mono-tech text-[10px] tracking-[0.14em] uppercase">
                Lupa técnica · 2.4x
              </div>
              {stageDragOver && (
                <div className="pointer-events-none absolute inset-3 border-2 border-dashed border-[#d91e2a] bg-[#0a0a0a]/80 grid place-items-center">
                  <span className="font-mono-tech text-[11px] font-bold uppercase tracking-[0.15em] text-white">
                    Soltá tu escaneo .GLB aquí
                  </span>
                </div>
              )}
            </>
          ) : (
            <GarmentStudio3D
              modelUrl={activeModel?.url ?? null}
              modelLabel={activeModel?.label ?? null}
              productName={product.name}
              isCustomUpload={activeModel?.isCustomUpload ?? false}
              onUploadFile={handleGlbFile}
              onClearCustom={() => revokeCustomGlb()}
            />
          )}

          {/* Bottom-right mode switcher: 2D photo tabs + clean 2D <-> 360° 3D toggle */}
          <div
            data-testid="loupe-view-switcher"
            className="absolute right-3 bottom-3 z-10 flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {!is3dMode &&
              product.images.map((_, i) => {
                const active = i === imgIdx;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      soundEngine.playZoom(i === 1);
                      setImgIdx(i);
                      setMobileZoom(false);
                    }}
                    className={`min-h-[34px] px-2.5 border font-mono-tech text-[10px] uppercase whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-white text-[#0a0a0a] border-white font-bold'
                        : 'bg-[#0a0a0a]/90 text-white border-white/28 hover:border-white'
                    }`}
                  >
                    {product.viewLabels[i]}
                  </button>
                );
              })}

            <button
              type="button"
              data-testid="loupe-mode-toggle"
              aria-pressed={is3dMode}
              onClick={handleToggle2d3d}
              className={`min-h-[34px] px-2.5 border font-mono-tech text-[10px] uppercase whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
                is3dMode
                  ? 'bg-white text-[#0a0a0a] border-white font-bold hover:bg-[#f4f4f5]'
                  : 'bg-[#0a0a0a]/92 text-white border-[#d91e2a]/80 hover:bg-[#d91e2a] hover:border-[#d91e2a] font-bold'
              }`}
            >
              {is3dMode ? (
                <>
                  <ImageIcon className="w-3 h-3" aria-hidden="true" />
                  <span>Vista 2D</span>
                </>
              ) : (
                <>
                  <Box className="w-3 h-3 text-[#ff4d58]" aria-hidden="true" />
                  <span>360° 3D</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Contiguous Purchase & Spec Module */}
        <div className="p-6 md:p-7 flex flex-col justify-between gap-5">
          <div>
            <p className="m-0 font-mono-tech text-[11px] tracking-[0.14em] text-[#a1a1aa] uppercase">
              <span className="text-[#ff4d58] font-bold">{product.brand}</span> · {product.sku} · {product.fit}
            </p>
            <h3 className="mt-2 mb-0 font-display text-[32px] md:text-[36px] font-extrabold leading-none uppercase">
              {product.name}
            </h3>
            <p className="mt-2.5 mb-0 font-mono-tech text-[22px] font-bold">
              {formatArs(product.price)}
            </p>
            <p className="mt-3.5 mb-0 text-[13.5px] leading-[1.6] text-[#b4b4bc]">
              {product.description}
            </p>

            <div className="mt-3.5 py-2.5 border-y border-white/12 flex items-center justify-between gap-3">
              <p className="m-0 font-mono-tech text-[11px]">
                <span className="text-[#a1a1aa]">MATERIALIDAD:</span> {product.fabric}
              </p>
              <input
                ref={glbInputRef}
                type="file"
                accept=".glb,.gltf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleGlbFile(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                data-testid="load-real-glb-btn"
                onClick={() => {
                  soundEngine.playPop();
                  glbInputRef.current?.click();
                }}
                title="Cargar un escaneo .GLB real de esta prenda"
                className="shrink-0 px-2 py-1 border border-white/16 text-[#a1a1aa] hover:text-white hover:border-white/50 font-mono-tech text-[9.5px] tracking-[0.1em] uppercase inline-flex items-center gap-1 transition-colors"
              >
                <Upload className="w-3 h-3" aria-hidden="true" />
                <span>.GLB</span>
              </button>
            </div>
            {glbError && (
              <p className="mt-1.5 mb-0 font-mono-tech text-[10px] text-[#ff8a92]">{glbError}</p>
            )}

            {/* Size Selection */}
            <div className="mt-4">
              <p className="m-0 mb-2 font-mono-tech text-[11px] tracking-[0.14em] text-[#a1a1aa] uppercase">
                Elegí tu talle
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => {
                  const active = size === selectedSize;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        soundEngine.playPop();
                        setSelectedSize(size);
                      }}
                      aria-pressed={active}
                      className={`min-h-[42px] min-w-[50px] border font-mono-tech text-[12px] transition-colors ${
                        active
                          ? 'border-[#d91e2a] bg-[#d91e2a] text-white font-bold'
                          : 'border-white/24 bg-transparent text-white hover:border-white'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Real Measurements Table */}
            <div className="mt-4 border border-white/16 bg-[#141414] p-3.5 font-mono-tech text-[11px]">
              <div className="grid grid-cols-3 pb-1.5 border-b border-white/14 text-[10px] uppercase text-[#a1a1aa]">
                <span>Talle</span>
                <span>Ancho</span>
                <span>Largo</span>
              </div>
              {product.measures.map((m) => {
                const hl = m.s === selectedSize;
                return (
                  <div
                    key={m.s}
                    className={`grid grid-cols-3 py-1.5 border-b border-white/6 last:border-b-0 ${
                      hl ? 'text-white font-bold' : 'text-[#a1a1aa]'
                    }`}
                  >
                    <span>{m.s}</span>
                    <span>{m.w} cm</span>
                    <span>{m.l} cm</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onAdd(product.id, selectedSize, false)}
              className="min-h-[46px] px-4 border border-white/28 bg-transparent text-white font-mono-tech text-[11px] tracking-[0.14em] uppercase whitespace-nowrap transition-colors hover:bg-white hover:text-[#0a0a0a]"
            >
              Sumar
            </button>
            <button
              type="button"
              onClick={() => onAdd(product.id, selectedSize, true)}
              className="min-h-[46px] px-4 bg-[#d91e2a] text-white font-mono-tech text-[11px] font-bold tracking-[0.14em] uppercase whitespace-nowrap transition-colors hover:bg-[#b31620]"
            >
              Sumar y ver pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Box, Pause, Play, RotateCcw, Upload } from 'lucide-react';
import { computeNormalizedModelTransform, isValidGlbFileName } from '../utils/garment3dLogic';
import { soundEngine } from '../utils/soundEngine';

interface GarmentStudio3DProps {
  modelUrl: string;
  modelLabel: string;
  isCustomUpload?: boolean;
  onUploadFile: (file: File) => void;
  onClearCustom?: () => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const rendererStr = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '');
    return /SwiftShader|llvmpipe|Software|Mesa|Microsoft Basic/i.test(rendererStr);
  } catch {
    return true;
  }
}

function createTurntableTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 252);
  grad.addColorStop(0, '#25252a');
  grad.addColorStop(0.74, '#17171b');
  grad.addColorStop(1, '#0e0e11');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(256, 256, 224, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(217, 30, 42, 0.58)';
  ctx.lineWidth = 2;
  for (let deg = 0; deg < 360; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    const inner = deg % 90 === 0 ? 202 : 213;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(rad) * inner, 256 + Math.sin(rad) * inner);
    ctx.lineTo(256 + Math.cos(rad) * 224, 256 + Math.sin(rad) * 224);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

/**
 * Pure real-asset .GLB / .GLTF 360° studio viewer for Ossk Tandil.
 * Renders only real scanned/authored 3D assets on a calibrated PBR studio turntable.
 */
export function GarmentStudio3D({
  modelUrl,
  modelLabel,
  isCustomUpload = false,
  onUploadFile,
  onClearCustom,
}: GarmentStudio3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const activeObjectRef = useRef<THREE.Object3D | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const renderNowRef = useRef<(() => void) | null>(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [loadingGlb, setLoadingGlb] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const autoRotateRef = useRef(true);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  const disposeObject = useCallback((obj: THREE.Object3D) => {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    });
  }, []);

  const handleIncomingFile = useCallback(
    (file: File) => {
      if (!isValidGlbFileName(file.name)) {
        setErrorMsg('Formato no soportado. Subí un archivo .GLB o .GLTF.');
        return;
      }
      setErrorMsg(null);
      onUploadFile(file);
    },
    [onUploadFile]
  );

  // Initialize isolated Three.js studio scene and load the real .GLB/.GLTF asset
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    if (!isSoftwareGl) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#131316');
    scene.fog = new THREE.Fog('#131316', 7.5, 16);
    sceneRef.current = scene;

    // RoomEnvironment PBR studio lighting on EVERY device
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.78;
    roomEnv.dispose();

    const hemi = new THREE.HemisphereLight(0xf5f7fc, 0x201e1c, 0.58);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff6ea, 1.75);
    keyLight.position.set(2.8, 4.2, 3.4);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 14;
      keyLight.shadow.camera.left = -2.4;
      keyLight.shadow.camera.right = 2.4;
      keyLight.shadow.camera.top = 2.8;
      keyLight.shadow.camera.bottom = -1.2;
      keyLight.shadow.bias = -0.0004;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xcfe0ff, 0.55);
    fillLight.position.set(-3.1, 2.2, 2.2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xd91e2a, 0.45);
    rimLight.position.set(-2.4, 2.9, -3.4);
    scene.add(rimLight);

    // Studio obsidian turntable pedestal
    const turntableTex = createTurntableTexture(maxAniso);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.14, 1.2, 0.08, 44),
      [
        new THREE.MeshStandardMaterial({ color: 0x1e1e22, roughness: 0.45, metalness: 0.5 }),
        new THREE.MeshStandardMaterial({ map: turntableTex, roughness: 0.58, metalness: 0.2 }),
        new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.8 }),
      ]
    );
    pedestal.position.y = 0.04;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    camera.position.set(0.38, 1.32, 3.7);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.96, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 5.8;
    controls.minPolarAngle = 0.22;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 1.45;
    controls.update();
    controlsRef.current = controls;

    renderNowRef.current = () => {
      controls.update();
      renderer.render(scene, camera);
    };

    // Synchronous Frame 0 render of studio pedestal
    controls.update();
    renderer.render(scene, camera);

    // Load real .GLB / .GLTF asset
    let disposed = false;
    setLoadingGlb(true);
    setErrorMsg(null);

    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          draco.dispose();
          return;
        }
        gltf.scene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const tx = computeNormalizedModelTransform(size, center, box.min.y, 1.82, 0.08);
        gltf.scene.scale.multiplyScalar(tx.scale);
        gltf.scene.position.set(tx.offsetX, tx.offsetY, tx.offsetZ);

        scene.add(gltf.scene);
        activeObjectRef.current = gltf.scene;
        setLoadingGlb(false);
        renderNowRef.current?.();
        soundEngine.playAdd();
        draco.dispose();
      },
      undefined,
      () => {
        if (disposed) {
          draco.dispose();
          return;
        }
        setLoadingGlb(false);
        setErrorMsg('No se pudo leer ese archivo .GLB. Probá otro escaneo.');
        draco.dispose();
      }
    );

    let rafId = 0;
    let timerId = 0;

    const scheduleNext = () => {
      if (disposed) return;
      if (!isSoftwareGl) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          if (!sync || gl.clientWaitSync(sync, 0, 0) !== gl.TIMEOUT_EXPIRED) {
            if (sync) gl.deleteSync(sync);
            timerId = window.setTimeout(tick, 80);
          } else {
            timerId = window.setTimeout(poll, 16);
          }
        };
        timerId = window.setTimeout(poll, 16);
      } else {
        timerId = window.setTimeout(tick, 80);
      }
    };

    const tick = () => {
      if (disposed) return;
      controls.autoRotate = autoRotateRef.current;
      controls.update();
      renderer.render(scene, camera);
      scheduleNext();
    };

    scheduleNext();

    const resizeObserver = new ResizeObserver(() => {
      if (disposed) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      resizeObserver.disconnect();
      controls.dispose();
      if (activeObjectRef.current) {
        disposeObject(activeObjectRef.current);
        activeObjectRef.current = null;
      }
      pedestal.geometry.dispose();
      turntableTex.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl, disposeObject]);

  const setCameraAngle = (angle: 'front' | 'back') => {
    soundEngine.playPop();
    const cam = cameraRef.current;
    const ctrls = controlsRef.current;
    if (!cam || !ctrls) return;
    setAutoRotate(false);
    cam.position.set(0, 1.3, angle === 'front' ? 3.7 : -3.7);
    ctrls.target.set(0, 0.96, 0);
    ctrls.update();
    renderNowRef.current?.();
  };

  return (
    <div
      data-testid="garment-studio-3d"
      className="relative w-full h-full bg-[#131316] select-none overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleIncomingFile(file);
      }}
    >
      {/* Isolated WebGL canvas mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-left Real .GLB indicator */}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1 max-w-[64%]">
        <div className="px-2.5 py-1.5 bg-[#0a0a0a]/92 border border-white/20 font-mono-tech text-[9.5px] tracking-[0.13em] uppercase text-white flex items-center gap-1.5">
          <Box className="w-3.5 h-3.5 text-[#ff4d58] shrink-0" aria-hidden="true" />
          <span className="truncate">3D · {modelLabel}</span>
        </div>
        {errorMsg && (
          <div className="px-2.5 py-1 bg-[#3a0d12] border border-[#d91e2a] font-mono-tech text-[10px] text-[#ffd4d7]">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Top-right .GLB swap & clear */}
      <div
        className="absolute top-3 right-3 flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleIncomingFile(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          data-testid="upload-glb-btn"
          onClick={() => {
            soundEngine.playPop();
            fileInputRef.current?.click();
          }}
          className="min-h-[30px] px-2.5 bg-[#0e0e11]/95 border border-white/28 text-white font-mono-tech text-[9.5px] font-bold tracking-[0.1em] uppercase inline-flex items-center gap-1 hover:bg-white hover:text-[#0a0a0a] transition-colors"
        >
          <Upload className="w-3 h-3" aria-hidden="true" />
          <span>.GLB</span>
        </button>

        {isCustomUpload && onClearCustom && (
          <button
            type="button"
            onClick={() => {
              soundEngine.playPop();
              onClearCustom();
            }}
            aria-label="Quitar vista previa .GLB"
            className="min-h-[30px] px-2 bg-[#0e0e11]/95 border border-white/22 text-[#d4d4d8] hover:text-white hover:border-white inline-flex items-center"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {loadingGlb && (
        <div className="pointer-events-none absolute inset-0 bg-[#0d0d10]/70 grid place-items-center">
          <span className="px-4 py-2 bg-[#141417] border border-white/25 font-mono-tech text-[11px] uppercase tracking-[0.14em] text-white">
            Cargando escaneo .GLB...
          </span>
        </div>
      )}

      {dragOver && (
        <div className="pointer-events-none absolute inset-3 border-2 border-dashed border-[#d91e2a] bg-[#0d0d10]/75 grid place-items-center">
          <span className="font-mono-tech text-[11px] font-bold uppercase tracking-[0.16em] text-white">
            Soltá tu modelo .GLB / .GLTF aquí
          </span>
        </div>
      )}

      {/* Left-bottom compact camera controls */}
      <div
        data-testid="studio-3d-controls"
        className="absolute left-3 bottom-14 md:bottom-3 flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setCameraAngle('front')}
          className="min-h-[32px] px-2 bg-[#0e0e11]/95 border border-white/22 text-white font-mono-tech text-[9.5px] font-bold tracking-[0.08em] uppercase hover:border-white transition-colors"
        >
          Frente
        </button>
        <button
          type="button"
          onClick={() => setCameraAngle('back')}
          className="min-h-[32px] px-2 bg-[#0e0e11]/95 border border-white/22 text-white font-mono-tech text-[9.5px] font-bold tracking-[0.08em] uppercase hover:border-white transition-colors"
        >
          Espalda
        </button>
        <button
          type="button"
          aria-pressed={autoRotate}
          onClick={() => {
            soundEngine.playPop();
            setAutoRotate((v) => !v);
          }}
          aria-label={autoRotate ? 'Pausar giro 360' : 'Activar giro 360'}
          className={`min-h-[32px] px-2 border font-mono-tech text-[9.5px] font-bold uppercase inline-flex items-center gap-1 transition-colors ${
            autoRotate
              ? 'bg-[#d91e2a] border-[#d91e2a] text-white'
              : 'bg-[#0e0e11]/95 border-white/22 text-white hover:border-white'
          }`}
        >
          {autoRotate ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          <span>360°</span>
        </button>
      </div>
    </div>
  );
}

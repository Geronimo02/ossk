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
  modelUrl: string | null;
  modelLabel: string | null;
  productName: string;
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
  grad.addColorStop(0, '#26262c');
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

function createAtelierLinenTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#24252a';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle woven dark atelier linen grain
  for (let y = 0; y < 512; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(0, y, 512, 1);
  }
  for (let x = 0; x < 512; x += 4) {
    ctx.fillStyle = x % 8 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(x, 0, 1, 512);
  }

  // Couture vertical princess-seam stitching & subtle crimson waist tape
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  for (const sx of [128, 256, 384]) {
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, 512);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Subtle architectural crimson waist measurement line
  ctx.fillStyle = 'rgba(217, 30, 42, 0.65)';
  ctx.fillRect(0, 355, 512, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

/**
 * Minimalist sculptural obsidian atelier dress-form mannequin displayed when
 * inspecting 360° 3D before a product-specific .GLB scan is loaded.
 */
function createAtelierMannequinBust(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  const linenTex = createAtelierLinenTexture(maxAnisotropy);
  const linenMat = new THREE.MeshStandardMaterial({
    map: linenTex,
    roughness: 0.88,
    metalness: 0.05,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0xd4d8e0,
    roughness: 0.24,
    metalness: 0.88,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x151518,
    roughness: 0.42,
    metalness: 0.75,
  });

  // Grounded weighted studio disc flange
  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.045, 32), ironMat);
  baseDisc.position.y = 0.0225;
  group.add(baseDisc);

  const baseCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.055, 22), titaniumMat);
  baseCollar.position.y = 0.065;
  group.add(baseCollar);

  // Vertical stand rod
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.64, 18), ironMat);
  pole.position.y = 0.39;
  group.add(pole);

  const bottomCap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.082, 0.05, 20), titaniumMat);
  bottomCap.position.y = 0.72;
  group.add(bottomCap);

  // Sculpted couture torso silhouette (hip -> waist -> chest -> shoulders -> neck)
  const pts = [
    new THREE.Vector2(0.0, 0.74),
    new THREE.Vector2(0.27, 0.75),
    new THREE.Vector2(0.30, 0.88),
    new THREE.Vector2(0.255, 1.07),
    new THREE.Vector2(0.265, 1.2),
    new THREE.Vector2(0.34, 1.42),
    new THREE.Vector2(0.38, 1.57),
    new THREE.Vector2(0.31, 1.66),
    new THREE.Vector2(0.115, 1.72),
    new THREE.Vector2(0.108, 1.88),
    new THREE.Vector2(0.0, 1.89),
  ];
  const bustGeo = new THREE.LatheGeometry(pts, 44);
  bustGeo.scale(1.16, 1, 0.72);
  const bustMesh = new THREE.Mesh(bustGeo, linenMat);
  bustMesh.castShadow = true;
  bustMesh.receiveShadow = true;
  group.add(bustMesh);

  // Subtle recessed armhole plates on left & right shoulders
  [-1, 1].forEach((side) => {
    const armCap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.03, 24), ironMat);
    armCap.rotation.z = Math.PI / 2 - side * 0.16;
    armCap.position.set(side * 0.435, 1.54, 0);
    group.add(armCap);
  });

  // Brushed titanium neck finial
  const neckCap = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.114, 0.04, 28), titaniumMat);
  neckCap.position.y = 1.905;
  group.add(neckCap);

  const neckStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.055, 16), titaniumMat);
  neckStem.position.y = 1.945;
  group.add(neckStem);

  const finialBall = new THREE.Mesh(new THREE.SphereGeometry(0.046, 20, 16), titaniumMat);
  finialBall.position.y = 1.985;
  group.add(finialBall);

  return group;
}

/**
 * 360° Three.js Studio Viewer with OrbitControls.
 * Renders a loaded .GLB/.GLTF garment scan when present, or the sculptural atelier
 * mannequin bust ready for 360° rotation and instant .GLB drag-and-drop.
 */
export function GarmentStudio3D({
  modelUrl,
  modelLabel,
  productName,
  isCustomUpload = false,
  onUploadFile,
  onClearCustom,
}: GarmentStudio3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const activeObjectRef = useRef<THREE.Object3D | null>(null);
  const renderNowRef = useRef<(() => void) | null>(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [loadingGlb, setLoadingGlb] = useState(Boolean(modelUrl));
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
    renderer.toneMappingExposure = 1.04;
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

    // RoomEnvironment PBR studio lighting on EVERY device
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.78;
    roomEnv.dispose();

    const hemi = new THREE.HemisphereLight(0xf5f7fc, 0x201e1c, 0.6);
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

    const rimLight = new THREE.DirectionalLight(0xd91e2a, 0.48);
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
    camera.position.set(0.42, 1.32, 3.68);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.98, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 5.8;
    controls.minPolarAngle = 0.22;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 1.4;
    controls.update();
    controlsRef.current = controls;

    renderNowRef.current = () => {
      controls.update();
      renderer.render(scene, camera);
    };

    const mountNormalizedObject = (obj: THREE.Object3D, targetHeight = 1.8) => {
      if (activeObjectRef.current) {
        scene.remove(activeObjectRef.current);
        disposeObject(activeObjectRef.current);
      }
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const tx = computeNormalizedModelTransform(size, center, box.min.y, targetHeight, 0.08);
      obj.scale.multiplyScalar(tx.scale);
      obj.position.set(tx.offsetX, tx.offsetY, tx.offsetZ);
      scene.add(obj);
      activeObjectRef.current = obj;
    };

    let disposed = false;

    if (modelUrl) {
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
          mountNormalizedObject(gltf.scene, 1.82);
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
          setErrorMsg('No se pudo leer ese archivo .GLB. Mostrando maniquí base.');
          mountNormalizedObject(createAtelierMannequinBust(maxAniso), 1.78);
          renderNowRef.current?.();
          draco.dispose();
        }
      );
    } else {
      setLoadingGlb(false);
      setErrorMsg(null);
      mountNormalizedObject(createAtelierMannequinBust(maxAniso), 1.78);
    }

    // Synchronous Frame 0 render
    controls.update();
    renderer.render(scene, camera);

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
    cam.position.set(0, 1.3, angle === 'front' ? 3.68 : -3.68);
    ctrls.target.set(0, 0.98, 0);
    ctrls.update();
    renderNowRef.current?.();
  };

  return (
    <div
      data-testid="garment-studio-3d"
      aria-label={`Visor 360° 3D de ${productName}`}
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
      {/* Isolated WebGL OrbitControls canvas mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-left 360° indicator */}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1 max-w-[66%]">
        <div className="px-2.5 py-1.5 bg-[#0a0a0a]/92 border border-white/20 font-mono-tech text-[9.5px] tracking-[0.13em] uppercase text-white flex items-center gap-1.5">
          <Box className="w-3.5 h-3.5 text-[#ff4d58] shrink-0" aria-hidden="true" />
          <span className="truncate">
            {modelLabel ? `360° · ${modelLabel}` : 'Maniquí 360° · Arrastrá o subí .GLB'}
          </span>
        </div>
        {errorMsg && (
          <div className="px-2.5 py-1 bg-[#3a0d12] border border-[#d91e2a] font-mono-tech text-[10px] text-[#ffd4d7]">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Top-right .GLB scan upload / clear */}
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
            aria-label="Volver al maniquí base"
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

      {/* Left-bottom OrbitControls camera presets & auto-rotate */}
      <div
        data-testid="studio-3d-controls"
        className="absolute left-3 bottom-3 flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setCameraAngle('front')}
          className="min-h-[34px] px-2.5 bg-[#0e0e11]/95 border border-white/22 text-white font-mono-tech text-[9.5px] font-bold tracking-[0.08em] uppercase hover:border-white transition-colors"
        >
          Frente
        </button>
        <button
          type="button"
          onClick={() => setCameraAngle('back')}
          className="min-h-[34px] px-2.5 bg-[#0e0e11]/95 border border-white/22 text-white font-mono-tech text-[9.5px] font-bold tracking-[0.08em] uppercase hover:border-white transition-colors"
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
          className={`min-h-[34px] px-2.5 border font-mono-tech text-[9.5px] font-bold uppercase inline-flex items-center gap-1 transition-colors ${
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

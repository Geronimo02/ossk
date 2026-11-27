import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  type GameEvent,
  type GameState,
  createInitialGameState,
  laneToWorldX,
  shiftLane,
  startRun,
  stepGameState,
  triggerJump,
} from './gameLogic';
import {
  type HazardHandle,
  type SkaterRig,
  type UrbanCorridor,
  createBarrierHazard,
  createBollardConesHazard,
  createContactShadowTexture,
  createDeliveryTrolleyHazard,
  createDropCrate,
  createSkaterRig,
  createUrbanCorridor,
} from './threeModels';

export type CameraPreset = 'chase' | 'low' | 'aerial';

export interface HudSnapshot {
  phase: GameState['phase'];
  score: number;
  bestScore: number;
  drops: number;
  combo: number;
  lives: number;
  speedKmh: number;
  promoUnlocked: boolean;
  distance: number;
}

interface ParticleSlot {
  active: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: THREE.Color;
}

interface EngineOptions {
  container: HTMLElement;
  initialBestScore: number;
  initialPromoUnlocked: boolean;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onEvent: (event: GameEvent) => void;
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

export class OsskThreeEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget;
  private isSoftwareGl: boolean;

  private skater: SkaterRig;
  private corridor: UrbanCorridor;
  private entityMeshes = new Map<number, HazardHandle>();

  // Pooled particle sparks (zero runtime allocations)
  private particleCount = 64;
  private particles: ParticleSlot[] = [];
  private particleMesh: THREE.InstancedMesh;

  // Pre-allocated scratch math objects
  private _dummy = new THREE.Object3D();
  private _camTarget = new THREE.Vector3();
  private _lookTarget = new THREE.Vector3();
  private _colorDrop = new THREE.Color(0xd91e2a);
  private _colorSpark = new THREE.Color(0xf6c453);
  private _colorHit = new THREE.Color(0xff4d4d);

  private state: GameState;
  private cameraPreset: CameraPreset = 'chase';
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onEvent: (event: GameEvent) => void;

  private disposed = false;
  private rafId = 0;
  private timerId = 0;
  private lastTime = 0;
  private lastHudEmit = 0;
  private resizeObserver: ResizeObserver;

  constructor(options: EngineOptions) {
    this.container = options.container;
    this.onHudUpdate = options.onHudUpdate;
    this.onEvent = options.onEvent;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.state = createInitialGameState(
      options.initialBestScore,
      options.initialPromoUnlocked,
      'title'
    );

    // 1. Renderer — disable AA & shadowMap only on software WebGL
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isSoftwareGl ? 1 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    // 2. Scene — warm Tandil late-afternoon sky + light atmospheric horizon fog
    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color('#e2d9ce');
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(skyColor.getHex(), 0.0068);

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.2, 190);
    this.camera.position.set(0, 3.4, 7.6);
    this.camera.lookAt(0, 1.3, -10);

    // 4. Studio PBR Environment (RoomEnvironment + PMREMGenerator on every device!)
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = this.pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.65;
    roomEnv.dispose();

    // 5. Key Sunlight + Cool Sky/Ground Hemisphere Fill
    const hemi = new THREE.HemisphereLight(0xd9e6f7, 0x8b7e72, 0.82);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1dc, 2.15);
    sun.position.set(16, 26, 14);
    if (!this.isSoftwareGl) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 2;
      sun.shadow.camera.far = 75;
      sun.shadow.camera.left = -14;
      sun.shadow.camera.right = 14;
      sun.shadow.camera.top = 18;
      sun.shadow.camera.bottom = -18;
      sun.shadow.bias = -0.0005;
    }
    this.scene.add(sun);

    // 6. Build World & Composite Skater
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.corridor = createUrbanCorridor(maxAniso);
    this.scene.add(this.corridor.group);

    const shadowTex = createContactShadowTexture();
    this.skater = createSkaterRig(shadowTex);
    this.scene.add(this.skater.root);

    // 7. Pooled Burst Particles
    const pGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const pMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.2,
    });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.particleCount);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        active: false,
        age: 0,
        life: 0.4,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        color: new THREE.Color(0xffffff),
      });
      this._dummy.position.set(0, -50, 0);
      this._dummy.scale.setScalar(0.001);
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
      this.particleMesh.setColorAt(i, this._colorDrop);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.particleMesh);

    // 8. Resize handling
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    // Emit initial HUD, paint Frame 0 synchronously (no black mount flash), and start adaptive loop
    this.emitHud(true);
    this.updateSceneVisuals(0.016);
    this.renderer.render(this.scene, this.camera);
    this.lastTime = performance.now();
    this.scheduleNextFrame();
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private afterDraw(next: () => void): void {
    if (this.disposed) return;
    if (!this.isSoftwareGl) {
      this.rafId = window.requestAnimationFrame(next);
      return;
    }

    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        if (!sync || gl.clientWaitSync(sync, 0, 0) !== gl.TIMEOUT_EXPIRED) {
          if (sync) gl.deleteSync(sync);
          this.timerId = window.setTimeout(next, 80);
        } else {
          this.timerId = window.setTimeout(poll, 16);
        }
      };
      this.timerId = window.setTimeout(poll, 16);
    } else {
      this.timerId = window.setTimeout(next, 80);
    }
  }

  private scheduleNextFrame(): void {
    this.afterDraw(this.tick);
  }

  public startNewRun(): void {
    this.clearEntityMeshes();
    this.state = startRun(this.state);
    this.emitHud(true);
  }

  public togglePause(): void {
    if (this.state.phase === 'playing') {
      this.state = { ...this.state, phase: 'paused' };
      this.emitHud(true);
    } else if (this.state.phase === 'paused') {
      this.state = { ...this.state, phase: 'playing' };
      this.lastTime = performance.now();
      this.emitHud(true);
    }
  }

  public moveLane(delta: -1 | 1): void {
    const events: GameEvent[] = [];
    this.state = shiftLane(this.state, delta, events);
    events.forEach((ev) => this.handleGameEvent(ev));
  }

  public jump(): void {
    this.state = triggerJump(this.state);
  }

  public setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset = preset;
  }

  public getPhase(): GameState['phase'] {
    return this.state.phase;
  }

  private clearEntityMeshes(): void {
    for (const handle of this.entityMeshes.values()) {
      this.scene.remove(handle.group);
    }
    this.entityMeshes.clear();
  }

  private spawnBurst(x: number, y: number, z: number, color: THREE.Color, count = 12): void {
    let spawned = 0;
    for (let i = 0; i < this.particleCount && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.age = 0;
        p.life = 0.28 + Math.random() * 0.26;
        p.x = x;
        p.y = y;
        p.z = z;
        const angle = Math.random() * Math.PI * 2;
        const spd = 2.4 + Math.random() * 4.2;
        p.vx = Math.cos(angle) * spd;
        p.vy = 2.2 + Math.random() * 4.5;
        p.vz = Math.sin(angle) * spd;
        p.color.copy(color);
        spawned++;
      }
    }
  }

  private handleGameEvent(ev: GameEvent): void {
    if (ev.type === 'collect') {
      this.spawnBurst(ev.x ?? 0, ev.y ?? 1, ev.z ?? 0, this._colorDrop, 14);
    } else if (ev.type === 'ollie') {
      this.spawnBurst(ev.x ?? 0, 0.15, 0.2, this._colorSpark, 8);
    } else if (ev.type === 'hit') {
      this.spawnBurst(ev.x ?? 0, 0.9, 0, this._colorHit, 18);
    }
    this.onEvent(ev);
  }

  private syncEntities(dt: number): void {
    const activeIds = new Set<number>();

    for (const entity of this.state.entities) {
      activeIds.add(entity.id);
      let handle = this.entityMeshes.get(entity.id);
      if (!handle) {
        if (entity.kind === 'drop') handle = createDropCrate();
        else if (entity.kind === 'barrier') handle = createBarrierHazard();
        else if (entity.kind === 'bollard') handle = createBollardConesHazard();
        else handle = createDeliveryTrolleyHazard();
        this.scene.add(handle.group);
        this.entityMeshes.set(entity.id, handle);
      }

      const ex = laneToWorldX(entity.lane);
      const ey =
        entity.kind === 'drop'
          ? (entity.telegraph > 0.5 ? 2.05 : 0.9) + Math.sin(this.state.elapsed * 4.5 + entity.id) * 0.14
          : 0;
      handle.group.position.set(ex, ey, entity.z);

      if (handle.spinTarget) {
        handle.spinTarget.rotation.y += dt * 2.8;
      }

      if (handle.telegraphMat) {
        const pulse =
          entity.telegraph > 0.05
            ? 0.6 + Math.abs(Math.sin(this.state.elapsed * 16)) * 2.2 * entity.telegraph
            : 0.2;
        handle.telegraphMat.emissiveIntensity = pulse;
      }
    }

    // Remove despawned or collected entity meshes
    for (const [id, handle] of this.entityMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(handle.group);
        this.entityMeshes.delete(id);
      }
    }
  }

  private updateParticles(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.particleCount; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChanged = true;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        this._dummy.position.set(0, -50, 0);
        this._dummy.scale.setScalar(0.001);
        this._dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const frac = 1 - p.age / p.life;
      this._dummy.position.set(p.x, p.y, p.z);
      this._dummy.rotation.set(p.age * 8, p.age * 6, 0);
      this._dummy.scale.setScalar(0.65 + frac * 0.85);
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    if (anyChanged) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateSceneVisuals(dt: number): void {
    const s = this.state;
    const isMoving = s.phase === 'playing';
    const scrollDelta = isMoving ? s.speed * dt : s.phase === 'title' ? 3.8 * dt : 0;

    // 1. Scroll street textures & repeating Tandil storefront blocks
    this.corridor.roadTexture.offset.y -= scrollDelta * 0.1;
    this.corridor.sidewalkTexture.offset.y -= scrollDelta * 0.16;

    const totalSpan = this.corridor.scrollGroups.length * this.corridor.segmentLength;
    for (const seg of this.corridor.scrollGroups) {
      seg.position.z += scrollDelta;
      if (seg.position.z > 32) {
        seg.position.z -= totalSpan;
      }
    }

    // 2. Position & animate skater rig
    this.skater.root.position.set(s.x, 0, 0);
    this.skater.bodyGroup.position.y = s.y;
    this.skater.deckGroup.position.y = s.y;

    // Squash & stretch preservation of volume
    const sy = s.squashY;
    const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
    this.skater.bodyGroup.scale.set(sxz, sy, sxz);

    // Dynamic carve tilt toward lane target + Ollie nose pitch
    const laneDiff = laneToWorldX(s.lane) - s.x;
    const leanZ = THREE.MathUtils.clamp(-laneDiff * 0.16, -0.32, 0.32);
    const olliePitch = !s.grounded ? THREE.MathUtils.clamp(s.vy * 0.032, -0.24, 0.36) : 0;
    this.skater.deckGroup.rotation.z = leanZ;
    this.skater.deckGroup.rotation.x = olliePitch;
    this.skater.bodyGroup.rotation.z = leanZ * 0.85;

    // Subtle idle/carve arm balance & wheel spin
    const bob = isMoving && s.grounded ? Math.sin(s.elapsed * 12) * 0.04 : 0;
    this.skater.bodyGroup.position.y += bob;
    this.skater.leftArm.rotation.z =
      0.22 + Math.sin(s.elapsed * 8) * 0.08 + (!s.grounded ? 0.18 : 0);
    this.skater.rightArm.rotation.z =
      -0.22 - Math.sin(s.elapsed * 8) * 0.08 - (!s.grounded ? 0.18 : 0);

    for (const wheel of this.skater.wheels) {
      wheel.rotation.x -= scrollDelta * 3.8;
    }

    // Contact shadow shrinks & softens during Ollie height
    const shadowScale = Math.max(0.45, 1 - s.y * 0.22);
    this.skater.shadow.scale.set(shadowScale, shadowScale, 1);
    (this.skater.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.18, 0.72 - s.y * 0.2);

    // Invulnerability flicker feedback after collision
    const visible = s.invulnTimer <= 0 || Math.floor(s.invulnTimer * 18) % 2 === 0;
    this.skater.bodyGroup.visible = visible;
    this.skater.deckGroup.visible = visible;

    // 3. Camera framing (hero 3/4 showcase in title vs. active camera preset + shake decay)
    const camAlpha = 1 - Math.exp(-7.5 * dt);
    if (s.phase === 'title') {
      const orbit = s.elapsed * 0.28;
      this._camTarget.set(2.4 + Math.sin(orbit) * 1.4, 2.35, 5.1 + Math.cos(orbit) * 0.4);
      this._lookTarget.set(0, 1.85, -4);
    } else if (this.cameraPreset === 'low') {
      this._camTarget.set(s.x * 0.72, 1.85 + s.y * 0.22, 5.2);
      this._lookTarget.set(s.x * 0.55, 1.35, -14);
    } else if (this.cameraPreset === 'aerial') {
      this._camTarget.set(s.x * 0.45, 8.2, 10.6);
      this._lookTarget.set(s.x * 0.4, 0.8, -14);
    } else {
      // Default crisp chase camera
      this._camTarget.set(s.x * 0.68, 3.65 + s.y * 0.25, 7.2);
      this._lookTarget.set(s.x * 0.5, 1.3, -15);
    }

    this.camera.position.lerp(this._camTarget, camAlpha);

    if (s.shakeIntensity > 0.01) {
      const mag = s.shakeIntensity * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * mag;
      this.camera.position.y += (Math.random() - 0.5) * mag;
    }
    this.camera.lookAt(this._lookTarget);

    // 4. Sync entities & particles
    this.syncEntities(dt);
    this.updateParticles(dt);
  }

  private emitHud(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastHudEmit < 65) return;
    this.lastHudEmit = now;

    this.onHudUpdate({
      phase: this.state.phase,
      score: Math.floor(this.state.score),
      bestScore: Math.floor(this.state.bestScore),
      drops: this.state.drops,
      combo: this.state.combo,
      lives: this.state.lives,
      speedKmh: Math.round(this.state.speed * 3.1),
      promoUnlocked: this.state.promoUnlocked,
      distance: Math.floor(this.state.distance),
    });
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    const prevPhase = this.state.phase;
    const prevPromo = this.state.promoUnlocked;
    const result = stepGameState(this.state, rawDt);
    this.state = result.state;

    for (const ev of result.events) {
      this.handleGameEvent(ev);
    }

    this.updateSceneVisuals(rawDt);
    this.renderer.render(this.scene, this.camera);

    const stateChanged =
      prevPhase !== this.state.phase ||
      prevPromo !== this.state.promoUnlocked ||
      result.events.length > 0;
    this.emitHud(stateChanged);

    this.scheduleNextFrame();
  };

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.rafId);
    window.clearTimeout(this.timerId);
    this.resizeObserver.disconnect();
    this.clearEntityMeshes();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).geometry) {
        (obj as THREE.Mesh).geometry.dispose();
      }
      const mat = (obj as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    });

    this.envRT.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

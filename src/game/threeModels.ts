import * as THREE from 'three';
import { LANE_WIDTH } from './gameLogic';

export interface SkaterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  deckGroup: THREE.Group;
  wheels: THREE.Mesh[];
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  shadow: THREE.Mesh;
}

export interface HazardHandle {
  group: THREE.Group;
  telegraphMat?: THREE.MeshStandardMaterial;
  spinTarget?: THREE.Object3D;
}

export function createRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Urban weathered asphalt base
  ctx.fillStyle = '#2a2a2d';
  ctx.fillRect(0, 0, 512, 512);

  // Fine asphalt grain
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 34 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle tire wear tracks along the 3 lanes
  const laneXs = [108, 256, 404];
  laneXs.forEach((lx) => {
    const grad = ctx.createLinearGradient(lx - 38, 0, lx + 38, 0);
    grad.addColorStop(0, 'rgba(18,18,20,0)');
    grad.addColorStop(0.5, 'rgba(16,16,18,0.28)');
    grad.addColorStop(1, 'rgba(18,18,20,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(lx - 38, 0, 76, 512);
  });

  // Side gutter lines
  ctx.fillStyle = '#e5e2dc';
  ctx.fillRect(18, 0, 7, 512);
  ctx.fillRect(487, 0, 7, 512);

  // Dashed white lane dividers between the 3 lanes
  ctx.fillStyle = 'rgba(245, 243, 238, 0.84)';
  [182, 330].forEach((divX) => {
    for (let y = 16; y < 512; y += 96) {
      ctx.fillRect(divX - 4, y, 8, 52);
    }
  });

  // Subtle crimson OSSK street stencil accent in center lane
  ctx.fillStyle = 'rgba(217, 30, 42, 0.22)';
  ctx.fillRect(216, 224, 80, 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 14);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

export function createSidewalkTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c8c3ba';
  ctx.fillRect(0, 0, 256, 256);

  // Concrete speckle
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 180 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Tile seams (Tandil baldosa urban grid)
  ctx.strokeStyle = 'rgba(72, 68, 62, 0.42)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 22);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

export function createFacadeTexture(
  baseHex: string,
  accentHex: string,
  signText?: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  // Architectural plaster grain
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.035)';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }

  // Upper floor windows
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const wx = 44 + col * 150;
      const wy = 48 + row * 124;
      ctx.fillStyle = '#1b2028';
      ctx.fillRect(wx, wy, 108, 86);
      ctx.fillStyle = 'rgba(255, 240, 220, 0.14)';
      ctx.fillRect(wx + 8, wy + 8, 42, 70);
      ctx.strokeStyle = '#d4cfc7';
      ctx.lineWidth = 4;
      ctx.strokeRect(wx, wy, 108, 86);
    }
  }

  // Ground floor storefront band
  ctx.fillStyle = '#121214';
  ctx.fillRect(0, 310, 512, 202);

  // Illuminated showcase glass
  const glassGrad = ctx.createLinearGradient(0, 360, 0, 500);
  glassGrad.addColorStop(0, '#2c2f36');
  glassGrad.addColorStop(1, '#1a1c20');
  ctx.fillStyle = glassGrad;
  ctx.fillRect(28, 368, 456, 130);

  // Accent header fascia
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 308, 512, 48);

  if (signText) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(signText, 256, 333);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(10, 10, 12, 0.52)');
  grad.addColorStop(0.55, 'rgba(10, 10, 12, 0.22)');
  grad.addColorStop(1, 'rgba(10, 10, 12, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Composite 12-part procedural Skater + Skateboard rig wearing OSSK Animal Star Red Zip Hoodie & Baggy Denim */
export function createSkaterRig(shadowTex: THREE.CanvasTexture): SkaterRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const deckGroup = new THREE.Group();
  root.add(deckGroup);
  root.add(bodyGroup);

  // Soft grounded contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 2.3),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  // Materials
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x161618, roughness: 0.92, metalness: 0.05 });
  const deckBottomMat = new THREE.MeshStandardMaterial({ color: 0xd91e2a, roughness: 0.35, metalness: 0.15 });
  const truckMat = new THREE.MeshStandardMaterial({ color: 0xd4d7dd, roughness: 0.28, metalness: 0.85 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.42, metalness: 0.05 });
  const baggyDenimMat = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.86, metalness: 0.04 });
  const sneakerMat = new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.65, metalness: 0.05 });
  const hoodieMat = new THREE.MeshStandardMaterial({ color: 0xc91b26, roughness: 0.78, metalness: 0.04 });
  const hoodiePatchMat = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.6, metalness: 0.1 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a88a, roughness: 0.65, metalness: 0.02 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.72, metalness: 0.06 });

  // 1. Skateboard Deck (beveled rounded profile extruded along thickness)
  const deckShape = new THREE.Shape();
  const w = 0.24;
  const l = 0.62;
  deckShape.moveTo(-w, -l + 0.18);
  deckShape.quadraticCurveTo(-w, -l, 0, -l);
  deckShape.quadraticCurveTo(w, -l, w, -l + 0.18);
  deckShape.lineTo(w, l - 0.18);
  deckShape.quadraticCurveTo(w, l, 0, l);
  deckShape.quadraticCurveTo(-w, l, -w, l - 0.18);
  deckShape.closePath();

  const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  deckGeo.rotateX(Math.PI / 2);
  const deckMesh = new THREE.Mesh(deckGeo, [gripMat, deckBottomMat]);
  deckMesh.position.y = 0.16;
  deckMesh.castShadow = true;
  deckGroup.add(deckMesh);

  // 2-3. Aluminum Trucks + 4-7. Four Urethane Wheels
  const wheels: THREE.Mesh[] = [];
  const truckGeo = new THREE.BoxGeometry(0.42, 0.055, 0.07);
  const wheelGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.065, 14);
  wheelGeo.rotateZ(Math.PI / 2);

  [-0.36, 0.36].forEach((zOff) => {
    const truck = new THREE.Mesh(truckGeo, truckMat);
    truck.position.set(0, 0.095, zOff);
    deckGroup.add(truck);

    [-0.22, 0.22].forEach((xOff) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(xOff, 0.072, zOff);
      wheel.castShadow = true;
      deckGroup.add(wheel);
      wheels.push(wheel);
    });
  });

  // 8-9. Baggy Legs + Chunky Skate Sneakers
  const legGeo = new THREE.BoxGeometry(0.24, 0.68, 0.26);
  const shoeGeo = new THREE.BoxGeometry(0.22, 0.12, 0.34);

  const leftLeg = new THREE.Mesh(legGeo, baggyDenimMat);
  leftLeg.position.set(-0.14, 0.58, 0.14);
  leftLeg.rotation.y = 0.22;
  leftLeg.castShadow = true;
  bodyGroup.add(leftLeg);

  const leftShoe = new THREE.Mesh(shoeGeo, sneakerMat);
  leftShoe.position.set(0, -0.34, 0.04);
  leftLeg.add(leftShoe);

  const rightLeg = new THREE.Mesh(legGeo, baggyDenimMat);
  rightLeg.position.set(0.14, 0.58, -0.18);
  rightLeg.rotation.y = 0.25;
  rightLeg.castShadow = true;
  bodyGroup.add(rightLeg);

  const rightShoe = new THREE.Mesh(shoeGeo, sneakerMat);
  rightShoe.position.set(0, -0.34, 0.04);
  rightLeg.add(rightShoe);

  // 10. Boxy Crimson OSSK Zip Hoodie Torso + Back Star Patch + Collar Hood
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.68, 0.36), hoodieMat);
  torso.position.set(0, 1.2, 0);
  torso.castShadow = true;
  bodyGroup.add(torso);

  const backPatch = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.03), hoodiePatchMat);
  backPatch.position.set(0, 1.24, 0.185);
  bodyGroup.add(backPatch);

  const starAccent = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), sneakerMat);
  starAccent.scale.set(1, 1, 0.25);
  starAccent.position.set(0, 1.24, 0.205);
  bodyGroup.add(starAccent);

  const hoodCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.14, 12), hoodieMat);
  hoodCollar.position.set(0, 1.56, 0.04);
  bodyGroup.add(hoodCollar);

  // 11-12. Articulated Hoodie Sleeves / Arms (natural skate stance)
  const armGeo = new THREE.BoxGeometry(0.17, 0.54, 0.19);
  const leftArm = new THREE.Mesh(armGeo, hoodieMat);
  leftArm.position.set(-0.4, 1.18, 0.02);
  leftArm.rotation.z = 0.22;
  leftArm.castShadow = true;
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, hoodieMat);
  rightArm.position.set(0.4, 1.18, -0.02);
  rightArm.rotation.z = -0.22;
  rightArm.castShadow = true;
  bodyGroup.add(rightArm);

  // 13-14. Head + 6-Panel OSSK Cap
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 16, 14), skinMat);
  head.position.set(0, 1.74, -0.02);
  head.castShadow = true;
  bodyGroup.add(head);

  const capCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.198, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    capMat
  );
  capCrown.position.set(0, 1.76, -0.02);
  bodyGroup.add(capCrown);

  const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.18), capMat);
  capBrim.position.set(0, 1.79, 0.15);
  capBrim.rotation.x = 0.14;
  bodyGroup.add(capBrim);

  return {
    root,
    bodyGroup,
    deckGroup,
    wheels,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    shadow,
  };
}

/** 5-part collectible OSSK Drop Crate */
export function createDropCrate(): HazardHandle {
  const group = new THREE.Group();
  const spinTarget = new THREE.Group();
  group.add(spinTarget);

  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x151518,
    roughness: 0.42,
    metalness: 0.25,
  });
  const crimsonMat = new THREE.MeshStandardMaterial({
    color: 0xd91e2a,
    emissive: 0x6b0b12,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.35,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf4efe6,
    roughness: 0.35,
    metalness: 0.6,
  });

  // Core drop box
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.74, 0.74), crateMat);
  core.castShadow = true;
  spinTarget.add(core);

  // Horizontal & vertical crimson strapping bands
  const bandH = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.14, 0.78), crimsonMat);
  spinTarget.add(bandH);
  const bandV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.78, 0.78), crimsonMat);
  spinTarget.add(bandV);

  // Floating beveled octahedral diamond emblem on top
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), trimMat);
  emblem.position.y = 0.66;
  spinTarget.add(emblem);

  // Outer rotating beacon ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.035, 10, 28), crimsonMat);
  ring.rotation.x = Math.PI / 2;
  spinTarget.add(ring);

  return { group, spinTarget };
}

/** 6-part Tandil striped sawhorse barrier (Ollie jumpable!) */
export function createBarrierHazard(): HazardHandle {
  const group = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x26262a, roughness: 0.5, metalness: 0.75 });
  const plankMat = new THREE.MeshStandardMaterial({ color: 0xf2f0eb, roughness: 0.48, metalness: 0.05 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd91e2a, roughness: 0.42, metalness: 0.1 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffa822,
    emissive: 0xd96b00,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });

  // Top striped beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.28, 0.14), plankMat);
  beam.position.set(0, 0.78, 0);
  beam.castShadow = true;
  group.add(beam);

  // 3 crimson warning bands across the plank
  [-0.65, 0, 0.65].forEach((xOff) => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.29, 0.155), stripeMat);
    stripe.position.set(xOff, 0.78, 0);
    group.add(stripe);
  });

  // Lower stabilizer bar
  const lowerBar = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.09, 0.08), steelMat);
  lowerBar.position.set(0, 0.34, 0);
  group.add(lowerBar);

  // Left & Right A-frame steel legs
  [-0.82, 0.82].forEach((xOff) => {
    const legF = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.94, 0.08), steelMat);
    legF.position.set(xOff, 0.45, 0.14);
    legF.rotation.x = -0.22;
    legF.castShadow = true;
    group.add(legF);

    const legB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.94, 0.08), steelMat);
    legB.position.set(xOff, 0.45, -0.14);
    legB.rotation.x = 0.22;
    legB.castShadow = true;
    group.add(legB);

    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10), lampMat);
    lamp.position.set(xOff, 0.97, 0);
    group.add(lamp);
  });

  return { group };
}

/** 5-part urban concrete bollard + flanking reflective cones */
export function createBollardConesHazard(): HazardHandle {
  const group = new THREE.Group();

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xa6a198, roughness: 0.88, metalness: 0.04 });
  const steelCapMat = new THREE.MeshStandardMaterial({ color: 0xcfd3da, roughness: 0.3, metalness: 0.82 });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xe6491e, roughness: 0.45, metalness: 0.06 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.9 });
  const reflectMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x555555,
    emissiveIntensity: 0.4,
    roughness: 0.25,
  });

  // Heavy cylindrical concrete bollard
  const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.38, 16), concreteMat);
  bollard.position.y = 0.69;
  bollard.castShadow = true;
  group.add(bollard);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 16), steelCapMat);
  cap.position.y = 1.41;
  group.add(cap);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.16, 16), reflectMat);
  band.position.y = 1.1;
  group.add(band);

  // Two flanking street cones
  [-0.64, 0.64].forEach((xOff) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), rubberMat);
    base.position.set(xOff, 0.03, 0.18);
    group.add(base);

    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.66, 12), coneMat);
    cone.position.set(xOff, 0.36, 0.18);
    cone.castShadow = true;
    group.add(cone);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.115, 0.13, 12), reflectMat);
    collar.position.set(xOff, 0.42, 0.18);
    group.add(collar);
  });

  return { group };
}

/** 7-part swerving warehouse delivery trolley with glowing lane-shift telegraph lamp */
export function createDeliveryTrolleyHazard(): HazardHandle {
  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.4, metalness: 0.78 });
  const cartonMat = new THREE.MeshStandardMaterial({ color: 0xb78b5e, roughness: 0.82, metalness: 0.02 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xd91e2a, roughness: 0.45 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x161618, roughness: 0.85 });
  const telegraphMat = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xff5500,
    emissiveIntensity: 0.3,
    roughness: 0.2,
  });

  // Flatbed chassis
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.12, 1.9), frameMat);
  deck.position.y = 0.24;
  deck.castShadow = true;
  group.add(deck);

  // 4 caster wheels
  const wheelGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.09, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  [
    [-0.64, -0.72],
    [0.64, -0.72],
    [-0.64, 0.72],
    [0.64, 0.72],
  ].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.11, wz);
    group.add(w);
  });

  // Stacked OSSK stock boxes
  const box1 = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.74, 1.46), cartonMat);
  box1.position.set(0, 0.67, 0);
  box1.castShadow = true;
  group.add(box1);

  const box2 = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.56, 1.12), cartonMat);
  box2.position.set(0, 1.32, -0.06);
  box2.castShadow = true;
  group.add(box2);

  const seal = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.1, 1.14), tapeMat);
  seal.position.set(0, 1.32, -0.06);
  group.add(seal);

  // Rear push bar
  const handle = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, 0.07), frameMat);
  handle.position.set(0, 1.24, 0.9);
  group.add(handle);

  // Roof telegraph beacon (pulses intense amber/red when about to swerve)
  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.22), telegraphMat);
  beacon.position.set(0, 1.68, 0);
  group.add(beacon);

  return { group, telegraphMat };
}

export interface UrbanCorridor {
  group: THREE.Group;
  roadTexture: THREE.CanvasTexture;
  sidewalkTexture: THREE.CanvasTexture;
  scrollGroups: THREE.Group[];
  segmentLength: number;
}

/** Natural Tandil urban corridor: street, curbs, storefronts (including OSSK 743), instanced trees & distant Sierras de Tandil */
export function createUrbanCorridor(maxAnisotropy: number): UrbanCorridor {
  const group = new THREE.Group();
  const roadTexture = createRoadTexture(maxAnisotropy);
  const sidewalkTexture = createSidewalkTexture(maxAnisotropy);

  const roadWidth = LANE_WIDTH * 3 + 1.8; // 9.6m wide 3-lane street
  const roadLength = 140;

  // Main street plane
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(roadWidth, roadLength),
    new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.82,
      metalness: 0.06,
    })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -45);
  road.receiveShadow = true;
  group.add(road);

  // Extended urban ground skirt beyond sidewalks
  const skirt = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 220),
    new THREE.MeshStandardMaterial({ color: 0xbcb6ac, roughness: 0.95 })
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.set(0, -0.04, -55);
  group.add(skirt);

  // Raised concrete sidewalks + granite curbs
  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTexture,
    roughness: 0.88,
    metalness: 0.02,
  });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x8f8a82, roughness: 0.8 });

  [-1, 1].forEach((side) => {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.24, roadLength), sidewalkMat);
    sw.position.set(side * (roadWidth / 2 + 3.6), 0.12, -45);
    sw.receiveShadow = true;
    group.add(sw);

    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, roadLength), curbMat);
    curb.position.set(side * (roadWidth / 2 + 0.16), 0.14, -45);
    group.add(curb);
  });

  // Facade textures for Tandil storefronts (including flagship OSSK 743)
  const facadeMats = [
    new THREE.MeshStandardMaterial({
      map: createFacadeTexture('#ded9cf', '#d91e2a', 'OSSK · RODRÍGUEZ 743'),
      roughness: 0.78,
    }),
    new THREE.MeshStandardMaterial({
      map: createFacadeTexture('#d1c8bc', '#19191c', 'TANDIL · DROP 04'),
      roughness: 0.82,
    }),
    new THREE.MeshStandardMaterial({
      map: createFacadeTexture('#c9c4bb', '#2b2d32', 'STREETWEAR 743'),
      roughness: 0.8,
    }),
    new THREE.MeshStandardMaterial({
      map: createFacadeTexture('#e2ddd4', '#222225'),
      roughness: 0.84,
    }),
  ];

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x454442, roughness: 0.9 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.4, metalness: 0.8 });
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d4,
    emissive: 0xffd28c,
    emissiveIntensity: 0.55,
    roughness: 0.2,
  });

  // Repeating modular architectural segments
  const segmentLength = 26;
  const segmentCount = 6;
  const scrollGroups: THREE.Group[] = [];

  // Shared geometries for InstancedMesh multi-cluster urban planter trees
  const planterGeo = new THREE.BoxGeometry(1.15, 0.34, 1.15);
  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.17, 1.85, 7);
  const canopyGeo = new THREE.IcosahedronGeometry(0.76, 0);
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x7b766e, roughness: 0.9 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4738, roughness: 0.92 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x4c6b44, roughness: 0.86, flatShading: true });

  const dummy = new THREE.Object3D();
  const colorScratch = new THREE.Color();

  for (let s = 0; s < segmentCount; s++) {
    const seg = new THREE.Group();
    seg.position.z = 16 - s * segmentLength;

    // Left & right buildings per segment (2 blocks per side)
    [-1, 1].forEach((side) => {
      for (let b = 0; b < 2; b++) {
        const bWidth = 8.4;
        const bHeight = 6.8 + ((s + b + (side > 0 ? 1 : 0)) % 3) * 1.9;
        const bDepth = 12.2;
        const mat = facadeMats[(s * 2 + b + (side > 0 ? 0 : 2)) % facadeMats.length];

        const building = new THREE.Mesh(new THREE.BoxGeometry(bWidth, bHeight, bDepth), mat);
        building.position.set(
          side * (roadWidth / 2 + 7.2 + bWidth / 2 - 0.3),
          bHeight / 2,
          -b * 13 - 6
        );
        seg.add(building);

        const cornice = new THREE.Mesh(new THREE.BoxGeometry(bWidth + 0.4, 0.35, bDepth + 0.3), roofMat);
        cornice.position.set(building.position.x, bHeight + 0.16, building.position.z);
        seg.add(cornice);
      }

      // Streetlight post + overhanging arm
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 6.2, 8), poleMat);
      pole.position.set(side * (roadWidth / 2 + 1.05), 3.1, -13);
      seg.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.09), poleMat);
      arm.position.set(side * (roadWidth / 2 + 0.3), 6.08, -13);
      seg.add(arm);

      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.24), lanternMat);
      lamp.position.set(side * (roadWidth / 2 - 0.32), 6.0, -13);
      seg.add(lamp);
    });

    // Instanced street planter trees (planter curb + trunk + 3-cluster faceted foliage with ±15% variation)
    const treesPerSeg = 4;
    const planters = new THREE.InstancedMesh(planterGeo, planterMat, treesPerSeg);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treesPerSeg);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treesPerSeg * 3);

    const treeSpots: [number, number][] = [
      [-(roadWidth / 2 + 2.1), -5],
      [roadWidth / 2 + 2.1, -5],
      [-(roadWidth / 2 + 2.1), -19],
      [roadWidth / 2 + 2.1, -19],
    ];

    const clusterOffsets: [number, number, number, number][] = [
      [0, 2.55, 0, 1.05],
      [-0.45, 2.25, 0.28, 0.78],
      [0.44, 2.2, -0.26, 0.82],
    ];

    treeSpots.forEach(([tx, tz], idx) => {
      const seed = ((s * 7 + idx * 13) % 11) / 10; // deterministic 0..1
      const scale = 0.86 + seed * 0.28; // ±14% natural scale variation

      dummy.position.set(tx, 0.38, tz);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      planters.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tx, 0.92 * scale + 0.35, tz);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, seed * Math.PI * 2, 0);
      dummy.updateMatrix();
      trunks.setMatrixAt(idx, dummy.matrix);

      clusterOffsets.forEach(([ox, oy, oz, cScale], cIdx) => {
        const instIdx = idx * 3 + cIdx;
        dummy.position.set(tx + ox * scale, oy * scale + 0.25, tz + oz * scale);
        dummy.scale.set(scale * cScale * 1.12, scale * cScale * 0.92, scale * cScale);
        dummy.rotation.set(cIdx * 0.7, seed * Math.PI * 2 + cIdx, 0.2 * cIdx);
        dummy.updateMatrix();
        canopies.setMatrixAt(instIdx, dummy.matrix);

        colorScratch.setHSL(
          0.27 + (seed - 0.5) * 0.045,
          0.28,
          0.32 + (seed - 0.5) * 0.05 + cIdx * 0.025
        );
        canopies.setColorAt(instIdx, colorScratch);
      });
    });

    planters.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;

    seg.add(planters);
    seg.add(trunks);
    seg.add(canopies);

    group.add(seg);
    scrollGroups.push(seg);
  }

  // Prominent layered Sierras de Tandil rocky ridges silhouetted at the end of Calle Rodríguez
  const sierraFarMat = new THREE.MeshStandardMaterial({
    color: 0x8a837d,
    roughness: 0.96,
    metalness: 0.02,
    flatShading: true,
  });
  const sierraMidMat = new THREE.MeshStandardMaterial({
    color: 0x6b6762,
    roughness: 0.94,
    metalness: 0.02,
    flatShading: true,
  });

  const peaks: [number, number, number, number, boolean][] = [
    [-42, -96, 36, 26, true],
    [-4, -100, 44, 34, true],
    [34, -95, 38, 28, true],
    [-24, -84, 24, 17, false],
    [16, -86, 28, 19, false],
  ];

  peaks.forEach(([px, pz, rad, h, isFar]) => {
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(rad, h, 7),
      isFar ? sierraFarMat : sierraMidMat
    );
    hill.position.set(px, h / 2 - 2, pz);
    hill.scale.set(1.45, 1, 0.68);
    hill.rotation.y = px * 0.1;
    group.add(hill);
  });

  return { group, roadTexture, sidewalkTexture, scrollGroups, segmentLength };
}

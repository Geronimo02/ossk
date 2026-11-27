export type LoupeViewMode = '2d' | '3d';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface NormalizedModelTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

export interface ResolvedModelSource {
  url: string;
  label: string;
  isCustomUpload: boolean;
}

/** Validates whether a dropped/selected filename is a supported 3D GLTF/GLB asset */
export function isValidGlbFileName(fileName: string): boolean {
  const clean = fileName.trim().toLowerCase();
  return clean.endsWith('.glb') || clean.endsWith('.gltf');
}

/**
 * Computes uniform scale & ground-centered offset so any scanned .glb model
 * (whether in mm, cm, or meters) lands squarely on y = pedestalY inside the 360° studio frame.
 */
export function computeNormalizedModelTransform(
  size: Vec3Like,
  center: Vec3Like,
  minY: number,
  targetExtent = 1.82,
  pedestalY = 0
): NormalizedModelTransform {
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 1e-5 ? targetExtent / maxDim : 1;

  return {
    scale,
    offsetX: -center.x * scale,
    offsetY: pedestalY - minY * scale,
    offsetZ: -center.z * scale,
  };
}

/**
 * Resolves the active real .GLB/.GLTF model source for a product.
 * Returns null when neither a catalog scan (product.modelUrl) nor a local test upload exists,
 * in which case GarmentStudio3D shows the sculptural studio tailor mannequin ready for 360° orbit or .GLB drop.
 */
export function resolveProductModelSource(
  productModelUrl: string | undefined,
  productSku: string,
  customUpload: { url: string; name: string } | null
): ResolvedModelSource | null {
  if (customUpload && customUpload.url.trim().length > 0) {
    return {
      url: customUpload.url,
      label: customUpload.name,
      isCustomUpload: true,
    };
  }
  if (productModelUrl && productModelUrl.trim().length > 0) {
    return {
      url: productModelUrl.trim(),
      label: productSku,
      isCustomUpload: false,
    };
  }
  return null;
}

/** Toggles cleanly between 2D technical loupe and 360° Three.js OrbitControls inspection */
export function toggleLoupeViewMode(current: LoupeViewMode): LoupeViewMode {
  return current === '2d' ? '3d' : '2d';
}

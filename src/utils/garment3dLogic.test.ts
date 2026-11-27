import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNormalizedModelTransform,
  isValidGlbFileName,
  resolveProductModelSource,
} from './garment3dLogic';

test('isValidGlbFileName validates .glb and .gltf extensions case-insensitively and rejects unsupported files', () => {
  assert.equal(isValidGlbFileName('hoodie-animal.glb'), true);
  assert.equal(isValidGlbFileName('OSSK_SCAN.GLTF'), true);
  assert.equal(isValidGlbFileName('  torso.Glb  '), true);
  assert.equal(isValidGlbFileName('photo.jpg'), false);
  assert.equal(isValidGlbFileName('archive.zip'), false);
  assert.equal(isValidGlbFileName(''), false);
});

test('computeNormalizedModelTransform scales oversized millimeter scans down and grounds minY cleanly on pedestal', () => {
  const tx = computeNormalizedModelTransform(
    { x: 520, y: 800, z: 320 },
    { x: 100, y: 400, z: -50 },
    0,
    2.0,
    0.08
  );

  assert.equal(Number(tx.scale.toFixed(4)), 0.0025);
  assert.equal(Number(tx.offsetX.toFixed(4)), -0.25);
  assert.equal(Number(tx.offsetY.toFixed(4)), 0.08);
  assert.equal(Number(tx.offsetZ.toFixed(4)), 0.125);

  const degenerate = computeNormalizedModelTransform(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    0,
    2.0,
    0
  );
  assert.equal(degenerate.scale, 1);
});

test('resolveProductModelSource returns null when no real GLB exists and prioritizes local scan uploads', () => {
  assert.equal(resolveProductModelSource(undefined, 'OSK-AN-01', null), null);
  assert.equal(resolveProductModelSource('   ', 'OSK-AN-01', null), null);

  const catalogModel = resolveProductModelSource('/models/osk-an-01.glb', 'OSK-AN-01', null);
  assert.deepEqual(catalogModel, {
    url: '/models/osk-an-01.glb',
    label: 'OSK-AN-01',
    isCustomUpload: false,
  });

  const uploadedModel = resolveProductModelSource('/models/osk-an-01.glb', 'OSK-AN-01', {
    url: 'blob:test-scan',
    name: 'polycam-hoodie.glb',
  });
  assert.deepEqual(uploadedModel, {
    url: 'blob:test-scan',
    label: 'polycam-hoodie.glb',
    isCustomUpload: true,
  });
});

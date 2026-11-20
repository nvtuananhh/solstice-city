// Geometry merging: combine many small static parts into ONE mesh per material
// so the renderer issues a handful of draw calls instead of hundreds. This is
// what makes the game fast under software rendering (SwiftShader) as well as
// on a real GPU. Parts carry a solid colour each; the merged mesh uses vertex
// colours (material colour stays white).

export function xform(x, y, z, rx, ry, rz, sx, sy, sz) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx || 1, sy || 1, sz || 1));
  return m;
}

// parts: [{ geo, matrix, color }] — color is a hex number (default white).
// Returns a BufferGeometry with position/normal/uv/color + index.
export function mergeParts(parts) {
  const geos = [];
  let vCount = 0, iCount = 0;
  for (const p of parts) {
    const g = p.geo.clone();
    if (p.matrix) g.applyMatrix4(p.matrix);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const c = new THREE.Color(p.color !== undefined ? p.color : 0xffffff);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geos.push(g);
    vCount += n;
    iCount += g.index ? g.index.count : n;
  }
  const pos = new Float32Array(vCount * 3);
  const norm = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, cc = g.attributes.color;
    pos.set(p.array, vo * 3);
    norm.set(n.array, vo * 3);
    if (u) uv.set(u.array, vo * 2);
    col.set(cc.array, vo * 3);
    if (g.index) {
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i++) idx[io + i] = ix[i] + vo;
      io += ix.length;
    } else {
      for (let i = 0; i < p.count; i++) idx[io + i] = vo + i;
      io += p.count;
    }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// Build one mesh from parts and add it to the scene. Returns the mesh.
export function batchMesh(scene, material, parts) {
  if (!parts.length) return null;
  const mesh = new THREE.Mesh(mergeParts(parts), material);
  scene.add(mesh);
  return mesh;
}

// Shared vertex-colour lambert material for merged meshes.
export function vertexMaterial() {
  return new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
}

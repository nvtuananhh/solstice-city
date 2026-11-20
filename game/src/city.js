// SOLSTICE CITY — the city itself. Grid streets, seeded buildings with shared
// canvas facade textures, the Helios Tower, the Heliostat Sea mirror field,
// palms, cacti, streetlights, shop signs, water tower, garage, truck yard,
// rooftop. All static geometry is MERGED into a few meshes per material (see
// merge.js) so the renderer issues ~60 draw calls for the whole city instead
// of hundreds. All placement comes from the seeded RNG.

import { CFG, DISTRICTS, LANDMARKS, SHOP_NAMES } from './config.js';
import { mergeParts, batchMesh, xform, vertexMaterial } from './merge.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function facadeTexture(rng, base) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h - 40, w, 40);
    const cols = 4, rows = 9;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng.next() < 0.22;
        g.fillStyle = lit ? '#ffe9a8' : (rng.next() < 0.5 ? '#2b3a4a' : '#1d2733');
        g.fillRect(10 + c * 30, 14 + r * 26, 20, 15);
      }
    }
  });
}

function roadTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#33343a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8d24a'; g.fillRect(w / 2 - 2, 0, 4, 34);
    g.fillRect(w / 2 - 2, 64, 4, 34);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
  });
}

function signTexture(text, bg, fg) {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = fg; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text.toUpperCase(), w / 2, h / 2 + 1);
  });
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Solstice City';
}

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = []; // {x, z, hx, hz}
    this.lampMats = [];
    this.beacon = null;
    this.dustDevils = [];
    this.build();
  }

  addCollider(x, z, hx, hz) { this.colliders.push({ x, z, hx, hz }); }

  // Resolve a circle (x,z,r) against all AABB colliders. Returns corrected x,z.
  collide(x, z, r) {
    for (const c of this.colliders) {
      const nx = Math.max(c.x - c.hx, Math.min(x, c.x + c.hx));
      const nz = Math.max(c.z - c.hz, Math.min(z, c.z + c.hz));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          const px = c.hx + r - Math.abs(x - c.x);
          const pz = c.hz + r - Math.abs(z - c.z);
          if (px < pz) x = c.x + (x >= c.x ? c.hx + r : -(c.hx + r));
          else z = c.z + (z >= c.z ? c.hz + r : -(c.hz + r));
        }
      }
    }
    return { x, z };
  }

  build() {
    const scene = this.scene, rng = this.rng;
    const VC = vertexMaterial();
    // --- ground: desert sand + city slab + dunes (merged) ---
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800),
      new THREE.MeshLambertMaterial({ color: 0xd9b36c }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, -0.05, 0);
    scene.add(sand);
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
      new THREE.MeshLambertMaterial({ color: 0xbfae8e }));
    slab.rotation.x = -Math.PI / 2; slab.position.set(0, 0, 0);
    scene.add(slab);
    const duneParts = [];
    for (let i = 0; i < 26; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(420, 800);
      duneParts.push({
        geo: new THREE.SphereGeometry(rng.range(30, 90), 10, 6),
        matrix: xform(Math.cos(a) * d, 0, Math.sin(a) * d, 0, 0, 0, 1, 0.12, 1),
        color: 0xe0bd77,
      });
    }
    batchMesh(scene, VC, duneParts);

    // --- roads: one merged mesh, UVs scaled so dashes repeat every 14 units ---
    const roadTex = roadTexture();
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    const roadParts = [];
    const roadGeo = (vertical) => {
      const g = new THREE.PlaneGeometry(700, 14);
      g.rotateX(-Math.PI / 2);
      if (vertical) g.rotateY(Math.PI / 2);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 50);
      return g;
    };
    for (let v = CFG.roadMin; v <= CFG.roadMax; v += CFG.roadSpacing) {
      roadParts.push({ geo: roadGeo(false), matrix: xform(0, 0.02, v), color: 0xffffff });
      roadParts.push({ geo: roadGeo(true), matrix: xform(v, 0.02, 0), color: 0xffffff });
    }
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex, vertexColors: true });
    batchMesh(scene, roadMat, roadParts);

    // --- buildings: 4 shared facade materials, merged per material ---
    const palette = ['#c98f4e', '#b76a3f', '#8fa3b0', '#d9c08a', '#a8574a', '#7d8f6a', '#c9a35a', '#96684f'];
    const facadeMats = palette.slice(0, 4).map((col) =>
      new THREE.MeshLambertMaterial({ map: facadeTexture(rng, col), vertexColors: true }));
    const facadeParts = [[], [], [], []];
    const roofParts = [];
    const awnParts = [];
    const skip = (bx, bz) => {
      for (const k of Object.keys(LANDMARKS)) {
        const L = LANDMARKS[k];
        if (Math.abs(L.x - bx) < 46 && Math.abs(L.z - bz) < 46) return true;
      }
      return false;
    };
    let shopIdx = 0;
    for (let gx = 0; gx < 7; gx++) {
      for (let gz = 0; gz < 7; gz++) {
        const bx = CFG.roadMin + 40 + gx * CFG.roadSpacing;
        const bz = CFG.roadMin + 40 + gz * CFG.roadSpacing;
        if (skip(bx, bz)) continue;
        const n = rng.int(1, 3);
        for (let b = 0; b < n; b++) {
          const ox = rng.range(-16, 16), oz = rng.range(-16, 16);
          const w = rng.range(14, 26), d = rng.range(14, 26);
          const h = rng.range(8, gz === 3 && gx >= 3 ? 42 : 26);
          const mi = rng.int(0, 3);
          facadeParts[mi].push({
            geo: new THREE.BoxGeometry(w, h, d),
            matrix: xform(bx + ox, h / 2, bz + oz),
            color: 0xffffff,
          });
          this.addCollider(bx + ox, bz + oz, w / 2 + 0.4, d / 2 + 0.4);
          roofParts.push({
            geo: new THREE.BoxGeometry(w * 0.5, 1.6, d * 0.5),
            matrix: xform(bx + ox, h + 0.8, bz + oz),
            color: 0x6b5a44,
          });
          if (Math.abs(bz) < 60 && shopIdx < SHOP_NAMES.length) {
            const name = SHOP_NAMES[shopIdx++];
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(16, 4),
              new THREE.MeshBasicMaterial({ map: signTexture(name, rng.pick(['#7a1f2b', '#123a5c', '#2b5c1f', '#5c2b7a']), '#ffe9a8') }));
            sign.position.set(bx + ox, 5.2, bz + oz + d / 2 + 0.15);
            scene.add(sign);
            awnParts.push({
              geo: new THREE.BoxGeometry(w * 0.8, 0.5, 3),
              matrix: xform(bx + ox, 4.2, bz + oz + d / 2 + 1.4),
              color: rng.pick([0x9a2f2f, 0x2f6b4a, 0x2f4a6b]),
            });
          }
        }
      }
    }
    for (let i = 0; i < 4; i++) batchMesh(scene, facadeMats[i], facadeParts[i]);
    batchMesh(scene, VC, roofParts);
    batchMesh(scene, VC, awnParts);

    this.buildLandmarks();
    this.buildMirrorField();
    this.buildNature();
    this.buildStreetlights();
  }

  buildLandmarks() {
    const scene = this.scene, rng = this.rng;
    const add = (m, x, y, z) => { m.position.set(x, y, z); scene.add(m); return m; };
    // Helios Tower: tapering cylinder + spire + beacon
    add(new THREE.Mesh(new THREE.CylinderGeometry(9, 16, 120, 12),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d2 })), 0, 60, -360);
    add(new THREE.Mesh(new THREE.CylinderGeometry(2, 6, 26, 8),
      new THREE.MeshLambertMaterial({ color: 0xc9a24a })), 0, 132, -360);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    this.beacon = add(new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 8), beaconMat), 0, 146, -360);
    const beaconLight = new THREE.PointLight(0xffd23f, 1.2, 220);
    beaconLight.position.set(0, 146, -360); scene.add(beaconLight);
    this.addCollider(0, -360, 17, 17);
    add(new THREE.Mesh(new THREE.BoxGeometry(60, 2, 60),
      new THREE.MeshLambertMaterial({ color: 0x9a8a6a })), 0, 1, -360);
    // water tower
    const wt = LANDMARKS.waterTower;
    const legMat = new THREE.MeshLambertMaterial({ color: 0x5a4a38 });
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 18, 6), legMat), wt.x + dx, 9, wt.z + dz);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 8, 12),
      new THREE.MeshLambertMaterial({ color: 0x7fa3b8 })), wt.x, 21, wt.z);
    add(new THREE.Mesh(new THREE.ConeGeometry(6.4, 3, 12),
      new THREE.MeshLambertMaterial({ color: 0x5a7a8c })), wt.x, 26.5, wt.z);
    this.addCollider(wt.x, wt.z, 5, 5);
    // Theo's garage
    const g = LANDMARKS.garage;
    add(new THREE.Mesh(new THREE.BoxGeometry(26, 7, 18),
      new THREE.MeshLambertMaterial({ color: 0x8a4a2f })), g.x, 3.5, g.z - 6);
    const gsign = new THREE.Mesh(new THREE.PlaneGeometry(22, 4),
      new THREE.MeshBasicMaterial({ map: signTexture("THEO'S AUTO", '#2b3a1f', '#ffd23f') }));
    gsign.position.set(g.x, 6.4, g.z + 3.2); scene.add(gsign);
    this.addCollider(g.x, g.z - 6, 13, 9);
    // chop shop
    const c = LANDMARKS.chopShop;
    add(new THREE.Mesh(new THREE.BoxGeometry(20, 6, 14),
      new THREE.MeshLambertMaterial({ color: 0x3a3f4a })), c.x, 3, c.z);
    const csign = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.4),
      new THREE.MeshBasicMaterial({ map: signTexture('CHOP SHOP', '#1f1f24', '#ff8a5c') }));
    csign.position.set(c.x, 5.6, c.z + 7.2); scene.add(csign);
    this.addCollider(c.x, c.z, 10, 7);
    // truck yard containers
    const ty = LANDMARKS.truckYard;
    const contCols = [0x9a3a2a, 0x2a5c7a, 0x5c7a2a, 0x7a6a2a];
    for (let i = 0; i < 6; i++) {
      const cx = ty.x - 14 + (i % 3) * 13, cz = ty.z - 10 + Math.floor(i / 3) * 12;
      add(new THREE.Mesh(new THREE.BoxGeometry(11, 3.4, 3.4),
        new THREE.MeshLambertMaterial({ color: contCols[i % 4] })), cx, 1.7, cz);
      this.addCollider(cx, cz, 5.6, 1.8);
    }
    // safehouse
    const s = LANDMARKS.safehouse;
    add(new THREE.Mesh(new THREE.BoxGeometry(12, 6, 10),
      new THREE.MeshLambertMaterial({ color: 0xd9c08a })), s.x, 3, s.z);
    add(new THREE.Mesh(new THREE.ConeGeometry(8.6, 3.4, 4),
      new THREE.MeshLambertMaterial({ color: 0x8a4a2f })), s.x, 7.6, s.z).rotation.y = Math.PI / 4;
    this.addCollider(s.x, s.z, 6, 5);
    // corner store
    const st = LANDMARKS.store;
    add(new THREE.Mesh(new THREE.BoxGeometry(16, 6, 12),
      new THREE.MeshLambertMaterial({ color: 0x7a2f3a })), st.x, 3, st.z);
    const ssign = new THREE.Mesh(new THREE.PlaneGeometry(13, 3),
      new THREE.MeshBasicMaterial({ map: signTexture('CORNER STORE', '#7a1f2b', '#ffe9a8') }));
    ssign.position.set(st.x, 5.4, st.z + 6.2); scene.add(ssign);
    this.addCollider(st.x, st.z, 8, 6);
    // rooftop building + ramp
    const r = LANDMARKS.rooftop;
    add(new THREE.Mesh(new THREE.BoxGeometry(24, 10, 20),
      new THREE.MeshLambertMaterial({ map: facadeTexture(rng, '#6a7a8a') })), r.x, 5, r.z);
    const ramp = add(new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 16),
      new THREE.MeshLambertMaterial({ color: 0x8a8f96 })), r.x - 14, 5, r.z + 4);
    ramp.rotation.z = 0.62;
    this.addCollider(r.x, r.z, 12, 10);
    // hospital / precinct
    const h = LANDMARKS.hospital;
    add(new THREE.Mesh(new THREE.BoxGeometry(18, 9, 14),
      new THREE.MeshLambertMaterial({ color: 0xd9d9d9 })), h.x, 4.5, h.z);
    this.addCollider(h.x, h.z, 9, 7);
    const p = LANDMARKS.policeStation;
    add(new THREE.Mesh(new THREE.BoxGeometry(18, 8, 14),
      new THREE.MeshLambertMaterial({ color: 0x2f4a6b })), p.x, 4, p.z);
    this.addCollider(p.x, p.z, 9, 7);
    void rng;
  }

  buildMirrorField() {
    const scene = this.scene, rng = this.rng;
    const panelParts = [], postParts = [];
    for (let ix = 0; ix < 10; ix++) {
      for (let iz = 0; iz < 8; iz++) {
        const x = 360 + ix * 16 + rng.range(-1, 1);
        const z = -120 + iz * 32 + rng.range(-2, 2);
        postParts.push({
          geo: new THREE.CylinderGeometry(0.4, 0.5, 4, 6),
          matrix: xform(x, 2, z), color: 0x6a6a6a,
        });
        panelParts.push({
          geo: new THREE.BoxGeometry(12, 0.4, 9),
          matrix: xform(x, 4.4, z, -0.5, rng.range(-0.1, 0.1), 0),
          color: 0xffffff,
        });
      }
    }
    for (let z = -140; z <= 140; z += 20) {
      postParts.push({
        geo: new THREE.CylinderGeometry(0.25, 0.25, 3, 5),
        matrix: xform(345, 1.5, z), color: 0x6a6a6a,
      });
    }
    const mirrorMat = new THREE.MeshPhongMaterial({ color: 0xcfe8ff, shininess: 120, specular: 0xffffff, vertexColors: true });
    batchMesh(scene, mirrorMat, panelParts);
    batchMesh(scene, vertexMaterial(), postParts);
  }

  buildNature() {
    const scene = this.scene, rng = this.rng;
    const VC = vertexMaterial();
    // palms: one merged trunk mesh + one merged frond mesh
    const trunkParts = [], frondParts = [];
    for (let i = 0; i < 42; i++) {
      const along = rng.pick([-280, -200, -120, -40, 40, 120, 200, 280]);
      const across = rng.range(-260, 260);
      const px = rng.chance(0.5) ? along + 10 : rng.range(-260, 260);
      const pz = rng.chance(0.5) ? across : along + 10;
      trunkParts.push({
        geo: new THREE.CylinderGeometry(0.35, 0.55, 7, 6),
        matrix: xform(px, 3.5, pz), color: 0x7a5a38,
      });
      for (let f = 0; f < 5; f++) {
        const a = (f / 5) * Math.PI * 2;
        frondParts.push({
          geo: new THREE.ConeGeometry(0.9, 4.4, 4),
          matrix: xform(px + Math.cos(a) * 1.4, 7.2, pz + Math.sin(a) * 1.4,
            -Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1),
          color: 0x3f7a3a,
        });
      }
    }
    batchMesh(scene, VC, trunkParts);
    batchMesh(scene, VC, frondParts);
    // cacti: one merged mesh
    const cactusParts = [];
    for (let i = 0; i < 34; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(360, 700);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = rng.range(2, 5);
      cactusParts.push({
        geo: new THREE.CylinderGeometry(0.6, 0.7, h, 8),
        matrix: xform(x, h / 2, z), color: 0x3a7a4a,
      });
      cactusParts.push({
        geo: new THREE.CylinderGeometry(0.35, 0.35, 1.6, 6),
        matrix: xform(x + 1, h * 0.6, z, 0, 0, Math.PI / 2),
        color: 0x3a7a4a,
      });
    }
    batchMesh(scene, VC, cactusParts);
    // dust devils: translucent cones, spun by sim time in render.js
    const ddMat = new THREE.MeshBasicMaterial({ color: 0xd9b36c, transparent: true, opacity: 0.28 });
    for (let i = 0; i < 4; i++) {
      const dd = new THREE.Mesh(new THREE.ConeGeometry(rng.range(3, 5), rng.range(14, 22), 8, 1, true), ddMat);
      dd.position.set(rng.range(-300, 300), 9, rng.range(-300, 300));
      scene.add(dd);
      this.dustDevils.push(dd);
    }
  }

  buildStreetlights() {
    const scene = this.scene;
    const VC = vertexMaterial();
    const poleParts = [], lampParts = [];
    for (let v = -280; v <= 280; v += 80) {
      for (const u of [-200, -40, 120, 260]) {
        poleParts.push({ geo: new THREE.CylinderGeometry(0.18, 0.24, 8, 6), matrix: xform(v + 9, 4, u), color: 0x3a3a3a });
        poleParts.push({ geo: new THREE.BoxGeometry(0.3, 0.3, 3.4), matrix: xform(v + 9, 7.8, u - 1.4), color: 0x3a3a3a });
        lampParts.push({ geo: new THREE.SphereGeometry(0.55, 8, 6), matrix: xform(v + 9, 7.6, u - 3), color: 0xffffff });
        poleParts.push({ geo: new THREE.CylinderGeometry(0.18, 0.24, 8, 6), matrix: xform(u, 4, v + 9), color: 0x3a3a3a });
        lampParts.push({ geo: new THREE.SphereGeometry(0.55, 8, 6), matrix: xform(u, 7.6, v + 9), color: 0xffffff });
      }
    }
    batchMesh(scene, VC, poleParts);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x554422 });
    this.lampMats.push(lampMat);
    batchMesh(scene, lampMat, lampParts);
  }
}

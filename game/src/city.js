// City builder: ground texture, streets, buildings with procedural facades,
// the detailed Helios Tower, mirror field, props, landmarks, sun shards.
// Everything is placed from the seeded RNG — same seed, same city.
// Three.js r149 UMD is loaded by index.html as a classic script, so modules
// read the global instead of importing the UMD file as a module (its `this`
// wrapper would fail in strict module scope).
const THREE = window.THREE;
import { CITY, DISTRICTS, SHOP_NAMES, LANDMARKS } from './config.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

const FACADE_COLORS = ['#c9a06a', '#b08a5a', '#9a7a6a', '#7a8a9a', '#a89a7a', '#c07a5a', '#8a6a8a', '#6a9a8a', '#d8b06a', '#5a6a7a'];

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = [];   // {x0,z0,x1,z1,h}
    this.mirrorMats = [];
    this.beaconMat = null;
    this.beaconLight = null;
    this.streetLights = [];
    this.palms = [];     // palm groups, for shot staging to clear sightlines
    this.shardMeshes = [];
    this.dustDevils = [];
    this.clouds = [];
    this.rooftop = { x: LANDMARKS.rooftop.x, z: LANDMARKS.rooftop.z, h: 14 };
    this.garageDoor = { x: LANDMARKS.garage.x, z: LANDMARKS.garage.z };
    this._buildGround();
    this._buildBuildings();
    this._buildTower();
    this._buildMirrorField();
    this._buildLandmarks();
    this._buildProps();
    this._buildShards();
  }

  // ---- ground: one 1024 canvas, sand + roads + dashes + district tints ----
  _buildGround() {
    const S = CITY.half * 2;
    const tex = canvasTexture(1024, 1024, (g, w, h) => {
      g.fillStyle = '#c9a86a'; g.fillRect(0, 0, w, h);
      // sand speckle
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = this.rng.chance(0.5) ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
        g.fillRect(this.rng.range(0, w), this.rng.range(0, h), 2, 2);
      }
      const toPx = (v) => ((v + CITY.half) / S) * w;
      // district tint patches
      for (const d of DISTRICTS) {
        g.fillStyle = '#' + d.tint.toString(16).padStart(6, '0') + '22';
        g.fillRect(toPx(d.x0), toPx(d.z0), toPx(d.x1) - toPx(d.x0), toPx(d.z1) - toPx(d.z0));
      }
      // roads
      const roadPx = (CITY.roadW / S) * w;
      g.fillStyle = '#3a3a40';
      for (let i = -5; i <= 5; i++) {
        const c = i * CITY.block;
        g.fillRect(toPx(c) - roadPx / 2, 0, roadPx, h);
        g.fillRect(0, toPx(c) - roadPx / 2, w, roadPx);
      }
      // sidewalks (lighter border along roads)
      g.fillStyle = '#b8a888';
      for (let i = -5; i <= 5; i++) {
        const c = i * CITY.block;
        g.fillRect(toPx(c) - roadPx / 2 - 5, 0, 5, h);
        g.fillRect(toPx(c) + roadPx / 2, 0, 5, h);
        g.fillRect(0, toPx(c) - roadPx / 2 - 5, w, 5);
        g.fillRect(0, toPx(c) + roadPx / 2, w, 5);
      }
      // centre dashes
      g.fillStyle = '#e8d27a';
      for (let i = -5; i <= 5; i++) {
        const c = i * CITY.block;
        for (let d = -CITY.half + 8; d < CITY.half; d += 16) {
          g.fillRect(toPx(c) - 1, toPx(d), 2, 7);
          g.fillRect(toPx(d), toPx(c) - 1, 7, 2);
        }
      }
      // mirror-field ground tint (east)
      g.fillStyle = 'rgba(200,220,235,0.35)';
      g.fillRect(toPx(150), toPx(-300), toPx(300) - toPx(150), toPx(-60) - toPx(-300));
    });
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _facadeTexture(base, shopName) {
    return canvasTexture(128, 256, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      // grime at the bottom
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h - 26, w, 26);
      // windows
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 4; col++) {
          const lit = this.rng.chance(0.25);
          g.fillStyle = lit ? '#ffe9a8' : '#2a2f3a';
          g.fillRect(10 + col * 30, 14 + row * 30, 20, 20);
          g.fillStyle = 'rgba(255,255,255,0.15)';
          g.fillRect(10 + col * 30, 14 + row * 30, 20, 4);
        }
      }
      if (shopName) {
        g.fillStyle = '#20242a'; g.fillRect(0, h - 52, w, 26);
        g.fillStyle = '#ffd23c'; g.font = 'bold 13px Arial'; g.textAlign = 'center';
        g.fillText(shopName.toUpperCase().slice(0, 16), w / 2, h - 34);
        // awning stripes
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? '#b02030' : '#f0e8d8';
          g.fillRect(i * 16, h - 26, 16, 8);
        }
      }
    });
  }

  _addBox(x, z, w, h, d, mat, y0 = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y0 + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    this.scene.add(m);
    this.colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, h });
    return m;
  }

  _buildBuildings() {
    const reserved = [
      { x: LANDMARKS.tower.x, z: LANDMARKS.tower.z, r: 40 },
      { x: LANDMARKS.mirrorField.x, z: LANDMARKS.mirrorField.z, r: 90 },
      { x: LANDMARKS.garage.x, z: LANDMARKS.garage.z, r: 30 },
      { x: LANDMARKS.truckYard.x, z: LANDMARKS.truckYard.z, r: 35 },
      { x: LANDMARKS.foundry.x, z: LANDMARKS.foundry.z, r: 30 },
      { x: LANDMARKS.rooftop.x, z: LANDMARKS.rooftop.z, r: 26 },
      { x: LANDMARKS.plaza.x, z: LANDMARKS.plaza.z, r: 26 },
      { x: LANDMARKS.safehouse.x, z: LANDMARKS.safehouse.z, r: 22 },
      { x: LANDMARKS.chopShop.x, z: LANDMARKS.chopShop.z, r: 22 },
      { x: LANDMARKS.waterTower.x, z: LANDMARKS.waterTower.z, r: 20 },
    ];
    let shopIdx = 0;
    for (let bx = -270; bx <= 270; bx += 60) {
      for (let bz = -270; bz <= 270; bz += 60) {
        if (reserved.some((r) => Math.abs(bx - r.x) < r.r && Math.abs(bz - r.z) < r.r)) continue;
        const n = this.rng.int(1, 2);
        for (let k = 0; k < n; k++) {
          const ox = n === 1 ? 0 : (k === 0 ? -13 : 13);
          const oz = n === 1 ? 0 : (k === 0 ? -13 : 13);
          const w = this.rng.range(16, 26);
          const d = this.rng.range(16, 26);
          const h = this.rng.range(7, 30);
          const base = this.rng.pick(FACADE_COLORS);
          const shop = this.rng.chance(0.45) ? SHOP_NAMES[shopIdx++ % SHOP_NAMES.length] : null;
          const mat = new THREE.MeshLambertMaterial({ map: this._facadeTexture(base, shop) });
          this._addBox(bx + ox, bz + oz, w, h, d, mat);
          // roof box (AC / parapet hint)
          if (this.rng.chance(0.6)) {
            const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 3),
              new THREE.MeshLambertMaterial({ color: 0x8a8a8a }));
            ac.position.set(bx + ox + this.rng.range(-4, 4), h + 0.6, bz + oz + this.rng.range(-4, 4));
            this.scene.add(ac);
          }
        }
      }
    }
  }

  // ---- Helios Tower: base + stepped shaft + panel seams + beacon + antenna ----
  _buildTower() {
    const T = LANDMARKS.tower;
    const g = new THREE.Group();
    g.position.set(T.x, 0, T.z);
    const concrete = new THREE.MeshLambertMaterial({ color: 0xd8d2c0 });
    const panel = new THREE.MeshLambertMaterial({ color: 0xe8ecf0 });
    const seam = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
    const gold = new THREE.MeshLambertMaterial({ color: 0xd8a83c, emissive: 0x442200 });
    // base plaza + stepped podium (sized to fit between the roads at x=0/60)
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(20, 24, 2, 8), concrete);
    plaza.position.y = 1; g.add(plaza);
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(14, 18, 8, 8), concrete);
    podium.position.y = 6; g.add(podium);
    // shaft in three tapering tiers (total height ~52 m, beacon at ~61 m)
    const tiers = [[9, 12, 20, 14], [7, 9, 16, 32], [5, 7, 12, 46]];
    for (const [rTop, rBot, h, y] of tiers) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 12), panel);
      shaft.position.y = y; shaft.castShadow = true; g.add(shaft);
      // panel seams: thin dark rings + vertical strips
      for (let s = 0; s < 4; s++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(rBot - (s * (rBot - rTop)) / 4, 0.18, 6, 24), seam);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y - h / 2 + (s + 1) * (h / 5);
        g.add(ring);
      }
      for (let v = 0; v < 8; v++) {
        const a = (v / 8) * Math.PI * 2;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 0.35), seam);
        const rr = (rTop + rBot) / 2;
        strip.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
        strip.rotation.y = -a;
        g.add(strip);
      }
      // gold band at the tier junction
      const band = new THREE.Mesh(new THREE.TorusGeometry(rBot + 0.15, 0.35, 8, 24), gold);
      band.rotation.x = Math.PI / 2;
      band.position.y = y - h / 2 + 0.4;
      g.add(band);
    }
    // gold crown ring + beacon mast + antenna
    const crown = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.7, 8, 24), gold);
    crown.rotation.x = Math.PI / 2; crown.position.y = 53; g.add(crown);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 8, 8), seam);
    mast.position.y = 57; g.add(mast);
    this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3020 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), this.beaconMat);
    beacon.position.y = 61; g.add(beacon);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), seam);
    antenna.position.y = 65; g.add(antenna);
    // base structure: entrance block + solar wings
    const entry = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 8), concrete);
    entry.position.set(0, 5, 16); g.add(entry);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, 8),
        new THREE.MeshLambertMaterial({ color: 0x2a4a6a, emissive: 0x0a2030 }));
      wing.position.set(sx * 20, 3, 0); wing.rotation.z = sx * 0.18; g.add(wing);
    }
    this.beaconLight = new THREE.PointLight(0xff4030, 1.2, 60);
    this.beaconLight.position.y = 61;
    g.add(this.beaconLight);
    this.scene.add(g);
    this.colliders.push({ x0: T.x - 14, z0: T.z - 14, x1: T.x + 14, z1: T.z + 14, h: 100 });
  }

  // ---- Mirror field: rows of tilted reflective panels ----
  // Panel rows sit between the roads (roads run on multiples of 60).
  _buildMirrorField() {
    const mat = new THREE.MeshPhongMaterial({ color: 0xbfd8e8, shininess: 120, specular: 0xffffff, emissive: 0x223344 });
    const xs = [168, 196, 224, 252, 280];
    const zs = [-282, -254, -226, -198, -170, -142, -114, -86];
    for (const px of xs) {
      for (const pz of zs) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), mat);
        p.position.set(px, 2.2, pz);
        p.rotation.x = -Math.PI / 2 + 0.5;
        p.rotation.z = 0.35;
        this.scene.add(p);
        this.mirrorMats.push(mat);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6),
          new THREE.MeshLambertMaterial({ color: 0x6a6a72 }));
        post.position.set(px, 1.2, pz);
        this.scene.add(post);
      }
    }
  }

  // ---- Landmark structures ----
  _buildLandmarks() {
    // Theo's garage: low building, open front, big sign
    const G = LANDMARKS.garage;
    const gmat = new THREE.MeshLambertMaterial({ color: 0x8a5a3a });
    this._addBox(G.x, G.z, 26, 8, 18, gmat);
    const sign = canvasTexture(256, 64, (c, w, h) => {
      c.fillStyle = '#20242a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffd23c'; c.font = 'bold 28px Arial'; c.textAlign = 'center';
      c.fillText("THEO'S AUTO", w / 2, 42);
    });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 5),
      new THREE.MeshBasicMaterial({ map: sign }));
    signMesh.position.set(G.x, 9.5, G.z - 9.5);
    this.scene.add(signMesh);
    // safehouse
    const S = LANDMARKS.safehouse;
    this._addBox(S.x, S.z, 14, 7, 12, new THREE.MeshLambertMaterial({ color: 0x7a9a6a }));
    // chop shop
    const C = LANDMARKS.chopShop;
    this._addBox(C.x, C.z, 20, 7, 16, new THREE.MeshLambertMaterial({ color: 0x5a4a6a }));
    // truck yard: flat yard + containers
    const Y = LANDMARKS.truckYard;
    for (let i = 0; i < 6; i++) {
      const cx = Y.x - 18 + (i % 3) * 18;
      const cz = Y.z - 8 + Math.floor(i / 3) * 16;
      this._addBox(cx, cz, 12, 3.5, 4, new THREE.MeshLambertMaterial({ color: this.rng.pick([0xb06030, 0x3060a0, 0x608030]) }));
    }
    // foundry: two smokestacks + low sheds
    const F = LANDMARKS.foundry;
    for (const dx of [-8, 8]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 34, 10),
        new THREE.MeshLambertMaterial({ color: 0x4a3a36 }));
      stack.position.set(F.x + dx, 17, F.z - 6);
      this.scene.add(stack);
      this.colliders.push({ x0: F.x + dx - 4, z0: F.z - 10, x1: F.x + dx + 4, z1: F.z - 2, h: 34 });
    }
    this._addBox(F.x, F.z + 12, 24, 8, 14, new THREE.MeshLambertMaterial({ color: 0x6a5a4a }));
    // water tower
    const W = LANDMARKS.waterTower;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 8, 12),
      new THREE.MeshLambertMaterial({ color: 0x9ab0c0 }));
    tank.position.set(W.x, 16, W.z); this.scene.add(tank);
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 14, 6),
        new THREE.MeshLambertMaterial({ color: 0x5a5a5a }));
      leg.position.set(W.x + dx, 7, W.z + dz); this.scene.add(leg);
    }
    this.colliders.push({ x0: W.x - 6, z0: W.z - 6, x1: W.x + 6, z1: W.z + 6, h: 20 });
    // rooftop mission building: flat roof at h=14, parapet + AC units
    const R = LANDMARKS.rooftop;
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6a });
    this._addBox(R.x, R.z, 24, 14, 20, roofMat);
    const parapetMat = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
    for (const [px, pz, pw, pd] of [
      [0, -10, 24, 1], [0, 10, 24, 1], [-12, 0, 1, 20], [12, 0, 1, 20]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(pw, 1.4, pd), parapetMat);
      p.position.set(R.x + px, 14.7, R.z + pz);
      this.scene.add(p);
    }
    for (let i = 0; i < 4; i++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 2.4),
        new THREE.MeshLambertMaterial({ color: 0x9a9a9a }));
      ac.position.set(R.x - 8 + i * 5, 14.7, R.z - 6 + (i % 2) * 10);
      this.scene.add(ac);
    }
    // plaza: fountain ring at the plaza block centre
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.6, 12),
      new THREE.MeshLambertMaterial({ color: 0x5a8ab0 }));
    fountain.position.set(LANDMARKS.plaza.x, 0.8, LANDMARKS.plaza.z); this.scene.add(fountain);
    this.colliders.push({ x0: LANDMARKS.plaza.x - 8, z0: LANDMARKS.plaza.z - 8, x1: LANDMARKS.plaza.x + 8, z1: LANDMARKS.plaza.z + 8, h: 2 });
  }

  // ---- Props: palms, cacti, streetlights, dust devils, clouds ----
  _buildProps() {
    const palmTrunk = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
    const palmLeaf = new THREE.MeshLambertMaterial({ color: 0x3a8a3a, side: THREE.DoubleSide });
    const cactusMat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a });
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    for (let i = 0; i < 70; i++) {
      const x = this.rng.range(-290, 290);
      const z = this.rng.range(-290, 290);
      if (Math.abs(x % 60) < 9 || Math.abs(z % 60) < 9) continue; // keep off roads
      if (x > 150 && z < -60) continue; // mirror field
      if (this.rng.chance(0.55)) {
        // palm
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), palmTrunk);
        trunk.position.y = 3.5; g.add(trunk);
        for (let l = 0; l < 6; l++) {
          const leaf = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.4), palmLeaf);
          const a = (l / 6) * Math.PI * 2;
          leaf.position.set(Math.cos(a) * 1.8, 7.2, Math.sin(a) * 1.8);
          leaf.rotation.set(0.5, -a, 0);
          leaf.rotation.y = -a;
          g.add(leaf);
        }
        g.position.set(x, 0, z);
        this.scene.add(g);
        this.palms.push({ group: g, x, z });
        this.colliders.push({ x0: x - 0.6, z0: z - 0.6, x1: x + 0.6, z1: z + 0.6, h: 7 });
      } else {
        const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 3, 4, 8), cactusMat);
        c.position.set(x, 2.2, z);
        this.scene.add(c);
        this.colliders.push({ x0: x - 0.9, z0: z - 0.9, x1: x + 0.9, z1: z + 0.9, h: 4 });
      }
    }
    // streetlights along avenues
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (let i = -4; i <= 4; i++) {
      for (const z of [-240, -120, 0, 120, 240]) {
        const x = i * 60 + 7;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 8, 6), poleMat);
        pole.position.set(x, 4, z); this.scene.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), headMat);
        head.position.set(x, 8.2, z); this.scene.add(head);
        this.streetLights.push(head);
      }
    }
    // dust devils on the highways (visual only, rotate by sim time)
    const devilMat = new THREE.MeshLambertMaterial({ color: 0xd8b06a, transparent: true, opacity: 0.35 });
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(new THREE.ConeGeometry(3, 14, 8, 1, true), devilMat);
      d.position.set(this.rng.range(-240, 240), 7, this.rng.range(-240, 240));
      this.scene.add(d);
      this.dustDevils.push(d);
    }
    // clouds: flat white blobs drifting with sim time
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 9; i++) {
      const cl = new THREE.Group();
      for (let b = 0; b < 3; b++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(this.rng.range(6, 12), 8, 6), cloudMat);
        s.position.set(b * 8 - 8, 0, this.rng.range(-3, 3));
        s.scale.y = 0.4;
        cl.add(s);
      }
      cl.position.set(this.rng.range(-280, 280), 95, this.rng.range(-280, 280));
      this.scene.add(cl);
      this.clouds.push(cl);
    }
  }

  // ---- 25 sun shards, seeded positions on sidewalks/plazas ----
  _buildShards() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23c });
    for (let i = 0; i < 25; i++) {
      const x = this.rng.range(-270, 270);
      const z = this.rng.range(-270, 270);
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), mat);
      m.position.set(x, 1.4, z);
      this.scene.add(m);
      this.shardMeshes.push({ mesh: m, x, z, taken: false });
    }
  }

  // Hide palms near a point (shot staging: keep the camera sightline clear).
  hidePalmsNear(x, z, r) {
    for (const p of this.palms) {
      if (Math.hypot(p.x - x, p.z - z) < r) p.group.visible = false;
    }
  }

  // Simple AABB collision resolve for a circle of radius r at (x,z), height h.
  // Returns corrected [x, z]. Buildings only block when the actor is below the roof.
  collide(x, z, r, h = 2) {
    for (const c of this.colliders) {
      if (h >= c.h) continue;
      if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) {
        const dxl = (x + r) - c.x0, dxr = c.x1 - (x - r);
        const dzl = (z + r) - c.z0, dzr = c.z1 - (z - r);
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) x = c.x0 - r;
        else if (m === dxr) x = c.x1 + r;
        else if (m === dzl) z = c.z0 - r;
        else z = c.z1 + r;
      }
    }
    x = Math.max(-298, Math.min(298, x));
    z = Math.max(-298, Math.min(298, z));
    return [x, z];
  }

  isOnRoad(x, z) {
    const fx = ((x % 60) + 60) % 60;
    const fz = ((z % 60) + 60) % 60;
    return Math.min(fx, 60 - fx) < 6.5 || Math.min(fz, 60 - fz) < 6.5;
  }
}

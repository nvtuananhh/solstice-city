// Pedestrians: sidewalk walkers who cross at crossings, scatter from gunfire
// or crashes, and can be taxi customers. One seeded RNG drives every choice.
// Each person is 3 meshes (merged torso + 2 swinging legs) to keep draw calls low.

import { CFG } from './config.js';
import { mergeParts, xform, vertexMaterial } from './merge.js';

const SHIRT_COLORS = [0xc22e4a, 0x3a6ea5, 0x3a7a4a, 0xd9a83a, 0x7a4a9a, 0xd9d9d9, 0x2a2a2a, 0xe87a3a];
const SKIN_COLORS = [0xe8b88a, 0xc98a5a, 0x8a5a38, 0xf0c8a0];
const PED_MAT = vertexMaterial();

export function makePersonMesh(rng, shirtColor) {
  const g = new THREE.Group();
  const shirt = shirtColor !== undefined ? shirtColor : SHIRT_COLORS[rng.int(0, SHIRT_COLORS.length - 1)];
  const skin = SKIN_COLORS[rng.int(0, SKIN_COLORS.length - 1)];
  const pants = rng.pick([0x2a3a5a, 0x3a3a3a, 0x5a4a3a]);
  // torso: body + head + arms merged into one vertex-colour mesh
  const parts = [
    { geo: new THREE.BoxGeometry(0.55, 0.75, 0.32), matrix: xform(0, 1.05, 0), color: shirt },
    { geo: new THREE.SphereGeometry(0.22, 10, 8), matrix: xform(0, 1.62, 0), color: skin },
    { geo: new THREE.BoxGeometry(0.16, 0.6, 0.16), matrix: xform(-0.36, 1.05, 0), color: shirt },
    { geo: new THREE.BoxGeometry(0.16, 0.6, 0.16), matrix: xform(0.36, 1.05, 0), color: shirt },
  ];
  const torso = new THREE.Mesh(mergeParts(parts), PED_MAT);
  g.add(torso);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), legMat);
  legL.position.set(-0.14, 0.35, 0); g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), legMat);
  legR.position.set(0.14, 0.35, 0); g.add(legR);
  g.userData = { legL, legR, torso, shirt };
  return g;
}

export class Pedestrians {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.list = [];
    const lines = [];
    for (let v = CFG.roadMin; v <= CFG.roadMax; v += CFG.roadSpacing) lines.push(v);
    for (let i = 0; i < CFG.pedestrians; i++) {
      const mesh = makePersonMesh(rng);
      const axis = rng.chance(0.5) ? 'x' : 'z';
      const line = rng.pick(lines) + rng.pick([-10.5, 10.5]);
      const along = rng.range(-280, 280);
      const p = {
        mesh,
        x: axis === 'x' ? along : line,
        z: axis === 'x' ? line : along,
        axis,
        dir: rng.chance(0.5) ? 1 : -1,
        speed: rng.range(1.1, 2.2),
        walkPhase: rng.range(0, 6.28),
        panic: 0,
        taxi: rng.chance(0.18),
        waiting: rng.chance(0.3),
      };
      mesh.position.set(p.x, 0, p.z);
      scene.add(mesh);
      this.list.push(p);
    }
  }

  scatter(x, z, radius) {
    for (const p of this.list) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) {
        p.panic = 3;
        // run away from the event
        const a = Math.atan2(p.x - x, p.z - z);
        p.dir = 1;
        p.axis = Math.abs(Math.cos(a)) > 0.5 ? 'x' : 'z';
        p.fleeAngle = a;
      }
    }
  }

  update(dt, simTime) {
    for (const p of this.list) {
      if (p.waiting && p.panic <= 0) {
        // waiting pedestrians idle (taxi customers hold a pose)
        p.mesh.rotation.y = Math.sin(simTime * 0.5 + p.walkPhase) * 0.4;
        continue;
      }
      const spd = p.panic > 0 ? p.speed * 3.2 : p.speed;
      if (p.panic > 0) p.panic -= dt;
      if (p.fleeAngle !== undefined && p.panic > 0) {
        p.x += Math.sin(p.fleeAngle) * spd * dt;
        p.z += Math.cos(p.fleeAngle) * spd * dt;
        p.mesh.rotation.y = p.fleeAngle;
      } else {
        p.fleeAngle = undefined;
        if (p.axis === 'x') p.x += p.dir * spd * dt;
        else p.z += p.dir * spd * dt;
        p.mesh.rotation.y = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
        // turn around at the block edge (seeded choice: reverse or switch axis)
        const along = p.axis === 'x' ? p.x : p.z;
        if (along > 285 || along < -285) p.dir *= -1;
        if (this.rng.chance(0.002)) p.dir *= -1;
      }
      p.walkPhase += dt * spd * 3.2;
      const swing = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
      p.mesh.position.set(p.x, 0, p.z);
    }
  }

  nearestWaiting(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const p of this.list) {
      if (!p.waiting || !p.taxi) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  remove(p) {
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
    this.scene.remove(p.mesh);
  }
}

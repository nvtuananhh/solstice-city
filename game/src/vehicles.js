// Vehicle factory + arcade driving model. Cars are box-built meshes with
// spinning wheels, headlights, damage smoke. Driving is arcade: accelerate,
// brake/reverse, steer scaled by speed, handbrake slide, nitro boost.
const THREE = window.THREE;
import { CAR_TYPES } from './config.js';

let carId = 0;

export function makeCarMesh(typeKey, color) {
  const def = CAR_TYPES[typeKey];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: color ?? def.color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(def.len, 0.85, def.wid), bodyMat);
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(def.len * 0.5, 0.7, def.wid * 0.86), glassMat);
  cabin.position.set(-def.len * 0.05, 1.4, 0); cabin.castShadow = true; g.add(cabin);
  if (typeKey === 'pickup' || typeKey === 'truck') {
    // open bed: raised rear walls
    const bed = new THREE.Mesh(new THREE.BoxGeometry(def.len * 0.32, 0.5, def.wid * 0.9), bodyMat);
    bed.position.set(-def.len * 0.3, 1.3, 0); g.add(bed);
  }
  if (typeKey === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    bar.position.set(0, 1.85, 0); g.add(bar);
    g.userData.lightBar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(def.len * 0.98, 0.18, def.wid * 1.01),
      new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
    stripe.position.y = 0.9; g.add(stripe);
  }
  if (typeKey === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    sign.position.set(0, 1.9, 0); g.add(sign);
  }
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const wheels = [];
  for (const [wx, wz] of [[def.len * 0.32, def.wid / 2], [def.len * 0.32, -def.wid / 2],
                          [-def.len * 0.32, def.wid / 2], [-def.len * 0.32, -def.wid / 2]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10), wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 0.35), lightMat);
    hl.position.set(def.len / 2, 0.7, s * (def.wid / 2 - 0.35));
    g.add(hl);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(typeKey, x, z, heading, rng, color) {
    this.id = ++carId;
    this.type = typeKey;
    this.def = CAR_TYPES[typeKey];
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.health = 100;
    this.mesh = makeCarMesh(typeKey, color);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = -heading;
    this.driver = null;      // 'player' | 'traffic' | 'police' | 'npc' | null (parked)
    this.engine = 0;         // upgrade stages 0..3
    this.brakes = 0;
    this.nitro = false;
    this.nitroFuel = 100;
    this.smokeTimer = 0;
    this.stuckTimer = 0;
    this.color = color ?? this.def.color;
    this.rng = rng;
    this.wrecked = false;
    this.smoke = null;
  }

  topSpeed() { return this.def.top * (1 + 0.18 * this.engine); }

  // Arcade step. steer in -1..1, throttle -1..1, handbrake bool, nitro bool.
  drive(dt, steer, throttle, handbrake, nitroBoost) {
    if (this.wrecked) { this.speed *= (1 - 2 * dt); return; }
    const top = this.topSpeed();
    const accel = this.def.accel * (nitroBoost && this.nitroFuel > 0 ? 2.1 : 1);
    if (throttle > 0) this.speed += accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= (22 + 8 * this.brakes) * dt; // brake
      else this.speed = Math.max(-10, this.speed + accel * 0.6 * dt);   // reverse
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    }
    if (nitroBoost && this.nitroFuel > 0) this.nitroFuel = Math.max(0, this.nitroFuel - 30 * dt);
    else this.nitroFuel = Math.min(100, this.nitroFuel + 4 * dt);
    this.speed = Math.max(-10, Math.min(top * (nitroBoost && this.nitroFuel > 0 ? 1.25 : 1), this.speed));
    const grip = handbrake ? this.def.grip * 0.45 : this.def.grip;
    this.heading += steer * grip * dt * Math.min(1, Math.abs(this.speed) / 8) * Math.sign(this.speed || 1);
    if (handbrake) this.speed *= (1 - 0.6 * dt);
    const fx = Math.cos(this.heading), fz = -Math.sin(this.heading);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = -this.heading;
    const spin = (this.speed * dt) / 0.38;
    for (const w of this.mesh.userData.wheels) w.rotation.z -= spin;
    if (this.mesh.userData.lightBar) {
      const mat = this.mesh.userData.lightBar.material;
      mat.color.setHex((Math.floor(this.mesh.position.x + this.mesh.position.z) % 2 === 0) ? 0xff2020 : 0x2040ff);
    }
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0 && !this.wrecked) {
      this.wrecked = true;
      this.speed = 0;
    }
  }
}

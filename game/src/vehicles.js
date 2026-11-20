// Cars: ONE merged mesh per car (vertex colours), so a car costs a single draw
// call. Arcade driving physics for the player car and pursuit steering for
// police cars. Damage shows as smoke once health drops.

import { CAR_TYPES } from './config.js';
import { mergeParts, xform, vertexMaterial } from './merge.js';

const CAR_MAT = vertexMaterial();

export function makeCarMesh(typeKey, colorOverride) {
  const t = CAR_TYPES[typeKey] || CAR_TYPES.sedan;
  const color = colorOverride !== undefined ? colorOverride : t.color;
  const L = t.length, W = t.width;
  const parts = [];
  const box = (w, h, d, x, y, z, c, ry) => parts.push({
    geo: new THREE.BoxGeometry(w, h, d),
    matrix: xform(x, y, z, 0, ry || 0, 0), color: c,
  });
  const cyl = (r1, r2, h, x, y, z, c, rx, rz) => parts.push({
    geo: new THREE.CylinderGeometry(r1, r2, h, 10),
    matrix: xform(x, y, z, rx || 0, 0, rz || 0), color: c,
  });
  // body + cabin + glass + lights
  box(W, 0.85, L, 0, 0.75, 0, color);
  box(W * 0.82, 0.7, L * 0.5, 0, 1.5, -L * 0.05, 0x1a1d22);
  box(W * 0.84, 0.5, 0.12, 0, 1.45, L * 0.22, 0x9fc4d8);
  box(0.4, 0.18, 0.1, -W / 2 + 0.35, 0.8, L / 2 + 0.02, 0xfff6c8);
  box(0.4, 0.18, 0.1, W / 2 - 0.35, 0.8, L / 2 + 0.02, 0xfff6c8);
  box(0.4, 0.18, 0.1, -W / 2 + 0.35, 0.8, -L / 2 - 0.02, 0xd92323);
  box(0.4, 0.18, 0.1, W / 2 - 0.35, 0.8, -L / 2 - 0.02, 0xd92323);
  // wheels (static geometry; the car still reads as moving from speed + dust)
  for (const [x, z] of [[-W / 2, L / 2 - 0.9], [W / 2, L / 2 - 0.9], [-W / 2, -L / 2 + 0.9], [W / 2, -L / 2 + 0.9]]) {
    cyl(0.42, 0.42, 0.3, x, 0.42, z, 0x14161a, 0, Math.PI / 2);
  }
  if (typeKey === 'pickup') {
    box(W * 0.9, 0.5, L * 0.34, 0, 1.0, -L * 0.3, 0x2a2118);
  }
  if (typeKey === 'police') {
    box(W * 0.5, 0.22, 0.5, 0, 1.95, -L * 0.05, 0x2244ff);
    box(W * 0.5, 0.22, 0.5, 0, 1.95, L * 0.12, 0xff2222);
    box(W + 0.02, 0.3, L * 0.9, 0, 0.78, 0, 0xffffff);
  }
  if (typeKey === 'taxi') {
    box(0.9, 0.25, 0.5, 0, 1.95, 0, 0x111111);
  }
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(mergeParts(parts), CAR_MAT);
  g.add(mesh);
  g.userData.type = typeKey;
  g.userData.bodyMesh = mesh;
  return g;
}

// Arcade car state. `drive` integrates one fixed step from input + upgrades.
export class Car {
  constructor(typeKey, x, z, angle, colorOverride) {
    this.type = typeKey;
    this.spec = CAR_TYPES[typeKey];
    this.mesh = makeCarMesh(typeKey, colorOverride);
    this.pos = new THREE.Vector3(x, 0, z);
    this.angle = angle;
    this.speed = 0;
    this.health = 100;
    this.nitro = 1; // 0..1 charge
    this.steerVis = 0;
    this.smoke = null;
  }
  forward() { return { x: Math.sin(this.angle), z: Math.cos(this.angle) }; }
  drive(input, dt, upgrades) {
    const spec = this.spec;
    const top = spec.topSpeed * (upgrades.engine ? 1.25 : 1);
    const accel = spec.accel * (upgrades.engine ? 1.2 : 1);
    let target = 0;
    if (input.down('w') || input.down('ArrowUp')) target = top;
    if (input.down('s') || input.down('ArrowDown')) target = -top * 0.45;
    const handbrake = input.down(' ');
    const nitro = input.down('Shift') && this.nitro > 0.05 && target > 0;
    if (nitro) { target = top * 1.45; this.nitro = Math.max(0, this.nitro - dt * 0.5); }
    else this.nitro = Math.min(1, this.nitro + dt * 0.05);
    const rate = handbrake ? 30 : accel;
    if (this.speed < target) this.speed = Math.min(target, this.speed + rate * dt);
    else if (this.speed > target) this.speed = Math.max(target, this.speed - rate * 1.4 * dt);
    if (handbrake) this.speed *= (1 - 2.2 * dt);
    // steering: stronger at speed, reversed when reversing
    const steerIn = (input.down('a') || input.down('ArrowLeft') ? 1 : 0) - (input.down('d') || input.down('ArrowRight') ? 1 : 0);
    const spd = Math.abs(this.speed);
    const steerAmt = steerIn * spec.steer * Math.min(1, spd / 10) * (this.speed >= 0 ? 1 : -1) * (handbrake ? 1.7 : 1);
    this.angle += steerAmt * dt * (spd > 0.1 ? 1 : 0);
    this.steerVis = steerIn;
    const f = this.forward();
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    this.syncMesh();
  }
  // Police-style pursuit: steer toward a target point, no input needed.
  chase(tx, tz, dt, maxSpeed) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const want = Math.atan2(dx, dz);
    let diff = want - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += Math.max(-1, Math.min(1, diff * 2.2)) * this.spec.steer * dt;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const target = dist > 6 ? (maxSpeed || this.spec.topSpeed) : this.spec.topSpeed * 0.4;
    if (this.speed < target) this.speed = Math.min(target, this.speed + this.spec.accel * dt);
    else this.speed = Math.max(target, this.speed - this.spec.accel * dt);
    const f = this.forward();
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    this.syncMesh();
  }
  syncMesh() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.angle;
  }
  damage(amount, scene) {
    this.health = Math.max(0, this.health - amount);
    if (this.health < 55 && !this.smoke) {
      const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5 }));
      smoke.position.set(0, 1.6, 1.2);
      this.mesh.add(smoke);
      this.smoke = smoke;
    }
    if (this.smoke) this.smoke.scale.setScalar(1 + (55 - this.health) / 40);
  }
}

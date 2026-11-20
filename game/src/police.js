// Police: wanted level 1-5, chasing police cars (ramming + PIT), foot police
// who attempt arrests, a helicopter at 4+ stars with a searchlight, and
// roadblocks at 3+ stars. Wanted decays when no police can see the player.

import { CFG } from './config.js';
import { Car, makeCarMesh } from './vehicles.js';
import { makePersonMesh } from './pedestrians.js';

export class Police {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.wanted = 0;
    this.cars = [];
    this.foot = [];
    this.heli = null;
    this.heliLight = null;
    this.roadblocks = [];
    this.hiddenTimer = 0;
    this.decayTimer = 0;
    this.spawnTimer = 0;
    this.arrestTimer = 0;
    this.busted = false;
    this.heliAngle = 0;
  }

  addWanted(n, reason) {
    const before = this.wanted;
    this.wanted = Math.max(0, Math.min(5, this.wanted + n));
    if (this.wanted > before) this.hiddenTimer = 0;
    return this.wanted;
  }
  setWanted(n) { this.wanted = Math.max(0, Math.min(5, n)); this.hiddenTimer = 0; }

  wantedCars() { return this.wanted >= 1 ? Math.min(1 + this.wanted, 5) : 0; }

  spawnCar(px, pz) {
    const car = new Car('police', px + this.rng.range(-40, 40), pz + this.rng.range(-40, 40), 0);
    car.speed = 10;
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  spawnFoot(px, pz) {
    const mesh = makePersonMesh(this.rng, 0x1f3a6b); // police blue shirt
    mesh.position.set(px + this.rng.range(-15, 15), 0, pz + this.rng.range(-15, 15));
    this.scene.add(mesh);
    const f = { mesh, x: mesh.position.x, z: mesh.position.z, speed: 5.2, walkPhase: 0 };
    this.foot.push(f);
    return f;
  }

  buildHelicopter() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 5.2),
      new THREE.MeshLambertMaterial({ color: 0x1c2a44 }));
    body.position.y = 0; g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x9fc4d8 }));
    glass.position.set(0, 0.2, 2.2); g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4),
      new THREE.MeshLambertMaterial({ color: 0x1c2a44 }));
    tail.position.set(0, 0.3, -4.4); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1.1; g.add(rotor);
    const rotor2 = rotor.clone(); rotor2.rotation.y = Math.PI / 2; g.add(rotor2);
    // searchlight cone
    const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 22, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    cone.position.y = -12; g.add(cone);
    this.heliLight = new THREE.PointLight(0xfff6c8, 0.9, 40);
    this.heliLight.position.y = -6; g.add(this.heliLight);
    g.userData.rotor = rotor; g.userData.rotor2 = rotor2;
    this.heli = g;
    this.scene.add(g);
  }

  buildRoadblocks(px, pz) {
    this.clearRoadblocks();
    // two roadblocks on the avenues nearest the player
    const spots = [
      { x: px + 60, z: Math.round(pz / 80) * 80 },
      { x: Math.round(px / 80) * 80, z: pz - 60 },
    ];
    for (const s of spots) {
      const group = new THREE.Group();
      for (let i = -1; i <= 1; i++) {
        const car = new Car('police', s.x + i * 5, s.z, Math.PI / 2);
        car.speed = 0;
        group.add(car.mesh);
        this.roadblocks.push(car);
      }
      const coneMat = new THREE.MeshLambertMaterial({ color: 0xff6a2a });
      for (let i = -2; i <= 2; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), coneMat);
        cone.position.set(s.x + i * 4, 0.55, s.z + 6);
        group.add(cone);
      }
      this.scene.add(group);
    }
  }
  clearRoadblocks() {
    for (const c of this.roadblocks) this.scene.remove(c.mesh);
    this.roadblocks = [];
  }

  update(dt, player, city, simTime) {
    const px = player.pos.x, pz = player.pos.z;
    // --- helicopter ---
    if (this.wanted >= 4 && !this.heli) this.buildHelicopter();
    if (this.wanted < 4 && this.heli) { this.scene.remove(this.heli); this.heli = null; }
    if (this.heli) {
      this.heliAngle += dt * 0.55;
      const r = 26;
      this.heli.position.set(px + Math.cos(this.heliAngle) * r, 58 + Math.sin(simTime * 0.7) * 3, pz + Math.sin(this.heliAngle) * r);
      this.heli.rotation.y = -this.heliAngle;
      this.heli.userData.rotor.rotation.y += dt * 22;
      this.heli.userData.rotor2.rotation.y += dt * 22;
    }
    // --- roadblocks at 3+ ---
    if (this.wanted >= 3 && this.roadblocks.length === 0) this.buildRoadblocks(px, pz);
    if (this.wanted < 3 && this.roadblocks.length > 0) this.clearRoadblocks();

    // --- spawn / despawn chasers ---
    const want = this.wantedCars();
    this.spawnTimer -= dt;
    if (this.cars.length < want && this.spawnTimer <= 0) {
      this.spawnCar(px, pz);
      this.spawnTimer = 1.2;
    }
    if (this.cars.length > want) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    // foot police at 1-2 stars when the player is on foot
    const wantFoot = this.wanted >= 1 && this.wanted <= 3 && !player.inCar ? 2 : 0;
    if (this.foot.length < wantFoot && this.spawnTimer <= 0) { this.spawnFoot(px, pz); this.spawnTimer = 1.5; }
    if (this.foot.length > wantFoot) {
      const f = this.foot.pop();
      this.scene.remove(f.mesh);
    }

    // --- chase ---
    let nearestDist = 1e9;
    for (const car of this.cars) {
      car.chase(px, pz, dt, 40 + this.wanted * 2);
      const d = Math.hypot(car.pos.x - px, car.pos.z - pz);
      nearestDist = Math.min(nearestDist, d);
      // ramming: damage the player's car / player on contact
      if (d < 3.4) {
        if (player.inCar && player.car) player.car.damage(6 * dt * 10, this.scene);
        else player.damage(8 * dt * 10);
        // PIT shove
        const a = Math.atan2(px - car.pos.x, pz - car.pos.z);
        player.pos.x += Math.sin(a) * dt * 4;
        player.pos.z += Math.cos(a) * dt * 4;
      }
      const c = city.collide(car.pos.x, car.pos.z, 1.6);
      car.pos.x = c.x; car.pos.z = c.z;
      car.syncMesh();
    }
    // foot police pursue and arrest
    this.arrestTimer = 0;
    for (const f of this.foot) {
      const dx = px - f.x, dz = pz - f.z;
      const d = Math.hypot(dx, dz);
      nearestDist = Math.min(nearestDist, d);
      if (d > 0.5) {
        f.x += (dx / d) * f.speed * dt;
        f.z += (dz / d) * f.speed * dt;
        f.mesh.rotation.y = Math.atan2(dx, dz);
      }
      f.walkPhase += dt * 9;
      const swing = Math.sin(f.walkPhase) * 0.5;
      f.mesh.userData.legL.rotation.x = swing;
      f.mesh.userData.legR.rotation.x = -swing;
      f.mesh.position.set(f.x, 0, f.z);
      if (d < 2.2) this.arrestTimer += dt;
    }
    if (this.arrestTimer > 1.6 && !this.busted) this.busted = true;

    // --- wanted decay: hidden when the nearest police is far / line of sight broken ---
    if (this.wanted > 0) {
      if (nearestDist > 70) {
        this.hiddenTimer += dt;
        this.decayTimer += dt;
        if (this.decayTimer > 8) {
          this.wanted = Math.max(0, this.wanted - 1);
          this.decayTimer = 0;
        }
      } else {
        this.hiddenTimer = 0;
        this.decayTimer = 0;
      }
    }
  }
}

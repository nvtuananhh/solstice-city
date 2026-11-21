// Police: car chases with ramming, foot police pursuit + arrest, helicopter
// at wanted 4-5 with a searchlight, roadblocks at wanted 3+. Wanted decays
// when the nearest police is far for a while (faster with district standing).
const THREE = window.THREE;
import { Car } from './vehicles.js';

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];        // police Car objects
    this.foot = [];        // foot officers {mesh,x,z,arrestTimer}
    this.heli = null;      // {mesh, rotor, light}
    this.roadblocks = [];  // {cars:[Car,Car], x, z, heading, timer}
    this.spawnTimer = 0;
    this.decayTimer = 0;
    this.hiddenTimer = 0;
  }

  _spawnPosNear(px, pz, dist) {
    const a = this.rng.range(0, Math.PI * 2);
    let x = px + Math.cos(a) * dist;
    let z = pz + Math.sin(a) * dist;
    x = Math.max(-280, Math.min(280, x));
    z = Math.max(-280, Math.min(280, z));
    return { x, z };
  }

  _makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.6, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x20242a }));
    body.castShadow = true; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x20242a }));
    tail.position.set(-3.8, 0.3, 0); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.1; g.add(rotor);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.9),
      new THREE.MeshLambertMaterial({ color: 0x2a4a6a }));
    glass.position.set(2, 0.1, 0); g.add(glass);
    const light = new THREE.SpotLight(0xfff2b0, 3, 90, 0.35, 0.5, 1);
    light.position.set(0, -0.8, 0);
    const target = new THREE.Object3D();
    target.position.set(0, -30, 0);
    g.add(target);
    light.target = target;
    g.add(light);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 })));
    return { mesh: g, rotor, light };
  }

  update(dt, wanted, player, playerCar, decayFactor = 1) {
    const px = player.x, pz = player.z;
    const inCar = !!playerCar;

    // --- spawn / despawn police cars ---
    const wantCars = wanted === 0 ? 0 : Math.min(1 + wanted, 6);
    this.spawnTimer -= dt;
    if (this.cars.length < wantCars && this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      const p = this._spawnPosNear(px, pz, 55);
      const car = new Car('police', p.x, p.z, this.rng.range(0, Math.PI * 2), this.rng);
      car.driver = 'police';
      this.scene.add(car.mesh);
      this.cars.push(car);
    }
    if (wanted === 0) {
      for (const c of this.cars) this.scene.remove(c.mesh);
      this.cars.length = 0;
      for (const f of this.foot) this.scene.remove(f.mesh);
      this.foot.length = 0;
      if (this.heli) { this.scene.remove(this.heli.mesh); this.heli = null; }
      for (const rb of this.roadblocks) for (const c of rb.cars) this.scene.remove(c.mesh);
      this.roadblocks.length = 0;
    }

    // --- police cars chase + ram ---
    for (const car of this.cars) {
      const dx = px - car.x, dz = pz - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(-dz, dx);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.5));
      const throttle = dist > 6 ? 1 : 0.3;
      car.drive(dt, steer, throttle, false, false);
      [car.x, car.z] = this.city.collide(car.x, car.z, 1.2, 2);
      car.mesh.position.set(car.x, 0, car.z);
      // Ram the player car: shove + damage on contact.
      if (playerCar && dist < 4.5) {
        playerCar.damage(6 * dt * 10);
        playerCar.speed *= (1 - 0.4 * dt);
        const push = 3 * dt;
        playerCar.x += (dx / (dist || 1)) * push * -1;
        playerCar.z += (dz / (dist || 1)) * push * -1;
      }
      // Ram the player on foot: knock + hurt.
      if (!inCar && dist < 2.2) {
        player.health -= 18 * dt;
        player.x += (dx / (dist || 1)) * -6 * dt;
        player.z += (dz / (dist || 1)) * -6 * dt;
      }
    }

    // --- foot police when the player is on foot and wanted ---
    if (!inCar && wanted > 0 && this.foot.length < Math.min(wanted, 3)) {
      if (this.rng.chance(dt * 0.5)) {
        const p = this._spawnPosNear(px, pz, 30);
        const mesh = this._makeOfficer();
        mesh.position.set(p.x, 0, p.z);
        this.scene.add(mesh);
        this.foot.push({ mesh, x: p.x, z: p.z, arrestTimer: 0 });
      }
    }
    for (const f of this.foot) {
      const dx = px - f.x, dz = pz - f.z;
      const dist = Math.hypot(dx, dz);
      const heading = Math.atan2(-dz, dx);
      const speed = 4.6;
      f.x += Math.cos(heading) * speed * dt;
      f.z += -Math.sin(heading) * speed * dt;
      f.mesh.position.set(f.x, 0, f.z);
      f.mesh.rotation.y = -heading;
      if (dist < 2.0) {
        f.arrestTimer += dt;
        if (f.arrestTimer > 3) {
          player.busted = true;
          f.arrestTimer = 0;
        }
      } else f.arrestTimer = 0;
    }

    // --- helicopter at wanted 4-5 ---
    if (wanted >= 4) {
      if (!this.heli) {
        this.heli = this._makeHeli();
        this.scene.add(this.heli.mesh);
      }
      const h = this.heli;
      h.mesh.position.set(px + 6, 42, pz + 6);
      h.mesh.rotation.y += dt * 0.4;
      h.rotor.rotation.y += dt * 22;
      h.light.target.position.set(px - h.mesh.position.x, -42, pz - h.mesh.position.z);
      h.light.target.updateMatrixWorld();
    } else if (this.heli) {
      this.scene.remove(this.heli.mesh);
      this.heli = null;
    }

    // --- roadblocks at wanted 3+ ---
    if (wanted >= 3 && this.roadblocks.length === 0) {
      this._placeRoadblock(px, pz, playerCar ? playerCar.heading : player.heading);
    }
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      rb.timer -= dt;
      // Re-place ahead of the player every 12 s so the block stays relevant.
      if (rb.timer <= 0) {
        for (const c of rb.cars) this.scene.remove(c.mesh);
        this.roadblocks.splice(i, 1);
        if (wanted >= 3) this._placeRoadblock(px, pz, playerCar ? playerCar.heading : player.heading);
      }
    }

    // --- wanted decay when hidden (no police near); standing speeds it up ---
    const nearest = this.nearestPoliceDist(px, pz);
    if (wanted > 0 && nearest > 85) {
      this.hiddenTimer += dt * decayFactor;
      if (this.hiddenTimer > 8) {
        this.hiddenTimer = 0;
        return 'decay'; // world lowers wanted by one star
      }
    } else this.hiddenTimer = 0;
    return null;
  }

  _placeRoadblock(px, pz, heading) {
    const fx = Math.cos(heading), fz = -Math.sin(heading);
    const cx = px + fx * 45, cz = pz + fz * 45;
    const cars = [];
    for (const side of [-3.4, 3.4]) {
      const car = new Car('police', cx - fz * side, cz + fx * side, heading + Math.PI / 2, this.rng);
      car.driver = 'police';
      this.scene.add(car.mesh);
      cars.push(car);
    }
    this.roadblocks.push({ cars, x: cx, z: cz, heading, timer: 12 });
  }

  _makeOfficer() {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x20242a }));
    torso.position.y = 1.15; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xd8a078 }));
    head.position.y = 1.85; g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x101418 }));
    cap.position.y = 2.1; g.add(cap);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x20242a }));
    legs.position.y = 0.4; g.add(legs);
    return g;
  }

  nearestPoliceDist(x, z) {
    let best = 1e9;
    for (const c of this.cars) best = Math.min(best, Math.hypot(c.x - x, c.z - z));
    for (const f of this.foot) best = Math.min(best, Math.hypot(f.x - x, f.z - z));
    return best;
  }

  clearAll() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars.length = 0;
    for (const f of this.foot) this.scene.remove(f.mesh);
    this.foot.length = 0;
    if (this.heli) { this.scene.remove(this.heli.mesh); this.heli = null; }
    for (const rb of this.roadblocks) for (const c of rb.cars) this.scene.remove(c.mesh);
    this.roadblocks.length = 0;
  }
}

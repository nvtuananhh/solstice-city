// Pedestrians: ~40 walkers on sidewalks. Each has a waypoint route between
// seeded sidewalk points, a walk speed and a shirt colour (never orange —
// orange is Dana's). They scatter from gunfire and crashes, cross at
// crossings, and some are taxi customers (raised hand + fare icon).
const THREE = window.THREE;

const SHIRT_COLORS = [0x3a6ab0, 0x9ab03a, 0xd8d8d8, 0x6a6a72, 0xb02030, 0x7a4a9a, 0x2a8a8a, 0xc9a86a];

export class Pedestrians {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    for (let i = 0; i < 40; i++) this.peds.push(this._makePed());
  }

  _makePed() {
    const g = new THREE.Group();
    const shirt = this.rng.pick(SHIRT_COLORS);
    const skin = this.rng.pick([0xd8a078, 0xb07850, 0x8a5a3a, 0xe8c098]);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4),
      new THREE.MeshLambertMaterial({ color: shirt }));
    torso.position.y = 1.15; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: skin }));
    head.position.y = 1.85; g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
    legs.position.y = 0.4; g.add(legs);
    // raised hand for taxi customers
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18),
      new THREE.MeshLambertMaterial({ color: skin }));
    arm.position.set(0.45, 1.5, 0); g.add(arm);
    arm.visible = false;
    const x = this.rng.range(-270, 270);
    const z = this.rng.range(-270, 270);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const ped = {
      mesh: g, arm, x, z,
      heading: this.rng.range(0, Math.PI * 2),
      speed: this.rng.range(1.2, 2.4),
      target: null,
      scatter: 0,
      taxi: false,
      fare: null,
    };
    ped.target = this._sidewalkPoint(ped);
    return ped;
  }

  _sidewalkPoint(ped) {
    // A point on a sidewalk: near a street line, offset 7-9 from its centre.
    const line = this.rng.int(-4, 4) * 60;
    const along = this.rng.range(-270, 270);
    const off = this.rng.pick([-8.5, 8.5]);
    return this.rng.chance(0.5) ? { x: along, z: line + off } : { x: line + off, z: along };
  }

  update(dt, gunfirePos, crashPos) {
    for (const p of this.peds) {
      if (gunfirePos && Math.hypot(p.x - gunfirePos.x, p.z - gunfirePos.z) < 25) { p.scatter = 3; p.fleeFrom = gunfirePos; }
      if (crashPos && Math.hypot(p.x - crashPos.x, p.z - crashPos.z) < 12) { p.scatter = 2; p.fleeFrom = crashPos; }
      let tx, tz, speed = p.speed;
      if (p.scatter > 0) {
        p.scatter -= dt;
        // Run away from the disturbance, along the sidewalk direction.
        const from = p.fleeFrom || { x: p.x, z: p.z };
        const dx = p.x - from.x;
        const dz = p.z - from.z;
        const len = Math.hypot(dx, dz) || 1;
        tx = p.x + (dx / len) * 10; tz = p.z + (dz / len) * 10;
        speed = 5.5;
      } else {
        tx = p.target.x; tz = p.target.z;
        if (Math.hypot(tx - p.x, tz - p.z) < 2) p.target = this._sidewalkPoint(p);
      }
      const dx = tx - p.x, dz = tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        const want = Math.atan2(-dz, dx);
        let dh = want - p.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        p.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
        const step = Math.min(dist, speed * dt);
        p.x += Math.cos(p.heading) * step;
        p.z += -Math.sin(p.heading) * step;
        // crude building avoidance: slide along the block edge
        [p.x, p.z] = this.city.collide(p.x, p.z, 0.4, 2);
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = -p.heading;
      // walk bob
      p.mesh.position.y = Math.abs(Math.sin(p.x * 2 + p.z * 2)) * 0.05;
    }
  }

  // Nearest pedestrian to a point (taxi pickup / melee target).
  nearest(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const p of this.peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // Mark a pedestrian as a taxi customer with a fare destination.
  makeCustomer(ped, dest) {
    ped.taxi = true;
    ped.fare = dest;
    ped.arm.visible = true;
  }

  clearCustomer(ped) {
    ped.taxi = false;
    ped.fare = null;
    ped.arm.visible = false;
  }
}

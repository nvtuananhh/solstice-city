// Traffic: ~24 cars following the road grid. Each car picks a lane (a street
// line + direction + side offset), drives to the next intersection, then the
// seeded RNG picks a turn. Cars brake for the car ahead and for the player.
// All decisions come from the seeded RNG.
import { Car } from './vehicles.js';
import { CITY } from './config.js';

const TRAFFIC_TYPES = ['sedan', 'hatch', 'van', 'taxi', 'sedan', 'hatch', 'pickup'];

export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    for (let i = 0; i < 24; i++) this.spawnCar(true);
  }

  _lanePos() {
    // A lane is a street line (multiple of 60) plus a side offset.
    const line = this.rng.int(-4, 4) * 60;
    const along = this.rng.range(-280, 280);
    const side = this.rng.pick([-2.8, 2.8]);
    const horizontal = this.rng.chance(0.5);
    return horizontal
      ? { x: along, z: line + side, heading: side > 0 ? 0 : Math.PI, horizontal: true, line }
      : { x: line + side, z: along, heading: side > 0 ? -Math.PI / 2 : Math.PI / 2, horizontal: false, line };
  }

  spawnCar(anywhere) {
    const type = this.rng.pick(TRAFFIC_TYPES);
    const p = this._lanePos();
    const color = [0x3a6ab0, 0x9ab03a, 0xd8d8d8, 0xb02030, 0x6a6a72, 0xc9a86a][this.rng.int(0, 5)];
    const car = new Car(type, p.x, p.z, p.heading, this.rng, color);
    car.driver = 'traffic';
    car.horizontal = p.horizontal;
    car.line = p.line;
    car.cruise = this.rng.range(9, 16);
    car.nextTurn = this.rng.int(-4, 4) * 60;
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  update(dt, playerCar, playerPos) {
    for (const car of this.cars) {
      if (car.wrecked) continue;
      // Are we near the next intersection? Then pick a turn.
      const along = car.horizontal ? car.x : car.z;
      if (Math.abs(along - car.nextTurn) < 2.5) {
        this._turn(car);
      }
      // Brake for the car ahead (same lane, close) and for the player car.
      let want = car.cruise;
      for (const other of this.cars) {
        if (other === car || other.wrecked) continue;
        if (other.horizontal !== car.horizontal || Math.abs(other.line - car.line) > 3) continue;
        const d = this._aheadDist(car, other);
        if (d > 0 && d < 12) { want = Math.min(want, Math.max(0, (d - 6) * 1.2)); }
      }
      if (playerCar && playerCar !== car) {
        const d = this._aheadDist(car, playerCar);
        if (d > 0 && d < 11) want = Math.min(want, Math.max(0, (d - 5) * 1.2));
      }
      // Simple speed control toward the wanted speed.
      const fx = Math.cos(car.heading), fz = -Math.sin(car.heading);
      const target = want;
      car.speed += (target - car.speed) * Math.min(1, 2.5 * dt);
      car.x += fx * car.speed * dt;
      car.z += fz * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = -car.heading;
      const spin = (car.speed * dt) / 0.38;
      for (const w of car.mesh.userData.wheels) w.rotation.z -= spin;
      // Respawn far away when it leaves the city.
      if (Math.abs(car.x) > 295 || Math.abs(car.z) > 295) {
        this.scene.remove(car.mesh);
        const idx = this.cars.indexOf(car);
        this.cars.splice(idx, 1);
        this.spawnCar(true);
      }
    }
  }

  _aheadDist(car, other) {
    const fx = Math.cos(car.heading), fz = -Math.sin(car.heading);
    const dx = other.x - car.x, dz = other.z - car.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * -fz + dz * fx);
    return side < 2.5 ? along : -1;
  }

  _turn(car) {
    // At an intersection: 60% straight, 20% left, 20% right (seeded).
    // Headings: 0 = +x, PI/2 = -z, PI = -x, -PI/2 = +z. Right-hand traffic:
    // a car travelling +x or -z rides at +2.8 from its street line, else -2.8.
    const inter = car.nextTurn; // grid-line coordinate of this intersection
    const roll = this.rng.next();
    const norm = (h) => { h = h % (Math.PI * 2); if (h < 0) h += Math.PI * 2; return h; };
    const stepFor = (heading, horizontal) => horizontal
      ? (Math.cos(heading) > 0 ? 60 : -60)
      : (Math.sin(heading) < 0 ? 60 : -60);
    const outOfBounds = (v) => Math.abs(v) > 270;
    if (roll < 0.6 && !outOfBounds(inter + stepFor(car.heading, car.horizontal))) {
      // Straight on: the next intersection is one block further.
      car.nextTurn = inter + stepFor(car.heading, car.horizontal);
      return;
    }
    // Turn (or forced turn at the city edge): pick left/right from the roll.
    const left = roll < 0.8 || roll < 0.6;
    const newHeading = norm(car.heading + (left ? 1 : -1) * Math.PI / 2);
    const side = (newHeading === 0 || newHeading === Math.PI / 2) ? 2.8 : -2.8;
    const oldLine = car.line;
    if (car.horizontal) {
      // Was moving along x on street z=oldLine; now moves along z on street x=inter.
      car.horizontal = false;
      car.line = inter;
      car.x = inter + side;
      car.z = oldLine; // z is the new along-coordinate; snap to the street line
      car.nextTurn = oldLine + stepFor(newHeading, false);
    } else {
      // Was moving along z on street x=oldLine; now moves along x on street z=inter.
      car.horizontal = true;
      car.line = inter;
      car.z = inter + side;
      car.x = oldLine;
      car.nextTurn = oldLine + stepFor(newHeading, true);
    }
    car.heading = newHeading;
    if (outOfBounds(car.nextTurn)) car.nextTurn = Math.sign(car.nextTurn) * 240;
  }

  // Nearest traffic car to a point (for carjacking / collisions).
  nearest(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
}

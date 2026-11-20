// Traffic: cars that follow the road grid. Each car drives along one axis on a
// road line, picks a new direction at intersections from the seeded RNG, and
// brakes for the car ahead or the player. All decisions use the shared RNG.

import { CFG, CAR_TYPES } from './config.js';
import { Car } from './vehicles.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'coupe', 'pickup', 'truck', 'taxi'];

export class Traffic {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.cars = [];
    const lines = [];
    for (let v = CFG.roadMin; v <= CFG.roadMax; v += CFG.roadSpacing) lines.push(v);
    for (let i = 0; i < CFG.trafficCars; i++) {
      const type = rng.pick(TRAFFIC_TYPES);
      const axis = rng.chance(0.5) ? 'x' : 'z';
      const line = rng.pick(lines);
      const along = rng.range(-300, 300);
      const lane = rng.chance(0.5) ? 3.5 : -3.5;
      const car = new Car(type, axis === 'x' ? along : line + lane, axis === 'x' ? line + lane : along, 0);
      car.speed = rng.range(8, 14);
      car.cruise = car.speed;
      car.axis = axis;
      car.line = line;
      car.lane = lane;
      car.dir = rng.chance(0.5) ? 1 : -1;
      car.angle = axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.mesh.position.set(car.pos.x, 0, car.pos.z);
      car.mesh.rotation.y = car.angle;
      scene.add(car.mesh);
      this.cars.push(car);
    }
  }

  update(dt, playerPos, playerInCar) {
    for (const car of this.cars) {
      // brake if something is ahead within 14 units
      let blocked = false;
      const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x, dz = other.pos.z - car.pos.z;
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 15 && side < 3.4) { blocked = true; break; }
      }
      if (!blocked && playerPos) {
        const dx = playerPos.x - car.pos.x, dz = playerPos.z - car.pos.z;
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 13 && side < 3.2) blocked = true;
      }
      const want = blocked ? 0 : car.cruise;
      if (car.speed < want) car.speed = Math.min(want, car.speed + 10 * dt);
      else if (car.speed > want) car.speed = Math.max(want, car.speed - 22 * dt);
      car.pos.x += fx * car.speed * dt;
      car.pos.z += fz * car.speed * dt;
      car.mesh.position.set(car.pos.x, 0, car.pos.z);
      car.mesh.rotation.y = car.angle;
      // at an intersection, maybe turn (seeded)
      const along = car.axis === 'x' ? car.pos.x : car.pos.z;
      const nearestLine = Math.round((along - CFG.roadMin) / CFG.roadSpacing) * CFG.roadSpacing + CFG.roadMin;
      if (Math.abs(along - nearestLine) < 0.6 && car.speed > 2) {
        if (this.rng.chance(0.12)) this.turn(car, nearestLine);
      }
      // wrap around the city edge
      const a = car.axis === 'x' ? car.pos.x : car.pos.z;
      if (a > 330) { if (car.axis === 'x') car.pos.x = -330; else car.pos.z = -330; }
      if (a < -330) { if (car.axis === 'x') car.pos.x = 330; else car.pos.z = 330; }
    }
  }

  turn(car, atLine) {
    // switch axis at this intersection, keeping the lane offset
    const newAxis = car.axis === 'x' ? 'z' : 'x';
    const newDir = this.rng.chance(0.5) ? 1 : -1;
    const lane = this.rng.chance(0.5) ? 3.5 : -3.5;
    if (newAxis === 'x') {
      car.pos.z = atLine + lane;
      car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.pos.x = atLine + lane;
      car.angle = newDir > 0 ? 0 : Math.PI;
    }
    car.axis = newAxis;
    car.dir = newDir;
    car.line = atLine;
    car.lane = lane;
  }

  // Nearest traffic car to a point (for carjacking).
  nearest(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const c of this.cars) {
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    this.scene.remove(car.mesh);
  }
  addStolenBack(car) {
    // A stolen NPC car re-enters traffic once the player abandons it far away.
    this.cars.push(car);
    this.scene.add(car.mesh);
  }
}

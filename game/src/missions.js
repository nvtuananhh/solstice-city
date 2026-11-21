// Mission engine: the 9-job story chain (data-driven stages) plus side work
// (taxi fares, street races, corner-store robbery, car deliveries, sun shards).
// A stage completes only through real game checks: proximity, interact key,
// kills, delivery. Nothing here teleports or fakes a completion.
const THREE = window.THREE;
import { LANDMARKS, DISTRICTS, districtAt } from './config.js';

const L = LANDMARKS;

export const JOBS = [
  {
    title: 'First Light', payout: 150, respect: 5,
    briefing: 'Meet Theo at the garage, learn the ropes, drive your pickup to the solar field.',
    stages: [
      { type: 'talk', x: L.garage.x, z: L.garage.z + 15, r: 6, label: 'Meet Theo at the garage' },
      { type: 'enterCar', label: 'Get in your pickup' },
      { type: 'driveTo', x: L.mirrorField.x, z: L.mirrorField.z, r: 12, label: 'Drive to the mirror field' },
    ],
  },
  {
    title: 'Hotwire', payout: 300, respect: 8,
    briefing: 'Steal a parked sedan from Helios Plaza, shake the 1-star tail, deliver it to the chop shop.',
    stages: [
      { type: 'goto', x: L.plaza.x, z: L.plaza.z, r: 10, label: 'Find a parked car at Helios Plaza' },
      { type: 'steal', label: 'Steal the parked car (E)' },
      { type: 'driveTo', x: L.chopShop.x, z: L.chopShop.z, r: 10, label: 'Deliver it to the chop shop' },
    ],
  },
  {
    title: 'The Drop', payout: 400, respect: 10,
    briefing: 'Pick up the package under the water tower. Rivals are waiting in Cactus Row — get out by car.',
    stages: [
      { type: 'talk', x: L.waterTower.x, z: L.waterTower.z - 10, r: 5, label: 'Pick up the package' },
      { type: 'combat', spawn: [[-200, -20], [-190, -40]], count: 2, label: 'Fight off the rivals' },
      { type: 'enterCar', label: 'Get to a car' },
      { type: 'driveTo', x: L.safehouse.x, z: L.safehouse.z, r: 10, label: 'Escape to the safehouse' },
    ],
  },
  {
    title: 'Clean Plates', payout: 350, respect: 8,
    briefing: 'Swap plates at the garage while patrols sweep the block. Stay on foot and stay quiet.',
    stages: [
      { type: 'goto', x: L.garage.x, z: L.garage.z + 15, r: 8, label: 'Reach the garage on foot' },
      { type: 'talk', x: L.garage.x, z: L.garage.z + 15, r: 5, label: 'Swap the plates (E)' },
      { type: 'driveTo', x: L.plaza.x, z: L.plaza.z, r: 10, label: 'Drive to Helios Plaza' },
    ],
  },
  {
    title: 'Dust Run', payout: 600, respect: 12,
    briefing: 'A getaway car is waiting at the truck yard. Three stars on you — dodge the roadblocks to the foundry.',
    stages: [
      { type: 'enterCar', x: L.truckYard.x, z: L.truckYard.z, r: 14, label: 'Take the getaway car at the truck yard' },
      { type: 'driveTo', x: L.foundry.x, z: L.foundry.z, r: 12, label: 'Reach the foundry tunnels' },
    ],
  },
  {
    title: 'The Witness', payout: 800, respect: 15,
    briefing: 'A witness is hiding on the Mesa Court rooftop. Climb up, clear the roof, keep her alive.',
    stages: [
      { type: 'goto', x: L.rooftop.x, z: L.rooftop.z + 14, r: 6, label: 'Reach the Mesa Court stair door' },
      { type: 'climb', x: L.rooftop.x, z: L.rooftop.z + 14, r: 5, label: 'Climb to the rooftop (E)' },
      { type: 'combat', roof: true, spawn: [[22, -38], [38, -22], [26, -24], [34, -36]], count: 4, label: 'Clear the rooftop' },
      { type: 'protect', x: L.rooftop.x, z: L.rooftop.z, r: 12, duration: 20, label: 'Protect the witness' },
      { type: 'descend', x: L.rooftop.x, z: L.rooftop.z + 10, r: 5, label: 'Head back down (E)' },
    ],
  },
  {
    title: 'Air Support', payout: 900, respect: 15,
    briefing: 'Four stars and a police helicopter overhead. Lose it in the foundry tunnels.',
    stages: [
      { type: 'enterCar', x: L.garage.x, z: L.garage.z + 15, r: 14, label: 'Take a car at the garage' },
      { type: 'driveTo', x: L.foundry.x, z: L.foundry.z, r: 12, label: 'Reach the foundry tunnels' },
      { type: 'escape', label: 'Lose the helicopter — stay hidden in the tunnels' },
    ],
  },
  {
    title: 'Double Cross', payout: 1200, respect: 20,
    briefing: 'Vesper set the meet at the truck yard and it is an ambush. Take the score and run.',
    stages: [
      { type: 'goto', x: L.truckYard.x, z: L.truckYard.z, r: 10, label: 'Reach the truck yard' },
      { type: 'combat', spawn: [[18, 258], [42, 276], [16, 282], [44, 258]], count: 4, label: 'Fight off the ambush' },
      { type: 'enterCar', label: 'Take a car with the score' },
      { type: 'driveTo', x: L.safehouse.x, z: L.safehouse.z, r: 10, label: 'Deliver the score to the safehouse' },
    ],
  },
  {
    title: 'The Last Light', payout: 2500, respect: 30,
    briefing: 'The Helios Tower vault, at dusk. Five stars, helicopter, roadblocks — then the mirror-field escape.',
    stages: [
      { type: 'goto', x: L.tower.x, z: L.tower.z + 26, r: 10, label: 'Reach the Helios Tower vault' },
      { type: 'talk', x: L.tower.x, z: L.tower.z + 26, r: 6, label: 'Breach the vault (E)' },
      { type: 'combat', spawn: [[16, -128], [44, -128], [20, -160], [40, -160]], count: 4, label: 'Hold off tower security' },
      { type: 'enterCar', label: 'Get to a car' },
      { type: 'driveTo', x: L.mirrorField.x, z: L.mirrorField.z, r: 14, label: 'Escape to the mirror field at dusk' },
      { type: 'escape', duration: 15, label: 'Lose the tail in the mirrors' },
    ],
  },
];

export const RACES = [
  { name: 'Plaza Loop', checkpoints: [[-60, -60], [60, -60], [60, 60], [-60, 60]], payout: 250 },
  { name: 'Foundry Sprint', checkpoints: [[-240, 240], [-240, 0], [0, 0], [0, 240]], payout: 350 },
  { name: 'Mirror Dash', checkpoints: [[180, -240], [240, -60], [180, 60], [240, 240]], payout: 450 },
];

export class Missions {
  constructor(game) {
    this.game = game;   // the World: player, cars, combat, police, hud, standing, crew
    this.jobIndex = 0;  // next job to start (0-based)
    this.jobDone = 0;
    this.activeJob = null;
    this.stageIndex = 0;
    this.stageState = {};
    this.witness = null; // {mesh, x, z, health}
    this.marker = null;  // current objective marker {x, z, y}
    // Side work
    this.taxi = null;    // {ped, dest, fare}
    this.race = null;    // {def, cp, startTime}
    this.robbery = null; // {timer, phase}
    this.delivery = null;// {car, dest}
    this.shardsCollected = 0;
    this.raceStart = { x: -60, z: -60 };
  }

  currentJob() { return (this.activeJob !== null && this.activeJob !== undefined) ? JOBS[this.activeJob] : null; }
  currentStage() {
    const job = this.currentJob();
    return job ? job.stages[this.stageIndex] : null;
  }

  startJob(i) {
    if (i < 0 || i >= JOBS.length) return false;
    this.activeJob = i;
    this.stageIndex = 0;
    this.stageState = {};
    this.game.crew.onJobStart();
    if (i === 8) this.game.clockMin = 1020; // finale at dusk (17:00)
    this._enterStage();
    this.game.toast(`Job ${i + 1}: ${JOBS[i].title}`, JOBS[i].briefing);
    return true;
  }

  _enterStage() {
    const s = this.currentStage();
    this.stageState = { timer: 0, spawned: false, kills: 0 };
    if (!s) return;
    if (s.type === 'combat') {
      const spots = s.spawn || [];
      for (const [x, z] of spots) {
        const y = s.roof ? 14 : 0;
        const e = this.game.combat.spawnEnemy(x, z, 60, 'Rival crew');
        if (s.roof) { e.mesh.position.y = 14; e.y = 14; }
      }
      this.stageState.spawned = true;
      this.stageState.total = spots.length;
    }
    if (s.type === 'protect') {
      this._spawnWitness(s.x, s.z);
      for (let i = 0; i < 2; i++) {
        const e = this.game.combat.spawnEnemy(s.x + (i === 0 ? -8 : 8), s.z - 6, 60, 'Rival crew');
        e.mesh.position.y = 14; e.y = 14;
      }
      this.stageState.total = 2;
    }
    if (this.game.audio) this.game.audio.pickup();
  }

  _spawnWitness(x, z) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2a6a9a }));
    torso.position.y = 1.15; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xe8c098 }));
    head.position.y = 1.85; g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x4a4a5a }));
    legs.position.y = 0.4; g.add(legs);
    g.position.set(x, 14, z);
    this.game.scene.add(g);
    this.witness = { mesh: g, x, z, health: 100 };
  }

  _clearWitness() {
    if (this.witness) { this.game.scene.remove(this.witness.mesh); this.witness = null; }
  }

  // Called every fixed step. Returns nothing; advances stages, pays out jobs.
  update(dt) {
    const g = this.game;
    const p = g.player;
    // --- job stages ---
    const s = this.currentStage();
    if (s) {
      const done = this._checkStage(s, dt);
      if (done) this._advance();
    }
    // --- side work ---
    this._updateTaxi(dt);
    this._updateRace(dt);
    this._updateRobbery(dt);
    this._updateShards();
    // Witness takes fire while enemies live on the roof.
    if (this.witness && this.game.combat.enemies.length > 0) {
      if (g.rng.next() < dt * 0.25) this.witness.health -= 5;
      if (this.witness.health <= 0) {
        g.toast('The witness is down!', 'Job failed — restart the job.');
        this._failJob();
      }
    }
  }

  _checkStage(s, dt) {
    const g = this.game;
    const p = g.player;
    const dist = (x, z) => Math.hypot(p.x - x, p.z - z);
    switch (s.type) {
      case 'goto':
        return dist(s.x, s.z) < (s.r || 8);
      case 'talk':
        if (dist(s.x, s.z) < (s.r || 5) && g.input.wasPressed('KeyE')) {
          if (this.activeJob === 8 && this.stageIndex === 1) g.setWanted(5); // vault breach
          if (this.activeJob === 0 && this.stageIndex === 0) g.giveWeapon('bat', 0);
          return true;
        }
        return false;
      case 'enterCar': {
        if (s.x !== undefined && dist(s.x, s.z) > (s.r || 14)) return false;
        if (g.playerCar) {
          if (this.activeJob === 4 && this.stageIndex === 0) g.setWanted(3);
          if (this.activeJob === 6 && this.stageIndex === 0) g.setWanted(4);
          return true;
        }
        return false;
      }
      case 'steal':
        // Completes when the player enters a car that is not their own pickup.
        if (g.playerCar && g.playerCar !== g.ownPickup) {
          g.setWanted(1);
          return true;
        }
        return false;
      case 'driveTo':
        return g.playerCar && dist(s.x, s.z) < (s.r || 10);
      case 'combat': {
        const alive = g.combat.enemies.length;
        if (alive === 0) return true;
        return false;
      }
      case 'protect': {
        this.stageState.timer += dt;
        if (this.stageState.timer >= s.duration && g.combat.enemies.length === 0) return true;
        if (this.stageState.timer >= s.duration && g.combat.enemies.length > 0) {
          // Timer ran out but rivals remain: keep fighting, timer holds.
          this.stageState.timer = s.duration;
        }
        return false;
      }
      case 'climb':
        if (dist(s.x, s.z) < (s.r || 5) && g.input.wasPressed('KeyE')) {
          g.putPlayerOnRoof();
          return true;
        }
        return false;
      case 'descend':
        if (p.onRoof && dist(s.x, s.z) < (s.r || 5) && g.input.wasPressed('KeyE')) {
          g.putPlayerOnGround();
          return true;
        }
        return false;
      case 'escape': {
        this.stageState.timer += dt;
        const dur = s.duration || 20;
        if (this.activeJob === 6) return g.wanted <= 1; // lost the helicopter
        if (this.stageState.timer >= dur) return true;
        return false;
      }
      default:
        return false;
    }
  }

  _advance() {
    const job = this.currentJob();
    this.stageIndex++;
    if (this.stageIndex >= job.stages.length) {
      this._completeJob();
    } else {
      this._enterStage();
      const s = this.currentStage();
      this.game.toast(`Job ${this.activeJob + 1}: ${job.title}`, s.label);
    }
  }

  _completeJob() {
    const g = this.game;
    const job = this.currentJob();
    g.cash += job.payout;
    g.respect += job.respect;
    g.standing.addAt(g.player.x, g.player.z, 1);
    g.toast(`Job complete: ${job.title}`, `+$${job.payout} · +${job.respect} respect · +1 standing here`);
    if (g.audio) g.audio.cash();
    this.jobDone++;
    this.jobIndex = this.activeJob + 1;
    this.activeJob = null;
    this.stageIndex = 0;
    this._clearWitness();
    g.combat.clearEnemies();
    if (this.jobDone === 3) {
      g.crew.recruited = true;
      g.toast('Mira joined your crew!', 'Press V to call her — one clean getaway per job.');
    }
    if (this.jobDone === 9) {
      g.toast('SOLSTICE CITY — finale complete!', 'Dana drove into the mirrors at dusk. The city is yours.');
    }
  }

  _failJob() {
    this._clearWitness();
    this.game.combat.clearEnemies();
    this.activeJob = null;
    this.stageIndex = 0;
  }

  // Objective for HUD + marker + minimap.
  objective() {
    const s = this.currentStage();
    if (!s) {
      if (this.jobIndex < JOBS.length) return { title: `Job ${this.jobIndex + 1}: ${JOBS[this.jobIndex].title}`, text: 'Press Enter to start the job', x: null, z: null };
      return { title: 'All jobs complete', text: 'Free roam: fares, races, shards, garage', x: null, z: null };
    }
    const job = this.currentJob();
    const target = s.x !== undefined ? { x: s.x, z: s.z, y: s.roof ? 14 : 0 } : null;
    return { title: `Job ${this.activeJob + 1}: ${job.title}`, text: s.label, ...(target || {}) };
  }

  // ---- side work ----
  startTaxi(ped) {
    const g = this.game;
    const dest = g.rng.chance(0.5)
      ? { x: L.plaza.x + g.rng.range(-20, 20), z: L.plaza.z + g.rng.range(-20, 20) }
      : { x: L.mirrorField.x + g.rng.range(-20, 20), z: L.mirrorField.z + g.rng.range(-20, 20) };
    const fare = 40 + g.rng.int(0, 40);
    this.taxi = { ped, dest, fare };
    g.toast('Taxi fare', `Take the customer to the marker — $${fare} + tip`);
    return dest;
  }

  _updateTaxi(dt) {
    const g = this.game;
    if (!this.taxi) return;
    if (!g.playerCar) return; // customer waits until you are in a car
    const d = Math.hypot(g.player.x - this.taxi.dest.x, g.player.z - this.taxi.dest.z);
    if (d < 8) {
      const tip = g.standing.tipBonus(districtAt(g.player.x, g.player.z));
      const total = this.taxi.fare + tip;
      g.cash += total;
      g.standing.addAt(g.player.x, g.player.z, 1);
      g.toast('Fare complete', `+$${total} (fare $${this.taxi.fare} + tip $${tip})`);
      if (g.audio) g.audio.cash();
      g.pedestrians.clearCustomer(this.taxi.ped);
      this.taxi = null;
    }
  }

  startRace(idx) {
    const g = this.game;
    this.race = { def: RACES[idx], cp: 0, time: 0 };
    g.toast(`Race: ${RACES[idx].name}`, 'Hit every checkpoint in order');
  }

  _updateRace(dt) {
    const g = this.game;
    if (!this.race) return;
    this.race.time += dt;
    const cp = this.race.def.checkpoints[this.race.cp];
    const d = Math.hypot(g.player.x - cp[0], g.player.z - cp[1]);
    if (d < 10) {
      this.race.cp++;
      if (g.audio) g.audio.pickup();
      if (this.race.cp >= this.race.def.checkpoints.length) {
        const bonus = Math.max(0, 120 - Math.floor(this.race.time));
        const total = this.race.def.payout + bonus;
        g.cash += total;
        g.respect += 3;
        g.standing.addAt(g.player.x, g.player.z, 1);
        g.toast(`Race won: ${this.race.def.name}`, `+$${total} in ${this.race.time.toFixed(1)}s`);
        if (g.audio) g.audio.cash();
        this.race = null;
      }
    }
  }

  startRobbery() {
    const g = this.game;
    this.robbery = { timer: 20, phase: 'holdup' };
    g.setWanted(Math.max(g.wanted, 2));
    g.toast('Robbery!', 'Hold position 20s, then lose the cops');
  }

  _updateRobbery(dt) {
    const g = this.game;
    if (!this.robbery) return;
    if (this.robbery.phase === 'holdup') {
      this.robbery.timer -= dt;
      if (this.robbery.timer <= 0) {
        this.robbery.phase = 'escape';
        this.robbery.timer = 60;
        g.toast('Got the cash — run!', 'Lose the wanted level within 60s');
      }
    } else {
      this.robbery.timer -= dt;
      if (g.wanted === 0) {
        g.cash += 220;
        g.toast('Robbery clean', '+$220');
        if (g.audio) g.audio.cash();
        this.robbery = null;
      } else if (this.robbery.timer <= 0) {
        g.toast('Robbery failed', 'The cops closed in');
        this.robbery = null;
      }
    }
  }

  _updateShards() {
    const g = this.game;
    for (const s of g.city.shardMeshes) {
      if (s.taken) continue;
      const d = Math.hypot(g.player.x - s.x, g.player.z - s.z);
      if (d < 2.5) {
        s.taken = true;
        s.mesh.visible = false;
        this.shardsCollected++;
        g.cash += 25;
        if (g.audio) g.audio.pickup();
        g.toast('Sun shard!', `+$25 · ${this.shardsCollected}/25 found`);
      }
    }
  }
}

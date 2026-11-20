// World: the orchestrator. Owns the scene, the player (on foot + in car), the
// fixed-step simulation loop, collisions, interactions, shards, the mission
// marker beacon, busted/wasted flow, and the day clock. Every system gets the
// shared state object S.

import { CFG, LANDMARKS, PRICES, CAR_TYPES } from './config.js';
import { RNG } from './random.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { City, districtAt } from './city.js';
import { Sky } from './render.js';
import { Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians, makePersonMesh } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { stageShot } from './shots.js';

export class World {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts || {};
    this.seed = opts.seed || CFG.seedDefault;
    this.shotMode = opts.shot || null;
    this.rng = new RNG(this.seed);
    this.simTime = 0;
    this.acc = 0;
    this.lastTs = 0;
    this.paused = false;
    this.running = false;
    this.fixedCamera = null;

    // --- shared state S ---
    const S = this.S = {
      rng: this.rng, seed: this.seed, simTime: 0,
      cash: CFG.startCash, respect: 0, health: CFG.playerHealth,
      clock: CFG.clockStart, day: 1, district: 'Mirror Flats',
      shardsCollected: [], ownedCars: ['pickup'], upgrades: { engine: false, brakes: false, nitro: false },
      world: this, audio: null, hud: null, missions: null, combat: null,
      police: null, traffic: null, peds: null, city: null,
      player: null,
    };
    S.audio = this.audio = new AudioSys();
    this.input = new Input(canvas);

    // --- three.js ---
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

    this.city = new City(this.scene, this.rng);
    S.city = this.city;
    this.sky = new Sky(this.scene, this.city);
    this.traffic = new Traffic(this.scene, this.rng, this.city);
    S.traffic = this.traffic;
    this.peds = new Pedestrians(this.scene, this.rng);
    S.peds = this.peds;
    this.police = new Police(this.scene, this.rng, this.city);
    S.police = this.police;
    this.combat = new Combat(this.scene, this.rng, this.audio);
    S.combat = this.combat;
    this.missions = new Missions(S, this.audio);
    S.missions = this.missions;
    this.hud = new HUD(S);
    S.hud = this.hud;

    this.buildPlayer();
    this.buildParkedCars();
    this.buildShards();
    this.buildMarker();

    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 9;
    this.interactTarget = null;
    this.wantedShotCooldown = 0;
    this.regenTimer = 0;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  buildPlayer() {
    const mesh = makePersonMesh(this.rng);
    // Dana: burnt-orange jacket, dark jeans, boots
    mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xc25a1e });
    mesh.children[2].material = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
    this.scene.add(mesh);
    this.S.player = {
      mesh, pos: new THREE.Vector3(CFG.startPos.x, 0, CFG.startPos.z),
      angle: Math.PI * 0.75, vy: 0, onGround: true, inCar: false, car: null,
      walkPhase: 0, crouch: false, damage: (n) => this.damagePlayer(n),
    };
    this.S.player.mesh.position.copy(this.S.player.pos);
  }

  buildParkedCars() {
    this.parked = [];
    const spots = [
      { type: 'pickup', x: -214, z: 200, angle: Math.PI / 2, color: 0xb8642a, jobCar: true },
      { type: 'sedan', x: 228, z: -188, angle: -Math.PI / 2, color: 0x3a6ea5, chopCar: true },
      { type: 'coupe', x: -36, z: 44, angle: 0, color: 0xc22e4a },
      { type: 'sedan', x: 84, z: -36, angle: Math.PI, color: 0x7a8a9a },
      { type: 'pickup', x: -124, z: 124, angle: Math.PI / 2, color: 0x3a7a4a },
      { type: 'truck', x: 204, z: 164, angle: -Math.PI / 2, color: 0x8a8f96 },
      { type: 'sedan', x: 44, z: -124, angle: 0, color: 0xd9c08a },
      { type: 'coupe', x: -204, z: -84, angle: Math.PI, color: 0x5a4a9a },
      { type: 'taxi', x: 124, z: 36, angle: Math.PI / 2, color: 0xe8b400 },
      { type: 'sedan', x: -44, z: 204, angle: -Math.PI / 2, color: 0x2a5c7a },
    ];
    for (const s of spots) {
      const car = new Car(s.type, s.x, s.z, s.angle, s.color);
      car.jobCar = !!s.jobCar;
      car.chopCar = !!s.chopCar;
      car.parked = true;
      car.syncMesh();
      this.scene.add(car.mesh);
      this.parked.push(car);
    }
  }

  buildShards() {
    this.shardMeshes = [];
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    for (let i = 0; i < CFG.shardCount; i++) {
      const x = this.rng.range(-300, 320);
      const z = this.rng.range(-300, 300);
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), mat);
      m.position.set(x, 1.4, z);
      this.scene.add(m);
      this.shardMeshes.push({ id: i, mesh: m, x, z });
    }
  }

  buildMarker() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.4, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
    beam.position.y = 13;
    g.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.35, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
    g.add(ring);
    const pin = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.4, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    pin.rotation.x = Math.PI; pin.position.y = 7;
    g.add(pin);
    g.visible = false;
    this.scene.add(g);
    this.markerMesh = g;
  }

  // ---- game flow ----
  newGame() {
    this.audio.ensure();
    this.hud.hideMenu();
    this.running = true;
    this.paused = false;
    this.missions.startJob(0);
  }
  continueGame() {
    this.audio.ensure();
    if (!this.loadGame()) { this.newGame(); return; }
    this.hud.hideMenu();
    this.running = true;
    this.paused = false;
  }
  resume() { this.hud.hideMenu(); this.paused = false; this.running = true; }
  pause() { if (this.running) { this.paused = true; this.hud.showPause(); } }
  hasSave() { return hasSave(); }
  saveGame() { if (saveGame(this.S)) this.hud.toast('Game saved'); }
  loadGame() {
    const d = loadGame();
    if (!d) { this.hud.toast('No save found'); return false; }
    this.S.cash = d.cash; this.S.respect = d.respect; this.S.health = d.health;
    this.S.clock = d.clock; this.S.day = d.day;
    this.S.shardsCollected = d.shardIds || [];
    this.S.ownedCars = d.ownedCars || ['pickup'];
    this.S.upgrades = d.upgrades || { engine: false, brakes: false, nitro: false };
    const p = this.S.player;
    p.pos.set(d.player.x, 0, d.player.z);
    p.angle = d.player.angle;
    p.inCar = false; p.car = null;
    if (d.weapons) { this.combat.owned = d.weapons.owned; this.combat.ammo = d.weapons.ammo; }
    for (const s of this.shardMeshes) s.mesh.visible = !this.S.shardsCollected.includes(s.id);
    this.missions.jobIndex = d.jobIndex;
    this.missions.stepIndex = 0;
    this.missions.stepSpawned = false;
    this.missions.updateMarker();
    this.hud.toast(`Save loaded — Job ${(d.jobIndex || 0) + 1}`);
    return true;
  }

  damagePlayer(n) {
    if (!this.running || this.paused) return;
    this.S.health = Math.max(0, this.S.health - n);
    this.regenTimer = 0;
    if (this.S.health <= 0) this.wasted();
  }
  wasted() {
    this.S.cash = Math.floor(this.S.cash * 0.85);
    this.police.setWanted(0);
    const h = LANDMARKS.hospital;
    const p = this.S.player;
    p.pos.set(h.x + 14, 0, h.z); p.inCar = false; p.car = null;
    this.S.health = CFG.playerHealth;
    this.hud.banner('WASTED', 'You woke up at the clinic. 15% of your cash is gone.');
  }
  busted() {
    this.S.cash = Math.floor(this.S.cash * 0.9);
    this.police.setWanted(0);
    this.police.busted = false;
    const st = LANDMARKS.policeStation;
    const p = this.S.player;
    p.pos.set(st.x + 14, 0, st.z); p.inCar = false; p.car = null;
    this.S.health = CFG.playerHealth;
    this.hud.banner('BUSTED', 'Precinct 7 let you go. 10% of your cash is gone.');
  }

  buyUpgrade(kind) {
    const S = this.S;
    const price = PRICES[kind];
    if (price === undefined) return;
    if (kind === 'repair') {
      if (S.player.car && S.cash >= price) { S.cash -= price; S.player.car.health = 100; S.hud.toast('Car repaired'); }
      else if (!S.player.car) S.hud.toast('Bring a car to repair it');
      else S.hud.toast('Not enough cash');
      return;
    }
    if (kind === 'repaint') {
      if (S.player.car && S.cash >= price) {
        S.cash -= price;
        S.player.car.mesh.children[0].material.color.setHex(0x3a6ea5 + Math.floor(this.rng.next() * 0x808080));
        S.hud.toast('Repainted');
      } else S.hud.toast('Not enough cash or no car');
      return;
    }
    if (S.upgrades[kind]) { S.hud.toast('Already installed'); return; }
    if (S.cash < price) { S.hud.toast('Not enough cash'); return; }
    S.cash -= price;
    S.upgrades[kind] = true;
    S.hud.toast(`${kind} installed`);
    this.audio.cash();
  }
  buyShop(kind) {
    const S = this.S;
    if (kind === 'health') {
      if (S.cash >= PRICES.healthPack && S.health < 100) { S.cash -= PRICES.healthPack; S.health = Math.min(100, S.health + 50); S.hud.toast('Health +50'); }
      else S.hud.toast('Not enough cash or full health');
    } else if (kind === 'pistol') {
      if (S.cash >= PRICES.pistolAmmo) { S.cash -= PRICES.pistolAmmo; this.combat.giveWeapon(2, 24); S.hud.toast('Pistol ammo +24'); }
      else S.hud.toast('Not enough cash');
    } else if (kind === 'smg') {
      if (S.cash >= PRICES.smgAmmo) { S.cash -= PRICES.smgAmmo; this.combat.giveWeapon(3, 60); S.hud.toast('SMG ammo +60'); }
      else S.hud.toast('Not enough cash');
    } else if (kind === 'bat') {
      if (S.cash >= PRICES.bat) { S.cash -= PRICES.bat; this.combat.giveWeapon(1, Infinity); S.hud.toast('Baseball bat acquired — press 2'); }
      else S.hud.toast('Not enough cash');
    }
  }

  // ---- per fixed step ----
  step(dt) {
    const S = this.S, input = this.input, p = S.player;
    this.simTime += dt;
    S.simTime = this.simTime;
    // day clock
    S.clock += dt * CFG.clockRate;
    if (S.clock >= 24) { S.clock -= 24; S.day++; }
    const dusk = this.sky.update(S.clock, this.simTime);
    S.district = districtAt(p.pos.x, p.pos.z);

    // pause / menus
    if (input.hit('Escape')) {
      if (this.hud.menuMode === 'pause') this.resume();
      else if (this.hud.menuMode === 'garage' || this.hud.menuMode === 'shop') this.showPauseSafe();
      else if (this.running) this.pause();
    }
    if (input.hit('m')) { this.audio.setMuted(!this.audio.muted); }
    if (this.paused || !this.running) { input.endStep(); return; }
    // shot-mode demo keys (e.g. hold W so the car actually drives in the shot)
    if (this.demoKeys) for (const k of this.demoKeys) input.keys.add(k);

    // camera orbit: mouse drag + arrow keys
    this.camYaw -= input.mouseDX * 0.004 * this.hud.sensitivity;
    this.camPitch = Math.max(-0.1, Math.min(0.9, this.camPitch + input.mouseDY * 0.003 * this.hud.sensitivity));
    if (input.down('ArrowLeft')) this.camYaw += dt * 2.2;
    if (input.down('ArrowRight')) this.camYaw -= dt * 2.2;

    // weapon wheel + switching
    if (input.down('q')) S.combat.wheelOpen = true;
    else if (S.combat.wheelOpen) {
      S.combat.wheelOpen = false;
      // pick the slot under the mouse drag direction, else keep current
      if (Math.abs(input.mouseDX) + Math.abs(input.mouseDY) > 4) {
        const ang = Math.atan2(-input.mouseDY, input.mouseDX);
        const idx = ((Math.round(ang / (Math.PI / 2)) % 4) + 4) % 4;
        S.combat.select(idx);
      }
    }
    for (let i = 0; i < 4; i++) {
      if (input.hit(String(i + 1))) { if (S.combat.select(i)) this.audio.click(); }
    }
    if (input.hit('r') && p.inCar) this.hud.toast(`Radio: ${this.audio.cycleStation()}`);

    this.updatePlayer(dt, dusk);
    this.traffic.update(dt, p.pos, p.inCar);
    this.peds.update(dt, this.simTime);
    this.police.update(dt, p, this.city, this.simTime);
    if (this.police.busted) this.busted();
    this.combat.update(dt, p.pos, (n) => this.damagePlayer(n));
    this.missions.update(dt, {
      playerPos: p.pos, inCar: p.inCar, wanted: this.police.wanted,
      stolenCar: this.stolenFlag,
    });
    this.stolenFlag = false;
    this.updateShards(dt);
    this.updateMarkerMesh(dt);
    this.updateInteract(dt);

    // audio
    if (this.audio.ctx) {
      this.audio.engine(p.inCar ? Math.abs(p.car.speed) / 40 : 0, p.inCar);
      this.audio.siren(this.police.wanted >= 1);
      this.audio.radioTick(dt);
    }
    // slow health regen
    this.regenTimer += dt;
    if (this.regenTimer > 8 && S.health > 0 && S.health < 100) S.health = Math.min(100, S.health + dt * 2);

    this.hud.update(dt);
    input.endStep();
  }

  showPauseSafe() { this.hud.showPause(); }

  updatePlayer(dt, dusk) {
    const S = this.S, input = this.input, p = S.player;
    if (p.inCar && p.car) {
      p.car.drive(input, dt, S.upgrades);
      // car collision with buildings
      const c = this.city.collide(p.car.pos.x, p.car.pos.z, 1.8);
      if (c.x !== p.car.pos.x || c.z !== p.car.pos.z) {
        if (Math.abs(p.car.speed) > 8) {
          p.car.damage(4, this.scene);
          this.audio.crash();
          this.peds.scatter(p.car.pos.x, p.car.pos.z, 20);
        }
        p.car.pos.x = c.x; p.car.pos.z = c.z;
        p.car.speed *= 0.4;
        p.car.syncMesh();
      }
      // bump traffic cars
      for (const t of this.traffic.cars) {
        const d = Math.hypot(t.pos.x - p.car.pos.x, t.pos.z - p.car.pos.z);
        if (d < 3.6) {
          p.car.damage(2, this.scene);
          t.speed *= 0.5;
          this.audio.crash();
          this.peds.scatter(p.car.pos.x, p.car.pos.z, 16);
        }
      }
      p.pos.copy(p.car.pos);
      p.angle = p.car.angle;
      if (input.hit('e')) this.exitCar();
      if (input.hit('h')) this.audio.horn();
      return;
    }

    // --- on foot ---
    const speed = CFG.walkSpeed * (input.down('Shift') ? CFG.sprintMult : 1) * (p.crouch ? 0.45 : 1);
    let mx = 0, mz = 0;
    if (input.down('w') || input.down('ArrowUp')) mz += 1;
    if (input.down('s') || input.down('ArrowDown')) mz -= 1;
    if (input.down('a')) mx -= 1;
    if (input.down('d')) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      // movement relative to camera yaw
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      const wx = (mx * cos - mz * sin) * speed;
      const wz = (mx * sin + mz * cos) * speed;
      p.pos.x += wx * dt;
      p.pos.z += wz * dt;
      p.angle = Math.atan2(wx, wz);
      p.walkPhase += dt * speed * 1.6;
    }
    // jump
    if (input.hit(' ') && p.onGround) { p.vy = CFG.jumpVel; p.onGround = false; }
    if (!p.onGround) {
      p.vy -= CFG.gravity * dt;
      p.pos.y += p.vy * dt;
      if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.onGround = true; }
    }
    p.crouch = input.down('c');
    // building collision
    const c = this.city.collide(p.pos.x, p.pos.z, CFG.playerRadius);
    p.pos.x = c.x; p.pos.z = c.z;
    // keep inside the world
    p.pos.x = Math.max(-860, Math.min(860, p.pos.x));
    p.pos.z = Math.max(-860, Math.min(860, p.pos.z));
    // walk animation
    const swing = len > 0 ? Math.sin(p.walkPhase) * 0.55 : 0;
    p.mesh.userData.legL.rotation.x = swing;
    p.mesh.userData.legR.rotation.x = -swing;
    p.mesh.userData.armL.rotation.x = -swing * 0.7;
    p.mesh.userData.armR.rotation.x = swing * 0.7;
    p.mesh.position.set(p.pos.x, p.pos.y, p.pos.z);
    p.mesh.rotation.y = p.angle;
    p.mesh.scale.y = p.crouch ? 0.72 : 1;

    // melee
    if (input.hit('f')) {
      if (this.combat.current <= 1) {
        this.combat.melee(p.pos, p.angle, null);
        // assault a nearby pedestrian
        let nearest = null, bd = 2.4;
        for (const ped of this.peds.list) {
          const d = Math.hypot(ped.x - p.pos.x, ped.z - p.pos.z);
          if (d < bd) { bd = d; nearest = ped; }
        }
        if (nearest && this.combat.enemies.length === 0) {
          this.peds.scatter(p.pos.x, p.pos.z, 30);
          this.police.addWanted(1, 'assault');
          this.hud.toast('Assault! Wanted +1');
        }
      } else {
        this.hud.toast('Switch to fists or bat (1/2) to melee');
      }
    }
    // ranged fire (click or R on foot)
    if ((input.hit('r') && !p.inCar) || input.mouseDX === 9999) {
      if (this.combat.current >= 2) {
        const fired = this.combat.fire(this.camera, p.pos, null);
        if (fired) {
          this.peds.scatter(p.pos.x, p.pos.z, 40);
          if (this.wantedShotCooldown <= 0) { this.police.addWanted(1, 'gunfire'); this.wantedShotCooldown = 5; }
        }
      }
    }
    if (this.wantedShotCooldown > 0) this.wantedShotCooldown -= dt;
    if (input.hit('e')) this.tryInteract();
    // mouse click fires (tracked via a synthetic flag set by the canvas listener)
    if (this.clickQueued) {
      this.clickQueued = false;
      if (this.combat.current >= 2) {
        const fired = this.combat.fire(this.camera, p.pos, null);
        if (fired) {
          this.peds.scatter(p.pos.x, p.pos.z, 40);
          if (this.wantedShotCooldown <= 0) { this.police.addWanted(1, 'gunfire'); this.wantedShotCooldown = 5; }
        }
      }
    }
  }

  tryInteract() {
    const S = this.S, p = S.player;
    // 1. parked car nearby?
    let best = null, bd = 5;
    for (const car of this.parked) {
      const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
      if (d < bd) { bd = d; best = car; }
    }
    if (best) { this.enterCar(best, false); return; }
    // 2. traffic car nearby (carjacking)?
    const npc = this.traffic.nearest(p.pos.x, p.pos.z, 5);
    if (npc) {
      this.traffic.remove(npc);
      // driver flees on foot
      const driver = { mesh: makePersonMesh(this.rng), x: npc.pos.x + 2, z: npc.pos.z, axis: 'x', dir: 1, speed: 3.4, walkPhase: 0, panic: 4, fleeAngle: Math.atan2(2, 1), waiting: false, taxi: false };
      driver.mesh.position.set(driver.x, 0, driver.z);
      this.scene.add(driver.mesh);
      this.peds.list.push(driver);
      this.enterCar(npc, true);
      return;
    }
    // 3. taxi customer?
    const cust = this.peds.nearestWaiting(p.pos.x, p.pos.z, 4);
    if (cust && !this.missions.taxi) {
      this.peds.remove(cust);
      const dest = { x: this.rng.range(-260, 260), z: this.rng.range(-260, 260) };
      this.missions.startTaxi(dest, this.rng.int(80, 220));
      return;
    }
    // 4. garage / shop / safehouse
    const d = (L) => Math.hypot(L.x - p.pos.x, L.z - p.pos.z);
    if (d(LANDMARKS.garage) < 14) { this.hud.showGarage(); this.paused = true; return; }
    if (d(LANDMARKS.store) < 10) { this.hud.showShop(); this.paused = true; return; }
    if (d(LANDMARKS.safehouse) < 10) {
      this.saveGame();
      if (this.police.wanted > 0 && S.cash >= 100 * this.police.wanted) {
        S.cash -= 100 * this.police.wanted;
        this.police.setWanted(0);
        this.hud.toast('Safehouse: saved + wanted paid off');
      } else this.hud.toast('Safehouse: game saved');
      return;
    }
    // 5. race / robbery triggers with G are handled in updateInteract
  }

  enterCar(car, stolen) {
    const S = this.S, p = S.player;
    const i = this.parked.indexOf(car);
    if (i >= 0) this.parked.splice(i, 1);
    car.parked = false;
    p.inCar = true;
    p.car = car;
    p.mesh.visible = false;
    if (stolen) {
      this.police.addWanted(1, 'carjacking');
      this.hud.toast('Carjacked! Wanted +1');
      this.stolenFlag = true;
    } else {
      // parked steal: witnessed only if police are close
      let witnessed = false;
      for (const pc of this.police.cars) {
        if (Math.hypot(pc.pos.x - p.pos.x, pc.pos.z - p.pos.z) < 45) witnessed = true;
      }
      if (witnessed) { this.police.addWanted(1, 'theft witnessed'); this.hud.toast('Theft witnessed! Wanted +1'); }
      if (car.chopCar) this.stolenFlag = true;
      if (car.jobCar) this.hud.toast("Theo's pickup — drive it to the Heliostat Sea");
      if (!S.ownedCars.includes(car.type)) S.ownedCars.push(car.type);
    }
    this.audio.engine(0, true);
  }

  exitCar() {
    const S = this.S, p = S.player;
    if (!p.car) return;
    const car = p.car;
    car.speed = 0;
    const fx = Math.sin(car.angle + Math.PI / 2), fz = Math.cos(car.angle + Math.PI / 2);
    p.pos.set(car.pos.x + fx * 2.2, 0, car.pos.z + fz * 2.2);
    p.inCar = false;
    p.car = null;
    p.mesh.visible = true;
    p.mesh.position.copy(p.pos);
    // abandoned car becomes parked again so it can be re-entered
    if (!this.parked.includes(car)) {
      car.parked = true;
      this.parked.push(car);
    }
  }

  updateShards(dt) {
    const S = this.S, p = S.player;
    for (const s of this.shardMeshes) {
      if (!s.mesh.visible) continue;
      s.mesh.rotation.y += dt * 1.5;
      s.mesh.position.y = 1.4 + Math.sin(this.simTime * 2 + s.id) * 0.25;
      const d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z);
      if (d < 2.6) {
        s.mesh.visible = false;
        S.shardsCollected.push(s.id);
        S.cash += 50;
        this.audio.pickup();
        this.hud.toast(`Sun shard ${S.shardsCollected.length}/25 — +$50`);
      }
    }
  }

  updateMarkerMesh(dt) {
    const m = this.missions.marker;
    if (!m) { this.markerMesh.visible = false; return; }
    this.markerMesh.visible = true;
    this.markerMesh.position.set(m.x, 0, m.z);
    this.markerMesh.rotation.y += dt * 0.8;
    this.markerMesh.children[2].position.y = 7 + Math.sin(this.simTime * 3) * 0.8;
  }

  updateInteract(dt) {
    const S = this.S, p = S.player;
    if (p.inCar) { this.hud.setInteract('E — Exit car'); return; }
    const d = (L) => Math.hypot(L.x - p.pos.x, L.z - p.pos.z);
    let label = null;
    for (const car of this.parked) {
      if (Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z) < 5) { label = 'E — Enter car'; break; }
    }
    if (!label && this.traffic.nearest(p.pos.x, p.pos.z, 5)) label = 'E — Jack the car';
    if (!label && this.peds.nearestWaiting(p.pos.x, p.pos.z, 4)) label = 'E — Pick up taxi fare';
    if (!label && d(LANDMARKS.garage) < 14) label = "E — Theo's Auto (garage)";
    if (!label && d(LANDMARKS.store) < 10) label = 'E — Corner Store  •  G — Rob it';
    if (!label && d(LANDMARKS.safehouse) < 10) label = 'E — Safehouse (save / pay off)';
    if (!label && d(LANDMARKS.truckYard) < 16) label = 'G — Start street race';
    this.hud.setInteract(label);
    // G triggers: robbery at the store, race at the truck yard
    if (this.input.hit('g')) {
      if (d(LANDMARKS.store) < 10 && !this.missions.robbery) {
        this.missions.startRobbery(400);
        this.hud.toast('You robbed the store! Lose the cops for 30s.');
      } else if (d(LANDMARKS.truckYard) < 16 && !this.missions.race) {
        this.missions.startRace([
          { x: 120, z: 200 }, { x: -120, z: -120 }, { x: 240, z: -200 },
        ]);
      }
    }
  }

  // ---- camera + render ----
  updateCamera() {
    if (this.fixedCamera) {
      if (this.fixedCamera.follow) {
        // chase the player: offsets are relative to the player position
        const p = this.S.player;
        const o = this.fixedCamera.off, l = this.fixedCamera.lookOff;
        this.camera.position.set(p.pos.x + o[0], o[1], p.pos.z + o[2]);
        this.camera.lookAt(p.pos.x + l[0], l[1], p.pos.z + l[2]);
      } else {
        this.camera.position.set(this.fixedCamera.pos[0], this.fixedCamera.pos[1], this.fixedCamera.pos[2]);
        this.camera.lookAt(this.fixedCamera.look[0], this.fixedCamera.look[1], this.fixedCamera.look[2]);
      }
      return;
    }
    const p = this.S.player;
    const dist = p.inCar ? 13 : 9;
    const height = p.inCar ? 5.2 : 3.6;
    const cx = p.pos.x - Math.sin(this.camYaw) * dist * Math.cos(this.camPitch);
    const cz = p.pos.z - Math.cos(this.camYaw) * dist * Math.cos(this.camPitch);
    const cy = (p.pos.y || 0) + height + Math.sin(this.camPitch) * dist * 0.5;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(p.pos.x, (p.pos.y || 0) + 1.6, p.pos.z);
  }

  render() {
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }

  // ---- main loop ----
  loop(ts) {
    if (this.shotMode) return;
    const dtMs = this.lastTs ? Math.min(100, ts - this.lastTs) : 16.7;
    this.lastTs = ts;
    if (this.running && !this.paused) {
      this.acc += dtMs / 1000;
      let n = 0;
      while (this.acc >= CFG.step && n < 5) {
        this.step(CFG.step);
        this.acc -= CFG.step;
        n++;
      }
      if (n === 5) this.acc = 0;
    }
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  start() {
    // click fires weapons on foot
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.clickQueued = true;
      this.audio.ensure();
    });
    window.addEventListener('keydown', () => this.audio.ensure(), { once: true });
    if (this.shotMode) {
      // deterministic shot: build the scene, run fixed steps, render once.
      this.running = true;
      this.paused = false;
      this.hud.hideMenu();
      stageShot(this.shotMode, this);
      for (let i = 0; i < 240; i++) this.step(CFG.step);
      this.render();
      window.__shotReady = true;
      return;
    }
    this.hud.showTitle();
    this.running = false;
    requestAnimationFrame((t) => this.loop(t));
  }
}

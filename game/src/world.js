// World: the Game object that owns every system and the fixed-step loop.
// Player (Dana), cars, enter/exit + carjacking, garage/shop menus, wanted,
// busted/wasted, save/load, Mira calls, clock, and the __SC debug handle.
const THREE = window.THREE;
import { CITY, LANDMARKS, districtAt, CAR_TYPES } from './config.js';
import { createRng } from './random.js';
import { City } from './city.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Weapons } from './weapons.js';
import { Combat } from './combat.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions, RACES } from './missions.js';
import { Standing } from './standing.js';
import { Crew } from './crew.js';
import { Hud } from './hud.js';
import { Car } from './vehicles.js';
import { saveGame, loadGame } from './save.js';

export const STEP = 1 / 60;

export class World {
  constructor(canvas, seed) {
    this.seed = seed;
    this.rng = createRng(seed);
    this.simTime = 0;
    this.clockMin = 720;   // 12:00 noon
    this.day = 1;
    this.cash = 200;
    this.respect = 0;
    this.wanted = 0;
    this.station = 0;
    this.radioOn = true;
    this.sensitivity = 1;
    this.quality = 'high';
    this.screen = 'title'; // title | play | pause | big | garage | shop
    this.camYaw = Math.PI * 0.75;
    this.camPitch = 0.32;
    this.aiming = false;
    this.busted = false;
    this.wasted = false;
    this.gunfirePos = null;
    this.gunfireTimer = 0;
    this.crashPos = null;

    this.renderer = new Renderer(canvas);
    this.scene = this.renderer.scene;
    this.city = new City(this.scene, this.rng);
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.weapons = new Weapons();
    this.combat = new Combat(this.scene, this.rng);
    this.traffic = new Traffic(this.scene, this.city, this.rng);
    this.pedestrians = new Pedestrians(this.scene, this.city, this.rng);
    this.police = new Police(this.scene, this.city, this.rng);
    this.standing = new Standing();
    this.crew = new Crew();
    this.missions = new Missions(this);
    this.hud = new Hud();
    this.ownedCars = ['pickup'];
    this.upgrades = { engine: 0, brakes: 0, nitro: false };
    this.raceIdx = 0;

    // Dana Reyes, on foot — south of the garage, clear of its walls.
    this.player = {
      x: LANDMARKS.garage.x, z: LANDMARKS.garage.z + 20,
      y: 0, vy: 0, heading: Math.PI * 0.5, health: 100,
      onRoof: false, hurtFlash: 0, walkPhase: 0, busted: false,
    };
    this.playerMesh = this._makeDana();
    this.scene.add(this.playerMesh);
    this.playerCar = null;
    this.ownPickup = null;
    this.parkedCars = [];
    this._spawnOwnPickup();
    this._spawnParkedCars();
    this._makeTaxiCustomers();
    this._makeRaceFlag();
    this._applySaveIfAny();
    this._wireDebug();
  }

  _makeDana() {
    const g = new THREE.Group();
    const orange = new THREE.MeshLambertMaterial({ color: 0xff6a1e });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a078 });
    const hair = new THREE.MeshLambertMaterial({ color: 0x2a1a10 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.42), orange);
    torso.position.y = 1.15; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
    head.position.y = 1.86; g.add(head);
    const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.48), hair);
    hairM.position.y = 2.1; g.add(hairM);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), dark);
    legL.position.set(-0.18, 0.4, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), orange);
    armL.position.set(-0.48, 1.2, 0); g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.48; g.add(armR);
    g.userData = { legL, legR, armL, armR, torso };
    return g;
  }

  _spawnOwnPickup() {
    const car = new Car('pickup', LANDMARKS.garage.x, LANDMARKS.garage.z + 18, Math.PI / 2, this.rng);
    car.driver = 'player-owned';
    this.scene.add(car.mesh);
    this.ownPickup = car;
  }

  _spawnParkedCars() {
    // Parked cars sit just off the roads (8 m from a street centreline).
    const spots = [
      { x: 24, z: 36, type: 'sedan' },           // Helios Plaza (job 2 target)
      { x: 36, z: 24, type: 'hatch' },
      { x: 54, z: 288, type: 'van' },            // truck yard
      { x: -114, z: 132, type: 'sedan' },        // near garage
      { x: -172, z: 24, type: 'hatch' },
      { x: 128, z: -128, type: 'sedan' },
      { x: -52, z: 188, type: 'pickup' },
      { x: 188, z: 128, type: 'sedan' },
      { x: -232, z: -52, type: 'van' },
      { x: 68, z: 128, type: 'hatch' },
    ];
    for (const s of spots) {
      const car = new Car(s.type, s.x, s.z, this.rng.range(0, Math.PI * 2), this.rng);
      car.driver = null;
      this.scene.add(car.mesh);
      this.parkedCars.push(car);
    }
  }

  _makeTaxiCustomers() {
    let made = 0;
    for (const p of this.pedestrians.peds) {
      if (made >= 3) break;
      if (this.rng.chance(0.5)) {
        this.pedestrians.makeCustomer(p, null);
        made++;
      }
    }
  }

  _makeRaceFlag() {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    pole.position.set(-30, 3, -30);
    this.scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 2),
      new THREE.MeshBasicMaterial({ color: 0xffd23c, side: THREE.DoubleSide }));
    flag.position.set(-28.4, 5, -30);
    this.scene.add(flag);
  }

  _applySaveIfAny() {
    // A saved game is only applied when the player picks CONTINUE on the title
    // screen; the world boots fresh otherwise.
    this.savedData = loadGame();
  }

  applySave(data) {
    if (!data) return;
    this.cash = data.cash ?? 200;
    this.respect = data.respect ?? 0;
    this.missions.jobIndex = data.jobIndex ?? 0;
    this.missions.jobDone = data.jobDone ?? 0;
    this.standing.levels = data.standing || new Array(10).fill(0);
    this.crew.recruited = !!data.miraRecruited;
    if (data.player) {
      this.player.x = data.player.x; this.player.z = data.player.z;
      this.player.health = data.player.health ?? 100;
    }
    this.ownedCars = data.ownedCars || ['pickup'];
    this.upgrades = data.upgrades || { engine: 0, brakes: 0, nitro: false };
    this.missions.shardsCollected = data.shards ?? 0;
    this.day = data.day ?? 1;
    this.clockMin = data.clockMin ?? 720;
    this.ownPickup.engine = this.upgrades.engine || 0;
    this.ownPickup.brakes = this.upgrades.brakes || 0;
    this.ownPickup.nitro = !!this.upgrades.nitro;
  }

  save() {
    return saveGame({
      cash: this.cash, respect: this.respect,
      jobIndex: this.missions.jobIndex, jobDone: this.missions.jobDone,
      standing: this.standing.levels, miraRecruited: this.crew.recruited,
      player: this.player, ownedCars: this.ownedCars, upgrades: this.upgrades,
      shards: this.missions.shardsCollected, day: this.day, clockMin: this.clockMin,
    });
  }

  setWanted(n) { this.wanted = Math.max(0, Math.min(5, n)); }
  addWanted(n) { this.setWanted(this.wanted + n); }

  giveWeapon(key, ammo) { this.weapons.give(key, ammo); }

  toast(title, text) { this.hud.toast(title, text); }

  putPlayerOnRoof() {
    this.player.onRoof = true;
    this.player.y = 14;
    this.player.x = LANDMARKS.rooftop.x;
    this.player.z = LANDMARKS.rooftop.z;
    this.toast('Rooftop', 'Mesa Court roof — clear it and protect the witness.');
  }

  putPlayerOnGround() {
    this.player.onRoof = false;
    this.player.y = 0;
    this.player.x = LANDMARKS.rooftop.x;
    this.player.z = LANDMARKS.rooftop.z + 16;
  }

  setQuality(q) {
    this.quality = q;
    this.renderer.setQuality(q);
  }

  // ---------------- fixed step ----------------
  step(dt) {
    this.simTime += dt;
    this.clockMin += dt * 0.5; // 1 game minute per 2 real seconds
    if (this.clockMin >= 1440) { this.clockMin -= 1440; this.day++; }
    // Big-message and pause screens take Enter / Escape.
    if (this.screen === 'big' && this.input.wasPressed('Enter')) {
      this.hud.hideBig();
      this.screen = 'play';
    }
    if (this.screen === 'pause' && this.input.wasPressed('Escape')) {
      this.hud.hidePause();
      this.screen = 'play';
    }
    if (this.screen === 'title') this.camYaw += dt * 0.05; // slow title orbit
    if (this.screen === 'play') {
      this._handleGlobalKeys();
      if (this.screen !== 'play') { this.input.endStep(); return; }
      this._updatePlayer(dt);
      this._updateCar(dt);
      this._updateInteractions(dt);
      this.traffic.update(dt, this.playerCar, this.player);
      this.pedestrians.update(dt, this.gunfirePos, this.crashPos);
      const decay = this.police.update(dt, this.wanted, this.player, this.playerCar,
        this.standing.decayFactor(districtAt(this.player.x, this.player.z)));
      if (decay === 'decay') this.setWanted(this.wanted - 1);
      this.combat.update(dt, this.player);
      this.missions.update(dt);
      this.crew.update(dt);
      this._updateWanted(dt);
      this._updateBustedWasted(dt);
      this._updateVisuals(dt);
      this.audio.update(dt, this.playerCar ? Math.abs(this.playerCar.speed) * 3.6 : 0,
        this.wanted, this.radioOn, this.station);
      if (this.hudEnabled !== false) this.hud.update(dt, this);
    }
    this.renderer.update(dt, this);
    this.renderer.updateCamera(this);
    this.input.endStep();
  }

  _handleGlobalKeys() {
    const inp = this.input;
    if (inp.wasPressed('Escape')) { this._openPause(); return; }
    if (inp.wasPressed('Enter')) {
      if (this.screen === 'big') { this.hud.hideBig(); this.screen = 'play'; return; }
      if (!this.missions.activeJob && this.missions.jobIndex < 9) {
        this.missions.startJob(this.missions.jobIndex);
      }
      return;
    }
    if (inp.wasPressed('KeyR')) {
      this.station = (this.station + 1) % 3;
      this.toast('Radio', this.radioOn ? 'Station: ' + ['K-SOL Desert Rock', 'Cactus FM Latin', 'Talk Radio 88'][this.station] : 'Radio off');
    }
    if (inp.wasPressed('KeyV')) this._callMira();
    if (inp.wasPressed('Digit1')) this.weapons.select(0);
    if (inp.wasPressed('Digit2')) this.weapons.select(1);
    if (inp.wasPressed('Digit3')) this.weapons.select(2);
    if (inp.wasPressed('Digit4')) this.weapons.select(3);
    if (inp.wasPressed('KeyQ')) this.weapons.wheelOpen = !this.weapons.wheelOpen;
    if (this.weapons.wheelOpen && inp.mouseDX !== 0) {
      const idx = this.weapons.wheelPick(inp.mouseDX, inp.mouseDY);
      this.weapons.select(idx);
    }
    if (inp.wasPressed('KeyH') && this.playerCar) this.audio.honk();
  }

  _callMira() {
    const res = this.crew.call();
    if (res === 'not-recruited') { this.toast('Mira', 'She joins your crew after Job 3.'); return; }
    if (res === 'already-called') { this.toast('Mira', 'Already called her this job.'); return; }
    if (this.crew.useCleanGetaway(this.wanted)) {
      this.setWanted(this.wanted - 1);
      this.toast('Mira — clean getaway', 'Wanted level dropped by one. Her GT is on the way.');
    } else {
      this.toast('Mira', 'Her Vesper GT is on the way.');
    }
  }

  _updatePlayer(dt) {
    const p = this.player;
    const inp = this.input;
    if (this.playerCar) return; // driving handled separately
    // Camera orbit from the mouse.
    this.camYaw -= inp.mouseDX * 0.0032 * this.sensitivity;
    this.camPitch = Math.max(-0.15, Math.min(0.9, this.camPitch + inp.mouseDY * 0.0028 * this.sensitivity));
    // WASD relative to the camera.
    let fx = 0, fz = 0;
    const fwdX = Math.cos(this.camYaw), fwdZ = -Math.sin(this.camYaw);
    const rightX = -Math.sin(this.camYaw), rightZ = -Math.cos(this.camYaw);
    if (inp.held('KeyW') || inp.held('ArrowUp')) { fx += fwdX; fz += fwdZ; }
    if (inp.held('KeyS') || inp.held('ArrowDown')) { fx -= fwdX; fz -= fwdZ; }
    if (inp.held('KeyA') || inp.held('ArrowLeft')) { fx += rightX; fz += rightZ; }
    if (inp.held('KeyD') || inp.held('ArrowRight')) { fx -= rightX; fz -= rightZ; }
    const len = Math.hypot(fx, fz);
    const sprint = inp.held('ShiftLeft') || inp.held('ShiftRight');
    const crouch = inp.held('KeyC');
    const speed = crouch ? 1.8 : (sprint ? 6.5 : 3.6);
    if (len > 0) {
      fx /= len; fz /= len;
      p.x += fx * speed * dt;
      p.z += fz * speed * dt;
      p.heading = Math.atan2(-fz, fx);
      p.walkPhase += dt * speed * 1.6;
      if (Math.floor(p.walkPhase * 2) !== Math.floor((p.walkPhase - dt * speed * 1.6) * 2)) this.audio.footstep();
    }
    // Jump + gravity.
    if (inp.wasPressed('Space') && p.y <= 0.01 && !p.onRoof) { p.vy = 7; }
    if (p.y > 0 || p.vy !== 0) {
      p.vy -= 22 * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; }
    }
    if (p.onRoof) {
      p.y = 14;
      // Clamp to the rooftop rectangle (building at 30,-30, 24 x 20).
      p.x = Math.max(20, Math.min(40, p.x));
      p.z = Math.max(-39, Math.min(-21, p.z));
    } else {
      [p.x, p.z] = this.city.collide(p.x, p.z, 0.5, 2);
    }
    // Aiming + firing.
    this.aiming = inp.aimHeld || inp.fireHeld;
    this.weapons.update(dt);
    if (inp.wasPressed('KeyF') || (inp.fireHeld && this.weapons.currentWeapon().key === 'fists')) {
      this._melee();
    }
    if (inp.fireHeld && this.weapons.canFire() && this.weapons.current >= 2) {
      this._shoot();
    }
    if (inp.wasPressed('KeyF') && this.weapons.current >= 2) this._shoot();
    // Mesh pose.
    const m = this.playerMesh;
    m.position.set(p.x, p.y, p.z);
    m.rotation.y = -p.heading;
    const swing = len > 0 ? Math.sin(p.walkPhase * 3) * 0.55 : 0;
    m.userData.legL.rotation.x = swing;
    m.userData.legR.rotation.x = -swing;
    m.userData.armL.rotation.x = this.aiming ? -1.2 : -swing;
    m.userData.armR.rotation.x = this.aiming ? -1.2 : swing;
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  }

  _aimDir() {
    return { x: Math.cos(this.camYaw), z: -Math.sin(this.camYaw) };
  }

  _melee() {
    const w = this.weapons.currentWeapon();
    if (!w || (w.key !== 'fists' && w.key !== 'bat')) return;
    if (!this.weapons.canFire()) return;
    this.weapons.spendAmmo();
    this.audio.punch();
    const targets = [...this.combat.enemies];
    const ped = this.pedestrians.nearest(this.player.x, this.player.z, 3);
    const hits = this.combat.playerMelee(this.player, this.player.heading, w, targets);
    if (hits.length === 0 && ped) {
      // Shoving a pedestrian counts as assault.
      ped.scatter = 2;
      this.addWanted(1);
      this.toast('Assault!', 'The cops noticed that.');
    }
    if (hits.length > 0) this.addWanted(1);
  }

  _shoot() {
    const w = this.weapons.currentWeapon();
    if (!this.weapons.canFire()) return;
    this.weapons.spendAmmo();
    this.audio.gunshot();
    this.gunfirePos = { x: this.player.x, z: this.player.z };
    this.gunfireTimer = 1.5;
    const dir = this._aimDir();
    const from = { x: this.player.x, y: (this.player.onRoof ? 14 : 0) + 1.4, z: this.player.z };
    const targets = this.combat.enemies.filter((e) => Math.abs((e.y || 0) - (this.player.onRoof ? 14 : 0)) < 4);
    const hit = this.combat.playerShoot(from, dir, w, targets);
    if (hit) {
      if (hit.target.health <= 0) this.toast('Rival down', `${hit.target.name} is out.`);
    } else {
      // A stray shot near pedestrians scatters them; shooting at all is a crime.
      const ped = this.pedestrians.nearest(this.player.x + dir.x * 10, this.player.z + dir.z * 10, 8);
      if (ped) ped.scatter = 3;
      if (this.police.nearestPoliceDist(this.player.x, this.player.z) < 60) this.addWanted(1);
      else this.addWanted(1); // gunfire draws a star regardless in this city
    }
  }

  _updateCar(dt) {
    const inp = this.input;
    const car = this.playerCar;
    if (!car) return;
    // Camera orbit.
    this.camYaw -= inp.mouseDX * 0.0032 * this.sensitivity;
    this.camPitch = Math.max(-0.1, Math.min(0.7, this.camPitch + inp.mouseDY * 0.0028 * this.sensitivity));
    let steer = 0;
    if (inp.held('KeyA') || inp.held('ArrowLeft')) steer += 1;
    if (inp.held('KeyD') || inp.held('ArrowRight')) steer -= 1;
    let throttle = 0;
    if (inp.held('KeyW') || inp.held('ArrowUp')) throttle += 1;
    if (inp.held('KeyS') || inp.held('ArrowDown')) throttle -= 1;
    const handbrake = inp.held('Space');
    const nitro = (inp.held('ShiftLeft') || inp.held('ShiftRight')) && car.nitro;
    const prevX = car.x, prevZ = car.z;
    car.drive(dt, steer, throttle, handbrake, nitro);
    [car.x, car.z] = this.city.collide(car.x, car.z, 1.3, 2);
    // Wall hit: scrape speed + damage.
    const moved = Math.hypot(car.x - prevX, car.z - prevZ);
    const expected = Math.abs(car.speed) * dt;
    if (expected > 0.1 && moved < expected * 0.4 && Math.abs(car.speed) > 6) {
      car.damage(4);
      car.speed *= 0.4;
      this.crashPos = { x: car.x, z: car.z };
    }
    // Bump traffic cars.
    for (const t of this.traffic.cars) {
      if (t === car || t.wrecked) continue;
      const d = Math.hypot(t.x - car.x, t.z - car.z);
      if (d < 3.6) {
        const push = (3.6 - d) / 2;
        const nx = (t.x - car.x) / (d || 1), nz = (t.z - car.z) / (d || 1);
        t.x += nx * push; t.z += nz * push;
        car.x -= nx * push; car.z -= nz * push;
        car.damage(2);
        t.damage(3);
        car.speed *= 0.85;
        this.crashPos = { x: car.x, z: car.z };
      }
    }
    // Run over a pedestrian? They scatter, but a hit is a crime.
    const ped = this.pedestrians.nearest(car.x, car.z, 2.2);
    if (ped && Math.abs(car.speed) > 3) {
      ped.scatter = 3;
      this.addWanted(1);
      car.damage(1);
    }
    // Player position follows the car.
    this.player.x = car.x; this.player.z = car.z;
    this.player.heading = car.heading;
    // Damage smoke + wreck.
    if (car.health < 40 && !car.smoke) {
      const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0x666666, transparent: true, opacity: 0.6 }));
      smoke.position.set(0, 1.6, 0);
      car.mesh.add(smoke);
      car.smoke = smoke;
    }
    if (car.smoke) {
      car.smoke.position.y = 1.6 + Math.sin(this.simTime * 6) * 0.3;
      car.smoke.scale.setScalar(1 + Math.sin(this.simTime * 3) * 0.2);
    }
    if (car.wrecked) {
      this.toast('Car wrecked!', 'Get out and find another ride.');
      this._exitCar();
    }
    // Speeding past police adds heat.
    if (Math.abs(car.speed) > 30 && this.police.nearestPoliceDist(car.x, car.z) < 35) {
      this._speedingTimer = (this._speedingTimer || 0) + dt;
      if (this._speedingTimer > 4) { this.addWanted(1); this._speedingTimer = 0; }
    } else this._speedingTimer = 0;
  }

  _updateInteractions(dt) {
    const inp = this.input;
    const p = this.player;
    // Mission interact stages consume E themselves; don't double-handle.
    const stage = this.missions.currentStage();
    if (stage && ['talk', 'climb', 'descend'].includes(stage.type)) {
      const sx = stage.x ?? p.x, sz = stage.z ?? p.z;
      if (Math.hypot(p.x - sx, p.z - sz) < (stage.r || 6)) {
        this.hud.showInteract('Press E — ' + stage.label);
        return;
      }
    }
    if (this.playerCar) {
      // In a car: taxi pickup takes priority over exiting the car.
      const cust = this._nearestTaxiCustomer(6);
      if (cust && !this.missions.taxi) {
        this.hud.showInteract('Press E — pick up fare');
        if (inp.wasPressed('KeyE')) {
          const dest = this.missions.startTaxi(cust);
          this.pedestrians.clearCustomer(cust);
          this._taxiDest = dest;
        }
        return;
      }
      if (inp.wasPressed('KeyE')) {
        this._exitCar();
        return;
      }
      this.hud.hideInteract();
      return;
    }
    // On foot: find the nearest interactable.
    const car = this._nearestEnterableCar(4.5);
    if (car) {
      const label = car.driver === 'traffic' ? 'Press E — jack the car' : (car === this.ownPickup ? 'Press E — get in your pickup' : 'Press E — get in the car');
      this.hud.showInteract(label);
      if (inp.wasPressed('KeyE')) this._enterCar(car);
      return;
    }
    const cust = this._nearestTaxiCustomer(4);
    if (cust && !this.missions.taxi) {
      this.hud.showInteract('Taxi customer — get in a car first');
      return;
    }
    if (Math.hypot(p.x - LANDMARKS.garage.x, p.z - LANDMARKS.garage.z) < 12) {
      this.hud.showInteract("Press E — Theo's Auto (garage)");
      if (inp.wasPressed('KeyE')) this._openGarage();
      return;
    }
    if (Math.hypot(p.x - LANDMARKS.safehouse.x, p.z - LANDMARKS.safehouse.z) < 8) {
      this.hud.showInteract('Press E — Safehouse (save + lay low)');
      if (inp.wasPressed('KeyE')) this._useSafehouse();
      return;
    }
    if (Math.hypot(p.x - LANDMARKS.store.x, p.z - LANDMARKS.store.z) < 8) {
      this.hud.showInteract('Press E — Dune Mart (shop)');
      if (inp.wasPressed('KeyE')) this._openShop();
      return;
    }
    if (Math.hypot(p.x + 30, p.z + 30) < 8) {
      this.hud.showInteract(`Press E — Start race: ${RACES[this.raceIdx].name}`);
      if (inp.wasPressed('KeyE')) {
        this.missions.startRace(this.raceIdx);
        this.raceIdx = (this.raceIdx + 1) % RACES.length;
      }
      return;
    }
    this.hud.hideInteract();
  }

  _nearestEnterableCar(maxDist) {
    let best = null, bd = maxDist;
    const consider = (c) => {
      if (c.wrecked) return;
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d < bd) { bd = d; best = c; }
    };
    for (const c of this.parkedCars) consider(c);
    for (const c of this.traffic.cars) consider(c);
    if (this.ownPickup && this.ownPickup !== this.playerCar) consider(this.ownPickup);
    return best;
  }

  _nearestTaxiCustomer(maxDist) {
    let best = null, bd = maxDist;
    for (const p of this.pedestrians.peds) {
      if (!p.taxi) continue;
      const d = Math.hypot(p.x - this.player.x, p.z - this.player.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  _enterCar(car) {
    if (car.driver === 'traffic') {
      // Jack it: the driver flees, the cops notice if they are near.
      const idx = this.traffic.cars.indexOf(car);
      if (idx >= 0) this.traffic.cars.splice(idx, 1);
      car.driver = 'player';
      this.addWanted(1);
      this.toast('Carjacked!', 'The driver ran — the cops saw that.');
    } else {
      car.driver = 'player';
    }
    this.playerCar = car;
    this.playerMesh.visible = false;
    this.audio.ensure();
  }

  _exitCar() {
    const car = this.playerCar;
    if (!car) return;
    const side = Math.cos(car.heading + Math.PI / 2);
    const sideZ = -Math.sin(car.heading + Math.PI / 2);
    this.player.x = car.x + side * 2.2;
    this.player.z = car.z + sideZ * 2.2;
    this.player.y = 0;
    this.playerCar = null;
    this.playerMesh.visible = true;
    car.driver = car === this.ownPickup ? 'player-owned' : null;
  }

  _openGarage() {
    this.screen = 'garage';
    const car = this.ownPickup;
    const di = districtAt(this.player.x, this.player.z);
    const factor = this.standing.garageFactor(di);
    const rows = [
      { key: 'repair', name: 'Repair (full)', price: Math.round(120 * factor), desc: 'Fix all damage' },
      { key: 'engine', name: `Engine Stage ${this.upgrades.engine}/3`, price: Math.round(450 * factor), desc: '+18% top speed' },
      { key: 'brakes', name: `Brakes Stage ${this.upgrades.brakes}/3`, price: Math.round(300 * factor), desc: '+25% braking' },
      { key: 'nitro', name: this.upgrades.nitro ? 'Nitro Kit (owned)' : 'Nitro Kit', price: Math.round(600 * factor), desc: 'Shift = nitro boost' },
      { key: 'paint', name: 'Repaint', price: Math.round(80 * factor), desc: 'Fresh coat, new colour' },
    ];
    this.hud.screen.style.display = 'flex';
    this.hud.screen.innerHTML = `<h1 style="font-size:40px">THEO'S AUTO</h1>
      <h2>Standing here: ${this.standing.levels[di]}/5 — ${Math.round((1 - factor) * 100)}% discount</h2>
      <p>Cash $${this.cash} · Your pickup: ${Math.round(car.health)}% health</p>
      ${rows.map((r) => `<button data-upg="${r.key}" style="display:block;width:340px">${r.name} — $${r.price}<br><span style="font-size:12px">${r.desc}</span></button>`).join('')}
      <button id="btnGarageClose">CLOSE</button>`;
    this.hud.screen.querySelectorAll('[data-upg]').forEach((b) => {
      b.onclick = () => this._buyUpgrade(b.dataset.upg, factor);
    });
    document.getElementById('btnGarageClose').onclick = () => {
      this.hud.hideTitle();
      this.screen = 'play';
    };
  }

  _buyUpgrade(key, factor) {
    const prices = { repair: 120, engine: 450, brakes: 300, nitro: 600, paint: 80 };
    const price = Math.round(prices[key] * factor);
    if (this.cash < price) { this.toast('Not enough cash', `Need $${price}.`); return; }
    if (key === 'engine' && this.upgrades.engine >= 3) { this.toast('Maxed', 'Engine is already stage 3.'); return; }
    if (key === 'brakes' && this.upgrades.brakes >= 3) { this.toast('Maxed', 'Brakes are already stage 3.'); return; }
    if (key === 'nitro' && this.upgrades.nitro) { this.toast('Owned', 'Nitro kit already fitted.'); return; }
    this.cash -= price;
    const car = this.ownPickup;
    if (key === 'repair') car.health = 100;
    if (key === 'engine') { this.upgrades.engine++; car.engine = this.upgrades.engine; }
    if (key === 'brakes') { this.upgrades.brakes++; car.brakes = this.upgrades.brakes; }
    if (key === 'nitro') { this.upgrades.nitro = true; car.nitro = true; }
    if (key === 'paint') {
      const colors = [0xc96a1e, 0x3a6ab0, 0xb02030, 0x9ab03a, 0x20242a];
      car.color = colors[this.rng.int(0, colors.length - 1)];
      car.mesh.children[0].material.color.setHex(car.color);
    }
    this.audio.cash();
    this._openGarage(); // refresh the menu
  }

  _useSafehouse() {
    const cost = this.wanted * 50;
    if (this.wanted > 0 && this.cash >= cost) {
      this.cash -= cost;
      this.setWanted(0);
      this.toast('Laid low', `Paid off $${cost} — the heat is gone.`);
    } else if (this.wanted > 0) {
      this.toast('Safehouse', `Need $${cost} to pay off ${this.wanted} stars.`);
    }
    this.save();
    this.toast('Game saved', 'Progress saved at the safehouse.');
  }

  _openShop() {
    this.screen = 'shop';
    this.hud.screen.style.display = 'flex';
    this.hud.screen.innerHTML = `<h1 style="font-size:40px">DUNE MART</h1>
      <p>Cash $${this.cash} · Health ${Math.round(this.player.health)}%</p>
      <button data-shop="health" style="display:block;width:340px">Health pack — $30<br><span style="font-size:12px">Restore 50 health</span></button>
      <button data-shop="pistol" style="display:block;width:340px">Pistol — $150<br><span style="font-size:12px">Sidearm + 60 rounds</span></button>
      <button data-shop="smg" style="display:block;width:340px">SMG — $320<br><span style="font-size:12px">Full-auto + 120 rounds</span></button>
      <button data-shop="ammo" style="display:block;width:340px">Ammo box — $40<br><span style="font-size:12px">+60 rounds for your gun</span></button>
      <button data-shop="rob" style="display:block;width:340px;background:#4a1010">ROB THE STORE — $220<br><span style="font-size:12px">Hold up the clerk. Wanted +2.</span></button>
      <button id="btnShopClose">CLOSE</button>`;
    this.hud.screen.querySelectorAll('[data-shop]').forEach((b) => {
      b.onclick = () => this._buyShop(b.dataset.shop);
    });
    document.getElementById('btnShopClose').onclick = () => {
      this.hud.hideTitle();
      this.screen = 'play';
    };
  }

  _buyShop(kind) {
    const prices = { health: 30, pistol: 150, smg: 320, ammo: 40, rob: 0 };
    if (kind === 'rob') {
      this.hud.hideTitle();
      this.screen = 'play';
      this.missions.startRobbery();
      return;
    }
    if (this.cash < prices[kind]) { this.toast('Not enough cash', `Need $${prices[kind]}.`); return; }
    this.cash -= prices[kind];
    if (kind === 'health') this.player.health = Math.min(100, this.player.health + 50);
    if (kind === 'pistol') this.giveWeapon('pistol', 60);
    if (kind === 'smg') this.giveWeapon('smg', 120);
    if (kind === 'ammo') {
      const w = this.weapons.currentWeapon();
      if (w.ammoLeft !== Infinity) w.ammoLeft += 60;
    }
    this.audio.cash();
    this._openShop();
  }

  _updateWanted(dt) {
    // Foundry tunnels break line of sight: decay much faster there.
    const inFoundry = Math.hypot(this.player.x - LANDMARKS.foundry.x, this.player.z - LANDMARKS.foundry.z) < 35;
    if (inFoundry && this.wanted > 0) {
      this._tunnelTimer = (this._tunnelTimer || 0) + dt;
      if (this._tunnelTimer > 3) {
        this._tunnelTimer = 0;
        this.setWanted(this.wanted - 1);
        this.toast('Lost them in the tunnels', `${this.wanted} stars left`);
      }
    } else this._tunnelTimer = 0;
    if (this.gunfireTimer > 0) this.gunfireTimer -= dt;
    else this.gunfirePos = null;
  }

  _updateBustedWasted(dt) {
    const p = this.player;
    if (p.health <= 0 && !this.wasted) {
      this.wasted = true;
      this.cash = Math.floor(this.cash * 0.9);
      this.setWanted(0);
      this.police.clearAll();
      this.hud.showBig('WASTED', 'Dana wakes up at the safehouse, $10% lighter.', '#ff4030');
      this.screen = 'big';
      this._respawn();
      this.wasted = false;
      return;
    }
    if (p.busted) {
      p.busted = false;
      this.cash = Math.floor(this.cash * 0.8);
      this.setWanted(0);
      this.police.clearAll();
      this.hud.showBig('BUSTED', 'The cops took 20% of your cash. Back at the safehouse.', '#3a8aff');
      this.screen = 'big';
      this._respawn();
    }
  }

  _respawn() {
    if (this.playerCar) this._exitCar();
    this.player.x = LANDMARKS.safehouse.x;
    this.player.z = LANDMARKS.safehouse.z;
    this.player.y = 0;
    this.player.onRoof = false;
    this.player.health = 100;
    this.playerMesh.visible = true;
  }

  _updateVisuals(dt) {
    // Mirror glint: emissive pulse driven by sim time (deterministic).
    const glint = 0.5 + 0.5 * Math.sin(this.simTime * 1.3);
    for (const m of this.city.mirrorMats) m.emissive.setRGB(0.1 + glint * 0.25, 0.15 + glint * 0.3, 0.2 + glint * 0.35);
    // Beacon blink.
    if (this.city.beaconMat) {
      this.city.beaconMat.color.setHex(Math.floor(this.simTime * 1.5) % 2 === 0 ? 0xff3020 : 0x801008);
      if (this.city.beaconLight) this.city.beaconLight.intensity = Math.floor(this.simTime * 1.5) % 2 === 0 ? 1.2 : 0.2;
    }
    // Dust devils spin, clouds drift — all sim-time driven.
    for (const d of this.city.dustDevils) d.rotation.y += dt * 1.2;
    for (const c of this.city.clouds) {
      c.position.x += dt * 1.5;
      if (c.position.x > 300) c.position.x = -300;
    }
    // Sun shards bob + spin.
    for (const s of this.city.shardMeshes) {
      if (s.taken) continue;
      s.mesh.rotation.y += dt * 2;
      s.mesh.position.y = 1.4 + Math.sin(this.simTime * 2 + s.x) * 0.3;
    }
    // Streetlights on at dusk.
    const dusk = this.renderer.duskFactor(this.clockMin);
    for (const h of this.city.streetLights) h.material.color.setHex(dusk > 0.3 ? 0xffe9a8 : 0x8a8a8a);
    // Mira's arrival: her GT pulls up near the player.
    if (this.crew.present && !this._miraCar) {
      const car = new Car('sports', this.player.x + 12, this.player.z + 4, this.player.heading, this.rng);
      car.driver = null;
      this.scene.add(car.mesh);
      this.parkedCars.push(car);
      this._miraCar = car;
      this.toast('Mira is here', 'Her Vesper GT is parked nearby — take it.');
    }
    if (!this.crew.present) this._miraCar = null;
  }

  _openPause() {
    this.screen = 'pause';
    this.hud.showPause(this, {
      resume: () => { this.hud.hidePause(); this.screen = 'play'; },
      save: () => { this.save(); this.toast('Saved', 'Game saved.'); },
      load: () => {
        const d = loadGame();
        if (d) { this.applySave(d); this.toast('Loaded', 'Save loaded.'); }
        else this.toast('No save', 'No saved game found.');
      },
      quit: () => {
        this.hud.hidePause();
        this.screen = 'title';
        this.hud.showTitle(() => this._newGame(), () => this._continueGame(), !!loadGame());
      },
    });
  }

  _newGame() {
    this.hud.hideTitle();
    this.screen = 'play';
    this.audio.ensure();
  }

  _continueGame() {
    this.applySave(loadGame());
    this.hud.hideTitle();
    this.screen = 'play';
    this.audio.ensure();
  }

  start() {
    this.hud.showTitle(() => this._newGame(), () => this._continueGame(), !!this.savedData);
  }

  // ---------------- debug handle for the headless test harness ----------------
  _wireDebug() {
    window.__SC = {
      state: () => ({
        screen: this.screen,
        x: this.player.x, z: this.player.z, y: this.player.y,
        heading: this.player.heading,
        health: this.player.health,
        cash: this.cash, respect: this.respect, wanted: this.wanted,
        jobIndex: this.missions.jobIndex, jobDone: this.missions.jobDone,
        activeJob: this.missions.activeJob, stageIndex: this.missions.stageIndex,
        stage: this.missions.currentStage(),
        inCar: !!this.playerCar,
        carType: this.playerCar ? this.playerCar.type : null,
        carHealth: this.playerCar ? this.playerCar.health : null,
        carSpeed: this.playerCar ? this.playerCar.speed : 0,
        enemies: this.combat.enemies.length,
        enemyPos: this.combat.enemies.map((e) => [e.x, e.z, e.health]),
        policeCars: this.police.cars.length,
        heli: !!this.police.heli,
        roadblocks: this.police.roadblocks.length,
        shards: this.missions.shardsCollected,
        mira: this.crew.statusText(),
        clockMin: this.clockMin, day: this.day,
        simTime: this.simTime,
        onRoof: this.player.onRoof,
        taxi: !!this.missions.taxi,
        taxiDest: this.missions.taxi ? this.missions.taxi.dest : null,
        taxiCustomers: this.pedestrians.peds.filter((p) => p.taxi).map((p) => [p.x, p.z]),
        race: !!this.missions.race,
        raceCp: this.missions.race ? this.missions.race.def.checkpoints[this.missions.race.cp] : null,
        raceIdx: this.missions.race ? this.missions.race.cp : 0,
        robbery: !!this.missions.robbery,
        weapons: this.weapons.slots.map((s) => ({ key: s.key, owned: s.owned, ammo: s.ammoLeft })),
        currentWeapon: this.weapons.currentWeapon().key,
        wheelOpen: this.weapons.wheelOpen,
        standing: this.standing.levels.slice(),
        parkedCars: this.parkedCars.filter((c) => !c.wrecked).map((c) => [c.x, c.z, c.type]),
      }),
      warp: (x, z) => {
        this.player.x = x; this.player.z = z;
        if (this.playerCar) { this.playerCar.x = x; this.playerCar.z = z; this.playerCar.mesh.position.set(x, 0, z); }
        this.playerMesh.position.set(x, this.player.y, z);
      },
      aimAt: (x, z) => {
        const dx = x - this.player.x, dz = z - this.player.z;
        this.camYaw = Math.atan2(-dz, dx);
      },
      press: (code, down) => this.input.inject(code, down),
      holdFire: (down) => { this.input.fireHeld = down; this.input.aimHeld = down; },
      startJob: (i) => this.missions.startJob(i),
      setWanted: (n) => this.setWanted(n),
      giveCash: (n) => { this.cash += n; },
      setHealth: (n) => { this.player.health = n; },
      giveWeapon: (k, a) => this.giveWeapon(k, a),
      giveUpgrade: (k) => { this.upgrades[k] = (this.upgrades[k] || 0) + 1; },
      setCarHealth: (n) => { if (this.playerCar) this.playerCar.health = n; },
      bringPickup: () => {
        const c = this.ownPickup;
        c.x = this.player.x + 4; c.z = this.player.z + 2;
        c.mesh.position.set(c.x, 0, c.z);
        c.wrecked = false; c.health = 100;
        return true;
      },
      step: (n) => { for (let i = 0; i < n; i++) this.step(STEP); },
      enterNearestCar: () => {
        const c = this._nearestEnterableCar(6);
        if (c) this._enterCar(c);
        return !!c;
      },
      exitCar: () => this._exitCar(),
      openGarage: () => this._openGarage(),
      buyUpgrade: (k) => this._buyUpgrade(k, this.standing.garageFactor(districtAt(this.player.x, this.player.z))),
      setHud: (on) => { this.hudEnabled = on; },
      setScreen: (s) => { this.screen = s; },
      startGame: () => this._newGame(),
      save: () => this.save(),
      load: () => this.applySave(loadGame()),
    };
  }
}

// SOLSTICE CITY — boot. Parses ?seed= and ?shot=, builds the world, and
// exposes a small test hook surface on window.__game for the Playwright
// playthrough (teleport, wanted, jobs, synthetic input, state snapshots).
// No network, no wall-clock randomness: the seed drives every RNG in the game.

import { World } from './world.js';
import { CFG } from './config.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || CFG.seedDefault) || CFG.seedDefault;
const shot = params.get('shot') || null;
const perfLow = params.get('perf') === 'low';

const canvas = document.getElementById('game');
const world = new World(canvas, { seed, shot, perfLow });

window.__game = {
  world,
  S: world.S,
  seed,
  shot,
  state() {
    const S = world.S, p = S.player;
    return {
      x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), y: +p.pos.y.toFixed(2),
      inCar: p.inCar, carType: p.car ? p.car.type : null,
      carSpeed: p.car ? +p.car.speed.toFixed(2) : 0,
      wanted: S.police.wanted, health: Math.round(S.health), cash: S.cash,
      respect: S.respect, clock: +S.clock.toFixed(2), day: S.day,
      district: S.district, jobIndex: S.missions.jobIndex, stepIndex: S.missions.stepIndex,
      job: S.missions.job ? S.missions.job.name : null,
      objective: S.missions.objectiveText(),
      enemies: S.combat.enemies.length, kills: S.combat.killsThisStep,
      policeCars: S.police.cars.length, heli: !!S.police.heli,
      roadblocks: S.police.roadblocks.length,
      traffic: S.traffic.cars.length, peds: S.peds.list.length,
      shards: S.shardsCollected.length, weapon: S.combat.weapon.name,
      ammo: S.combat.ammo.slice(), running: world.running, paused: world.paused,
      menu: S.hud.menuMode, simTime: +world.simTime.toFixed(2),
    };
  },
  teleport(x, z) {
    const p = world.S.player;
    if (p.inCar && p.car) { p.car.pos.set(x, 0, z); p.car.speed = 0; p.car.syncMesh(); }
    p.pos.set(x, 0, z);
    p.mesh.position.copy(p.pos);
  },
  setWanted(n) { world.S.police.setWanted(n); },
  startJob(i) { world.missions.startJob(i); },
  newGame() { world.newGame(); },
  key(k, down) { world.input.injectKey(k, down); },
  tapKey(k) { world.input.injectKey(k, true); setTimeout(() => world.input.injectKey(k, false), 150); },
  mouse(dx, dy) { world.input.injectMouse(dx, dy); },
  click() { world.clickQueued = true; },
  save() { world.saveGame(); },
  load() { return world.loadGame(); },
  selectWeapon(i) { world.S.combat.select(i); },
  giveWeapon(i, ammo) { world.S.combat.giveWeapon(i, ammo); },
};

world.start();
window.__ready = true;

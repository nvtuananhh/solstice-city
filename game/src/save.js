// Save / load via localStorage. Stores mission progress, cash, respect, owned
// cars + upgrades, player position, shards and day/clock. Never auto-claims or
// auto-spends anything — it only records what the player already earned.

import { CFG } from './config.js';

export function saveGame(S) {
  try {
    const data = {
      v: 1,
      jobIndex: S.missions.jobIndex,
      cash: S.cash,
      respect: S.respect,
      health: S.health,
      clock: S.clock,
      day: S.day,
      shards: S.shardsCollected.length,
      shardIds: S.shardsCollected,
      player: { x: S.player.pos.x, z: S.player.pos.z, angle: S.player.angle },
      ownedCars: S.ownedCars,
      upgrades: S.upgrades,
      weapons: S.combat ? { owned: S.combat.owned, ammo: S.combat.ammo } : null,
    };
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(CFG.saveKey); } catch (e) { return false; }
}

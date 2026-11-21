// Weapon wheel + switching. Four slots: fists, bat, pistol, SMG. Hold Q for
// the wheel overlay, keys 1-4 switch directly. Ammo counts live here.
import { WEAPONS } from './config.js';

export class Weapons {
  constructor() {
    this.slots = WEAPONS.map((w) => ({
      ...w,
      owned: w.key === 'fists',
      ammoLeft: w.ammo === Infinity ? Infinity : 0,
    }));
    this.current = 0;
    this.cooldown = 0;
    this.wheelOpen = false;
  }

  give(key, ammo) {
    const s = this.slots.find((w) => w.key === key);
    if (!s) return;
    s.owned = true;
    if (s.ammoLeft !== Infinity) s.ammoLeft += ammo;
  }

  select(idx) {
    if (idx < 0 || idx >= this.slots.length) return false;
    if (!this.slots[idx].owned) return false;
    this.current = idx;
    return true;
  }

  currentWeapon() { return this.slots[this.current]; }

  canFire() {
    const w = this.currentWeapon();
    return this.cooldown <= 0 && (w.ammoLeft === Infinity || w.ammoLeft > 0);
  }

  spendAmmo() {
    const w = this.currentWeapon();
    if (w.ammoLeft !== Infinity) w.ammoLeft = Math.max(0, w.ammoLeft - 1);
    this.cooldown = w.rate;
  }

  update(dt) { this.cooldown = Math.max(0, this.cooldown - dt); }

  hasRanged() {
    return this.slots[2].owned || this.slots[3].owned;
  }

  // Wheel selection by mouse angle (0 = up, clockwise). Returns slot index.
  wheelPick(dx, dy) {
    const a = Math.atan2(dx, -dy); // 0 at top
    const idx = Math.round(a / (Math.PI / 2));
    return ((idx % 4) + 4) % 4;
  }
}

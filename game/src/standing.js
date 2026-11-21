// District standing: 10 districts, 0-5 each. Earned by finishing jobs, taxi
// fares and races in that district. Effects: garage discount, bigger taxi
// tips, faster wanted decay. Shown on the HUD minimap panel + pause screen.
import { DISTRICTS, districtAt } from './config.js';

export class Standing {
  constructor() {
    this.levels = new Array(10).fill(0);
  }

  add(districtIdx, amount) {
    if (districtIdx < 0 || districtIdx > 9) return;
    this.levels[districtIdx] = Math.min(5, this.levels[districtIdx] + amount);
  }

  addAt(x, z, amount) { this.add(districtAt(x, z), amount); }

  levelAt(x, z) { return this.levels[districtAt(x, z)]; }

  // Garage price multiplier in a district: 5% off per standing level.
  garageFactor(districtIdx) {
    return 1 - 0.05 * this.levels[districtIdx];
  }

  // Taxi tip bonus in a district: +$8 per standing level.
  tipBonus(districtIdx) { return 8 * this.levels[districtIdx]; }

  // Wanted decay speed multiplier: standing makes police lose the trail faster.
  decayFactor(districtIdx) { return 1 + 0.25 * this.levels[districtIdx]; }

  topList() {
    return DISTRICTS.map((d, i) => ({ name: d.name, level: this.levels[i] }))
      .sort((a, b) => b.level - a.level)
      .slice(0, 5);
  }
}

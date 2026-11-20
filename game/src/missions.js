// Missions: the 9-job chain plus side jobs (taxi fares, street races, corner
// store robberies, 25 sun shards). A generic step engine drives every job:
// goto / drive / steal / lose / combat / survive. The world supplies the
// context (player pos, in-car, wanted, kills) and this module decides when a
// step completes, pays out, and advances.

import { JOBS, LANDMARKS } from './config.js';

export class Missions {
  constructor(S, audio) {
    this.S = S;
    this.audio = audio;
    this.jobIndex = 0; // 0-based into JOBS
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.stepSpawned = false;
    this.marker = null; // {x, z, r} current objective marker
    this.completedJobs = [];
    this.taxi = null; // active taxi fare {dest, fare}
    this.race = null; // active race {checkpoints, idx, timer}
    this.robbery = null; // {timer}
    this.updateMarker();
  }

  get job() { return JOBS[this.jobIndex] || null; }
  get step() { const j = this.job; return j ? j.steps[this.stepIndex] : null; }

  objectiveText() {
    if (!this.job) return { title: 'SOLSTICE CITY — all jobs done', sub: 'Free roam: taxi fares, races, shards' };
    const s = this.step;
    return { title: `Job ${this.job.id}: ${this.job.name}`, sub: s ? s.text : this.job.briefing };
  }

  updateMarker() {
    const s = this.step;
    if (!s) { this.marker = null; return; }
    if (s.x !== undefined) this.marker = { x: s.x, z: s.z, r: s.r || 10 };
    else if (this.taxi) this.marker = { x: this.taxi.dest.x, z: this.taxi.dest.z, r: 12 };
    else this.marker = null;
  }

  startJob(i) {
    this.jobIndex = Math.max(0, Math.min(JOBS.length - 1, i));
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.stepSpawned = false;
    this.S.combat.killsThisStep = 0;
    this.S.combat.clearEnemies();
    this.updateMarker();
    const j = this.job;
    this.S.hud.banner(`${j.name}`, j.briefing);
    this.S.hud.toast(`Job ${j.id} started: ${j.name}`);
  }

  completeStep() {
    const j = this.job;
    this.stepIndex++;
    this.stepTimer = 0;
    this.stepSpawned = false;
    this.S.combat.killsThisStep = 0;
    this.audio.cash();
    if (this.stepIndex >= j.steps.length) {
      this.S.cash += j.payout;
      this.S.respect += j.respect;
      this.completedJobs.push(j.id);
      this.S.hud.banner('JOB COMPLETE', `+ $${j.payout}  •  +${j.respect} respect`);
      this.S.hud.toast(`Job ${j.id} "${j.name}" complete — $${j.payout}`);
      this.jobIndex++;
      this.stepIndex = 0;
      if (this.jobIndex >= JOBS.length) {
        this.S.hud.banner('THE LAST LIGHT', 'All 9 jobs done. Solstice City is yours, Dana.');
      } else {
        const nj = this.job;
        this.S.hud.toast(`Next job unlocked: ${nj.name}`);
      }
    }
    this.updateMarker();
  }

  // Called every fixed step with live world context.
  update(dt, ctx) {
    const s = this.step;
    if (!s) {
      // free roam: keep the taxi marker current
      if (this.taxi) this.marker = { x: this.taxi.dest.x, z: this.taxi.dest.z, r: 12 };
      return;
    }
    const px = ctx.playerPos.x, pz = ctx.playerPos.z;
    const dist = s.x !== undefined ? Math.hypot(px - s.x, pz - s.z) : 1e9;
    if (s.type === 'goto' && dist < (s.r || 10)) { this.completeStep(); return; }
    if (s.type === 'drive' && ctx.inCar && dist < (s.r || 12)) { this.completeStep(); return; }
    if (s.type === 'steal' && ctx.stolenCar) { this.completeStep(); return; }
    if (s.type === 'lose' && ctx.wanted === 0) { this.completeStep(); return; }
    if (s.type === 'combat') {
      if (!this.stepSpawned) {
        this.S.combat.spawnEnemies(s.x, s.z, s.count, this.job.id === 9 ? 'vault' : 'crew');
        this.stepSpawned = true;
      }
      if (this.S.combat.killsThisStep >= s.count) { this.completeStep(); return; }
    }
    if (s.type === 'survive') {
      const ok = s.wanted === 0 ? ctx.wanted === 0 : ctx.wanted >= s.wanted;
      if (ok) {
        this.stepTimer += dt;
        if (this.stepTimer >= s.seconds) { this.completeStep(); return; }
      } else {
        this.stepTimer = Math.max(0, this.stepTimer - dt * 2);
      }
    }
    // side jobs tick alongside
    this.updateSide(dt, ctx);
  }

  updateSide(dt, ctx) {
    // taxi fare: reach the destination in the car
    if (this.taxi) {
      const d = Math.hypot(ctx.playerPos.x - this.taxi.dest.x, ctx.playerPos.z - this.taxi.dest.z);
      if (d < 12 && ctx.inCar) {
        this.S.cash += this.taxi.fare;
        this.S.hud.toast(`Taxi fare done: +$${this.taxi.fare}`);
        this.audio.cash();
        this.taxi = null;
        this.updateMarker();
      }
    }
    // street race checkpoints
    if (this.race) {
      this.race.timer += dt;
      const cp = this.race.checkpoints[this.race.idx];
      if (cp) {
        const d = Math.hypot(ctx.playerPos.x - cp.x, ctx.playerPos.z - cp.z);
        if (d < 12 && ctx.inCar) {
          this.race.idx++;
          this.S.hud.toast(`Checkpoint ${this.race.idx}/${this.race.checkpoints.length}`);
          if (this.race.idx >= this.race.checkpoints.length) {
            const prize = Math.max(200, 900 - Math.floor(this.race.timer) * 5);
            this.S.cash += prize;
            this.S.respect += 5;
            this.S.hud.banner('RACE WON', `+ $${prize}`);
            this.race = null;
            this.updateMarker();
          }
        }
      }
    }
    // robbery escape timer
    if (this.robbery) {
      this.robbery.timer -= dt;
      if (this.robbery.timer <= 0) {
        this.S.cash += this.robbery.take;
        this.S.hud.toast(`Robbery take banked: +$${this.robbery.take}`);
        this.audio.cash();
        this.robbery = null;
      }
    }
  }

  startTaxi(dest, fare) {
    this.taxi = { dest, fare };
    this.marker = { x: dest.x, z: dest.z, r: 12 };
    this.S.hud.toast(`Taxi fare: take them to the marker — $${fare}`);
  }
  startRace(checkpoints) {
    this.race = { checkpoints, idx: 0, timer: 0 };
    this.S.hud.toast('Street race started — hit every checkpoint!');
  }
  startRobbery(take) {
    this.robbery = { timer: 30, take };
    this.S.police.addWanted(2, 'robbery');
    this.S.hud.toast('Robbery! Lose the cops for 30s to keep the take.');
  }
}

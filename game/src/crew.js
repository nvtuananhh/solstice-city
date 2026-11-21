// Crew ability: Mira, a getaway driver, joins after job 3. Once per job the
// player can call her (key V): she drives a fast sports car to the player's
// position, and the call also grants one wanted-level drop ("clean getaway")
// for that job. State resets per job.
export class Crew {
  constructor() {
    this.recruited = false;
    this.calledThisJob = false;
    this.dropUsedThisJob = false;
    this.arriving = false;   // Mira is driving in
    this.arriveTimer = 0;
    this.present = false;    // her car is here / she is on site
  }

  onJobStart() {
    this.calledThisJob = false;
    this.dropUsedThisJob = false;
    this.arriving = false;
    this.present = false;
  }

  // Returns 'ok' | 'not-recruited' | 'already-called'
  call() {
    if (!this.recruited) return 'not-recruited';
    if (this.calledThisJob) return 'already-called';
    this.calledThisJob = true;
    this.arriving = true;
    this.arriveTimer = 4;   // seconds until she pulls up
    return 'ok';
  }

  update(dt) {
    if (this.arriving) {
      this.arriveTimer -= dt;
      if (this.arriveTimer <= 0) {
        this.arriving = false;
        this.present = true;
      }
    }
  }

  // One-time wanted drop per job. Returns true if it applied.
  useCleanGetaway(wanted) {
    if (!this.recruited || this.dropUsedThisJob || wanted <= 0) return false;
    this.dropUsedThisJob = true;
    return true;
  }

  statusText() {
    if (!this.recruited) return 'Mira: joins after Job 3';
    if (this.arriving) return 'Mira: on her way…';
    if (this.present) return 'Mira: on site — clean getaway ready (V used)';
    if (this.calledThisJob) return 'Mira: called this job';
    return 'Mira: ready — press V to call';
  }
}

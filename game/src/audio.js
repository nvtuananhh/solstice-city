// WebAudio synth only — no audio files, no network. Everything is created lazily
// on the first user gesture (or never, in shot mode). All oscillators are short
// lived except the engine hum and radio loops, which are gain-gated.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.muted = false;
    this.station = 0;
    this.radioOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioTimer = 0;
    this.radioStep = 0;
    this.stations = ['Desert Rock', 'Latin Groove', 'Talk Radio'];
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      // Engine hum: two detuned saws through a lowpass, gain by speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: triangle LFO wobble, gain gated by wanted level.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 260;
      lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); lfo.start();
    } catch (e) { this.ctx = null; return false; }
    return true;
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }
  engine(speed01, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.03 + speed01 * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, t, 0.1);
  }
  siren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.3);
  }
  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.value = vol || 0.12;
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch (e) { /* audio is best-effort */ }
  }
  shot() { this.blip(180, 0.12, 'square', 0.2); this.blip(90, 0.18, 'sawtooth', 0.16); }
  melee() { this.blip(120, 0.08, 'sine', 0.15); }
  pickup() { this.blip(660, 0.1, 'sine', 0.14); this.blip(990, 0.14, 'sine', 0.12); }
  cash() { this.blip(880, 0.09, 'sine', 0.14); this.blip(1320, 0.16, 'sine', 0.12); }
  horn() { this.blip(370, 0.25, 'square', 0.1); }
  crash() { this.blip(70, 0.25, 'sawtooth', 0.2); }
  click() { this.blip(440, 0.05, 'sine', 0.08); }
  // Radio: a tiny step sequencer. Desert rock = minor riff, latin = syncopated
  // bass, talk = filtered noise bleeps. Driven from the world step, not timers.
  radioTick(dt) {
    if (!this.ctx || !this.radioOn) return;
    this.radioTimer += dt;
    const stepDur = this.station === 1 ? 0.22 : 0.26;
    if (this.radioTimer < stepDur) return;
    this.radioTimer -= stepDur;
    this.radioStep = (this.radioStep + 1) % 16;
    const s = this.radioStep;
    if (this.station === 0) {
      const riff = [110, 0, 130.8, 0, 98, 0, 110, 146.8, 110, 0, 130.8, 0, 164.8, 146.8, 130.8, 98];
      if (riff[s]) this.blip(riff[s], 0.2, 'sawtooth', 0.05);
      if (s % 4 === 0) this.blip(55, 0.15, 'sine', 0.1);
    } else if (this.station === 1) {
      const bass = [82.4, 0, 98, 0, 0, 110, 0, 98, 82.4, 0, 98, 0, 123.5, 0, 110, 0];
      if (bass[s]) this.blip(bass[s], 0.18, 'triangle', 0.09);
      if (s % 2 === 0) this.blip(1200, 0.03, 'square', 0.03);
    } else {
      if (s % 5 === 0) this.blip(300 + (s * 37) % 500, 0.12, 'sine', 0.05);
    }
  }
  cycleStation() {
    this.station = (this.station + 1) % 3;
    return this.stations[this.station];
  }
}

// WebAudio synth only — no audio files, no network. Every sound is built from
// oscillators / filtered noise. All calls are guarded: if AudioContext is
// unavailable the game keeps running silently.
import { RADIO } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.radioOn = true;
    this.station = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioTimer = 0;
    this.radioStep = 0;
    this.started = false;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.started = true;
      this._engineLoop();
      this._sirenLoop();
    } catch (e) { /* silent game */ }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  _engineLoop() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  _sirenLoop() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  // Called every frame with game state; all values are sim-driven.
  update(dt, speedKmh, wanted, radioOn, station) {
    if (!this.started || !this.ctx) return;
    this.radioOn = radioOn; this.station = station;
    if (this.engineGain) {
      const target = speedKmh > 1 ? 0.045 + speedKmh / 900 : 0.0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(48 + speedKmh * 1.6, this.ctx.currentTime, 0.08);
    }
    if (this.sirenGain) {
      const t = this.ctx.currentTime;
      if (wanted > 0) {
        this.sirenGain.gain.setTargetAtTime(0.035, t, 0.2);
        const phase = (t % 1.6) < 0.8 ? 660 : 880;
        this.sirenOsc.frequency.setTargetAtTime(phase, t, 0.05);
      } else {
        this.sirenGain.gain.setTargetAtTime(0.0, t, 0.2);
      }
    }
    if (this.radioOn) {
      this.radioTimer += dt;
      const st = RADIO[station % RADIO.length];
      const stepDur = 60 / st.bpm / 2;
      if (this.radioTimer >= stepDur) {
        this.radioTimer -= stepDur;
        this._radioNote(st, this.radioStep);
        this.radioStep = (this.radioStep + 1) % st.notes.length;
      }
    }
  }

  _radioNote(st, step) {
    const semi = st.notes[step];
    const freq = st.base * Math.pow(2, semi / 12);
    const osc = this.ctx.createOscillator();
    osc.type = st.wave;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
    osc.connect(g); g.connect(this.master);
    osc.start(); osc.stop(this.ctx.currentTime + 0.24);
  }

  _noiseBurst(dur, freq, gainVal, type = 'lowpass') {
    if (!this.started) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Deterministic noise from a tiny LFSR — audio texture only, never gameplay.
    let lfsr = 0xACE1;
    for (let i = 0; i < len; i++) {
      lfsr = (lfsr >> 1) ^ (-(lfsr & 1) & 0xB400);
      data[i] = ((lfsr & 0xFFFF) / 32768 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type; filt.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gainVal;
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start();
  }

  // Noise burst helper (deterministic LFSR texture; never gameplay).
  gunshot() { this._noiseBurst(0.14, 1800, 0.5, 'highpass'); }
  punch() { this._noiseBurst(0.08, 500, 0.4); }
  pickup() { this._blip(880, 0.12, 'sine'); this._blip(1320, 0.12, 'sine', 0.07); }
  honk() { this._blip(370, 0.25, 'square', 0, 0.12); }
  cash() { this._blip(660, 0.1, 'sine'); this._blip(990, 0.16, 'sine', 0.08); }
  click() { this._blip(1200, 0.04, 'square', 0, 0.06); }
  footstep() { this._noiseBurst(0.05, 300, 0.08); }

  _blip(freq, dur, type = 'sine', delay = 0, gainVal = 0.12) {
    if (!this.started) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type; osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
}

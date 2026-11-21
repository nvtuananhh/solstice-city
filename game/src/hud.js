// HUD: DOM overlay (health, cash, respect, stars, clock, district, objective,
// speedometer, ammo, Mira status, toasts, weapon wheel) + a rotating minimap
// canvas (player arrow, police blips, mission marker, garage/shop icons).
import { DISTRICTS, districtAt, WEAPONS, RADIO } from './config.js';

export class Hud {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.healthbar = this.el('healthbar');
    this.cashline = this.el('cashline');
    this.respectline = this.el('respectline');
    this.stars = this.el('stars');
    this.clockline = this.el('clockline');
    this.districtline = this.el('districtline');
    this.objtitle = this.el('objtitle');
    this.objtext = this.el('objtext');
    this.mirastatus = this.el('mirastatus');
    this.minimap = this.el('minimap');
    this.mm = this.minimap.getContext('2d');
    this.standingpanel = this.el('standingpanel');
    this.speedo = this.el('speedo');
    this.speedval = this.el('speedval');
    this.weaponname = this.el('weaponname');
    this.ammo = this.el('ammo');
    this.interact = this.el('interact');
    this.crosshair = this.el('crosshair');
    this.wheel = this.el('wheel');
    this.toastEl = this.el('toast');
    this.toastTimer = 0;
    this.screen = this.el('screen');
    this.pausemenu = this.el('pausemenu');
    this.bigmsg = this.el('bigmsg');
    this._buildWheel();
  }

  _buildWheel() {
    this.wheel.innerHTML = '';
    for (let i = 0; i < WEAPONS.length; i++) {
      const d = document.createElement('div');
      d.className = 'wheelslot';
      d.innerHTML = `<div class="wn">${i + 1} · ${WEAPONS[i].name}</div><div class="wa" id="wheelammo${i}"></div>`;
      this.wheel.appendChild(d);
    }
  }

  toast(title, text) {
    this.toastEl.innerHTML = `<div>${title}</div><div style="font-size:13px;font-weight:400">${text || ''}</div>`;
    this.toastEl.style.display = 'block';
    this.toastTimer = 4;
  }

  update(dt, g) {
    // Toast lifetime runs on sim dt so shot modes are deterministic.
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.display = 'none';
    }
    this.healthbar.style.width = `${Math.max(0, g.player.health)}%`;
    this.cashline.textContent = `$${g.cash.toLocaleString('en-US')}`;
    this.respectline.textContent = `Respect ${g.respect} · Shards ${g.missions.shardsCollected}/25`;
    let starsHtml = '';
    for (let i = 0; i < 5; i++) starsHtml += `<span class="${i < g.wanted ? '' : 'off'}">★</span>`;
    this.stars.innerHTML = starsHtml;
    const hh = Math.floor(g.clockMin / 60) % 24;
    const mm = Math.floor(g.clockMin % 60);
    this.clockline.textContent = `Day ${g.day} — ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${RADIO[g.station].name}`;
    const di = districtAt(g.player.x, g.player.z);
    this.districtline.textContent = `${DISTRICTS[di].name} · Standing ${g.standing.levels[di]} · ${g.player.onRoof ? 'Rooftop' : (g.playerCar ? g.playerCar.def.name : 'On foot')}`;
    const obj = g.missions.objective();
    this.objtitle.textContent = obj.title;
    this.objtext.textContent = obj.text;
    this.mirastatus.textContent = g.crew.statusText();
    // Speedometer + ammo
    if (g.playerCar) {
      this.speedo.style.display = 'block';
      this.speedval.textContent = String(Math.round(Math.abs(g.playerCar.speed) * 3.6));
    } else this.speedo.style.display = 'none';
    const w = g.weapons.currentWeapon();
    this.weaponname.textContent = w.name + (g.playerCar ? '' : '');
    this.ammo.textContent = w.ammoLeft === Infinity ? '' : `Ammo ${w.ammoLeft}`;
    // Crosshair when aiming on foot with a ranged weapon.
    this.crosshair.style.display = (!g.playerCar && g.weapons.current >= 2 && g.aiming) ? 'block' : 'none';
    // Weapon wheel
    if (g.weapons.wheelOpen) {
      this.wheel.style.display = 'flex';
      const slots = this.wheel.children;
      for (let i = 0; i < slots.length; i++) {
        slots[i].classList.toggle('sel', i === g.weapons.current);
        const s = g.weapons.slots[i];
        document.getElementById(`wheelammo${i}`).textContent = s.owned
          ? (s.ammoLeft === Infinity ? '∞' : `${s.ammoLeft} rounds`) : 'locked';
      }
    } else this.wheel.style.display = 'none';
    // Standing panel (top 5 districts)
    this.standingpanel.innerHTML = '<b>District standing</b><br>' +
      g.standing.topList().map((d) => `${d.name}: ${'●'.repeat(d.level)}${'○'.repeat(5 - d.level)}`).join('<br>');
    this._drawMinimap(g);
  }

  _drawMinimap(g) {
    const ctx = this.mm;
    const S = 190, C = S / 2;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#10160f'; ctx.fillRect(0, 0, S, S);
    // Rotate so the player's heading is up.
    ctx.translate(C, C);
    ctx.rotate(g.camYaw + Math.PI / 2);
    const scale = S / 340; // show ~340 m across
    const px = -g.player.x * scale, pz = g.player.z * scale;
    ctx.translate(px, pz);
    // Roads
    ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 7;
    for (let i = -5; i <= 5; i++) {
      const c = i * 60 * scale;
      ctx.beginPath(); ctx.moveTo(-300 * scale, c); ctx.lineTo(300 * scale, c); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c, -300 * scale); ctx.lineTo(c, 300 * scale); ctx.stroke();
    }
    // Helios Tower
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.arc(0, -150 * scale, 5, 0, Math.PI * 2); ctx.fill();
    // Mirror field
    ctx.fillStyle = '#9fc8e8';
    ctx.fillRect(150 * scale, -300 * scale, 150 * scale, 240 * scale);
    // Garage + safehouse icons
    ctx.fillStyle = '#7ae08a';
    ctx.fillRect(-120 * scale - 3, 120 * scale - 3, 6, 6);
    ctx.fillStyle = '#8ab8ff';
    ctx.fillRect(-90 * scale - 3, 150 * scale - 3, 6, 6);
    // Mission marker
    const obj = g.missions.objective();
    if (obj.x !== undefined && obj.x !== null) {
      const pulse = 5 + Math.sin(g.simTime * 4) * 2;
      ctx.fillStyle = '#ff4030';
      ctx.beginPath(); ctx.arc(obj.x * scale, -obj.z * scale, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(obj.x * scale, -obj.z * scale, pulse + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // Police blips
    ctx.fillStyle = '#3a8aff';
    for (const c of g.police.cars) {
      ctx.beginPath(); ctx.arc(c.x * scale, -c.z * scale, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Taxi customers
    ctx.fillStyle = '#ffe9a8';
    for (const p of g.pedestrians.peds) {
      if (p.taxi) { ctx.beginPath(); ctx.arc(p.x * scale, -p.z * scale, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    // Traffic dots
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const c of g.traffic.cars) ctx.fillRect(c.x * scale - 1, -c.z * scale - 1, 2, 2);
    ctx.restore();
    // Player arrow (screen space, always up)
    ctx.save();
    ctx.translate(C, C);
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  showInteract(text) {
    this.interact.style.display = 'block';
    this.interact.textContent = text;
  }
  hideInteract() { this.interact.style.display = 'none'; }

  showTitle(onNew, onContinue, hasSave) {
    this.screen.style.display = 'flex';
    this.screen.innerHTML = `
      <h1>SOLSTICE CITY</h1>
      <h2>sun-baked desert open-world crime</h2>
      <p class="story">Dana Reyes drives parts across the Heliostat Sea for a living. Her brother Theo's
      garage is drowning in debt, and fixer Vesper Kane just offered her one last chain of jobs —
      nine of them, ending at the Helios Tower vault at dusk. Drive fast, stay low, and mind the
      five-star sky: the city has a helicopter, and it knows your name.</p>
      <div>
        <button id="btnNew">NEW GAME</button>
        ${hasSave ? '<button id="btnContinue">CONTINUE</button>' : ''}
      </div>
      <div class="controls">WASD move / drive · Mouse orbit · Shift sprint / nitro · Space jump / handbrake ·
      E interact / enter car · F melee · Right-click aim + click fire · Q weapon wheel · 1–4 weapons ·
      R radio · H horn · V call Mira · Esc pause · Enter start job</div>
      <div class="small">All names, characters and places are original. No network needed — runs offline.</div>`;
    document.getElementById('btnNew').onclick = onNew;
    const bc = document.getElementById('btnContinue');
    if (bc) bc.onclick = onContinue;
  }

  hideTitle() { this.screen.style.display = 'none'; }

  showPause(g, callbacks) {
    this.pausemenu.style.display = 'flex';
    const top = g.standing.topList().map((d) => `${d.name}: ${d.level}/5`).join(' · ');
    this.pausemenu.innerHTML = `
      <h1>PAUSED</h1>
      <p>Cash $${g.cash} · Respect ${g.respect} · Jobs done ${g.missions.jobDone}/9</p>
      <p style="font-size:13px;color:#ffe9a8">District standing — ${top}</p>
      <p style="font-size:13px">Mira: ${g.crew.statusText()}</p>
      <button id="btnResume">RESUME</button>
      <button id="btnSave">SAVE GAME</button>
      <button id="btnLoad">LOAD GAME</button>
      <button id="btnQuit">QUIT TO TITLE</button>
      <label>Volume <input id="volRange" type="range" min="0" max="100" value="${Math.round(g.audio.volume * 100)}"></label>
      <label>Mouse sensitivity <input id="sensRange" type="range" min="20" max="200" value="${Math.round(g.sensitivity * 100)}"></label>
      <label>Graphics <select id="gfxSel">
        <option value="high" ${g.quality === 'high' ? 'selected' : ''}>High</option>
        <option value="low" ${g.quality === 'low' ? 'selected' : ''}>Low</option>
      </select></label>`;
    document.getElementById('btnResume').onclick = callbacks.resume;
    document.getElementById('btnSave').onclick = callbacks.save;
    document.getElementById('btnLoad').onclick = callbacks.load;
    document.getElementById('btnQuit').onclick = callbacks.quit;
    document.getElementById('volRange').oninput = (e) => { g.audio.setVolume(e.target.value / 100); };
    document.getElementById('sensRange').oninput = (e) => { g.sensitivity = e.target.value / 100; };
    document.getElementById('gfxSel').onchange = (e) => { g.setQuality(e.target.value); };
  }

  hidePause() { this.pausemenu.style.display = 'none'; }

  showBig(title, text, color) {
    this.bigmsg.style.display = 'flex';
    this.bigmsg.innerHTML = `<h1 style="color:${color || '#ff4030'}">${title}</h1><p>${text || ''}</p><p style="font-size:14px">Press Enter to continue</p>`;
  }
  hideBig() { this.bigmsg.style.display = 'none'; }
}

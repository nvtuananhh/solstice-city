// HUD: DOM readouts, the rotating minimap canvas, banners/toasts, the weapon
// wheel, and the title / pause / settings / garage / shop menus. All updates
// are driven from sim state; nothing here reads the wall clock.

import { LANDMARKS, WEAPONS, PRICES, JOBS } from './config.js';

export class HUD {
  constructor(S) {
    this.S = S;
    this.el = {};
    for (const id of ['healthfill', 'stars', 'cashline', 'respectline', 'clockline', 'districtline',
      'objtitle', 'objsub', 'minimap', 'speedo', 'speedval', 'carname', 'ammo', 'weaponname',
      'interact', 'banner', 'toast', 'crosshair', 'wheel', 'menu', 'menubox', 'shardline']) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.bannerTimer = 0;
    this.toastTimer = 0;
    this.menuMode = 'title'; // title | pause | settings | garage | shop | none
    this.sensitivity = 1;
    this.quality = 'high';
    this._bindMenuClicks();
  }

  _bindMenuClicks() {
    this.el.menubox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      this.S.audio.ensure();
      this.S.audio.click();
      const act = b.dataset.act;
      if (act === 'new') this.S.world.newGame();
      else if (act === 'continue') this.S.world.continueGame();
      else if (act === 'resume') this.S.world.resume();
      else if (act === 'settings') this.showSettings();
      else if (act === 'save') { this.S.world.saveGame(); this.toast('Game saved'); }
      else if (act === 'load') { this.S.world.loadGame(); }
      else if (act === 'quit') this.showTitle();
      else if (act === 'garage-close') this.showPause();
      else if (act.startsWith('buy:')) this.S.world.buyUpgrade(act.slice(4));
      else if (act.startsWith('shop:')) this.S.world.buyShop(act.slice(5));
      else if (act === 'back-pause') this.showPause();
    });
    this.el.menubox.addEventListener('input', (e) => {
      if (e.target.id === 'vol') { this.S.audio.setVolume(Number(e.target.value)); }
      if (e.target.id === 'sens') { this.sensitivity = Number(e.target.value); }
      if (e.target.id === 'qual') { this.quality = e.target.value; }
    });
  }

  banner(big, small) {
    this.el.banner.innerHTML = `${big}<small>${small || ''}</small>`;
    this.el.banner.style.display = 'block';
    this.bannerTimer = 3;
  }
  toast(text) {
    this.el.toast.textContent = text;
    this.el.toast.style.display = 'block';
    this.toastTimer = 3.5;
  }
  setInteract(text) {
    if (text) { this.el.interact.textContent = text; this.el.interact.style.display = 'block'; }
    else this.el.interact.style.display = 'none';
  }

  showTitle() {
    this.menuMode = 'title';
    const has = this.S.world.hasSave();
    this.el.menu.style.display = 'flex';
    this.el.menubox.innerHTML = `
      <h1>SOLSTICE CITY</h1>
      <h2>SUN-BAKED DESERT OPEN-WORLD CRIME</h2>
      <p>Dana Reyes, solar-field courier. Her brother Theo's garage is dying,
      and a fixer called Vesper has one last chain of jobs — nine of them, ending
      at the Helios Tower vault and a mirror-field escape at dusk.</p>
      <p>9 story jobs &middot; 5-star police with helicopter &amp; roadblocks &middot;
      weapon wheel &middot; carjacking &middot; garage upgrades &middot; radio &middot; respect &middot; saves</p>
      <button class="btn" data-act="new">New Game</button>
      ${has ? '<button class="btn ghost" data-act="continue">Continue</button>' : ''}
      <button class="btn ghost" data-act="settings">Settings</button>
      <div class="controls">
        <div>WASD — move / drive &nbsp; Shift — sprint / nitro</div>
        <div>Space — jump / handbrake &nbsp; E — interact / enter car</div>
        <div>Mouse drag — camera &nbsp; F — melee &nbsp; Click / R — fire</div>
        <div>Q (hold) — weapon wheel &nbsp; 1-4 — weapons</div>
        <div>H — horn &nbsp; R — radio station &nbsp; C — crouch</div>
        <div>Esc — pause &nbsp; M — mute &nbsp; Arrows — camera</div>
      </div>`;
  }

  showPause() {
    this.menuMode = 'pause';
    const j = this.S.missions.job;
    this.el.menu.style.display = 'flex';
    this.el.menubox.innerHTML = `
      <h1 style="font-size:34px">PAUSED</h1>
      <p>${j ? `Job ${j.id}: ${j.name} — ${j.briefing}` : 'Free roam — all 9 jobs complete.'}</p>
      <p>Cash $${this.S.cash} &middot; Respect ${this.S.respect} &middot; Day ${this.S.day}</p>
      <button class="btn" data-act="resume">Resume</button>
      <button class="btn ghost" data-act="save">Save Game</button>
      <button class="btn ghost" data-act="load">Load Game</button>
      <button class="btn ghost" data-act="settings">Settings</button>
      <button class="btn ghost" data-act="quit">Quit to Title</button>`;
  }

  showSettings() {
    this.menuMode = 'settings';
    this.el.menu.style.display = 'flex';
    this.el.menubox.innerHTML = `
      <h1 style="font-size:34px">SETTINGS</h1>
      <p>Volume <input id="vol" type="range" min="0" max="1" step="0.05" value="${this.S.audio.volume}"></p>
      <p>Mouse sensitivity <input id="sens" type="range" min="0.3" max="2.5" step="0.1" value="${this.sensitivity}"></p>
      <p>Graphics <select id="qual">
        <option value="high" ${this.quality === 'high' ? 'selected' : ''}>High</option>
        <option value="low" ${this.quality === 'low' ? 'selected' : ''}>Low</option>
      </select></p>
      <button class="btn" data-act="back-pause">Back</button>`;
  }

  showGarage() {
    this.menuMode = 'garage';
    const u = this.S.upgrades;
    this.el.menu.style.display = 'flex';
    this.el.menubox.innerHTML = `
      <h1 style="font-size:34px">THEO'S AUTO</h1>
      <p>Cash $${this.S.cash} &middot; Car health ${this.S.player.car ? Math.round(this.S.player.car.health) : '—'}%</p>
      <button class="btn" data-act="buy:repair">Repair — $${PRICES.repair}</button>
      <button class="btn" data-act="buy:repaint">Repaint — $${PRICES.repaint}</button>
      <button class="btn" data-act="buy:engine">${u.engine ? 'Engine ✓' : 'Engine upgrade'} — $${PRICES.engine}</button>
      <button class="btn" data-act="buy:brakes">${u.brakes ? 'Brakes ✓' : 'Brakes upgrade'} — $${PRICES.brakes}</button>
      <button class="btn" data-act="buy:nitro">${u.nitro ? 'Nitro ✓' : 'Nitro kit'} — $${PRICES.nitro}</button>
      <br><button class="btn ghost" data-act="garage-close">Leave garage</button>`;
  }

  showShop() {
    this.menuMode = 'shop';
    this.el.menu.style.display = 'flex';
    this.el.menubox.innerHTML = `
      <h1 style="font-size:34px">CORNER STORE</h1>
      <p>Cash $${this.S.cash} &middot; Health ${Math.round(this.S.health)}%</p>
      <button class="btn" data-act="shop:health">Health pack — $${PRICES.healthPack}</button>
      <button class="btn" data-act="shop:pistol">Pistol ammo +24 — $${PRICES.pistolAmmo}</button>
      <button class="btn" data-act="shop:smg">SMG ammo +60 — $${PRICES.smgAmmo}</button>
      <button class="btn" data-act="shop:bat">Baseball bat — $${PRICES.bat}</button>
      <br><button class="btn ghost" data-act="garage-close">Leave store</button>`;
  }

  hideMenu() { this.menuMode = 'none'; this.el.menu.style.display = 'none'; }

  update(dt) {
    const S = this.S;
    if (this.bannerTimer > 0) { this.bannerTimer -= dt; if (this.bannerTimer <= 0) this.el.banner.style.display = 'none'; }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.el.toast.style.display = 'none'; }
    this.el.healthfill.style.width = `${Math.max(0, S.health)}%`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="${i < S.police.wanted ? '' : 'off'}">★</span>`;
    this.el.stars.innerHTML = stars;
    this.el.cashline.textContent = `$${S.cash.toLocaleString('en-US')}`;
    this.el.respectline.innerHTML = `Respect ${S.respect} &middot; <span id="shardline">Sun shards ${S.shardsCollected.length}/${25}</span>`;
    const hh = Math.floor(S.clock), mm = Math.floor((S.clock - hh) * 60);
    this.el.clockline.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · Day ${S.day}`;
    this.el.districtline.textContent = S.district;
    const obj = S.missions.objectiveText();
    this.el.objtitle.textContent = obj.title;
    this.el.objsub.textContent = obj.sub;
    // driving readouts
    if (S.player.inCar && S.player.car) {
      this.el.speedo.style.display = 'block';
      this.el.speedval.textContent = Math.round(Math.abs(S.player.car.speed) * 3.6);
      this.el.carname.textContent = `${S.player.car.spec.name}${S.upgrades.engine ? ' • tuned' : ''} · Nitro ${Math.round(S.player.car.nitro * 100)}%`;
      this.el.ammo.style.display = 'none';
      this.el.weaponname.style.display = 'none';
    } else {
      this.el.speedo.style.display = 'none';
      this.el.ammo.style.display = 'block';
      this.el.weaponname.style.display = 'block';
      const w = S.combat.weapon;
      this.el.weaponname.textContent = w.name;
      this.el.ammo.textContent = w.ammo === Infinity ? '∞' : `${S.combat.ammo[S.combat.current]} / ${w.ammo}`;
    }
    // crosshair when armed with a gun on foot
    this.el.crosshair.style.display = (!S.player.inCar && S.combat.current >= 2) ? 'block' : 'none';
    // weapon wheel
    this.el.wheel.style.display = S.combat.wheelOpen ? 'block' : 'none';
    if (S.combat.wheelOpen) {
      const slots = this.el.wheel.querySelectorAll('.wslot');
      slots.forEach((el) => {
        const i = Number(el.dataset.w);
        el.classList.toggle('sel', i === S.combat.current);
        el.style.opacity = S.combat.owned[i] ? '1' : '0.35';
      });
      const a2 = document.getElementById('wammo2');
      const a3 = document.getElementById('wammo3');
      if (a2) a2.textContent = String(S.combat.ammo[2]);
      if (a3) a3.textContent = String(S.combat.ammo[3]);
    }
    this.drawMinimap();
  }

  drawMinimap() {
    const S = this.S, ctx = this.mapCtx, W = 190, R = 88;
    const cx = W / 2, cy = W / 2;
    ctx.clearRect(0, 0, W, W);
    const scale = R / 340;
    const px = S.player.pos.x, pz = S.player.pos.z;
    const toMap = (x, z) => [cx + (x - px) * scale, cy + (z - pz) * scale];
    // roads
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    for (let v = -280; v <= 280; v += 80) {
      let [x1, y1] = toMap(v, -340); let [x2, y2] = toMap(v, 340);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      [x1, y1] = toMap(-340, v); [x2, y2] = toMap(340, v);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // mirror field
    ctx.fillStyle = 'rgba(160,220,255,0.5)';
    let [mx, my] = toMap(345, -140);
    ctx.fillRect(mx, my, 190 * scale, 280 * scale);
    // landmarks: garage (green), safehouse (blue), tower (gold)
    const dot = (x, z, color, r) => {
      const [a, b] = toMap(x, z);
      if (a < 0 || a > W || b < 0 || b > W) return;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(a, b, r, 0, 6.29); ctx.fill();
    };
    dot(LANDMARKS.garage.x, LANDMARKS.garage.z, '#37d67a', 4);
    dot(LANDMARKS.safehouse.x, LANDMARKS.safehouse.z, '#5aa8ff', 4);
    dot(LANDMARKS.tower.x, LANDMARKS.tower.z, '#ffd23f', 5);
    dot(LANDMARKS.chopShop.x, LANDMARKS.chopShop.z, '#ff8a5c', 3);
    // mission marker
    const m = S.missions.marker;
    if (m) {
      const [a, b] = toMap(m.x, m.z);
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(a, b, 8, 0, 6.29); ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(a, b, 3, 0, 6.29); ctx.fill();
    }
    // police blips (red) + traffic (grey)
    for (const c of S.police.cars) dot(c.pos.x, c.pos.z, '#ff3b30', 3);
    for (const c of S.traffic.cars) dot(c.pos.x, c.pos.z, 'rgba(255,255,255,0.55)', 2);
    // player arrow (rotates with facing)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(S.player.inCar ? S.player.car.angle : S.player.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // north tick
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 11px sans-serif'; ctx.fillText('N', cx - 4, 14);
  }
}

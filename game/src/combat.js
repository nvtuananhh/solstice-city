// Combat: hitscan shooting with seeded spread, melee arcs, enemy NPCs
// (rival crew) with health, simple aim-at-player shooting, hit reactions,
// muzzle flash, health pickups. Enemies are plain data + a box figure mesh.
const THREE = window.THREE;

export class Combat {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.enemies = [];
    this.bullets = [];   // tracer lines, visual only, fade fast
    this.flash = null;   // muzzle flash sprite
    this.flashTimer = 0;
    this._makeFlash();
  }

  _makeFlash() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0 });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), mat);
    this.scene.add(this.flash);
  }

  spawnEnemy(x, z, health, name) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x7a2020 }));
    torso.position.y = 1.15; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xc09868 }));
    head.position.y = 1.85; g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
    legs.position.y = 0.4; g.add(legs);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x181818 }));
    gun.position.set(0.45, 1.35, 0.2); g.add(gun);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const e = { mesh: g, x, z, health, maxHealth: health, name: name || 'Rival', shootTimer: this.rng.range(0.5, 1.5), hitTimer: 0 };
    this.enemies.push(e);
    return e;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies.length = 0;
  }

  // Player fires the current weapon. from = player pos, dir = aim direction
  // (unit, xz), aimY = height of the shot. Returns a hit record or null.
  playerShoot(from, dir, weapon, targets) {
    const spread = weapon.key === 'smg' ? 0.06 : 0.025;
    const a = Math.atan2(-dir.z, dir.x) + (this.rng.next() - 0.5) * 2 * spread;
    const dx = Math.cos(a), dz = -Math.sin(a);
    this._tracer(from.x, from.y, from.z, dx, dz, weapon.range);
    this._muzzle(from.x + dx * 1.2, from.y, from.z + dz * 1.2);
    let best = null, bd = weapon.range;
    for (const t of targets) {
      const tx = t.x - from.x, tz = t.z - from.z;
      const along = tx * dx + tz * dz;
      if (along < 0 || along > weapon.range) continue;
      const side = Math.abs(tx * -dz + tz * dx);
      if (side < 1.1 && along < bd) { bd = along; best = t; }
    }
    if (best) {
      best.health -= weapon.dmg;
      best.hitTimer = 0.25;
      return { target: best, dist: bd };
    }
    return null;
  }

  // Melee arc: hits every enemy within range and a 100-degree cone.
  playerMelee(from, heading, weapon, targets) {
    const hits = [];
    for (const t of targets) {
      const dx = t.x - from.x, dz = t.z - from.z;
      const dist = Math.hypot(dx, dz);
      if (dist > weapon.range) continue;
      const ang = Math.atan2(-dz, dx);
      let dh = ang - heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      if (Math.abs(dh) < 0.9) {
        t.health -= weapon.dmg;
        t.hitTimer = 0.3;
        hits.push(t);
      }
    }
    return hits;
  }

  // Enemies shoot at the player when in range and line of sight is short.
  update(dt, player) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.health <= 0) {
        this.scene.remove(e.mesh);
        this.enemies.splice(i, 1);
        continue;
      }
      const dx = player.x - e.x, dz = player.z - e.z;
      const dist = Math.hypot(dx, dz);
      const heading = Math.atan2(-dz, dx);
      e.mesh.rotation.y = -heading;
      e.hitTimer = Math.max(0, e.hitTimer - dt);
      const baseY = e.y || 0;
      if (e.hitTimer > 0) {
        e.mesh.position.y = baseY + 0.15; // flinch hop
      } else {
        e.mesh.position.y = baseY;
        // Advance to ~18 m, then hold and shoot.
        if (dist > 18) {
          e.x += Math.cos(heading) * 3.2 * dt;
          e.z += -Math.sin(heading) * 3.2 * dt;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 40) {
          e.shootTimer = this.rng.range(0.9, 1.8);
          const spread = 0.12;
          const a = heading + (this.rng.next() - 0.5) * 2 * spread;
          this._tracer(e.x, (e.y || 0) + 1.4, e.z, Math.cos(a), -Math.sin(a), dist + 4);
          // Hit chance falls with distance; seeded, so replays match.
          if (this.rng.next() < Math.max(0.12, 0.55 - dist * 0.012)) {
            player.health -= 8;
            player.hurtFlash = 0.3;
          }
        }
      }
      e.mesh.position.set(e.x, e.mesh.position.y, e.z);
    }
    // Tracer fade.
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.line.material.opacity = Math.max(0, b.life * 6);
      if (b.life <= 0) { this.scene.remove(b.line); this.bullets.splice(i, 1); }
    }
    this.flashTimer -= dt;
    this.flash.material.opacity = Math.max(0, this.flashTimer * 4);
  }

  _tracer(x, y, z, dx, dz, len) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x + dx * len, y, z + dz * len),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.bullets.push({ line, life: 0.12 });
  }

  _muzzle(x, y, z) {
    this.flash.position.set(x, y, z);
    this.flashTimer = 0.09;
  }
}

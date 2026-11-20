// Combat: weapon wheel (hold Q, keys 1-4), melee + ranged fire with raycast,
// muzzle flash, hit reactions, enemies (rival crew), health packs and weapon
// pickups. Enemies are simple humanoids that chase and shoot back.

import { WEAPONS } from './config.js';
import { makePersonMesh } from './pedestrians.js';

export class Combat {
  constructor(scene, rng, audio) {
    this.scene = scene;
    this.rng = rng;
    this.audio = audio;
    this.owned = [true, false, true, false]; // fists + pistol owned at start
    this.ammo = [Infinity, Infinity, 24, 0];
    this.current = 0;
    this.cooldown = 0;
    this.wheelOpen = false;
    this.enemies = [];
    this.flash = null;
    this.flashTimer = 0;
    this.tracer = null;
    this.tracerTimer = 0;
    this.raycaster = new THREE.Raycaster();
    this.killsThisStep = 0;
  }

  get weapon() { return WEAPONS[this.current]; }

  select(i) {
    if (i < 0 || i > 3) return false;
    if (!this.owned[i]) return false;
    this.current = i;
    return true;
  }
  giveWeapon(i, ammo) {
    this.owned[i] = true;
    if (ammo !== Infinity) this.ammo[i] = (this.ammo[i] === Infinity ? 0 : this.ammo[i]) + ammo;
  }

  spawnEnemies(x, z, count, kind) {
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const mesh = makePersonMesh(this.rng);
      mesh.children[0].material = new THREE.MeshLambertMaterial({ color: kind === 'vault' ? 0x3a3a3a : 0x7a2f2f });
      const ex = x + this.rng.range(-14, 14), ez = z + this.rng.range(-14, 14);
      mesh.position.set(ex, 0, ez);
      this.scene.add(mesh);
      const e = {
        mesh, x: ex, z: ez, health: 60, speed: this.rng.range(3.2, 4.4),
        shootTimer: this.rng.range(1, 2.5), walkPhase: this.rng.range(0, 6),
        hitFlash: 0,
      };
      this.enemies.push(e);
      spawned.push(e);
    }
    return spawned;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  // Player melee: hits the nearest enemy / ped within range in front.
  melee(playerPos, playerAngle, onHit) {
    if (this.cooldown > 0) return;
    this.cooldown = this.weapon.rate;
    this.audio.melee();
    const range = this.weapon.range;
    let best = null, bd = range;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - playerPos.x, e.z - playerPos.z);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      best.health -= this.weapon.damage;
      best.hitFlash = 0.15;
      onHit && onHit(best);
      if (best.health <= 0) this.kill(best);
    }
  }

  // Player ranged fire: raycast from the camera through the crosshair.
  fire(camera, playerPos, onHitEnemy) {
    const w = this.weapon;
    if (this.cooldown > 0) return false;
    if (w.ammo !== Infinity && this.ammo[this.current] <= 0) { this.audio.click(); this.cooldown = 0.25; return false; }
    this.cooldown = w.rate;
    if (w.ammo !== Infinity) this.ammo[this.current]--;
    this.audio.shot();
    // muzzle flash: small bright sphere at the camera, fades fast
    if (!this.flash) {
      this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      this.scene.add(this.flash);
    }
    this.flash.position.copy(camera.position).add(new THREE.Vector3(0, -0.25, 0).applyQuaternion(camera.quaternion));
    this.flash.visible = true;
    this.flashTimer = 0.06;
    // raycast against enemy meshes + a ground plane for the tracer end
    this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    this.raycaster.far = w.range;
    const meshes = this.enemies.map(e => e.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    let end;
    if (hits.length > 0) {
      end = hits[0].point;
      const enemy = this.enemies.find(e => e.mesh === hits[0].object || e.mesh.children.includes(hits[0].object));
      if (enemy) {
        enemy.health -= w.damage;
        enemy.hitFlash = 0.15;
        onHitEnemy && onHitEnemy(enemy);
        if (enemy.health <= 0) this.kill(enemy);
      }
    } else {
      end = this.raycaster.ray.at(w.range, new THREE.Vector3());
    }
    // tracer line
    if (this.tracer) this.scene.remove(this.tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([
      this.flash.position.clone(), end,
    ]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(this.tracer);
    this.tracerTimer = 0.08;
    return true;
  }

  kill(e) {
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    this.scene.remove(e.mesh);
    this.killsThisStep++;
    this.audio.pickup();
  }

  update(dt, playerPos, onEnemyShot) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0 && this.flash) this.flash.visible = false;
    }
    if (this.tracerTimer > 0) {
      this.tracerTimer -= dt;
      if (this.tracerTimer <= 0 && this.tracer) { this.scene.remove(this.tracer); this.tracer = null; }
    }
    // enemies chase the player and shoot when close
    for (const e of this.enemies) {
      const dx = playerPos.x - e.x, dz = playerPos.z - e.z;
      const d = Math.hypot(dx, dz);
      if (d > 3) {
        e.x += (dx / d) * e.speed * dt;
        e.z += (dz / d) * e.speed * dt;
        e.mesh.rotation.y = Math.atan2(dx, dz);
        e.walkPhase += dt * 8;
        const swing = Math.sin(e.walkPhase) * 0.5;
        e.mesh.userData.legL.rotation.x = swing;
        e.mesh.userData.legR.rotation.x = -swing;
      } else {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = this.rng.range(1.2, 2.4);
          // enemy shot: hit chance falls with distance
          if (this.rng.chance(Math.max(0.15, 0.7 - d * 0.05))) onEnemyShot && onEnemyShot(9);
          this.audio.shot();
        }
      }
      if (e.hitFlash > 0) {
        e.hitFlash -= dt;
        e.mesh.children[0].material.color.setHex(0xffffff);
      } else {
        e.mesh.children[0].material.color.setHex(0x7a2f2f);
      }
      e.mesh.position.set(e.x, 0, e.z);
    }
  }
}

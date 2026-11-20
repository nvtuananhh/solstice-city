// Deterministic screenshot staging. Each mode places the player, cars, police,
// enemies and time of day from the seeded RNG only, fixes the camera, and lets
// the world run a fixed number of fixed steps. No wall-clock reads, no
// unseeded randomness — two runs with the same seed stage byte-identical frames.

export function stageShot(mode, world) {
  const S = world.S;
  const p = S.player;
  world.demoKeys = null;
  if (mode === 'cover') {
    // Police chase at dusk: 4 stars, helicopter, roadblocks, traffic, objective.
    S.clock = 18.2; S.day = 1;
    world.missions.startJob(6); // Job 7: Air Support
    const car = world.parked.find((c) => c.jobCar) || world.parked[0];
    world.enterCar(car, false);
    p.pos.set(0, 0, 120);
    car.pos.set(0, 0, 120);
    car.angle = Math.PI; // heading north (-z)
    car.speed = 24;
    p.angle = Math.PI;
    world.camYaw = Math.PI;
    world.demoKeys = ['w'];
    S.police.setWanted(4);
    // pre-place chasers close behind so the frame is full of police
    for (let i = 0; i < 3; i++) {
      const pc = S.police.spawnCar(0, 120 + 18 + i * 12);
      pc.speed = 26;
      pc.angle = Math.PI;
    }
    // traffic ahead in both lanes
    for (const t of S.traffic.cars.slice(0, 6)) {
      t.pos.set((Math.abs(Math.floor(t.pos.x)) % 7 - 3) * 14, 0, 120 - 40 - (Math.abs(Math.floor(t.pos.z)) % 30));
    }
    world.fixedCamera = { follow: true, off: [14, 7, 34], lookOff: [0, 2, -24] };
  } else if (mode === 'onfoot') {
    // Dana on foot among pedestrians and storefronts, noon.
    S.clock = 12.0; S.day = 1;
    world.missions.startJob(0);
    p.pos.set(8, 0, 36);
    p.angle = Math.PI * 0.9;
    p.mesh.position.copy(p.pos);
    S.combat.select(2); // pistol out, crosshair visible
    // gather pedestrians around the storefront
    S.peds.list.slice(0, 8).forEach((ped, i) => {
      ped.x = -14 + i * 4; ped.z = 44 - (i % 3) * 4; ped.waiting = false;
      ped.mesh.position.set(ped.x, 0, ped.z);
    });
    world.fixedCamera = { pos: [20, 5, 58], look: [0, 2, 34] };
  } else if (mode === 'driving') {
    // Driving the coupe toward the Helios Tower, noon, traffic + minimap.
    S.clock = 11.0; S.day = 1;
    world.missions.startJob(0);
    const car = world.parked.find((c) => c.type === 'coupe') || world.parked[0];
    world.enterCar(car, false);
    p.pos.set(-40, 0, -40);
    car.pos.set(-40, 0, -40);
    car.angle = Math.PI; // north toward the tower
    car.speed = 26;
    p.angle = Math.PI;
    world.camYaw = Math.PI;
    world.demoKeys = ['w'];
    for (const t of S.traffic.cars.slice(0, 5)) {
      t.pos.set(-40 + (Math.abs(Math.floor(t.pos.x)) % 20), 0, -40 - 30 - (Math.abs(Math.floor(t.pos.z)) % 40));
    }
    world.fixedCamera = { follow: true, off: [13, 6.5, 32], lookOff: [0, 2, -24] };
  } else if (mode === 'mission') {
    // Job 6 rooftop combat at dusk: enemies closing in, muzzle flash, tower behind.
    S.clock = 18.6; S.day = 1;
    world.missions.startJob(5); // Job 6: The Witness
    p.pos.set(112, 0, -100);
    p.angle = -Math.PI * 0.25;
    p.mesh.position.copy(p.pos);
    S.combat.giveWeapon(3, 90);
    S.combat.select(3); // SMG
    S.police.setWanted(2);
    S.combat.spawnEnemies(120, -120, 4, 'crew');
    // keep enemies OUTSIDE the rooftop building (south side, in the open)
    S.combat.enemies.forEach((e, i) => {
      e.x = 116 + i * 3; e.z = -104 + (i % 2) * 5;
      e.mesh.position.set(e.x, 0, e.z);
    });
    world.fixedCamera = { pos: [100, 6, -88], look: [118, 2, -106] };
  } else {
    // unknown shot: plain title-screen-free overview
    S.clock = 12.0;
    world.fixedCamera = { pos: [60, 30, 120], look: [0, 2, 0] };
  }
  // demo keys are consumed by the world step loop (see World.step).
}

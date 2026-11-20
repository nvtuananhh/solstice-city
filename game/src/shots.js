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
    // low helicopter, ending up SOUTH of the player (in the camera's view,
    // since the camera sits ahead of the chase looking back)
    S.police.heliAlt = 26;
    S.police.heliAngle = Math.PI / 2 - 2.2;
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
    // camera AHEAD of the chase, looking back south: the pickup faces the
    // camera, the police trail behind it, nothing occludes the player car.
    world.fixedCamera = { follow: true, off: [16, 7, -30], lookOff: [0, 2, 14] };
  } else if (mode === 'onfoot') {
    // Dana on foot among pedestrians and storefronts, noon.
    S.clock = 12.0; S.day = 1;
    world.missions.startJob(0);
    p.pos.set(5, 0, 36);
    p.angle = Math.PI * 0.9;
    p.mesh.position.copy(p.pos);
    S.combat.select(2); // pistol out, crosshair visible
    // gather pedestrians around the storefront
    S.peds.list.slice(0, 8).forEach((ped, i) => {
      ped.x = -4 + i * 3; ped.z = 42 - (i % 3) * 3; ped.waiting = false;
      ped.mesh.position.set(ped.x, 0, ped.z);
    });
    world.fixedCamera = { pos: [13, 3.2, 47], look: [5, 1.5, 35] };
  } else if (mode === 'driving') {
    // Driving the pickup toward the Helios Tower, noon, traffic + minimap.
    S.clock = 11.0; S.day = 1;
    world.missions.startJob(0);
    world.missions.stepIndex = 1; // objective: drive to the Heliostat Sea
    world.missions.updateMarker();
    const car = world.parked.find((c) => c.jobCar) || world.parked[0];
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
    world.fixedCamera = { follow: true, off: [9, 5.5, 24], lookOff: [0, 2, -18] };
  } else if (mode === 'mission') {
    // Job 6 rooftop combat at dusk: enemies closing in, muzzle flash, tower behind.
    S.clock = 18.6; S.day = 1;
    world.missions.startJob(5); // Job 6: The Witness
    p.pos.set(112, 0, -88);
    p.angle = -Math.PI * 0.25;
    p.mesh.position.copy(p.pos);
    S.combat.giveWeapon(3, 90);
    S.combat.select(3); // SMG
    // no wanted level here: police cars would drive onto the player and block
    // the frame; the crew + SMG + rooftop carry the combat shot.
    S.police.setWanted(0);
    S.combat.spawnEnemies(120, -120, 4, 'crew');
    // keep enemies OUTSIDE the rooftop building (south side, in the open)
    S.combat.enemies.forEach((e, i) => {
      e.x = 116 + i * 3; e.z = -92 + (i % 2) * 4;
      e.mesh.position.set(e.x, 0, e.z);
    });
    world.fixedCamera = { pos: [100, 5, -76], look: [114, 2, -92] };
  } else {
    // unknown shot: plain title-screen-free overview
    S.clock = 12.0;
    world.fixedCamera = { pos: [60, 30, 120], look: [0, 2, 0] };
  }
  // demo keys are consumed by the world step loop (see World.step).
}

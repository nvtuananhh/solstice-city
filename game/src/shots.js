// Deterministic screenshot staging for ?shot=<mode>&seed=1. Each mode sets up
// a real game state (real jobs, real police, real traffic), runs a fixed
// number of fixed steps, then overrides the camera (and, for the cover, the
// helicopter's hover spot) once — no more steps run after staging, so the
// frame is exactly reproducible from the seed.
import { STEP } from './world.js';

function setShotCam(g, px, py, pz, lx, ly, lz) {
  g.shotCam = { pos: [px, py, pz], look: [lx, ly, lz] };
}

function seatInPickup(g, x, z, heading) {
  const car = g.ownPickup;
  car.x = x; car.z = z; car.heading = heading;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = -heading;
  car.health = 100000; // staging: the chase must not wreck the hero car
  g.player.x = x; g.player.z = z; g.player.heading = heading;
  g.playerCar = car;
  g.playerMesh.visible = false;
  g.camYaw = heading;
}

export function stageShot(g, mode) {
  g.hud.hideTitle();
  g.screen = 'play';
  g.cash = 1250;
  g.respect = 42;

  if (mode === 'cover') {
    // Police chase on the open z=0 avenue: wanted 4 (helicopter + roadblocks),
    // job 5 objective, pickup large and central, no building in the sightline.
    seatInPickup(g, -100, 0, 0); // heading +x along the avenue
    g.missions.startJob(4);
    g.setWanted(4);
    g.clockMin = 780;
    for (let i = 0; i < 300; i++) g.step(STEP);
    // Helicopter hover spot, framed in the same shot as the car (ahead-left).
    if (g.police.heli) g.police.heli.mesh.position.set(-82, 13, -14);
    // A traffic car can brake to a stop right behind the player and block the
    // camera — shove any car near the player 45 m ahead along its own lane.
    for (const t of g.traffic.cars) {
      if (Math.hypot(t.x - g.player.x, t.z - g.player.z) < 15) {
        t.x += Math.cos(t.heading) * 45;
        t.z += -Math.sin(t.heading) * 45;
        t.mesh.position.set(t.x, 0, t.z);
      }
    }
    // A police car can ram right up to the lens and crowd the frame — push
    // any car that closed to within 8 m back out to ~16 m, still visibly
    // chasing but no longer swallowing the hero car.
    for (const c of g.police.cars) {
      const d = Math.hypot(c.x - g.player.x, c.z - g.player.z);
      if (d < 8 && d > 0.01) {
        const s = 16 / d;
        c.x = g.player.x + (c.x - g.player.x) * s;
        c.z = g.player.z + (c.z - g.player.z) * s;
        c.mesh.position.set(c.x, 0, c.z);
      }
    }
    g.city.hidePalmsNear(-108, 7, 20);
    // Camera close behind-right of the pickup, looking just past it, so the
    // car sits large and near-centre (it was bottom-left and small before).
    // Staging sits 20 m east of the old spot to keep the car out of the
    // tall building's shadow.
    setShotCam(g, -109, 2.6, 4.0, -88, 1.2, -3);
  } else if (mode === 'onfoot') {
    // Dana centred in her orange jacket, facing the camera, storefronts +
    // pedestrians behind her, crosshair off (fists selected, not aiming).
    g.missions.startJob(0);
    g.player.x = 30; g.player.z = 46; g.player.y = 0;
    g.player.heading = -Math.PI / 2; // facing south, toward the camera
    g.weapons.select(0);
    g.aiming = false;
    g.clockMin = 780;
    // Stage a few pedestrians on the plaza around her (behind/side of her,
    // never between her and the camera, so none blocks the shot).
    const spots = [[24, 40], [38, 40], [22, 44], [40, 44], [30, 36]];
    g.pedestrians.peds.slice(0, 5).forEach((p, i) => {
      p.x = spots[i][0]; p.z = spots[i][1];
      p.target = { x: spots[i][0] + 4, z: spots[i][1] + 2 };
      p.mesh.position.set(p.x, 0, p.z);
    });
    for (let i = 0; i < 120; i++) g.step(STEP);
    g.city.hidePalmsNear(30, 54, 18);
    // Camera closer and more level than before, so Dana fills the frame and
    // the empty plaza foreground shrinks.
    setShotCam(g, 32, 1.8, 50.5, 30, 1.5, 46);
  } else if (mode === 'driving') {
    // Player pickup large and near, Helios Tower detailed beside it, beacon
    // and antenna in frame (camera tilted up toward the tower).
    seatInPickup(g, 0, -96, Math.PI / 2 - 0.3); // heading -z, slightly toward the tower
    g.clockMin = 780;
    g.setWanted(0);
    for (let i = 0; i < 180; i++) g.step(STEP);
    g.city.hidePalmsNear(0, -88, 16);
    setShotCam(g, -2, 3.0, -85, 12, 12, -128);
  } else if (mode === 'mission') {
    // Job 6 "The Witness": Dana actually on the rooftop, roof combat live.
    // Camera from the west so Dana is central and no enemy blocks her.
    g.missions.startJob(5);
    g.missions.stageIndex = 2;
    g.missions._enterStage();
    g.putPlayerOnRoof();
    g.giveWeapon('pistol', 60);
    g.weapons.select(2);
    g.player.health = 100;
    g.missions._spawnWitness(26, -34);
    g.clockMin = 900; // late afternoon light on the roof
    for (let i = 0; i < 180; i++) g.step(STEP);
    setShotCam(g, 18, 19, -14, 30, 14.5, -30);
  } else {
    // Unknown mode: plain plaza view.
    for (let i = 0; i < 60; i++) g.step(STEP);
    setShotCam(g, 30, 6, 70, 30, 2, 30);
  }
  g.renderer.updateCamera(g);
  g.renderer.render();
  window.__shotReady = true;
}

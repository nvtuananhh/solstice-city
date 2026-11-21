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
    // Police chase: wanted 4 (helicopter + roadblocks), job 5 objective,
    // pickup large and central on the z=60 avenue, traffic around.
    seatInPickup(g, 0, 60, 0); // heading +x along the avenue
    g.missions.startJob(4);
    g.setWanted(4);
    g.clockMin = 780;
    for (let i = 0; i < 300; i++) g.step(STEP);
    // Helicopter hover spot, framed in the same shot as the car.
    if (g.police.heli) g.police.heli.mesh.position.set(24, 20, 44);
    setShotCam(g, -11, 3.6, 68, 3, 1.4, 59);
  } else if (mode === 'onfoot') {
    // Dana centred in her orange jacket, storefronts + pedestrians behind her,
    // crosshair off (fists selected, not aiming).
    g.missions.startJob(0);
    g.player.x = 30; g.player.z = 46; g.player.y = 0;
    g.player.heading = Math.PI / 2; // facing north, toward the camera
    g.weapons.select(0);
    g.aiming = false;
    g.clockMin = 780;
    // Stage a few pedestrians on the plaza around her.
    const spots = [[24, 40], [36, 42], [22, 50], [38, 50], [30, 36]];
    g.pedestrians.peds.slice(0, 5).forEach((p, i) => {
      p.x = spots[i][0]; p.z = spots[i][1];
      p.target = { x: spots[i][0] + 4, z: spots[i][1] + 2 };
      p.mesh.position.set(p.x, 0, p.z);
    });
    for (let i = 0; i < 120; i++) g.step(STEP);
    setShotCam(g, 30, 3.0, 58.5, 30, 1.6, 44);
  } else if (mode === 'driving') {
    // Player pickup large and near, Helios Tower detailed beside it.
    seatInPickup(g, 0, -96, Math.PI / 2 - 0.3); // heading -z, slightly toward the tower
    g.clockMin = 780;
    g.setWanted(0);
    for (let i = 0; i < 180; i++) g.step(STEP);
    setShotCam(g, -1.5, 3.4, -87.5, 8, 2.2, -118);
  } else if (mode === 'mission') {
    // Job 6 "The Witness": Dana actually on the rooftop, roof combat live.
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
    setShotCam(g, 44, 21, -16, 29, 14.5, -30);
  } else {
    // Unknown mode: plain plaza view.
    for (let i = 0; i < 60; i++) g.step(STEP);
    setShotCam(g, 30, 6, 70, 30, 2, 30);
  }
  g.renderer.updateCamera(g);
  g.renderer.render();
  window.__shotReady = true;
}

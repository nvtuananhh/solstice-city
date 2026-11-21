// Boot: build the world, show the title, run the fixed-step loop.
// ?shot=<mode>&seed=1 stages a deterministic frame instead of playing:
// the world advances a fixed number of fixed steps from the seed, then the
// frame is re-rendered every animation frame without stepping, so the shot
// is exactly reproducible.
import { World, STEP } from './world.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot');

const canvas = document.getElementById('game');
const world = new World(canvas, seed);
world.start();

if (shot) {
  stageShot(world, shot);
  const loop = () => {
    world.renderer.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
} else {
  let last = null;
  let acc = 0;
  const loop = (now) => {
    if (last === null) last = now; // rAF timestamp drives the loop; no wall clock in gameplay
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      world.step(STEP);
      acc -= STEP;
      n++;
    }
    if (n === 5) acc = 0;
    world.renderer.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

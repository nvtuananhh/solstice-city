# SOLSTICE CITY — design doc (round 15, written fresh 2026-11-20)

## Premise
Sun-baked desert metropolis built around a giant solar mirror field ("the Heliostat
Sea") and the Helios Tower. Dana Reyes, 27, solar-field courier. Her brother Theo
runs a struggling garage at the field's edge. A fixer, Vesper Kane, pulls her into
a 9-job chain ending in a Helios Tower vault heist with a mirror-field escape at dusk.

## Tech choices (my own)
- Three.js r149 UMD, vendored at game/vendor/three.min.js, global THREE. No modules
  for the engine; my own code is ES modules under game/src/.
- One shared mutable state object `S` created in main.js and handed to every system.
  Fixed timestep 1/60 sim, accumulator, render decoupled. All randomness from a
  mulberry32 RNG seeded from `?seed=` (default 1). No Math.random / Date.now /
  performance.now anywhere in gameplay, traffic, pedestrians, spawns, or shot staging.
  (The only clock reads are the render loop's rAF timestamp, used only to advance the
  fixed-step accumulator — sim state itself never reads wall time.)
- WebAudio synth only, created lazily on first user gesture; shot mode never creates it.
- HUD is DOM over the canvas; minimap is a 2D canvas. Menus are DOM.

## City layout (my own grid)
- 8x8 road grid, roads every 80 units from -280 to +280, road width 14. Blocks hold
  1-4 buildings each (seeded heights/colours, awnings, neon signs on Cactus Row).
- Landmarks: Helios Tower at (0,-360) north of the grid; mirror field east of x=340
  (rows of tilted mirror panels); water tower (120,200); Theo's garage (-240,200);
  chop shop (240,-200); truck yard (240,200); safehouse (-240,-200); corner store
  (40,40); rooftop platform building (120,-120) with a ramp.
- 10 districts named per block region; HUD shows current district from position.
- Colliders: one AABB list for buildings + landmarks; player and cars resolve by
  push-out on the XZ plane.

## Systems (one module each)
- config.js — constants, districts, 9 jobs, weapons, car types, prices.
- random.js — mulberry32 RNG + helpers.
- audio.js — synth engine hum, sirens, gunshots, footsteps, pickup chimes, 3 radio
  stations (desert rock / latin groove / talk bleeps), all WebAudio oscillators.
- input.js — keyboard + mouse-drag orbit, arrow keys rotate camera (testable).
- city.js — ground, roads, buildings, tower, mirrors, palms, cacti, streetlights,
  signs, colliders, landmark table.
- render.js — sky dome gradient, sun, hemisphere+directional light, fog, day cycle
  (noon -> amber dusk, streetlights on at dusk, tower beacon sweep).
- vehicles.js — box-built car meshes by type (pickup, sedan, coupe, truck, police),
  arcade car physics (accel/brake/steer/handbrake/nitro), damage smoke.
- traffic.js — 24 cars on road lanes, seeded turns at intersections, braking.
- pedestrians.js — 40 sidewalk walkers, crossing, scatter from gunfire, taxi flags.
- police.js — wanted 1-5, police car chase + PIT, foot police + arrest timer,
  helicopter at 4+ (searchlight), roadblocks at 3+, decay when hidden.
- combat.js — weapons (fists/bat/pistol/SMG), wheel UI (hold Q, keys 1-4), raycast
  shooting, muzzle flash, melee, enemies, health packs, pickups.
- missions.js — generic step engine: goto / drive-to / steal / lose-wanted /
  combat / survive / deliver. All 9 jobs defined as step lists; job 1 is the
  tutorial chain (meet Theo -> drive pickup to solar field).
- hud.js — health/cash/respect/stars/clock/objective/speedometer/ammo, minimap
  (player arrow, police blips, mission marker, shop/garage icons), title/pause/
  settings/busted/wasted menus, banners, toasts, garage + shop panels.
- save.js — localStorage save/load (mission, cash, respect, cars, position, shards).
- shots.js — deterministic staging for the 4 shots: fixed camera, fixed time of
  day, fixed spawns, then N fixed steps; exposes window.__shotReady.
- world.js — orchestrator: scene, camera, player (on-foot humanoid + car states),
  fixed-step loop, collisions, day clock, district lookup, wanted wiring.
- main.js — boot, URL params (?shot= &seed=), wires systems, test hooks on
  window.__game (teleport, setWanted, startJob, state snapshot).

## Screenshots (deterministic, ?shot=<mode>&seed=1)
1. cover — police chase: 4 stars, helicopter overhead, roadblock ahead, traffic,
   minimap + objective visible, dusk amber light.
2. onfoot — Dana on foot among pedestrians and storefronts, noon.
3. driving — driving the pickup toward Helios Tower, traffic, minimap, noon.
4. mission — job 6 rooftop combat / finale mirror-field escape at dusk, enemies +
   muzzle flash.

## Testing
- Playwright + chromium-1255, headless, served by node serve.ts. Playthrough:
  walk, steal parked car, steal NPC car, drive, 4-star chase (helicopter visible),
  weapon wheel open + switch, job 1 start + complete, save + load, pause + resume.
- Each shot rendered twice with seed=1, hashes compared (byte-identical).
- main.ts run with MAKEFUN_OUTPUT_DIR; gate limits checked (files, sizes,
  dossier bytes, index.html bytes, screenshot sizes).

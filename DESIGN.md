# SOLSTICE CITY — design doc (round 16, written fresh from the brief)

## Core idea
A sun-baked desert city built around the Helios Tower and a mirror field.
Dana Reyes, solar-field courier, is pulled by fixer Vesper Kane into a 9-job
chain ending in a vault heist at the tower with a mirror-field escape at dusk.
Third-person on foot + arcade driving, 5-star police, weapon wheel,
carjacking, garage upgrades, radio, respect, saves — all in Three.js, all
offline, all seeded-deterministic.

## Tech
- Three.js r149 UMD vendored at game/vendor/three.min.js (global THREE).
- Plain ES modules under game/src/, no build step, no network at run.
- Fixed timestep 1/60. All randomness from one seeded RNG (sfc32) created
  from `?seed=` (default 1). No Math.random / Date.now / performance.now in
  any gameplay, traffic, pedestrian, spawn or shot path. Sim clock is the
  only clock; wall time is used only to accumulate fixed steps.
- `window.__SC` debug handle for the test harness (warp, state, key inject,
  job start). Missions complete through real game checks only.

## World layout (units = metres, city ~ 600 x 600)
- Grid streets every 60 units, roads 10 wide, sidewalks 3 wide. Blocks hold
  1-4 buildings each (boxes with procedural canvas facades: windows, signs,
  awnings). 10 districts named in config.js; districtAt(x,z) maps position
  to a district index.
- Helios Tower at (0,-150): stepped base + shaft with panel-seam strips, lit
  beacon, antenna, platform. Mirror field east (x>180): rows of tilted
  reflective panels that glint (emissive pulse driven by sim time).
- Props: palms (cylinder + crossed planes), cacti (green capsules), street
  lights (pole + emissive head, on at dusk), water tower, truck yard,
  foundry (smokestacks), solar plant yard, garage (Theo's Auto) at (-120,120),
  safehouse, shops with invented names, 25 sun shards (glowing orbs).

## Actors
- Dana: box-built figure, bright orange jacket (no pedestrian wears orange),
  dark trousers, hair cap. Walk/run/jump, crouch, melee, aim+fire.
- Cars: box body + cabin + 4 cylinder wheels + headlights. Types: pickup
  (Dana's, rust orange), sedan, hatch, van, taxi, police, sports (Mira's),
  truck. Distinct speed / handling / colour per type. Damage smoke above a
  threshold; wrecked cars stay as obstacles.
- Traffic ~24 cars: lane following on the grid, intersection turns from the
  seeded RNG, brake for the car ahead and for the player. Pedestrians ~40:
  sidewalk strolls between seeded waypoints, scatter from gunfire/crashes,
  some are taxi customers (raised hand, icon).
- Police: car pool chases and rams (PIT nudge), foot police pursue and arrest
  (3 s close = busted screen, lose cash, respawn at station). Helicopter at
  wanted >= 4: hovers above player, searchlight cone. Roadblocks at wanted
  >= 3: two police cars parked across the avenue ahead. Wanted decays when
  the nearest police is far for a while; payoff at the safehouse.

## Systems
- Wanted 0-5 stars; crimes add stars (steal +1, assault +1, shooting +2,
  speeding past police +1). Stars drive police spawn count and helicopter.
- Combat: fists / bat / pistol / SMG (keys 1-4, hold Q wheel). Hitscan with
  seeded spread, muzzle flash sprite, hit reactions, health packs.
- District standing 0-5 per district: +standing from jobs/fares/races done
  there; effects: garage discount, bigger taxi tips, faster wanted decay.
  Shown on HUD minimap panel + pause screen.
- Crew: Mira joins after job 3. Key V calls her once per job: she drives a
  sports car to the player and the call also grants one wanted-level drop
  ("clean getaway") per job. HUD shows her status.
- Missions: data-driven chain of 9 jobs, each a stage list
  (goto / talk / enterCar / driveTo / steal / combat / protect / escape /
  deliver). Stage completion is checked by the mission engine every tick
  against real game state (proximity, kills, delivery). Payouts: cash +
  respect + standing in the district where the job finished.
- Side work: taxi fares, 3 street-race checkpoint circuits, corner-store
  robbery (escape timer), 25 sun shards, car deliveries.
- Garage: repair / repaint / engine / brakes / nitro, prices scaled by
  district standing; owned cars stored and selectable.
- Save/load: localStorage (progress, cash, cars, position, standing, crew).
- Audio: WebAudio synth only — engine hum (pitch by speed), sirens,
  gunshots, footsteps, chimes, 3 radio stations (sequenced synth loops).
  Guarded so a missing AudioContext never breaks the game.
- HUD: DOM overlay — health, cash, respect, stars, clock/day, objective
  banner, speedometer, ammo, weapon indicator, Mira status, district
  standing, minimap canvas (rotating, player arrow, police blips, mission
  marker, shop/garage icons). Title screen, pause menu, settings
  (volume, sensitivity, quality), busted/wasted screens.

## Screenshots (deterministic `?shot=<mode>&seed=1`)
- cover: police chase, player car large + central, wanted stars, minimap,
  objective, traffic, helicopter; no palm/building blocking >5% of frame.
- onfoot: Dana centred in orange jacket, crosshair aimed at empty street.
- driving: player pickup large/near, Helios Tower detailed beside it.
- mission: job 6 "The Witness", player actually on a rooftop, AC units,
  city below, title matches staging, no diagonal/floating geometry.
Each shot is rendered twice with seed=1 and hash-compared.

## Files (game/src/)
random, config, audio, input, save, standing, crew, city, vehicles,
traffic, pedestrians, police, combat, weapons, missions, hud, render,
world, shots, main. main.ts at repo root writes the dossier.
